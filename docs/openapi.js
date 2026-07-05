/**
 * OpenAPI 3.0 specification (as a JS object so it can interpolate the live
 * version and config). Served as JSON at /api/openapi.json and rendered by
 * Swagger UI at /api/docs.
 */

const config = require('../config');
const { MODE_NAMES } = require('../utils/extractors');

module.exports = {
    openapi: '3.0.3',
    info: {
        title: 'URL Scraper API',
        version: config.version,
        description:
            'Extract structured content from web pages. Supports multiple extraction modes, optional JavaScript rendering, batch scraping, caching, and SSRF-safe fetching.',
        license: { name: 'MIT' },
    },
    servers: [{ url: '/', description: 'This server' }],
    tags: [
        { name: 'Scraping', description: 'Content extraction endpoints' },
        { name: 'Meta', description: 'Modes and documentation' },
        { name: 'Ops', description: 'Health and metrics' },
    ],
    components: {
        securitySchemes: {
            ApiKeyAuth: { type: 'apiKey', in: 'header', name: config.auth.headerName },
            BearerAuth: { type: 'http', scheme: 'bearer' },
        },
        schemas: {
            ScrapeRequest: {
                type: 'object',
                required: ['url'],
                properties: {
                    url: { type: 'string', example: 'https://example.com' },
                    mode: { type: 'string', enum: MODE_NAMES, default: 'headings-paragraphs' },
                    render: { type: 'boolean', default: false, description: 'Render JavaScript with a headless browser' },
                    options: {
                        type: 'object',
                        properties: { selector: { type: 'string', description: 'CSS selector (required for mode=custom)' } },
                    },
                },
            },
            BatchScrapeRequest: {
                type: 'object',
                required: ['urls'],
                properties: {
                    urls: { type: 'array', items: { type: 'string' }, maxItems: config.scraper.maxBatchUrls },
                    mode: { type: 'string', enum: MODE_NAMES, default: 'headings-paragraphs' },
                    render: { type: 'boolean', default: false },
                    options: { type: 'object', properties: { selector: { type: 'string' } } },
                },
            },
            CaptureRequest: {
                type: 'object',
                required: ['url'],
                properties: {
                    url: { type: 'string', example: 'https://example.com' },
                    encoding: { type: 'string', enum: ['base64', 'binary'], default: 'base64' },
                    fullPage: { type: 'boolean', default: true, description: 'Screenshot only' },
                    type: { type: 'string', enum: ['png', 'jpeg'], default: 'png', description: 'Screenshot only' },
                    format: { type: 'string', default: 'A4', description: 'PDF only' },
                    landscape: { type: 'boolean', default: false, description: 'PDF only' },
                },
            },
            Error: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: false },
                    error: { type: 'string' },
                    code: { type: 'string' },
                    field: { type: 'string' },
                },
            },
        },
    },
    security: config.auth.apiKeys.length > 0 ? [{ ApiKeyAuth: [] }, { BearerAuth: [] }] : [],
    paths: {
        '/api/scrape': {
            post: {
                tags: ['Scraping'],
                summary: 'Scrape a single URL',
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/ScrapeRequest' } } },
                },
                responses: {
                    200: { description: 'Content scraped successfully' },
                    400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                    401: { description: 'Missing or invalid API key' },
                    403: { description: 'Blocked (SSRF / robots.txt / protocol)' },
                    429: { description: 'Rate limit exceeded' },
                    502: { description: 'Upstream fetch failed' },
                    503: { description: 'Queue full / timed out' },
                },
            },
        },
        '/api/scrape/batch': {
            post: {
                tags: ['Scraping'],
                summary: `Scrape multiple URLs (max ${config.scraper.maxBatchUrls})`,
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/BatchScrapeRequest' } } },
                },
                responses: { 200: { description: 'Batch completed (per-URL success/failure)' }, 400: { description: 'Validation error' } },
            },
        },
        '/api/screenshot': {
            post: {
                tags: ['Scraping'],
                summary: 'Capture a screenshot (requires JS rendering)',
                description: 'Returns base64 JSON by default, or a raw image when `encoding: "binary"`.',
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/CaptureRequest' } } },
                },
                responses: {
                    200: { description: 'Screenshot (base64 JSON or image/*)' },
                    501: { description: 'Rendering unavailable' },
                    503: { description: 'Queue full / timed out' },
                },
            },
        },
        '/api/pdf': {
            post: {
                tags: ['Scraping'],
                summary: 'Render a URL to PDF (requires JS rendering)',
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/CaptureRequest' } } },
                },
                responses: {
                    200: { description: 'PDF (base64 JSON or application/pdf)' },
                    501: { description: 'Rendering unavailable' },
                    503: { description: 'Queue full / timed out' },
                },
            },
        },
        '/api/modes': {
            get: { tags: ['Meta'], summary: 'List available scraping modes and outputs', responses: { 200: { description: 'OK' } } },
        },
        '/api/usage': {
            get: { tags: ['Ops'], summary: 'Usage analytics summary + queue stats', responses: { 200: { description: 'OK' } } },
        },
        '/health': {
            get: { tags: ['Ops'], summary: 'Liveness check', security: [], responses: { 200: { description: 'Healthy' } } },
        },
        '/health/detailed': {
            get: { tags: ['Ops'], summary: 'Detailed diagnostics & enabled features', security: [], responses: { 200: { description: 'OK' } } },
        },
        '/metrics': {
            get: { tags: ['Ops'], summary: 'Prometheus metrics', security: [], responses: { 200: { description: 'OK (text/plain)' } } },
        },
    },
};
