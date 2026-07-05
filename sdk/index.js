/**
 * URL Scraper API — official JavaScript/TypeScript client.
 *
 * Isomorphic: uses the global `fetch` (Node.js >= 18 and modern browsers), so it
 * has zero runtime dependencies. Type declarations live in index.d.ts.
 *
 * @example
 *   const { UrlScraperClient } = require('url-scraper-api/sdk');
 *   const client = new UrlScraperClient({ baseUrl: 'http://localhost:3000', apiKey: 'secret' });
 *   const { data } = await client.scrape('https://example.com', { mode: 'articles' });
 */

/** Error thrown for non-2xx API responses; carries the server's code + status. */
class ScraperApiError extends Error {
    constructor(message, { status, code, field, response } = {}) {
        super(message);
        this.name = 'ScraperApiError';
        this.status = status;
        this.code = code;
        this.field = field;
        this.response = response;
    }
}

class UrlScraperClient {
    /**
     * @param {object} [opts]
     * @param {string} [opts.baseUrl='http://localhost:3000']
     * @param {string} [opts.apiKey]  Sent as `x-api-key`.
     * @param {number} [opts.timeout=60000]  Per-request timeout (ms).
     * @param {typeof fetch} [opts.fetch]  Custom fetch implementation.
     * @param {Record<string,string>} [opts.headers]  Extra default headers.
     */
    constructor(opts = {}) {
        this.baseUrl = (opts.baseUrl || 'http://localhost:3000').replace(/\/+$/, '');
        this.apiKey = opts.apiKey || null;
        this.timeout = opts.timeout ?? 60000;
        this.headers = opts.headers || {};
        this._fetch = opts.fetch || globalThis.fetch;
        if (typeof this._fetch !== 'function') {
            throw new Error('No fetch implementation available. Use Node.js >= 18 or pass { fetch }.');
        }
    }

    /** Low-level request helper. */
    async _request(method, path, body, { raw = false, accept } = {}) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeout);
        const headers = { ...this.headers };
        if (this.apiKey) headers['x-api-key'] = this.apiKey;
        if (body !== undefined) headers['content-type'] = 'application/json';
        if (accept) headers.accept = accept;

        let res;
        try {
            res = await this._fetch(`${this.baseUrl}${path}`, {
                method,
                headers,
                body: body !== undefined ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });
        } catch (err) {
            clearTimeout(timer);
            if (err.name === 'AbortError') {
                throw new ScraperApiError(`Request timed out after ${this.timeout}ms`, { code: 'CLIENT_TIMEOUT' });
            }
            throw new ScraperApiError(`Network error: ${err.message}`, { code: 'CLIENT_NETWORK_ERROR' });
        }
        clearTimeout(timer);

        if (raw) {
            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}));
                throw new ScraperApiError(errBody.error || `HTTP ${res.status}`, {
                    status: res.status, code: errBody.code, field: errBody.field, response: errBody,
                });
            }
            return Buffer.from(await res.arrayBuffer());
        }

        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.success === false) {
            throw new ScraperApiError(json.error || `HTTP ${res.status}`, {
                status: res.status, code: json.code, field: json.field, response: json,
            });
        }
        return json;
    }

    /**
     * Scrape a single URL.
     * @param {string} url
     * @param {object} [options]  { mode, render, options: { selector } }
     */
    scrape(url, options = {}) {
        const { mode, render, options: modeOptions, ...rest } = options;
        return this._request('POST', '/api/scrape', { url, mode, render, options: modeOptions, ...rest });
    }

    /** Scrape multiple URLs (server caps the count). */
    scrapeBatch(urls, options = {}) {
        const { mode, render, options: modeOptions } = options;
        return this._request('POST', '/api/scrape/batch', { urls, mode, render, options: modeOptions });
    }

    /**
     * Capture a screenshot.
     * @param {string} url
     * @param {object} [options]  { fullPage, type, quality, width, height, binary }
     * @returns {Promise<Buffer|object>}  Buffer when binary:true, else JSON with base64.
     */
    screenshot(url, options = {}) {
        const { binary, ...rest } = options;
        if (binary) {
            return this._request('POST', '/api/screenshot', { url, encoding: 'binary', ...rest }, { raw: true, accept: 'image/png' });
        }
        return this._request('POST', '/api/screenshot', { url, ...rest });
    }

    /**
     * Render a URL to PDF.
     * @returns {Promise<Buffer|object>}  Buffer when binary:true, else JSON with base64.
     */
    pdf(url, options = {}) {
        const { binary, ...rest } = options;
        if (binary) {
            return this._request('POST', '/api/pdf', { url, encoding: 'binary', ...rest }, { raw: true, accept: 'application/pdf' });
        }
        return this._request('POST', '/api/pdf', { url, ...rest });
    }

    /** List available extraction modes and capabilities. */
    getModes() {
        return this._request('GET', '/api/modes');
    }

    /** Usage analytics summary (requires an API key when auth is enabled). */
    getUsage() {
        return this._request('GET', '/api/usage');
    }

    /** Health check. */
    health(detailed = false) {
        return this._request('GET', detailed ? '/health/detailed' : '/health');
    }
}

module.exports = { UrlScraperClient, ScraperApiError };
