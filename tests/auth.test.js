/**
 * API-key auth tests. Env is set BEFORE requiring the app so config picks it up.
 */

process.env.NODE_ENV = 'test';
process.env.API_KEYS = 'secret-key-1,secret-key-2';

const request = require('supertest');
const createApp = require('../app');

const app = createApp();

describe('API-key authentication (enabled)', () => {
    test('rejects requests with no key', async () => {
        const res = await request(app).post('/api/scrape').send({ url: 'https://example.com' }).expect(401);
        expect(res.body.code).toBe('UNAUTHORIZED');
    });

    test('rejects an invalid key', async () => {
        const res = await request(app)
            .post('/api/scrape')
            .set('x-api-key', 'wrong')
            .send({ url: 'https://example.com' })
            .expect(401);
        expect(res.body.success).toBe(false);
    });

    test('accepts a valid key via x-api-key (passes auth, then validation applies)', async () => {
        // Uses a URL that fails validation so we never hit the network, but a 400
        // (not 401) proves the key was accepted.
        const res = await request(app).post('/api/scrape').set('x-api-key', 'secret-key-1').send({}).expect(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    test('accepts a valid key via Bearer token', async () => {
        const res = await request(app)
            .post('/api/scrape')
            .set('Authorization', 'Bearer secret-key-2')
            .send({})
            .expect(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    test('leaves open meta endpoints reachable without a key', async () => {
        await request(app).get('/api/modes').expect(200);
        await request(app).get('/health').expect(200);
    });
});
