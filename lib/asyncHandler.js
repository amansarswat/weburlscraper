/**
 * Wrap an async route handler so rejected promises are forwarded to Express's
 * error handler instead of becoming unhandled rejections.
 */
module.exports = function asyncHandler(fn) {
    return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
};
