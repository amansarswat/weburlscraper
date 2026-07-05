/**
 * WebScraper — orchestrates fetch (static or rendered) + extraction.
 *
 * Security-critical URL handling (SSRF, redirects, IP pinning) lives in
 * security/ssrf.js; this class focuses on turning a fetched document into
 * structured content. It intentionally does NOT swallow errors — it throws
 * typed AppErrors so the route/error-handler layer can respond consistently.
 */

const cheerio = require('cheerio');
const config = require('../config');
const extractors = require('./extractors');
const { safeFetch } = require('../security/ssrf');
const robots = require('../security/robots');
const renderer = require('./renderer');
const { FetchError } = require('../lib/errors');

class WebScraper {
    constructor(options = {}) {
        this.timeout = options.timeout ?? config.scraper.timeout;
        this.userAgent = options.userAgent ?? config.scraper.userAgent;
        this.maxContentLength = options.maxContentLength ?? config.scraper.maxContentLength;
        this.maxRedirects = options.maxRedirects ?? config.scraper.maxRedirects;
        this.retries = options.retries ?? config.scraper.retries;
        this.allowPrivate = options.allowPrivate ?? config.scraper.allowPrivateAddresses;
    }

    /** Default request headers for static fetches. */
    buildHeaders() {
        return {
            'User-Agent': this.userAgent,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
        };
    }

    /**
     * Scrape a URL and return structured content.
     * @param {string} url
     * @param {object} options  { mode, selector, render, waitUntil }
     * @returns {Promise<object>} scrape result (throws typed AppError on failure)
     */
    async scrape(url, options = {}) {
        const mode = options.mode || 'headings-paragraphs';
        const shouldRender = options.render === true;

        // robots.txt gate (no-op unless RESPECT_ROBOTS is enabled). Uses the raw
        // URL's origin; safeFetch/renderer normalize the scheme themselves.
        await robots.assertAllowed(/^[a-z]+:\/\//i.test(url) ? url : `https://${url}`, this.userAgent);

        let html;
        let finalUrl;
        let rendered = false;

        if (shouldRender) {
            const result = await renderer.render(url, {
                timeout: options.timeout,
                waitUntil: options.waitUntil,
                userAgent: this.userAgent,
                allowPrivate: this.allowPrivate,
            });
            html = result.html;
            finalUrl = result.finalUrl;
            rendered = true;
        } else {
            const result = await safeFetch(url, {
                timeout: this.timeout,
                maxContentLength: this.maxContentLength,
                maxRedirects: this.maxRedirects,
                retries: this.retries,
                headers: this.buildHeaders(),
                allowPrivate: this.allowPrivate,
            });
            html = result.data;
            finalUrl = result.finalUrl;

            if (typeof html !== 'string') {
                throw new FetchError('Response body was not text/HTML', 'NOT_HTML');
            }
        }

        const $ = cheerio.load(html);
        const content = extractors.extract($, mode, options);

        return {
            url: finalUrl,
            requestedUrl: url,
            title: extractors.extractTitle($),
            description: extractors.extractDescription($),
            content,
            metadata: {
                totalItems: content.length,
                scrapedAt: new Date().toISOString(),
                mode,
                rendered,
                contentLength: html.length,
            },
        };
    }
}

module.exports = WebScraper;
