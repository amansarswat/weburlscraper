/**
 * Scraper API routes.
 */

const express = require('express');
const config = require('../config');
const WebScraper = require('../utils/WebScraper');
const { validateScrapeRequest, validateBatchScrapeRequest, checkUrlShape } = require('../middleware/validator');
const { authenticate } = require('../middleware/auth');
const { createLimiter } = require('../lib/rateLimit');
const asyncHandler = require('../lib/asyncHandler');
const cache = require('../lib/cache');
const metrics = require('../lib/metrics');
const analytics = require('../lib/analytics');
const scrapeQueue = require('../lib/scrapeQueue');
const { MODES } = require('../utils/extractors');
const renderer = require('../utils/renderer');
const { ValidationError, AppError } = require('../lib/errors');

const router = express.Router();
const scraper = new WebScraper();

const scraperLimiter = createLimiter({
    max: config.rateLimit.scraper,
    prefix: 'rl:scrape:',
    message: 'Too many scraping requests. Please try again later.',
});

/** Best-effort hostname extraction for queue grouping + analytics. */
function domainOf(rawUrl) {
    try {
        const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
        return new URL(withScheme).hostname.toLowerCase();
    } catch {
        return '_';
    }
}

/** Run a scrape through the queue, with caching, metrics and analytics. */
async function runScrape(url, options, ctx = {}) {
    const rendered = options.render === true;
    const mode = options.mode || 'headings-paragraphs';
    const domain = domainOf(url);
    const key = cache.makeKey({ url, mode, selector: options.selector, render: rendered });
    const t0 = Date.now();

    const cachedData = await cache.get(key);
    if (cachedData) {
        metrics.cacheHits.inc();
        analytics.record({
            mode, domain, rendered, cached: true, success: true,
            durationMs: Date.now() - t0, bytes: cachedData.metadata?.contentLength || 0, apiKeyId: ctx.apiKeyId,
        });
        return { data: cachedData, cached: true };
    }

    const stop = metrics.scrapeDuration.startTimer({ mode, rendered: String(rendered) });
    try {
        // Per-domain + global concurrency throttling happens here.
        const data = await scrapeQueue.run(domain, () => scraper.scrape(url, options));
        stop();
        metrics.scrapeTotal.inc({ mode: data.metadata.mode, rendered: String(rendered), outcome: 'success' });
        await cache.set(key, data);
        analytics.record({
            mode: data.metadata.mode, domain, rendered, cached: false, success: true,
            durationMs: Date.now() - t0, bytes: data.metadata.contentLength || 0, apiKeyId: ctx.apiKeyId,
        });
        return { data, cached: false };
    } catch (err) {
        stop();
        metrics.scrapeTotal.inc({ mode, rendered: String(rendered), outcome: 'error' });
        analytics.record({
            mode, domain, rendered, cached: false, success: false,
            errorCode: err.code || 'FETCH_FAILED', durationMs: Date.now() - t0, apiKeyId: ctx.apiKeyId,
        });
        throw err;
    }
}

/**
 * POST /api/scrape — scrape a single URL.
 */
router.post(
    '/scrape',
    authenticate,
    scraperLimiter,
    validateScrapeRequest,
    asyncHandler(async (req, res) => {
        const startTime = Date.now();
        const { url, mode = 'headings-paragraphs', options = {}, render = false } = req.body;

        req.log?.info({ url, mode, render }, 'scrape:start');
        const { data, cached } = await runScrape(url, { mode, render, ...options }, { apiKeyId: req.apiKey });

        res.status(200).json({
            success: true,
            message: 'Content scraped successfully',
            data,
            cached,
            performance: { duration: Date.now() - startTime, itemsExtracted: data.content.length },
        });
    })
);

/**
 * POST /api/scrape/batch — scrape multiple URLs (bounded, in parallel; the queue
 * still throttles actual concurrency and per-domain politeness).
 */
router.post(
    '/scrape/batch',
    authenticate,
    scraperLimiter,
    validateBatchScrapeRequest,
    asyncHandler(async (req, res) => {
        const startTime = Date.now();
        const { urls, mode = 'headings-paragraphs', options = {}, render = false } = req.body;

        req.log?.info({ count: urls.length, mode, render }, 'batch:start');

        const settled = await Promise.allSettled(
            urls.map((url) => runScrape(url, { mode, render, ...options }, { apiKeyId: req.apiKey }))
        );

        const results = settled.map((r, i) => {
            if (r.status === 'fulfilled') {
                return { url: urls[i], success: true, cached: r.value.cached, data: r.value.data, error: null };
            }
            return {
                url: urls[i],
                success: false,
                data: null,
                error: r.reason?.expose ? r.reason.message : r.reason?.message || 'Scrape failed',
                code: r.reason?.code || 'FETCH_FAILED',
            };
        });

        const successCount = results.filter((r) => r.success).length;
        res.status(200).json({
            success: true,
            message: `Batch scraping completed: ${successCount}/${urls.length} successful`,
            data: results,
            performance: {
                duration: Date.now() - startTime,
                totalUrls: urls.length,
                successfulUrls: successCount,
                failedUrls: urls.length - successCount,
            },
        });
    })
);

/** Shared handler for screenshot/pdf capture endpoints. */
function captureHandler(kind) {
    return asyncHandler(async (req, res) => {
        const { url, encoding = 'base64' } = req.body || {};
        const shape = checkUrlShape(url);
        if (!shape.valid) throw new ValidationError(shape.error, 'url');
        if (!renderer.isAvailable() || !config.render.enabled) {
            throw new AppError('Rendering is unavailable on this server', 501, 'RENDER_UNAVAILABLE');
        }

        const domain = domainOf(url);
        const t0 = Date.now();
        const opts = { allowPrivate: config.scraper.allowPrivateAddresses, ...req.body };

        const result = await scrapeQueue.run(domain, () => (kind === 'pdf' ? renderer.pdf(url, opts) : renderer.screenshot(url, opts)));

        analytics.record({
            mode: kind, domain, rendered: true, cached: false, success: true,
            durationMs: Date.now() - t0, bytes: (result.image || result.pdf).length, apiKeyId: req.apiKey,
        });

        const buffer = result.image || result.pdf;
        const contentType = kind === 'pdf' ? 'application/pdf' : `image/${result.type}`;

        if (encoding === 'binary') {
            res.set('Content-Type', contentType);
            return res.send(buffer);
        }
        return res.json({
            success: true,
            data: {
                [kind === 'pdf' ? 'pdf' : 'image']: buffer.toString('base64'),
                encoding: 'base64',
                contentType,
                finalUrl: result.finalUrl,
                bytes: buffer.length,
            },
            performance: { duration: Date.now() - t0 },
        });
    });
}

/** POST /api/screenshot — capture a PNG/JPEG screenshot (requires rendering). */
router.post('/screenshot', authenticate, scraperLimiter, captureHandler('screenshot'));

/** POST /api/pdf — render a URL to PDF (requires rendering). */
router.post('/pdf', authenticate, scraperLimiter, captureHandler('pdf'));

/** GET /api/modes — list available scraping modes. */
router.get('/modes', (req, res) => {
    res.json({
        success: true,
        data: {
            modes: MODES,
            renderingAvailable: renderer.isAvailable() && config.render.enabled,
            outputs: ['content', 'screenshot', 'pdf'],
        },
    });
});

/** GET /api/usage — usage analytics summary + live queue stats (auth-protected). */
router.get('/usage', authenticate, (req, res) => {
    res.json({ success: true, data: { ...analytics.summary(), queue: scrapeQueue.stats() } });
});

module.exports = router;
