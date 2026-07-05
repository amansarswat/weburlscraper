/**
 * Request validation middleware.
 *
 * Structural validation only (types, ranges, allowed values). Security URL
 * checks (SSRF) happen at fetch time in security/ssrf.js, which is the only
 * place that can safely resolve DNS — this layer just rejects obviously bad
 * input fast and cheaply.
 */

const config = require('../config');
const { MODE_NAMES } = require('../utils/extractors');

/** Basic syntactic URL check (no DNS). Returns { valid, error }. */
function checkUrlShape(url) {
    if (!url || typeof url !== 'string') {
        return { valid: false, error: 'URL is required and must be a string' };
    }
    if (url.length > 2048) {
        return { valid: false, error: 'URL is too long (max 2048 characters)' };
    }
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`;
    let parsed;
    try {
        parsed = new URL(withScheme);
    } catch {
        return { valid: false, error: 'Invalid URL format' };
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { valid: false, error: 'Only HTTP and HTTPS protocols are allowed' };
    }
    if (!parsed.hostname) {
        return { valid: false, error: 'Invalid URL format' };
    }
    return { valid: true };
}

/** Validate mode + mode-specific options. Returns { valid, error, field }. */
function checkModeAndOptions(mode, options) {
    if (mode && !MODE_NAMES.includes(mode)) {
        return {
            valid: false,
            field: 'mode',
            error: `Invalid mode. Allowed modes: ${MODE_NAMES.join(', ')}`,
        };
    }
    if (mode === 'custom') {
        if (!options || typeof options.selector !== 'string' || !options.selector.trim()) {
            return {
                valid: false,
                field: 'options.selector',
                error: 'Custom mode requires a CSS selector in options.selector',
            };
        }
        if (options.selector.length > 200) {
            return {
                valid: false,
                field: 'options.selector',
                error: 'CSS selector must be at most 200 characters',
            };
        }
    }
    return { valid: true };
}

/** Validate the single-scrape request body. */
function validateScrapeRequest(req, res, next) {
    const { url, mode, options } = req.body || {};

    const urlCheck = checkUrlShape(url);
    if (!urlCheck.valid) {
        return res.status(400).json({ success: false, error: urlCheck.error, code: 'VALIDATION_ERROR', field: 'url' });
    }

    const modeCheck = checkModeAndOptions(mode, options);
    if (!modeCheck.valid) {
        return res
            .status(400)
            .json({ success: false, error: modeCheck.error, code: 'VALIDATION_ERROR', field: modeCheck.field });
    }

    if (req.body.render !== undefined && typeof req.body.render !== 'boolean') {
        return res
            .status(400)
            .json({ success: false, error: '`render` must be a boolean', code: 'VALIDATION_ERROR', field: 'render' });
    }

    return next();
}

/** Validate the batch-scrape request body. Previously written but never wired up. */
function validateBatchScrapeRequest(req, res, next) {
    const { urls, mode, options } = req.body || {};

    if (!Array.isArray(urls)) {
        return res
            .status(400)
            .json({ success: false, error: 'URLs must be an array', code: 'VALIDATION_ERROR', field: 'urls' });
    }
    if (urls.length === 0) {
        return res
            .status(400)
            .json({ success: false, error: 'At least one URL is required', code: 'VALIDATION_ERROR', field: 'urls' });
    }
    if (urls.length > config.scraper.maxBatchUrls) {
        return res.status(400).json({
            success: false,
            error: `Maximum ${config.scraper.maxBatchUrls} URLs allowed per batch request`,
            code: 'VALIDATION_ERROR',
            field: 'urls',
        });
    }

    for (let i = 0; i < urls.length; i += 1) {
        const check = checkUrlShape(urls[i]);
        if (!check.valid) {
            return res.status(400).json({
                success: false,
                error: `URL at index ${i}: ${check.error}`,
                code: 'VALIDATION_ERROR',
                field: `urls[${i}]`,
            });
        }
    }

    const modeCheck = checkModeAndOptions(mode, options);
    if (!modeCheck.valid) {
        return res
            .status(400)
            .json({ success: false, error: modeCheck.error, code: 'VALIDATION_ERROR', field: modeCheck.field });
    }

    return next();
}

module.exports = { checkUrlShape, validateScrapeRequest, validateBatchScrapeRequest };
