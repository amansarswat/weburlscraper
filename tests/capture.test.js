/**
 * Screenshot / PDF / usage endpoint tests (renderer mocked — no real browser).
 */

jest.mock('../utils/renderer', () => ({
    isAvailable: () => true,
    render: jest.fn(),
    screenshot: jest.fn(async () => ({ image: Buffer.from('PNGDATA'), type: 'png', finalUrl: 'https://example.com/' })),
    pdf: jest.fn(async () => ({ pdf: Buffer.from('PDFDATA'), finalUrl: 'https://example.com/' })),
    close: jest.fn(),
}));

const request = require('supertest');
const createApp = require('../app');

const app = createApp();

describe('POST /api/screenshot', () => {
    test('requires a url', async () => {
        const res = await request(app).post('/api/screenshot').send({}).expect(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    test('returns base64 JSON by default', async () => {
        const res = await request(app).post('/api/screenshot').send({ url: 'https://example.com' }).expect(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.encoding).toBe('base64');
        expect(res.body.data.contentType).toBe('image/png');
        expect(Buffer.from(res.body.data.image, 'base64').toString()).toBe('PNGDATA');
    });

    test('returns raw bytes when encoding=binary', async () => {
        const res = await request(app)
            .post('/api/screenshot')
            .send({ url: 'https://example.com', encoding: 'binary' })
            .expect(200);
        expect(res.headers['content-type']).toContain('image/png');
        expect(res.body.toString()).toBe('PNGDATA');
    });
});

describe('POST /api/pdf', () => {
    test('returns base64 PDF', async () => {
        const res = await request(app).post('/api/pdf').send({ url: 'https://example.com' }).expect(200);
        expect(res.body.data.contentType).toBe('application/pdf');
        expect(Buffer.from(res.body.data.pdf, 'base64').toString()).toBe('PDFDATA');
    });
});

describe('GET /api/usage', () => {
    test('returns a usage summary and queue stats', async () => {
        const res = await request(app).get('/api/usage').expect(200);
        expect(res.body.data).toHaveProperty('totals');
        expect(res.body.data).toHaveProperty('queue');
        expect(res.body.data.queue).toHaveProperty('globalActive');
    });
});

describe('GET /api/modes', () => {
    test('advertises output types', async () => {
        const res = await request(app).get('/api/modes').expect(200);
        expect(res.body.data.outputs).toEqual(expect.arrayContaining(['content', 'screenshot', 'pdf']));
    });
});
