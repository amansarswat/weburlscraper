/**
 * Health & readiness routes.
 */

const express = require('express');
const config = require('../config');
const renderer = require('../utils/renderer');
const cache = require('../lib/cache');
const scrapeQueue = require('../lib/scrapeQueue');
const { isAuthEnabled } = require('../middleware/auth');

const router = express.Router();

/** GET /health — liveness probe. */
router.get('/', (req, res) => {
    const mem = process.memoryUsage();
    res.json({
        success: true,
        status: 'healthy',
        version: config.version,
        uptime: process.uptime(),
        memory: {
            used: Math.round(mem.heapUsed / 1024 / 1024),
            total: Math.round(mem.heapTotal / 1024 / 1024),
            external: Math.round(mem.external / 1024 / 1024),
        },
        timestamp: new Date().toISOString(),
    });
});

/** GET /health/detailed — richer diagnostics + enabled features. */
router.get('/detailed', (req, res) => {
    const mem = process.memoryUsage();
    res.json({
        success: true,
        status: 'healthy',
        version: config.version,
        timestamp: new Date().toISOString(),
        system: {
            uptime: process.uptime(),
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            pid: process.pid,
        },
        memory: {
            rss: Math.round(mem.rss / 1024 / 1024),
            heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
            heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
            external: Math.round(mem.external / 1024 / 1024),
            arrayBuffers: Math.round((mem.arrayBuffers || 0) / 1024 / 1024),
        },
        features: {
            authEnabled: isAuthEnabled(),
            renderingAvailable: renderer.isAvailable() && config.render.enabled,
            cacheEnabled: config.cache.enabled,
            cacheBackend: cache.isRedis() ? 'redis' : 'memory',
            respectRobots: config.robots.respect,
            metricsEnabled: config.metrics.enabled,
            analyticsEnabled: config.analytics.enabled,
        },
        queue: scrapeQueue.stats(),
        environment: { nodeEnv: config.env, port: config.server.port },
    });
});

module.exports = router;
