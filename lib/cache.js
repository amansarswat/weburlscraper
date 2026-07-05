/**
 * Response cache with a pluggable backend.
 *
 * - Default: in-process LRU (fast, zero-config, per-process).
 * - When REDIS_URL is set: a shared Redis backend so cache (and rate limits)
 *   are consistent across a cluster / multiple instances.
 *
 * The public interface is async so callers don't care which backend is active.
 */

const crypto = require('crypto');
const { LRUCache } = require('lru-cache');
const config = require('../config');
const logger = require('./logger');

let redis = null;
if (config.redis.url && config.cache.enabled) {
    try {
        // eslint-disable-next-line global-require
        const Redis = require('ioredis');
        redis = new Redis(config.redis.url, { lazyConnect: false, maxRetriesPerRequest: 2 });
        redis.on('error', (err) => logger.warn({ err: err.message }, 'Redis cache error'));
        logger.info('Cache backend: Redis');
    } catch (err) {
        logger.warn({ err: err.message }, 'Redis unavailable; falling back to in-memory cache');
        redis = null;
    }
}

const memory = new LRUCache({ max: config.cache.max, ttl: config.cache.ttlMs });

/** Build a stable cache key from arbitrary request parameters. */
function makeKey(parts) {
    const hash = crypto.createHash('sha1').update(JSON.stringify(parts)).digest('hex');
    return `scrape:${hash}`;
}

async function get(key) {
    if (!config.cache.enabled) return null;
    try {
        if (redis) {
            const raw = await redis.get(key);
            return raw ? JSON.parse(raw) : null;
        }
        return memory.get(key) ?? null;
    } catch (err) {
        logger.warn({ err: err.message }, 'Cache get failed');
        return null;
    }
}

async function set(key, value, ttlMs = config.cache.ttlMs) {
    if (!config.cache.enabled) return;
    try {
        if (redis) {
            await redis.set(key, JSON.stringify(value), 'PX', ttlMs);
        } else {
            memory.set(key, value, { ttl: ttlMs });
        }
    } catch (err) {
        logger.warn({ err: err.message }, 'Cache set failed');
    }
}

async function close() {
    if (redis) {
        try {
            await redis.quit();
        } catch {
            /* ignore */
        }
    }
}

module.exports = { makeKey, get, set, close, isRedis: () => !!redis };
