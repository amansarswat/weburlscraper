/**
 * Server bootstrap + graceful shutdown.
 *
 * Separated from app.js so the app can be imported without side effects. This is
 * the process entrypoint (`npm start`).
 */

const createApp = require('./app');
const config = require('./config');
const logger = require('./lib/logger');
const cache = require('./lib/cache');
const rateLimit = require('./lib/rateLimit');
const renderer = require('./utils/renderer');
const scrapeQueue = require('./lib/scrapeQueue');

const app = createApp();
const server = app.listen(config.server.port, () => {
    logger.info(
        { port: config.server.port, env: config.env, version: config.version },
        `URL Scraper API listening on port ${config.server.port}`
    );
    logger.info(`Docs: http://localhost:${config.server.port}/api/docs`);
});

let shuttingDown = false;

/** Drain in-flight connections, then close resources, then exit. */
async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down gracefully...');

    // Stop accepting new connections and wait for in-flight requests to finish.
    const closed = new Promise((resolve) => server.close(resolve));
    const timeout = new Promise((resolve) => setTimeout(resolve, config.server.shutdownTimeoutMs));
    await Promise.race([closed, timeout]);

    scrapeQueue.close();
    await Promise.allSettled([renderer.close(), cache.close(), rateLimit.close()]);
    logger.info('Shutdown complete');
    process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Never leave the process in an undefined state on a programming error.
process.on('unhandledRejection', (reason) => {
    logger.error({ reason: reason?.message || reason }, 'Unhandled promise rejection');
});
process.on('uncaughtException', (err) => {
    logger.fatal({ err: err.message, stack: err.stack }, 'Uncaught exception; exiting');
    process.exit(1);
});

module.exports = server;
