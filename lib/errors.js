/**
 * Typed application errors.
 *
 * Carrying an HTTP status + machine code on the error lets the central error
 * handler produce consistent, safe responses without leaking internals.
 */

class AppError extends Error {
    /**
     * @param {string} message  Human-readable message (safe to expose to clients).
     * @param {number} statusCode  HTTP status to respond with.
     * @param {string} code  Stable machine-readable error code.
     */
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.code = code;
        this.expose = statusCode < 500; // 4xx messages are safe to show; 5xx are not.
    }
}

/** Bad input from the caller (400). */
class ValidationError extends AppError {
    constructor(message, field) {
        super(message, 400, 'VALIDATION_ERROR');
        this.field = field;
    }
}

/** Request blocked for security reasons — SSRF guard, disallowed protocol, robots.txt (403). */
class BlockedError extends AppError {
    constructor(message, code = 'BLOCKED') {
        super(message, 403, code);
    }
}

/** Upstream fetch failed — DNS, timeout, connection refused, non-2xx (502). */
class FetchError extends AppError {
    constructor(message, code = 'FETCH_FAILED') {
        super(message, 502, code);
    }
}

module.exports = { AppError, ValidationError, BlockedError, FetchError };
