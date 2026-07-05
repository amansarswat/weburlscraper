// API response shapes (mirrors the server + sdk/index.d.ts).

export type ScrapeMode =
    | 'headings-paragraphs'
    | 'all-text'
    | 'articles'
    | 'lists'
    | 'tables'
    | 'custom';

export interface ContentItem {
    type?: string;
    heading?: string;
    paragraph?: string;
    paragraphs?: string[];
    level?: string;
    text?: string;
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

export interface ScrapeData {
    url: string;
    requestedUrl: string;
    title: string;
    description: string;
    content: ContentItem[];
    metadata: {
        totalItems: number;
        scrapedAt: string;
        mode: string;
        rendered: boolean;
        contentLength: number;
    };
}

export interface ScrapeResponse {
    success: true;
    message: string;
    cached: boolean;
    data: ScrapeData;
    performance: { duration: number; itemsExtracted: number };
}

export interface CaptureResponse {
    success: true;
    data: {
        image?: string;
        pdf?: string;
        encoding: 'base64';
        contentType: string;
        finalUrl: string;
        bytes: number;
    };
    performance: { duration: number };
}

export interface ModeInfo {
    name: string;
    description: string;
    default?: boolean;
    requiresOptions?: string[];
}

export interface ModesResponse {
    success: true;
    data: { modes: ModeInfo[]; renderingAvailable: boolean; outputs: string[] };
}

export interface QueueStats {
    enabled: boolean;
    globalActive: number;
    queued: number;
    busyDomains: number;
    limits: { global: number; perDomain: number; perDomainDelayMs: number; maxQueue: number };
}

export interface UsageResponse {
    success: true;
    data: {
        since: string;
        uptimeSeconds: number;
        totals: {
            requests: number;
            success: number;
            error: number;
            cached: number;
            rendered: number;
            bytes: number;
            durationMsSum: number;
        };
        rates: { cacheHitRate: number; errorRate: number; avgDurationMs: number };
        byMode: Record<string, number>;
        byErrorCode: Record<string, number>;
        topDomains: { name: string; count: number }[];
        uniqueApiKeys: number;
        topApiKeys: { name: string; count: number }[];
        queue: QueueStats;
    };
}

export interface HealthResponse {
    success: true;
    status: string;
    version: string;
    features?: Record<string, unknown>;
    queue?: QueueStats;
}

export interface ApiError {
    success: false;
    error: string;
    code?: string;
    field?: string;
}
