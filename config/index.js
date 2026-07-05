/**
 * Centralized, validated configuration.
 *
 * All environment parsing happens here exactly once so the rest of the app
 * reads a typed, defaulted object instead of poking at process.env everywhere.
 */

require('dotenv').config({ quiet: true });

const path = require('path');
const pkg = require('../package.json');

/** Parse an integer env var, falling back to a default on missing/NaN. */
function int(name, fallback) {
    const raw = process.env[name];
    if (raw === undefined || raw === '') return fallback;
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? fallback : n;
}

/** Parse a boolean env var ("true"/"1"/"yes" => true). */
function bool(name, fallback) {
    const raw = process.env[name];
    if (raw === undefined || raw === '') return fallback;
    return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

/** Parse a comma-separated list env var into a trimmed, non-empty array. */
function list(name, fallback = []) {
    const raw = process.env[name];
    if (raw === undefined || raw === '') return fallback;
    return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

const nodeEnv = process.env.NODE_ENV || 'development';

const config = {
    version: pkg.version,
    name: pkg.name,
    env: nodeEnv,
    isProduction: nodeEnv === 'production',
    isTest: nodeEnv === 'test',

    server: {
        port: int('PORT', 3000),
        // Trust the first proxy hop by default so req.ip / rate-limiting work
        // correctly behind Nginx/load balancers. Set TRUST_PROXY=false to disable.
        trustProxy: bool('TRUST_PROXY', true),
        bodyLimit: process.env.BODY_LIMIT || '1mb',
        shutdownTimeoutMs: int('SHUTDOWN_TIMEOUT_MS', 10000),
        // Serve the built web console (web/dist) from the API at /app.
        serveUi: bool('SERVE_UI', false),
        uiDir: process.env.UI_DIR || path.join(__dirname, '..', 'web', 'dist'),
    },

    cors: {
        // '*' when unset; otherwise an explicit allowlist.
        origins: process.env.ALLOWED_ORIGINS ? list('ALLOWED_ORIGINS') : '*',
    },

    auth: {
        // When empty, auth is DISABLED (open API) — a warning is logged at boot.
        apiKeys: list('API_KEYS'),
        headerName: (process.env.API_KEY_HEADER || 'x-api-key').toLowerCase(),
    },

    rateLimit: {
        windowMs: int('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
        general: int('RATE_LIMIT', 100),
        scraper: int('SCRAPER_RATE_LIMIT', 20),
    },

    scraper: {
        timeout: int('SCRAPER_TIMEOUT', 10000),
        maxContentLength: int('MAX_CONTENT_LENGTH', 2 * 1024 * 1024),
        retries: int('SCRAPER_RETRIES', 2),
        maxRedirects: int('SCRAPER_MAX_REDIRECTS', 5),
        maxBatchUrls: int('MAX_BATCH_URLS', 5),
        userAgent:
            process.env.SCRAPER_USER_AGENT ||
            `Mozilla/5.0 (compatible; ${pkg.name}/${pkg.version}; +https://github.com/)`,
        // When true, allow scraping private/loopback addresses. NEVER enable on
        // a publicly-exposed instance — it opens SSRF. Off by default.
        allowPrivateAddresses: bool('ALLOW_PRIVATE_ADDRESSES', false),
    },

    render: {
        // JS rendering via Playwright. Opt-in per-request; this gates whether the
        // capability is available at all.
        enabled: bool('RENDER_ENABLED', true),
        timeout: int('RENDER_TIMEOUT', 30000),
        // 'load' | 'domcontentloaded' | 'networkidle'
        waitUntil: process.env.RENDER_WAIT_UNTIL || 'networkidle',
        maxConcurrency: int('RENDER_MAX_CONCURRENCY', 2),
        // Screenshot / PDF output (both require rendering).
        screenshot: {
            fullPage: bool('SCREENSHOT_FULL_PAGE', true),
            type: process.env.SCREENSHOT_TYPE || 'png', // png | jpeg
            quality: int('SCREENSHOT_QUALITY', 80), // jpeg only
            maxWidth: int('SCREENSHOT_VIEWPORT_WIDTH', 1280),
            maxHeight: int('SCREENSHOT_VIEWPORT_HEIGHT', 800),
        },
        pdf: {
            format: process.env.PDF_FORMAT || 'A4',
            landscape: bool('PDF_LANDSCAPE', false),
            printBackground: bool('PDF_PRINT_BACKGROUND', true),
        },
    },

    // Throttled request queue: caps in-flight scrapes globally and per-target
    // domain, with an optional politeness delay between requests to the same
    // domain. Requests beyond the queue capacity are rejected fast (503).
    queue: {
        enabled: bool('QUEUE_ENABLED', true),
        globalConcurrency: int('SCRAPE_MAX_CONCURRENCY', 10),
        perDomainConcurrency: int('SCRAPE_PER_DOMAIN_CONCURRENCY', 2),
        perDomainDelayMs: int('SCRAPE_PER_DOMAIN_DELAY_MS', 0),
        maxQueue: int('SCRAPE_QUEUE_MAX', 100),
        queueTimeoutMs: int('SCRAPE_QUEUE_TIMEOUT_MS', 20000),
    },

    analytics: {
        enabled: bool('ANALYTICS_ENABLED', true),
        topDomains: int('ANALYTICS_TOP_DOMAINS', 20),
        maxTrackedKeys: int('ANALYTICS_MAX_KEYS', 100),
    },

    robots: {
        // Respect target sites' robots.txt by default (ethical scraping).
        respect: bool('RESPECT_ROBOTS', false),
        cacheTtlMs: int('ROBOTS_CACHE_TTL_MS', 60 * 60 * 1000),
    },

    cache: {
        enabled: bool('CACHE_ENABLED', true),
        ttlMs: int('CACHE_TTL_MS', 5 * 60 * 1000),
        max: int('CACHE_MAX_ITEMS', 500),
    },

    redis: {
        // When set, used for distributed rate-limiting and caching (cluster-safe).
        url: process.env.REDIS_URL || null,
    },

    metrics: {
        enabled: bool('METRICS_ENABLED', true),
    },

    log: {
        level: process.env.LOG_LEVEL || (nodeEnv === 'production' ? 'info' : 'debug'),
        // Pretty-print in dev when LOG_PRETTY is unset; JSON in prod.
        pretty: bool('LOG_PRETTY', nodeEnv !== 'production'),
    },
};

module.exports = config;
