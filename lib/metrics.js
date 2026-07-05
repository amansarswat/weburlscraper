/**
 * Prometheus metrics.
 *
 * Exposes default Node process metrics plus scrape-specific counters/histograms.
 * Served at GET /metrics (see routes/metrics.js). No-ops cleanly when disabled.
 */

const client = require('prom-client');
const config = require('../config');

const register = new client.Registry();
register.setDefaultLabels({ service: config.name, version: config.version });

if (config.metrics.enabled) {
    client.collectDefaultMetrics({ register });
}

const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [register],
});

const scrapeTotal = new client.Counter({
    name: 'scrape_requests_total',
    help: 'Total scrape operations',
    labelNames: ['mode', 'rendered', 'outcome'], // outcome: success|error
    registers: [register],
});

const scrapeDuration = new client.Histogram({
    name: 'scrape_duration_seconds',
    help: 'Scrape operation duration in seconds',
    labelNames: ['mode', 'rendered'],
    buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 30],
    registers: [register],
});

const cacheHits = new client.Counter({
    name: 'scrape_cache_hits_total',
    help: 'Number of scrape cache hits',
    registers: [register],
});

module.exports = {
    register,
    httpRequestDuration,
    scrapeTotal,
    scrapeDuration,
    cacheHits,
};
