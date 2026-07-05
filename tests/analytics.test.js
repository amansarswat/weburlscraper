/**
 * Usage analytics unit tests.
 */

const analytics = require('../lib/analytics');

describe('analytics', () => {
    beforeEach(() => analytics.reset());

    test('accumulates totals and rates', () => {
        analytics.record({ mode: 'articles', domain: 'a.com', rendered: false, cached: false, success: true, durationMs: 100, bytes: 500 });
        analytics.record({ mode: 'articles', domain: 'a.com', rendered: false, cached: true, success: true, durationMs: 0, bytes: 500 });
        analytics.record({ mode: 'lists', domain: 'b.com', rendered: true, cached: false, success: false, errorCode: 'FETCH_FAILED', durationMs: 200 });

        const s = analytics.summary();
        expect(s.totals.requests).toBe(3);
        expect(s.totals.success).toBe(2);
        expect(s.totals.error).toBe(1);
        expect(s.totals.cached).toBe(1);
        expect(s.totals.rendered).toBe(1);
        expect(s.byMode).toEqual({ articles: 2, lists: 1 });
        expect(s.byErrorCode).toEqual({ FETCH_FAILED: 1 });
        expect(s.rates.errorRate).toBeCloseTo(1 / 3, 3);
        expect(s.rates.cacheHitRate).toBeCloseTo(1 / 3, 3);
    });

    test('ranks top domains by count', () => {
        for (let i = 0; i < 5; i += 1) analytics.record({ mode: 'articles', domain: 'busy.com', success: true });
        analytics.record({ mode: 'articles', domain: 'quiet.com', success: true });
        const s = analytics.summary();
        expect(s.topDomains[0]).toEqual({ name: 'busy.com', count: 5 });
    });

    test('tracks unique api keys', () => {
        analytics.record({ mode: 'articles', domain: 'a.com', success: true, apiKeyId: 'k1' });
        analytics.record({ mode: 'articles', domain: 'a.com', success: true, apiKeyId: 'k2' });
        analytics.record({ mode: 'articles', domain: 'a.com', success: true, apiKeyId: 'k1' });
        expect(analytics.summary().uniqueApiKeys).toBe(2);
    });
});
