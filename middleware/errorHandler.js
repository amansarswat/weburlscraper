/**
 * Central error handler + 404 handler.
 *
 * Produces a single, consistent error envelope and never leaks internals for
 * 5xx errors in production. Typed AppErrors carry their own status/code; unknown
 * errors are treated as 500.
 */

const logger = require('../lib/logger');
const { AppError } = require('../lib/errors');
const config = require('../config');

/** 404 for unmatched routes (Express 5: no path-string, just a terminal middleware). */
function notFound(req, res) {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        code: 'NOT_FOUND',
        message: `Cannot ${req.method} ${req.originalUrl}`,
    });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
    const isApp = err instanceof AppError;
    const status = isApp ? err.statusCode : err.status || 500;
    const code = isApp ? err.code : 'INTERNAL_ERROR';

    // Log full detail server-side; 5xx at error level, 4xx at warn.
    const logPayload = { err: { message: err.message, code, stack: err.stack }, reqId: req.id };
    if (status >= 500) logger.error(logPayload, 'Request failed');
    else logger.warn(logPayload, 'Request rejected');

    // Only expose messages that are safe (4xx / explicitly exposable).
    const expose = isApp ? err.expose : status < 500;
    const body = {
        success: false,
        error: expose ? err.message : 'Internal server error',
        code,
    };
    if (err.field) body.field = err.field;
    if (config.env === 'development' && status >= 500) body.stack = err.stack;

    res.status(status).json(body);
}

module.exports = { notFound, errorHandler };
