/**
 * Extractor unit tests (pure, no network).
 */

const cheerio = require('cheerio');
const extractors = require('../utils/extractors');

const load = (html) => cheerio.load(html);

describe('extractors', () => {
    describe('extractTitle / extractDescription', () => {
        test('reads <title> and meta description', () => {
            const $ = load(
                '<html><head><title>My Page</title><meta name="description" content="A description"></head><body></body></html>'
            );
            expect(extractors.extractTitle($)).toBe('My Page');
            expect(extractors.extractDescription($)).toBe('A description');
        });

        test('prefers og:title when present', () => {
            const $ = load('<head><title>Plain</title><meta property="og:title" content="OG Title"></head>');
            expect(extractors.extractTitle($)).toBe('OG Title');
        });

        test('falls back to Untitled', () => {
            expect(extractors.extractTitle(load('<body></body>'))).toBe('Untitled');
        });
    });

    describe('extractHeadingParagraphs', () => {
        test('associates a heading with following paragraphs', () => {
            const $ = load('<h1>Title</h1><p>One.</p><p>Two.</p><h2>Next</h2>');
            const result = extractors.extractHeadingParagraphs($);
            expect(result[0]).toMatchObject({ heading: 'Title', level: 'h1', paragraphs: ['One.', 'Two.'] });
        });
    });

    describe('extractLists', () => {
        test('extracts ul and ol with item counts', () => {
            const $ = load('<ul><li>a</li><li>b</li></ul><ol><li>1</li></ol>');
            const result = extractors.extractLists($);
            expect(result).toEqual([
                { type: 'unordered-list', items: ['a', 'b'], count: 2 },
                { type: 'ordered-list', items: ['1'], count: 1 },
            ]);
        });
    });

    describe('extractTables', () => {
        test('extracts headers and rows with dimensions', () => {
            const $ = load(
                '<table><tr><th>H1</th><th>H2</th></tr><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></table>'
            );
            const [table] = extractors.extractTables($);
            expect(table).toMatchObject({ headers: ['H1', 'H2'], rowCount: 2, columnCount: 2 });
        });
    });

    describe('extractCustom', () => {
        test('extracts text for a selector', () => {
            const $ = load('<div class="x">Hello</div><div class="x">World</div>');
            const result = extractors.extractCustom($, '.x');
            expect(result.map((r) => r.text)).toEqual(['Hello', 'World']);
        });

        test('returns empty for no selector', () => {
            expect(extractors.extractCustom(load('<p>x</p>'))).toEqual([]);
        });
    });

    describe('extract dispatcher', () => {
        test('falls back to headings-paragraphs for unknown mode', () => {
            const $ = load('<h1>T</h1><p>P</p>');
            const result = extractors.extract($, 'nonexistent-mode');
            expect(result[0].type).toBe('heading-paragraph');
        });
    });
});
