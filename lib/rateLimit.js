/**
 * Rate-limiter factory.
 *
 * The original app used express-rate-limit's default in-memory store. Under the
 * shipped PM2 config (`instances: 'max'`, cluster mode) that store is per-worker,
 * so the real limit was silently multiplied by the CPU count and was inconsistent
 * across workers. When REDIS_URL is configured we use a shared Redis store so the
 * limit is correct and cluster-safe; otherwise we fall back to in-memory with a
 * one-time warning.
 *
 * Limits are keyed by API key when present (so each key gets its own budget),
 * falling back to client IP.
 */

const rateLimit = require('express-rate-limit');
const config = require('../config');
const logger = require('./logger');

let redisStoreClient = null;
let warnedNoRedis = false;

if (config.redis.url) {
    try {
        // eslint-disable-next-line global-require
        const Redis = require('ioredis');
        redisStoreClient = new Redis(config.redis.url, { maxRetriesPerRequest: 2 });
        redisStoreClient.on('error', (err) => logger.warn({ err: err.message }, 'Redis rate-limit error'));
        logger.info('Rate-limit backend: Redis');
    } catch (err) {
        logger.warn({ err: err.message }, 'Redis unavailable for rate limiting; using in-memory store');
    }
}

/** Build a Redis store for express-rate-limit, or undefined for the default. */
function buildStore(prefix) {
    if (redisStoreClient) {
        // eslint-disable-next-line global-require
        const RedisStore = require('rate-limit-redis');
        return new RedisStore({
            sendCommand: (...args) => redisStoreClient.call(...args),
            prefix,
        });
    }
    if (config.env === 'production' && !warnedNoRedis) {
        warnedNoRedis = true;
        logger.warn(
            'Rate limiting uses an in-memory store. In a multi-instance/cluster deployment set REDIS_URL for correct, shared limits.'
        );
    }
    return undefined;
}

/** Key by API key (if authenticated) else by client IP. */
function keyGenerator(req) {
    return req.apiKey ? `key:${req.apiKey}` : `ip:${req.ip}`;
}

/**
 * @param {object} opts
 * @param {number} opts.max
 * @param {string} opts.prefix  Redis key prefix / limiter name.
 * @param {string} opts.message
 */
function createLimiter({ max, prefix, message }) {
    return rateLimit({
        windowMs: config.rateLimit.windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator,
        store: buildStore(prefix),
        message: {
            success: false,
            error: message || 'Too many requests, please try again later.',
            code: 'RATE_LIMITED',
        },
    });
}

async function close() {
    if (redisStoreClient) {
        try {
            await redisStoreClient.quit();
        } catch {
            /* ignore */
        }
    }
}

module.exports = { createLimiter, close };
