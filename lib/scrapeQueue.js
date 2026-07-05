/**
 * Application-wide scrape queue singleton, configured from env.
 * Kept separate from the ThrottleQueue class so the class stays config-free and
 * easy to unit-test with custom limits.
 */

const { ThrottleQueue } = require('./queue');
const config = require('../config');

module.exports = new ThrottleQueue(config.queue);
