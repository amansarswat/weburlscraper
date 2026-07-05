/**
 * Client SDK tests (fetch mocked).
 */

const { UrlScraperClient, ScraperApiError } = require('../sdk');

/** Build a fake fetch that records the last call and returns a canned response. */
function makeFetch(response) {
    const calls = [];
    const fn = async (url, init) => {
        calls.push({ url, init });
        return response;
    };
    fn.calls = calls;
    return fn;
}

const jsonResponse = (body, { ok = true, status = 200 } = {}) => ({
    ok,
    status,
    json: async () => body,
    arrayBuffer: async () => Buffer.from(JSON.stringify(body)),
});

describe('UrlScraperClient', () => {
    test('scrape() posts to /api/scrape with the API key header', async () => {
        const fetch = makeFetch(jsonResponse({ success: true, data: { content: [] }, cached: false }));
        const client = new UrlScraperClient({ baseUrl: 'http://api.test', apiKey: 'k', fetch });

        const out = await client.scrape('https://example.com', { mode: 'articles' });
        expect(out.success).toBe(true);

        const { url, init } = fetch.calls[0];
        expect(url).toBe('http://api.test/api/scrape');
        expect(init.method).toBe('POST');
        expect(init.headers['x-api-key']).toBe('k');
        expect(JSON.parse(init.body)).toMatchObject({ url: 'https://example.com', mode: 'articles' });
    });

    test('throws ScraperApiError carrying code + status on failure', async () => {
        const fetch = makeFetch(jsonResponse({ success: false, error: 'blocked', code: 'PRIVATE_IP_BLOCKED' }, { ok: false, status: 403 }));
        const client = new UrlScraperClient({ baseUrl: 'http://api.test', fetch });

        await expect(client.scrape('http://127.0.0.1')).rejects.toMatchObject({
            name: 'ScraperApiError',
            code: 'PRIVATE_IP_BLOCKED',
            status: 403,
        });
        expect(await client.scrape('http://127.0.0.1').catch((e) => e instanceof ScraperApiError)).toBe(true);
    });

    test('screenshot({ binary: true }) requests binary and returns a Buffer', async () => {
        const bytes = Buffer.from([1, 2, 3, 4]);
        const fetch = makeFetch({ ok: true, status: 200, arrayBuffer: async () => bytes, json: async () => ({}) });
        const client = new UrlScraperClient({ baseUrl: 'http://api.test', fetch });

        const buf = await client.screenshot('https://example.com', { binary: true, fullPage: true });
        expect(Buffer.isBuffer(buf)).toBe(true);
        expect([...buf]).toEqual([1, 2, 3, 4]);

        const { init } = fetch.calls[0];
        expect(init.headers.accept).toBe('image/png');
        expect(JSON.parse(init.body)).toMatchObject({ encoding: 'binary', fullPage: true });
    });

    test('strips trailing slash from baseUrl', async () => {
        const fetch = makeFetch(jsonResponse({ success: true, data: {} }));
        const client = new UrlScraperClient({ baseUrl: 'http://api.test/', fetch });
        await client.getModes();
        expect(fetch.calls[0].url).toBe('http://api.test/api/modes');
    });
});
