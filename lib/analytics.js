/**
 * In-process usage analytics.
 *
 * Prometheus (/metrics) covers time-series monitoring; this gives a compact,
 * human-friendly JSON summary suitable for a dashboard or quick `GET /api/usage`
 * check: totals, breakdowns by mode/outcome, cache hit rate, latency, top target
 * domains, and per-API-key usage.
 *
 * All counters are in memory (reset on restart) and bounded to avoid unbounded
 * growth from high-cardinality domains/keys.
 */

const config = require('../config');

const startedAt = Date.now();

const totals = {
    requests: 0,
    success: 0,
    error: 0,
    cached: 0,
    rendered: 0,
    bytes: 0,
    durationMsSum: 0,
};

const byMode = new Map(); // mode -> count
const byErrorCode = new Map(); // code -> count
const domainCounts = new Map(); // domain -> count
const keyCounts = new Map(); // apiKeyId -> count

function bump(map, key, by = 1, cap = Infinity) {
    if (!map.has(key) && map.size >= cap) return; // don't grow past cap with new keys
    map.set(key, (map.get(key) || 0) + by);
}

/**
 * Record one completed scrape.
 * @param {object} e
 * @param {string} e.mode
 * @param {string} e.domain
 * @param {boolean} e.rendered
 * @param {boolean} e.cached
 * @param {boolean} e.success
 * @param {string} [e.errorCode]
 * @param {number} [e.durationMs]
 * @param {number} [e.bytes]
 * @param {string} [e.apiKeyId]
 */
function record(e) {
    if (!config.analytics.enabled) return;

    totals.requests += 1;
    if (e.success) totals.success += 1;
    else totals.error += 1;
    if (e.cached) totals.cached += 1;
    if (e.rendered) totals.rendered += 1;
    if (e.bytes) totals.bytes += e.bytes;
    if (e.durationMs) totals.durationMsSum += e.durationMs;

    if (e.mode) bump(byMode, e.mode);
    if (!e.success && e.errorCode) bump(byErrorCode, e.errorCode);
    if (e.domain) bump(domainCounts, e.domain, 1, 10000);
    if (e.apiKeyId) bump(keyCounts, e.apiKeyId, 1, config.analytics.maxTrackedKeys);
}

/** Top-N entries of a Map by count, as [{name, count}]. */
function top(map, n) {
    return [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([name, count]) => ({ name, count }));
}

/** Snapshot summary for the /api/usage endpoint. */
function summary() {
    const avgDurationMs = totals.requests ? Math.round(totals.durationMsSum / totals.requests) : 0;
    const cacheHitRate = totals.requests ? +(totals.cached / totals.requests).toFixed(4) : 0;
    const errorRate = totals.requests ? +(totals.error / totals.requests).toFixed(4) : 0;

    return {
        since: new Date(startedAt).toISOString(),
        uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
        totals: { ...totals },
        rates: { cacheHitRate, errorRate, avgDurationMs },
        byMode: Object.fromEntries(byMode),
        byErrorCode: Object.fromEntries(byErrorCode),
        topDomains: top(domainCounts, config.analytics.topDomains),
        uniqueApiKeys: keyCounts.size,
        topApiKeys: top(keyCounts, 10),
    };
}

/** Reset all counters (used by tests). */
function reset() {
    Object.keys(totals).forEach((k) => {
        totals[k] = 0;
    });
    byMode.clear();
    byErrorCode.clear();
    domainCounts.clear();
    keyCounts.clear();
}

module.exports = { record, summary, reset };
