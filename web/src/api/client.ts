// Browser API client. Talks to the API through the Vite dev proxy (same-origin
// paths like /api/...) or to an explicit base URL. Sends the API key when set.

import type { ModesResponse, ScrapeResponse, CaptureResponse, UsageResponse, HealthResponse } from '../types';

export class ApiError extends Error {
    status?: number;
    code?: string;
    field?: string;
    constructor(message: string, opts: { status?: number; code?: string; field?: string } = {}) {
        super(message);
        this.name = 'ApiError';
        this.status = opts.status;
        this.code = opts.code;
        this.field = opts.field;
    }
}

export interface ClientConfig {
    baseUrl: string; // '' means same-origin (use the dev proxy)
    apiKey: string;
}

function headers(cfg: ClientConfig, json: boolean): HeadersInit {
    const h: Record<string, string> = {};
    if (json) h['content-type'] = 'application/json';
    if (cfg.apiKey) h['x-api-key'] = cfg.apiKey;
    return h;
}

async function parseError(res: Response): Promise<ApiError> {
    let body: { error?: string; code?: string; field?: string } = {};
    try {
        body = await res.json();
    } catch {
        /* non-JSON error */
    }
    return new ApiError(body.error || `HTTP ${res.status}`, { status: res.status, code: body.code, field: body.field });
}

async function postJson<T>(cfg: ClientConfig, path: string, body: unknown): Promise<T> {
    const res = await fetch(`${cfg.baseUrl}${path}`, {
        method: 'POST',
        headers: headers(cfg, true),
        body: JSON.stringify(body),
    });
    if (!res.ok) throw await parseError(res);
    return res.json() as Promise<T>;
}

async function getJson<T>(cfg: ClientConfig, path: string): Promise<T> {
    const res = await fetch(`${cfg.baseUrl}${path}`, { headers: headers(cfg, false) });
    if (!res.ok) throw await parseError(res);
    return res.json() as Promise<T>;
}

export const api = {
    getModes: (cfg: ClientConfig) => getJson<ModesResponse>(cfg, '/api/modes'),
    getUsage: (cfg: ClientConfig) => getJson<UsageResponse>(cfg, '/api/usage'),
    health: (cfg: ClientConfig) => getJson<HealthResponse>(cfg, '/health/detailed'),
    scrape: (cfg: ClientConfig, body: unknown) => postJson<ScrapeResponse>(cfg, '/api/scrape', body),
    screenshot: (cfg: ClientConfig, body: unknown) => postJson<CaptureResponse>(cfg, '/api/screenshot', body),
    pdf: (cfg: ClientConfig, body: unknown) => postJson<CaptureResponse>(cfg, '/api/pdf', body),
};
