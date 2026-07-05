/**
 * WebScraper orchestration tests. The network layer (safeFetch) is mocked so we
 * exercise fetch -> parse -> extract -> metadata without hitting the internet.
 */

jest.mock('../security/ssrf', () => {
    const actual = jest.requireActual('../security/ssrf');
    return { ...actual, safeFetch: jest.fn() };
});

const { safeFetch } = require('../security/ssrf');
const WebScraper = require('../utils/WebScraper');

const SAMPLE_HTML = `
<html><head><title>Sample</title><meta name="description" content="Desc"></head>
<body>
  <h1>Welcome</h1><p>Intro paragraph here.</p>
  <h2>Section</h2><p>Body of section.</p>
</body></html>`;

describe('WebScraper.scrape (mocked network)', () => {
    beforeEach(() => {
        safeFetch.mockReset();
        safeFetch.mockResolvedValue({
            data: SAMPLE_HTML,
            finalUrl: 'https://example.com/',
            status: 200,
            contentType: 'text/html',
        });
    });

    test('returns title, description, content and metadata', async () => {
        const scraper = new WebScraper();
        const result = await scraper.scrape('https://example.com', { mode: 'headings-paragraphs' });

        expect(result.title).toBe('Sample');
        expect(result.description).toBe('Desc');
        expect(result.url).toBe('https://example.com/');
        expect(result.requestedUrl).toBe('https://example.com');
        expect(result.metadata).toMatchObject({ mode: 'headings-paragraphs', rendered: false });
        expect(result.content.length).toBeGreaterThan(0);
        expect(result.metadata.totalItems).toBe(result.content.length);
    });

    test('all-text mode extracts text nodes over the length threshold', async () => {
        const scraper = new WebScraper();
        const result = await scraper.scrape('https://example.com', { mode: 'all-text' });
        expect(result.content.some((c) => c.text === 'Body of section.')).toBe(true);
    });

    test('propagates fetch errors (does not swallow)', async () => {
        const { FetchError } = require('../lib/errors');
        safeFetch.mockRejectedValueOnce(new FetchError('boom', 'FETCH_FAILED'));
        const scraper = new WebScraper();
        await expect(scraper.scrape('https://example.com')).rejects.toThrow('boom');
    });
});
