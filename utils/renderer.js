/**
 * JavaScript rendering via Playwright (Chromium).
 *
 * Playwright is an OPTIONAL dependency and is loaded lazily — the base install
 * and all static scraping work without it. Rendering only requires the browser
 * when a request explicitly opts in with `render: true`.
 *
 * Design notes:
 *   - A single browser instance is shared across requests and launched on first
 *     use; pages are created/destroyed per request.
 *   - A semaphore caps concurrent renders (each page costs real memory/CPU).
 *   - SSRF: the target host is validated before navigation, and a request
 *     interceptor aborts sub-requests to literal private/loopback hosts.
 */

const config = require('../config');
const { resolveToPublicIp, normalizeAndParse, isPublicIp } = require('../security/ssrf');
const { AppError, FetchError } = require('../lib/errors');
const ipaddr = require('ipaddr.js');

let playwright = null;
let browserPromise = null;

/** Lazily require Playwright, with a helpful error if it isn't installed. */
function loadPlaywright() {
    if (playwright) return playwright;
    try {
        // eslint-disable-next-line global-require
        playwright = require('playwright');
    } catch {
        throw new AppError(
            'JS rendering requires Playwright. Install it with `npm install playwright && npx playwright install chromium`.',
            501,
            'RENDER_UNAVAILABLE'
        );
    }
    return playwright;
}

/** Launch (once) and return the shared Chromium browser. */
async function getBrowser() {
    if (!browserPromise) {
        const pw = loadPlaywright();
        browserPromise = pw.chromium
            .launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] })
            .catch((err) => {
                browserPromise = null; // allow retry on next call
                throw new AppError(
                    `Failed to launch browser: ${err.message}. Did you run \`npx playwright install chromium\`?`,
                    501,
                    'RENDER_UNAVAILABLE'
                );
            });
    }
    return browserPromise;
}

// --- Simple concurrency semaphore ---------------------------------------
let active = 0;
const waiters = [];

function acquire() {
    if (active < config.render.maxConcurrency) {
        active += 1;
        return Promise.resolve();
    }
    return new Promise((resolve) => waiters.push(resolve));
}

function release() {
    active -= 1;
    const next = waiters.shift();
    if (next) {
        active += 1;
        next();
    }
}

/** True if a request URL points at a literal private/loopback host. */
function isPrivateRequestTarget(reqUrl) {
    try {
        const { hostname } = new URL(reqUrl);
        const lower = hostname.toLowerCase();
        if (lower === 'localhost' || lower.endsWith('.localhost')) return true;
        if (ipaddr.isValid(hostname) && !isPublicIp(hostname)) return true;
    } catch {
        /* ignore malformed */
    }
    return false;
}

/**
 * Open a page, navigate (with SSRF guards + concurrency limit), run `action`,
 * and always clean up. Shared by render(), screenshot() and pdf().
 * @param {string} rawUrl
 * @param {object} opts
 * @param {(page: import('playwright').Page, url: URL) => Promise<any>} action
 */
async function withPage(rawUrl, opts, action) {
    if (!config.render.enabled) {
        throw new AppError('JS rendering is disabled on this server', 501, 'RENDER_DISABLED');
    }

    const url = normalizeAndParse(rawUrl);
    const allowPrivate = opts.allowPrivate ?? config.scraper.allowPrivateAddresses;
    // Pre-validate the target host (throws BlockedError/FetchError on failure).
    await resolveToPublicIp(url.hostname, allowPrivate);

    const timeout = opts.timeout || config.render.timeout;
    const waitUntil = opts.waitUntil || config.render.waitUntil;

    await acquire();
    const browser = await getBrowser();
    const context = await browser.newContext({
        userAgent: opts.userAgent || config.scraper.userAgent,
        ignoreHTTPSErrors: false,
        viewport: opts.viewport || undefined,
    });

    try {
        const page = await context.newPage();

        // Block sub-requests to private/loopback hosts unless explicitly allowed.
        if (!allowPrivate) {
            await page.route('**/*', (route) => {
                if (isPrivateRequestTarget(route.request().url())) {
                    return route.abort();
                }
                return route.continue();
            });
        }

        const response = await page.goto(url.href, { timeout, waitUntil });
        if (response && response.status() >= 400) {
            throw new FetchError(`Rendered page returned HTTP ${response.status()}`, 'RENDER_HTTP_ERROR');
        }

        return await action(page, url);
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new FetchError(`Rendering failed: ${err.message}`, 'RENDER_FAILED');
    } finally {
        await context.close().catch(() => {});
        release();
    }
}

/**
 * Render a URL and return the fully-populated HTML.
 * @returns {Promise<{html: string, finalUrl: string}>}
 */
async function render(rawUrl, opts = {}) {
    return withPage(rawUrl, opts, async (page) => ({
        html: await page.content(),
        finalUrl: page.url(),
    }));
}

/**
 * Capture a screenshot of a URL.
 * @returns {Promise<{image: Buffer, type: string, finalUrl: string}>}
 */
async function screenshot(rawUrl, opts = {}) {
    const cfg = config.render.screenshot;
    const type = opts.type || cfg.type;
    const fullPage = opts.fullPage ?? cfg.fullPage;
    const viewport = {
        width: Math.min(opts.width || cfg.maxWidth, 3840),
        height: Math.min(opts.height || cfg.maxHeight, 3840),
    };

    return withPage(rawUrl, { ...opts, viewport }, async (page) => {
        const shotOpts = { fullPage, type };
        if (type === 'jpeg') shotOpts.quality = opts.quality || cfg.quality;
        const image = await page.screenshot(shotOpts);
        return { image, type, finalUrl: page.url() };
    });
}

/**
 * Render a URL to PDF (headless Chromium only).
 * @returns {Promise<{pdf: Buffer, finalUrl: string}>}
 */
async function pdf(rawUrl, opts = {}) {
    const cfg = config.render.pdf;
    return withPage(rawUrl, opts, async (page) => {
        const buf = await page.pdf({
            format: opts.format || cfg.format,
            landscape: opts.landscape ?? cfg.landscape,
            printBackground: opts.printBackground ?? cfg.printBackground,
        });
        return { pdf: buf, finalUrl: page.url() };
    });
}

/** Close the shared browser (called on graceful shutdown). */
async function close() {
    if (browserPromise) {
        try {
            const browser = await browserPromise;
            await browser.close();
        } catch {
            /* ignore */
        } finally {
            browserPromise = null;
        }
    }
}

/** Whether Playwright is installed (used by health/feature reporting). */
function isAvailable() {
    try {
        require.resolve('playwright');
        return true;
    } catch {
        return false;
    }
}

module.exports = { render, screenshot, pdf, close, isAvailable };
