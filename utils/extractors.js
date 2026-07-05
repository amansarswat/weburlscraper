/**
 * Content extractors.
 *
 * Each extractor is a pure function of a Cheerio instance, which keeps them
 * trivially unit-testable without any network access.
 */

/** Extract the page title from the most reliable source available. */
function extractTitle($) {
    return (
        $('meta[property="og:title"]').attr('content') ||
        $('title').first().text().trim() ||
        $('h1').first().text().trim() ||
        'Untitled'
    );
}

/** Extract a page description from meta tags, falling back to the first paragraph. */
function extractDescription($) {
    return (
        $('meta[name="description"]').attr('content') ||
        $('meta[property="og:description"]').attr('content') ||
        $('p').first().text().trim().substring(0, 160) ||
        ''
    );
}

/** Headings paired with their immediately following paragraph(s). */
function extractHeadingParagraphs($) {
    const content = [];
    $('h1, h2, h3, h4, h5, h6').each((_i, element) => {
        const heading = $(element).text().trim();
        const level = $(element).prop('tagName').toLowerCase();
        if (!heading) return;

        const paragraphs = [];
        let next = $(element).next();
        while (next.length && !next.is('h1, h2, h3, h4, h5, h6')) {
            if (next.is('p')) {
                const text = next.text().trim();
                if (text) paragraphs.push(text);
            }
            next = next.next();
            if (paragraphs.length >= 3) break; // cap to avoid runaway sections
        }

        if (paragraphs.length > 0) {
            content.push({
                type: 'heading-paragraph',
                heading,
                paragraph: paragraphs.join(' '),
                paragraphs,
                level,
            });
        }
    });
    return content;
}

/** All meaningful text nodes (headings, paragraphs, list items) over a min length. */
function extractAllText($) {
    const content = [];
    $('h1, h2, h3, h4, h5, h6, p, li').each((_i, element) => {
        const text = $(element).text().trim();
        const tag = $(element).prop('tagName').toLowerCase();
        if (text && text.length > 15) {
            content.push({
                type: tag.startsWith('h') ? 'heading' : tag,
                text,
                level: tag.startsWith('h') ? tag : undefined,
            });
        }
    });
    return content;
}

/** Article-like content from common article containers. */
function extractArticles($) {
    const content = [];
    const selectors = [
        'article',
        '.article',
        '.post',
        '.content',
        '.entry-content',
        '.post-content',
        '[role="main"]',
        'main',
    ];

    for (const selector of selectors) {
        $(selector).each((index, element) => {
            const title = $(element).find('h1, h2, h3').first().text().trim();
            const paragraphs = $(element)
                .find('p')
                .map((_i, p) => $(p).text().trim())
                .get()
                .filter((text) => text.length > 0);

            if (paragraphs.length > 0) {
                content.push({
                    type: 'article',
                    title: title || `Article ${index + 1}`,
                    content: paragraphs.join(' '),
                    paragraphs,
                    selector,
                });
            }
        });
        if (content.length > 0) break; // first selector that yields content wins
    }

    return content;
}

/** Ordered and unordered lists. */
function extractLists($) {
    const content = [];
    $('ul, ol').each((_i, element) => {
        const items = $(element)
            .find('li')
            .map((_j, li) => $(li).text().trim())
            .get()
            .filter((item) => item.length > 0);

        if (items.length > 0) {
            content.push({
                type: $(element).prop('tagName').toLowerCase() === 'ul' ? 'unordered-list' : 'ordered-list',
                items,
                count: items.length,
            });
        }
    });
    return content;
}

/** Tables with headers and rows. */
function extractTables($) {
    const content = [];
    $('table').each((_i, element) => {
        const headers = $(element)
            .find('th')
            .map((_j, th) => $(th).text().trim())
            .get();
        const rows = [];
        $(element)
            .find('tr')
            .each((_j, tr) => {
                const cells = $(tr)
                    .find('td')
                    .map((_k, td) => $(td).text().trim())
                    .get();
                if (cells.length > 0) rows.push(cells);
            });

        if (rows.length > 0) {
            content.push({
                type: 'table',
                headers,
                rows,
                rowCount: rows.length,
                columnCount: Math.max(...rows.map((row) => row.length)),
            });
        }
    });
    return content;
}

/** Arbitrary content matched by a caller-supplied CSS selector. */
function extractCustom($, selector) {
    if (!selector) return [];
    const content = [];
    try {
        $(selector).each((_i, element) => {
            const text = $(element).text().trim();
            if (text) {
                content.push({
                    type: 'custom',
                    text,
                    html: $(element).html(),
                    selector,
                    tagName: $(element).prop('tagName').toLowerCase(),
                });
            }
        });
    } catch {
        // Cheerio rarely throws on selectors, but guard anyway.
    }
    return content;
}

/** Map of mode name -> extractor. */
const EXTRACTORS = {
    'headings-paragraphs': ($) => extractHeadingParagraphs($),
    'all-text': ($) => extractAllText($),
    articles: ($) => extractArticles($),
    lists: ($) => extractLists($),
    tables: ($) => extractTables($),
    custom: ($, options) => extractCustom($, options.selector),
};

const MODES = [
    { name: 'headings-paragraphs', description: 'Extract headings with their associated paragraphs', default: true },
    { name: 'all-text', description: 'Extract all text content (headings, paragraphs, lists)' },
    { name: 'articles', description: 'Extract article content from common article selectors' },
    { name: 'lists', description: 'Extract ordered and unordered lists' },
    { name: 'tables', description: 'Extract table data with headers and rows' },
    { name: 'custom', description: 'Extract content using a custom CSS selector', requiresOptions: ['selector'] },
];

const MODE_NAMES = MODES.map((m) => m.name);

/**
 * Run the extractor for a mode.
 * @param {import('cheerio').CheerioAPI} $
 * @param {string} mode
 * @param {object} options
 */
function extract($, mode, options = {}) {
    const extractor = EXTRACTORS[mode] || EXTRACTORS['headings-paragraphs'];
    return extractor($, options);
}

module.exports = {
    extract,
    extractTitle,
    extractDescription,
    extractHeadingParagraphs,
    extractAllText,
    extractArticles,
    extractLists,
    extractTables,
    extractCustom,
    EXTRACTORS,
    MODES,
    MODE_NAMES,
};
