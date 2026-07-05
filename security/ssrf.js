/**
 * SSRF protection.
 *
 * The original implementation only string-matched the hostname against a list
 * of private-IP regexes. That is bypassable three ways:
 *   1. A public domain whose DNS points at a private/loopback/metadata IP.
 *   2. A public URL that HTTP-redirects into the internal network.
 *   3. DNS rebinding: resolve to a public IP for the check, a private IP for
 *      the actual connection (a time-of-check/time-of-use gap).
 *
 * This module closes all three:
 *   - Every hostname is resolved via DNS and *all* resolved IPs must be public
 *     (checked with ipaddr.js, which understands loopback, private, link-local,
 *     unique-local, CGNAT, reserved, and IPv4-mapped IPv6 ranges).
 *   - Redirects are followed manually, re-validating each hop.
 *   - The socket is pinned to the exact IP we validated via a custom DNS lookup
 *     on the HTTP agent, so the connection cannot be rebound to a different IP.
 */

const dns = require('dns');
const http = require('http');
const https = require('https');
const { promisify } = require('util');
const ipaddr = require('ipaddr.js');
const axios = require('axios');
const { BlockedError, FetchError, ValidationError } = require('../lib/errors');

const dnsLookupAll = promisify(dns.lookup);

/**
 * Normalize a raw URL string: prepend https:// when no scheme is present, then
 * parse and enforce the http/https allowlist.
 * @param {string} raw
 * @returns {URL}
 */
function normalizeAndParse(raw) {
    if (!raw || typeof raw !== 'string') {
        throw new ValidationError('URL is required and must be a string', 'url');
    }
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
    let url;
    try {
        url = new URL(withScheme);
    } catch {
        throw new ValidationError('Invalid URL format', 'url');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new BlockedError('Only http and https protocols are allowed', 'PROTOCOL_BLOCKED');
    }
    return url;
}

/**
 * Determine whether an IP literal is a globally-routable (public) address.
 * @param {string} ip
 * @returns {boolean}
 */
function isPublicIp(ip) {
    let addr;
    try {
        addr = ipaddr.parse(ip);
    } catch {
        return false;
    }
    if (addr.kind() === 'ipv6') {
        // Unwrap IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1) and judge the IPv4.
        if (addr.isIPv4MappedAddress()) {
            addr = addr.toIPv4Address();
        }
    }
    // Only ordinary global unicast is allowed. Everything else — loopback,
    // private, linkLocal, uniqueLocal, carrierGratNat, reserved, multicast,
    // teredo, 6to4, etc. — is rejected.
    return addr.range() === 'unicast';
}

/**
 * Resolve a hostname to a validated public IP address.
 *
 * Requires *every* resolved address to be public so an attacker cannot smuggle
 * a private IP alongside a public one. Returns the address to pin the socket to.
 *
 * @param {string} hostname
 * @param {boolean} allowPrivate  Bypass checks (self-hosted/internal use only).
 * @returns {Promise<{address: string, family: number}>}
 */
async function resolveToPublicIp(hostname, allowPrivate) {
    const lower = hostname.toLowerCase();

    // Literal IP: validate directly, no DNS needed.
    if (ipaddr.isValid(hostname)) {
        if (!allowPrivate && !isPublicIp(hostname)) {
            throw new BlockedError('Access to non-public IP addresses is not allowed', 'PRIVATE_IP_BLOCKED');
        }
        const family = ipaddr.parse(hostname).kind() === 'ipv6' ? 6 : 4;
        return { address: hostname, family };
    }

    if (!allowPrivate && (lower === 'localhost' || lower.endsWith('.localhost'))) {
        throw new BlockedError('Access to localhost is not allowed', 'PRIVATE_IP_BLOCKED');
    }

    let records;
    try {
        records = await dnsLookupAll(hostname, { all: true });
    } catch {
        throw new FetchError(`Could not resolve host: ${hostname}`, 'DNS_FAILED');
    }
    if (!records || records.length === 0) {
        throw new FetchError(`Could not resolve host: ${hostname}`, 'DNS_FAILED');
    }

    if (!allowPrivate) {
        for (const rec of records) {
            if (!isPublicIp(rec.address)) {
                throw new BlockedError(
                    'Host resolves to a non-public IP address; access is not allowed',
                    'PRIVATE_IP_BLOCKED'
                );
            }
        }
    }

    return { address: records[0].address, family: records[0].family };
}

/**
 * Build a dns.lookup-compatible function that always returns a fixed IP, so the
 * HTTP agent connects to exactly the address we validated (defeats rebinding).
 * TLS SNI and certificate verification still use the original hostname.
 */
function pinnedLookup(address, family) {
    return (_hostname, options, callback) => {
        // Node may call with (hostname, callback) or (hostname, options, callback).
        const cb = typeof options === 'function' ? options : callback;
        const wantsAll = typeof options === 'object' && options && options.all;
        if (wantsAll) {
            return cb(null, [{ address, family }]);
        }
        return cb(null, address, family);
    };
}

/** Transient network conditions worth retrying (not DNS/SSRF/HTTP-status errors). */
const RETRYABLE_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'EPIPE', 'EAI_AGAIN', 'ECONNREFUSED']);

function isRetryable(err) {
    return RETRYABLE_CODES.has(err.code) || (err.response && err.response.status >= 500);
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Perform a single validated GET (with connection pinned to a checked IP).
 * @returns {Promise<import('axios').AxiosResponse>}
 */
async function pinnedGet(current, { timeout, maxContentLength, headers, allowPrivate }) {
    const { address, family } = await resolveToPublicIp(current.hostname, allowPrivate);
    const isHttps = current.protocol === 'https:';
    const AgentClass = isHttps ? https.Agent : http.Agent;
    const agent = new AgentClass({ lookup: pinnedLookup(address, family), keepAlive: false });
    try {
        return await axios.get(current.href, {
            timeout,
            maxContentLength,
            maxBodyLength: maxContentLength,
            maxRedirects: 0, // handled manually by safeFetch
            responseType: 'text',
            decompress: true,
            httpAgent: isHttps ? undefined : agent,
            httpsAgent: isHttps ? agent : undefined,
            headers,
            validateStatus: (status) => status < 400, // accept 3xx to inspect Location
        });
    } finally {
        agent.destroy();
    }
}

/**
 * Fetch a URL with full SSRF protection, manual re-validated redirects, and
 * retries on transient network errors only.
 *
 * @param {string} rawUrl
 * @param {object} opts
 * @param {number} opts.timeout
 * @param {number} opts.maxContentLength
 * @param {number} opts.maxRedirects
 * @param {number} opts.retries  Extra attempts on transient failures.
 * @param {object} opts.headers
 * @param {boolean} opts.allowPrivate
 * @returns {Promise<{data: string, finalUrl: string, status: number, contentType: string}>}
 */
async function safeFetch(rawUrl, opts = {}) {
    const {
        timeout = 10000,
        maxContentLength = 2 * 1024 * 1024,
        maxRedirects = 5,
        retries = 0,
        headers = {},
        allowPrivate = false,
    } = opts;

    let current = normalizeAndParse(rawUrl);
    let redirects = 0;

    // Loop, following redirects ourselves so each hop is re-validated.
    // eslint-disable-next-line no-constant-condition
    while (true) {
        let response;
        let attempt = 0;
        // Retry only the current hop, only for transient errors.
        // eslint-disable-next-line no-constant-condition
        while (true) {
            try {
                response = await pinnedGet(current, { timeout, maxContentLength, headers, allowPrivate });
                break;
            } catch (err) {
                // SSRF/validation failures must never be retried or masked.
                if (err instanceof BlockedError || err instanceof ValidationError) throw err;
                if (attempt < retries && isRetryable(err)) {
                    attempt += 1;
                    await delay(500 * attempt); // linear backoff
                    continue;
                }
                if (err instanceof FetchError) throw err;
                const status = err.response ? ` (HTTP ${err.response.status})` : '';
                throw new FetchError(`Failed to fetch: ${err.message}${status}`, 'FETCH_FAILED');
            }
        }

        // Redirect: validate the next hop and continue.
        if (response.status >= 300 && response.status < 400 && response.headers.location) {
            redirects += 1;
            if (redirects > maxRedirects) {
                throw new FetchError(`Too many redirects (> ${maxRedirects})`, 'TOO_MANY_REDIRECTS');
            }
            let next;
            try {
                next = new URL(response.headers.location, current);
            } catch {
                throw new FetchError('Invalid redirect location', 'BAD_REDIRECT');
            }
            current = normalizeAndParse(next.href);
            continue;
        }

        return {
            data: response.data,
            finalUrl: current.href,
            status: response.status,
            contentType: response.headers['content-type'] || '',
        };
    }
}

module.exports = {
    normalizeAndParse,
    isPublicIp,
    resolveToPublicIp,
    safeFetch,
};
