/**
 * robots.txt compliance.
 *
 * When RESPECT_ROBOTS is enabled, we fetch and cache each origin's robots.txt
 * and refuse to scrape paths disallowed for our user agent. This is an ethical
 * (and in some jurisdictions legal) safeguard for a scraping product.
 *
 * The robots.txt fetch itself goes through the SSRF-safe fetcher.
 */

const robotsParser = require('robots-parser');
const { LRUCache } = require('lru-cache');
const config = require('../config');
const logger = require('../lib/logger');
const { safeFetch } = require('./ssrf');
const { BlockedError } = require('../lib/errors');

const cache = new LRUCache({ max: 200, ttl: config.robots.cacheTtlMs });

/** Fetch and parse robots.txt for an origin, caching the parser. */
async function getRobots(origin, userAgent) {
    const cached = cache.get(origin);
    if (cached) return cached;

    const robotsUrl = `${origin}/robots.txt`;
    let parser;
    try {
        const { data } = await safeFetch(robotsUrl, {
            timeout: config.scraper.timeout,
            maxContentLength: 512 * 1024,
            maxRedirects: config.scraper.maxRedirects,
            headers: { 'User-Agent': userAgent, Accept: 'text/plain,*/*' },
            allowPrivate: config.scraper.allowPrivateAddresses,
        });
        parser = robotsParser(robotsUrl, data);
    } catch (err) {
        // If robots.txt is unreachable/missing, the convention is to allow.
        logger.debug({ origin, err: err.message }, 'robots.txt unavailable; allowing by default');
        parser = robotsParser(robotsUrl, '');
    }

    cache.set(origin, parser);
    return parser;
}

/**
 * Throw a BlockedError if scraping `targetUrl` is disallowed by robots.txt.
 * No-op when RESPECT_ROBOTS is disabled.
 * @param {string} targetUrl  A fully-qualified http(s) URL.
 * @param {string} userAgent
 */
async function assertAllowed(targetUrl, userAgent) {
    if (!config.robots.respect) return;

    let origin;
    try {
        origin = new URL(targetUrl).origin;
    } catch {
        return; // malformed URLs are caught elsewhere
    }

    const parser = await getRobots(origin, userAgent);
    const allowed = parser.isAllowed(targetUrl, userAgent);
    // robots-parser returns undefined when there is no matching rule => allowed.
    if (allowed === false) {
        throw new BlockedError('Scraping this URL is disallowed by the site\'s robots.txt', 'ROBOTS_DISALLOWED');
    }
}

module.exports = { assertAllowed, _cache: cache };
