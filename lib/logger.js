/**
 * Structured logging via pino.
 *
 * - JSON output in production (machine-parseable for log aggregators).
 * - Pretty, colorized output in development (pino-pretty, loaded lazily).
 * - Silent during tests to keep test output readable.
 */

const pino = require('pino');
const config = require('../config');

let transport;
if (config.log.pretty && !config.isTest) {
    // pino-pretty is a dependency of pino's dev experience; load defensively so a
    // missing optional module never crashes the app.
    try {
        require.resolve('pino-pretty');
        transport = {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
        };
    } catch {
        transport = undefined;
    }
}

const logger = pino({
    level: config.isTest ? 'silent' : config.log.level,
    base: { service: config.name, version: config.version },
    redact: {
        // Never log secrets even if they end up on a logged object.
        paths: ['req.headers.authorization', `req.headers["${config.auth.headerName}"]`, 'req.headers.cookie'],
        remove: true,
    },
    transport,
});

module.exports = logger;
