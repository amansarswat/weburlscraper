/**
 * URL Scraper API — application factory.
 *
 * This module builds and returns the configured Express app WITHOUT starting a
 * server. Keeping `listen()` out of here (it now lives in server.js) means tests
 * can import the app without binding a port — the original code called
 * app.listen() at import time, which caused EADDRINUSE during tests.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pinoHttp = require('pino-http');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const swaggerUi = require('swagger-ui-express');

const config = require('./config');
const logger = require('./lib/logger');
const metrics = require('./lib/metrics');
const { createLimiter } = require('./lib/rateLimit');
const scraperRoutes = require('./routes/scraper');
const healthRoutes = require('./routes/health');
const metricsRoutes = require('./routes/metrics');
const openapiSpec = require('./docs/openapi');
const { notFound, errorHandler } = require('./middleware/errorHandler');

function createApp() {
    const app = express();

    // Behind a proxy/LB, trust X-Forwarded-* so req.ip and rate limiting are correct.
    app.set('trust proxy', config.server.trustProxy ? 1 : false);
    app.disable('x-powered-by');

    // Security headers. Relax CSP only for the Swagger UI page (it needs inline styles).
    app.use(helmet({ contentSecurityPolicy: false }));

    app.use(
        cors({
            origin: config.cors.origins,
            methods: ['GET', 'POST'],
            allowedHeaders: ['Content-Type', 'Authorization', config.auth.headerName],
        })
    );

    // Structured request logging with a per-request id (also surfaced as a header).
    app.use(
        pinoHttp({
            logger,
            genReqId: (req, res) => {
                const id = req.headers['x-request-id'] || crypto.randomUUID();
                res.setHeader('x-request-id', id);
                return id;
            },
            autoLogging: !config.isTest,
        })
    );

    app.use(express.json({ limit: config.server.bodyLimit }));
    app.use(express.urlencoded({ extended: true, limit: config.server.bodyLimit }));

    // HTTP request duration metric.
    app.use((req, res, next) => {
        const end = metrics.httpRequestDuration.startTimer();
        res.on('finish', () => {
            const route = req.route ? (req.baseUrl || '') + req.route.path : req.path;
            end({ method: req.method, route, status: res.statusCode });
        });
        next();
    });

    // General rate limit across everything (scrape routes add a stricter one).
    app.use(createLimiter({ max: config.rateLimit.general, prefix: 'rl:gen:', message: 'Too many requests from this IP.' }));

    // API documentation (open, no auth).
    app.get('/api/openapi.json', (req, res) => res.json(openapiSpec));
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, { customSiteTitle: 'URL Scraper API Docs' }));

    // Routes.
    app.use('/api', scraperRoutes);
    app.use('/health', healthRoutes);
    if (config.metrics.enabled) app.use('/metrics', metricsRoutes);

    // Optionally serve the built web console (web/dist) at /app.
    if (config.server.serveUi) {
        const uiDir = config.server.uiDir;
        if (fs.existsSync(path.join(uiDir, 'index.html'))) {
            app.use('/app', express.static(uiDir));
            logger.info({ uiDir }, 'Web console served at /app');
        } else {
            logger.warn({ uiDir }, 'SERVE_UI is enabled but no build found. Run: cd web && npm install && npm run build');
        }
    }

    // Root.
    app.get('/', (req, res) => {
        res.json({
            success: true,
            message: 'URL Scraper API is running',
            version: config.version,
            endpoints: {
                scrape: 'POST /api/scrape',
                batch: 'POST /api/scrape/batch',
                modes: 'GET /api/modes',
                docs: 'GET /api/docs',
                health: 'GET /health',
                metrics: config.metrics.enabled ? 'GET /metrics' : undefined,
                console: config.server.serveUi ? 'GET /app' : undefined,
            },
        });
    });

    // 404 + centralized error handling (must be last).
    app.use(notFound);
    app.use(errorHandler);

    return app;
}

module.exports = createApp;
module.exports.createApp = createApp;
