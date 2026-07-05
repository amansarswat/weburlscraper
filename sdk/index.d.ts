/**
 * Type declarations for the URL Scraper API client.
 */

export type ScrapeMode =
    | 'headings-paragraphs'
    | 'all-text'
    | 'articles'
    | 'lists'
    | 'tables'
    | 'custom';

export interface ScrapeContentItem {
    type?: string;
    heading?: string;
    paragraph?: string;
    paragraphs?: string[];
    level?: string;
    text?: string;
    html?: string | null;
    title?: string;
    content?: string;
    items?: string[];
    count?: number;
    headers?: string[];
    rows?: string[][];
    rowCount?: number;
    columnCount?: number;
    selector?: string;
    tagName?: string;
}

export interface ScrapeMetadata {
    totalItems: number;
    scrapedAt: string;
    mode: ScrapeMode | string;
    rendered: boolean;
    contentLength: number;
}

export interface ScrapeData {
    url: string;
    requestedUrl: string;
    title: string;
    description: string;
    content: ScrapeContentItem[];
    metadata: ScrapeMetadata;
}

export interface ScrapeResponse {
    success: true;
    message: string;
    cached: boolean;
    data: ScrapeData;
    performance: { duration: number; itemsExtracted: number };
}

export interface BatchResultItem {
    url: string;
    success: boolean;
    cached?: boolean;
    data: ScrapeData | null;
    error: string | null;
    code?: string;
}

export interface BatchResponse {
    success: true;
    message: string;
    data: BatchResultItem[];
    performance: { duration: number; totalUrls: number; successfulUrls: number; failedUrls: number };
}

export interface CaptureResponse {
    success: true;
    data: {
        image?: string; // base64 (screenshot)
        pdf?: string; // base64 (pdf)
        encoding: 'base64';
        contentType: string;
        finalUrl: string;
        bytes: number;
    };
    performance: { duration: number };
}

export interface ModesResponse {
    success: true;
    data: {
        modes: Array<{ name: string; description: string; default?: boolean; requiresOptions?: string[] }>;
        renderingAvailable: boolean;
        outputs: string[];
    };
}

export interface UsageResponse {
    success: true;
    data: {
        since: string;
        uptimeSeconds: number;
        totals: Record<string, number>;
        rates: { cacheHitRate: number; errorRate: number; avgDurationMs: number };
        byMode: Record<string, number>;
        byErrorCode: Record<string, number>;
        topDomains: Array<{ name: string; count: number }>;
        uniqueApiKeys: number;
        topApiKeys: Array<{ name: string; count: number }>;
        queue: QueueStats;
    };
}

export interface QueueStats {
    enabled: boolean;
    globalActive: number;
    queued: number;
    busyDomains: number;
    limits: { global: number; perDomain: number; perDomainDelayMs: number; maxQueue: number };
}

export interface ScrapeOptions {
    mode?: ScrapeMode;
    render?: boolean;
    options?: { selector?: string };
}

export interface ScreenshotOptions {
    fullPage?: boolean;
    type?: 'png' | 'jpeg';
    quality?: number;
    width?: number;
    height?: number;
    /** Return a raw Buffer instead of a base64 JSON envelope. */
    binary?: boolean;
}

export interface PdfOptions {
    format?: string;
    landscape?: boolean;
    printBackground?: boolean;
    binary?: boolean;
}

export interface ClientOptions {
    baseUrl?: string;
    apiKey?: string;
    timeout?: number;
    fetch?: typeof fetch;
    headers?: Record<string, string>;
}

export class ScraperApiError extends Error {
    name: 'ScraperApiError';
    status?: number;
    code?: string;
    field?: string;
    response?: unknown;
}

export class UrlScraperClient {
    constructor(opts?: ClientOptions);
    scrape(url: string, options?: ScrapeOptions): Promise<ScrapeResponse>;
    scrapeBatch(urls: string[], options?: ScrapeOptions): Promise<BatchResponse>;
    screenshot(url: string, options: ScreenshotOptions & { binary: true }): Promise<Buffer>;
    screenshot(url: string, options?: ScreenshotOptions): Promise<CaptureResponse>;
    pdf(url: string, options: PdfOptions & { binary: true }): Promise<Buffer>;
    pdf(url: string, options?: PdfOptions): Promise<CaptureResponse>;
    getModes(): Promise<ModesResponse>;
    getUsage(): Promise<UsageResponse>;
    health(detailed?: boolean): Promise<Record<string, unknown>>;
}
