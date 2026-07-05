/**
 * API integration tests (no outbound network — every case is either a
 * validation/SSRF rejection or a meta endpoint).
 */

const request = require('supertest');
const createApp = require('../app');

const app = createApp();

describe('Meta & ops endpoints', () => {
    test('GET / lists endpoints', async () => {
        const res = await request(app).get('/').expect(200);
        expect(res.body.success).toBe(true);
        expect(res.body.endpoints).toHaveProperty('scrape');
    });

    test('GET /health returns healthy status', async () => {
        const res = await request(app).get('/health').expect(200);
        expect(res.body).toMatchObject({ success: true, status: 'healthy' });
        expect(res.body).toHaveProperty('uptime');
        expect(res.body).toHaveProperty('memory');
        expect(res.body).toHaveProperty('version');
    });

    test('GET /health/detailed reports features', async () => {
        const res = await request(app).get('/health/detailed').expect(200);
        expect(res.body.features).toHaveProperty('authEnabled');
        expect(res.body.features).toHaveProperty('renderingAvailable');
        expect(res.body.features).toHaveProperty('cacheBackend');
    });

    test('GET /api/modes lists modes and rendering availability', async () => {
        const res = await request(app).get('/api/modes').expect(200);
        expect(Array.isArray(res.body.data.modes)).toBe(true);
        expect(res.body.data).toHaveProperty('renderingAvailable');
    });

    test('GET /api/openapi.json serves a valid spec', async () => {
        const res = await request(app).get('/api/openapi.json').expect(200);
        expect(res.body.openapi).toBe('3.0.3');
        expect(res.body.paths).toHaveProperty('/api/scrape');
    });

    test('GET /metrics exposes prometheus metrics', async () => {
        const res = await request(app).get('/metrics').expect(200);
        expect(res.text).toContain('http_request_duration_seconds');
    });

    test('unknown route returns 404 envelope', async () => {
        const res = await request(app).get('/nope').expect(404);
        expect(res.body).toMatchObject({ success: false, code: 'NOT_FOUND' });
    });
});

describe('Single scrape validation', () => {
    test('missing url => 400', async () => {
        const res = await request(app).post('/api/scrape').send({}).expect(400);
        expect(res.body).toMatchObject({ success: false, code: 'VALIDATION_ERROR', field: 'url' });
    });

    test('malformed url => 400', async () => {
        const res = await request(app).post('/api/scrape').send({ url: 'http://has a space' }).expect(400);
        expect(res.body.success).toBe(false);
    });

    test('non-http protocol => 400', async () => {
        const res = await request(app).post('/api/scrape').send({ url: 'file:///etc/passwd' }).expect(400);
        expect(res.body.success).toBe(false);
    });

    test('invalid mode => 400', async () => {
        const res = await request(app).post('/api/scrape').send({ url: 'https://example.com', mode: 'bogus' }).expect(400);
        expect(res.body.error).toContain('Invalid mode');
    });

    test('custom mode without selector => 400', async () => {
        const res = await request(app).post('/api/scrape').send({ url: 'https://example.com', mode: 'custom' }).expect(400);
        expect(res.body.field).toBe('options.selector');
    });

    test('non-boolean render => 400', async () => {
        const res = await request(app).post('/api/scrape').send({ url: 'https://example.com', render: 'yes' }).expect(400);
        expect(res.body.field).toBe('render');
    });
});

describe('SSRF protection via API', () => {
    test('localhost => 403 blocked', async () => {
        const res = await request(app).post('/api/scrape').send({ url: 'http://localhost:3000' }).expect(403);
        expect(res.body.code).toMatch(/PRIVATE_IP_BLOCKED|BLOCKED/);
    });

    test('private IP => 403 blocked', async () => {
        const res = await request(app).post('/api/scrape').send({ url: 'http://192.168.1.1' }).expect(403);
        expect(res.body.success).toBe(false);
    });

    test('cloud metadata IP => 403 blocked', async () => {
        const res = await request(app).post('/api/scrape').send({ url: 'http://169.254.169.254/latest/meta-data' }).expect(403);
        expect(res.body.success).toBe(false);
    });
});

describe('Batch scrape', () => {
    test('non-array => 400', async () => {
        const res = await request(app).post('/api/scrape/batch').send({ urls: 'x' }).expect(400);
        expect(res.body.error).toContain('must be an array');
    });

    test('empty array => 400 (previously passed silently)', async () => {
        const res = await request(app).post('/api/scrape/batch').send({ urls: [] }).expect(400);
        expect(res.body.error).toContain('At least one URL');
    });

    test('too many => 400', async () => {
        const urls = Array(10).fill('https://example.com');
        const res = await request(app).post('/api/scrape/batch').send({ urls }).expect(400);
        expect(res.body.error).toContain('Maximum');
    });

    test('per-URL SSRF failures reported without failing the batch', async () => {
        const res = await request(app)
            .post('/api/scrape/batch')
            .send({ urls: ['http://192.168.0.1', 'http://127.0.0.1'] })
            .expect(200);
        expect(res.body.data).toHaveLength(2);
        expect(res.body.data.every((r) => r.success === false)).toBe(true);
        expect(res.body.performance.failedUrls).toBe(2);
    });
});
