/**
 * Optional API-key authentication.
 *
 * Self-hosted deployments are frequently exposed publicly, so we ship key auth
 * that is trivial to enable: set API_KEYS to a comma-separated list. When no
 * keys are configured the API is OPEN (with a loud one-time boot warning) so the
 * out-of-the-box experience still works for local/trusted use.
 *
 * Keys may be supplied via the `x-api-key` header (configurable) or as a
 * `Authorization: Bearer <key>` token. Comparison is constant-time.
 */

const crypto = require('crypto');
const config = require('../config');
const logger = require('../lib/logger');

const enabled = config.auth.apiKeys.length > 0;

if (!enabled) {
    logger.warn(
        'API-key auth is DISABLED (no API_KEYS configured). The API is open to anyone who can reach it. Set API_KEYS before exposing this publicly.'
    );
} else {
    logger.info({ keyCount: config.auth.apiKeys.length }, 'API-key auth enabled');
}

// Pre-hash configured keys once for constant-time comparison.
const hashedKeys = new Set(
    config.auth.apiKeys.map((k) => crypto.createHash('sha256').update(k).digest('hex'))
);

/** Constant-time membership check against the configured keys. */
function isValidKey(presented) {
    if (!presented) return false;
    const presentedHash = crypto.createHash('sha256').update(presented).digest('hex');
    // Compare against each stored hash with timingSafeEqual to avoid leaking
    // information via early-exit timing.
    let match = false;
    const presentedBuf = Buffer.from(presentedHash, 'hex');
    for (const stored of hashedKeys) {
        const storedBuf = Buffer.from(stored, 'hex');
        if (presentedBuf.length === storedBuf.length && crypto.timingSafeEqual(presentedBuf, storedBuf)) {
            match = true;
        }
    }
    return match;
}

/** Extract a key from the configured header or a Bearer token. */
function extractKey(req) {
    const headerKey = req.headers[config.auth.headerName];
    if (headerKey) return Array.isArray(headerKey) ? headerKey[0] : headerKey;
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
    return null;
}

/** Express middleware. Passes through when auth is disabled. */
function authenticate(req, res, next) {
    if (!enabled) return next();

    const key = extractKey(req);
    if (!isValidKey(key)) {
        return res.status(401).json({
            success: false,
            error: 'Missing or invalid API key',
            code: 'UNAUTHORIZED',
        });
    }
    // Expose a short, non-reversible id for logging and per-key rate limiting.
    req.apiKey = crypto.createHash('sha256').update(key).digest('hex').slice(0, 12);
    return next();
}

module.exports = { authenticate, isAuthEnabled: () => enabled };
