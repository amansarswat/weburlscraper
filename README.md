# URL Scraper API

A production-ready, self-hostable **web-scraping API**. Extract structured content
from any web page — headings, articles, lists, tables, or custom selectors — with
**SSRF-safe fetching**, **optional JavaScript rendering**, screenshots & PDF,
caching, rate limiting, metrics, a typed client SDK, and a web console.

[![CI](https://github.com/amansarswat/weburlscraper/actions/workflows/ci.yml/badge.svg)](https://github.com/amansarswat/weburlscraper/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![Express](https://img.shields.io/badge/express-5-blue)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## Contents

- [Highlights](#-highlights)
- [Requirements](#-requirements)
- [Quick start](#-quick-start)
- [API reference](#-api-reference)
- [Extraction modes](#-extraction-modes)
- [Screenshots & PDF](#-screenshots--pdf)
- [Client SDK](#-client-sdk)
- [Web console](#-web-console)
- [Security](#-security)
- [Throttling & queue](#-throttling--queue)
- [Configuration](#-configuration)
- [Deployment](#-deployment)
- [Observability](#-observability)
- [Development](#-development)
- [Project structure](#-project-structure)
- [License](#-license)

## ✨ Highlights

| | |
|---|---|
| 🔒 **SSRF-safe by default** | DNS-resolved IP checks, per-redirect re-validation, and socket pinning defeat private-network, cloud-metadata, and DNS-rebinding attacks. |
| 🧭 **6 extraction modes** | `headings-paragraphs`, `articles`, `lists`, `tables`, `all-text`, and `custom` (CSS selector). |
| 🖥️ **JavaScript rendering** | Opt-in headless-Chromium rendering (`render: true`) for React/Vue/Angular/SPA sites, via Playwright. |
| 📸 **Screenshots & PDF** | `POST /api/screenshot` and `POST /api/pdf` — full-page PNG/JPEG or Chromium PDF, base64 or raw bytes. |
| 🚦 **Throttled queue** | Global + per-domain concurrency caps and a politeness delay; overflow rejected fast (503). |
| 🔑 **Optional API keys** | Enable auth with one env var; constant-time key checks; per-key rate limits. |
| ⚡ **Caching** | In-memory LRU out of the box, shared Redis for clusters. |
| 📊 **Observability** | Prometheus `/metrics`, usage analytics (`/api/usage`), structured JSON logs with request IDs, health probes. |
| 📦 **Typed client SDK** | `url-scraper-api/sdk` — isomorphic, zero-dependency, fully typed (`.d.ts`). |
| 🖼️ **Web console** | React SPA ([web/](web/)) — scrape playground, screenshot/PDF capture, live usage dashboard. Optionally served by the API at `/app`. |
| 📚 **OpenAPI + Swagger UI** | Interactive docs at `/api/docs`; machine-readable spec at `/api/openapi.json`. |
| 🐳 **Deploy anywhere** | Docker (static + rendering images), docker-compose, PM2, Nginx examples. |

## 📋 Requirements

- **Node.js ≥ 20** (required by `cheerio` and `lru-cache`; Express 5, global `fetch`).
- **Optional:** Chromium via Playwright for JS rendering / screenshots / PDF.
- **Optional:** Redis for cluster-safe rate limiting and a shared cache.

## 🚀 Quick start

```bash
git clone https://github.com/amansarswat/weburlscraper.git
cd weburlscraper

npm install
cp config.env.example .env      # optional; sensible defaults otherwise
npm start                       # -> http://localhost:3000
```

Scrape something:

```bash
curl -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","mode":"headings-paragraphs"}'
```

Open interactive docs at **http://localhost:3000/api/docs**.

### Enable JavaScript rendering (optional)

Playwright is installed automatically (it's an optional dependency); you just need
the browser binary:

```bash
npx playwright install chromium
```

Then pass `"render": true` to `/api/scrape`, or use `/api/screenshot` and `/api/pdf`.

## 🔧 API reference

| Method & path | Description | Auth¹ |
|---|---|:---:|
| `POST /api/scrape` | Scrape a single URL | ✅ |
| `POST /api/scrape/batch` | Scrape up to `MAX_BATCH_URLS` URLs | ✅ |
| `POST /api/screenshot` | Capture a PNG/JPEG screenshot (needs rendering) | ✅ |
| `POST /api/pdf` | Render a URL to PDF (needs rendering) | ✅ |
| `GET /api/modes` | List extraction modes, outputs, rendering availability | — |
| `GET /api/usage` | Usage analytics summary + live queue stats | ✅ |
| `GET /api/docs` | Swagger UI | — |
| `GET /api/openapi.json` | OpenAPI 3.0 spec | — |
| `GET /health`, `/health/detailed` | Liveness + diagnostics | — |
| `GET /metrics` | Prometheus metrics | — |

> ¹ Auth applies only when `API_KEYS` is set. When it's empty the API is open (with
> a startup warning) and every endpoint is reachable without a key.

### `POST /api/scrape`

**Request**

```json
{
  "url": "https://example.com",
  "mode": "headings-paragraphs",
  "render": false,
  "options": { "selector": ".article p" }
}
```

| Field | Required | Description |
|---|---|---|
| `url` | ✅ | Target URL (scheme optional; defaults to `https://`). |
| `mode` | — | Extraction mode (default `headings-paragraphs`). See [modes](#-extraction-modes). |
| `render` | — | `true` renders JavaScript with a headless browser. |
| `options.selector` | when `mode=custom` | CSS selector to extract. |

**Response**

```json
{
  "success": true,
  "message": "Content scraped successfully",
  "cached": false,
  "data": {
    "url": "https://example.com/",
    "requestedUrl": "https://example.com",
    "title": "Example Domain",
    "description": "…",
    "content": [
      { "type": "heading-paragraph", "heading": "…", "paragraph": "…", "level": "h1" }
    ],
    "metadata": {
      "totalItems": 1,
      "scrapedAt": "2026-07-05T00:00:00.000Z",
      "mode": "headings-paragraphs",
      "rendered": false,
      "contentLength": 1256
    }
  },
  "performance": { "duration": 267, "itemsExtracted": 1 }
}
```

`data.url` is the **final** URL after redirects; `data.requestedUrl` is what you sent.

**Errors** always include a machine-readable `code`:

```json
{ "success": false, "error": "Access to non-public IP addresses is not allowed", "code": "PRIVATE_IP_BLOCKED" }
```

| Status | Codes |
|---|---|
| 400 | `VALIDATION_ERROR` |
| 401 | `UNAUTHORIZED` |
| 403 | `PRIVATE_IP_BLOCKED`, `PROTOCOL_BLOCKED`, `ROBOTS_DISALLOWED` |
| 429 | `RATE_LIMITED` |
| 501 | `RENDER_UNAVAILABLE`, `RENDER_DISABLED` |
| 502 | `FETCH_FAILED`, `DNS_FAILED`, `TOO_MANY_REDIRECTS` |
| 503 | `QUEUE_FULL`, `QUEUE_TIMEOUT` |

### Batch

```bash
curl -X POST http://localhost:3000/api/scrape/batch \
  -H "Content-Type: application/json" \
  -d '{"urls":["https://a.com","https://b.com"],"mode":"articles"}'
```

Each URL succeeds or fails independently; the response reports per-URL results and
an aggregate summary. The queue still throttles real concurrency and per-domain
politeness.

## 🧭 Extraction modes

| Mode | Extracts |
|---|---|
| `headings-paragraphs` *(default)* | Each heading with its following paragraph(s) |
| `articles` | Article bodies from common containers (`article`, `main`, `.post`, …) |
| `lists` | Ordered/unordered lists with items |
| `tables` | Tables → headers + rows |
| `all-text` | All headings/paragraphs/list-items over a length threshold |
| `custom` | Nodes matching `options.selector` |

## 📸 Screenshots & PDF

Both require JavaScript rendering to be available (`npx playwright install chromium`).

```bash
# Base64 JSON (default)
curl -X POST http://localhost:3000/api/screenshot \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","fullPage":true,"type":"png"}'

# Raw bytes straight to a file
curl -X POST http://localhost:3000/api/pdf \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","encoding":"binary"}' --output page.pdf
```

- **`/api/screenshot`** accepts `fullPage`, `type` (`png`|`jpeg`), `quality`, `width`, `height`.
- **`/api/pdf`** accepts `format` (e.g. `A4`), `landscape`, `printBackground`.
- Add `"encoding":"binary"` to either for raw bytes instead of a base64 envelope.

## 📦 Client SDK

A zero-dependency, fully-typed client ships in the package (`url-scraper-api/sdk`):

```js
const { UrlScraperClient } = require('url-scraper-api/sdk');

const client = new UrlScraperClient({ baseUrl: 'http://localhost:3000', apiKey: 'secret' });

const { data } = await client.scrape('https://example.com', { mode: 'articles' });
const png = await client.screenshot('https://example.com', { binary: true }); // Buffer
const usage = await client.getUsage();
```

Methods: `scrape`, `scrapeBatch`, `screenshot`, `pdf`, `getModes`, `getUsage`,
`health`. Errors throw a typed `ScraperApiError` (with `.status` and `.code`).
TypeScript declarations are bundled ([sdk/index.d.ts](sdk/index.d.ts)).

## 🖼️ Web console

A React single-page app in [web/](web/) with a scrape **playground**,
**screenshot/PDF** capture, and a live **usage dashboard**.

```bash
# Development (hot reload; proxies API calls to :3000)
cd web && npm install && npm run dev        # -> http://localhost:5173

# Or serve the built console from the API itself (single process)
cd web && npm install && npm run build
cd .. && SERVE_UI=true npm start            # -> http://localhost:3000/app
```

Set the API base URL and API key from the app's top bar (saved to `localStorage`).
See [web/README.md](web/README.md).

## 🔒 Security

- **SSRF guard** ([security/ssrf.js](security/ssrf.js)): resolves DNS and rejects
  any request whose IP is loopback, private, link-local (incl. the cloud-metadata
  address `169.254.169.254`), unique-local, CGNAT, reserved, or an IPv4-mapped form
  of those — for the target **and every redirect hop**. The connection is pinned to
  the checked IP so DNS cannot be rebound between check and connect. Only `http`/`https`
  are allowed.
  > `ALLOW_PRIVATE_ADDRESSES=true` disables this for internal/self-hosted use.
  > **Never** enable it on a publicly-reachable instance.
- **API keys** — set `API_KEYS=key1,key2`. Clients send `x-api-key: <key>` or
  `Authorization: Bearer <key>`. Meta/health endpoints stay open; rate limits are
  keyed per API key.
- **Rate limiting** — a general limit plus a stricter scrape limit. For clusters,
  set `REDIS_URL` so limits are shared (otherwise each worker counts separately).
- **Helmet** security headers, configurable **CORS**, and request body-size limits.

## 🚦 Throttling & queue

Scrapes run through a queue that caps **global** and **per-domain** concurrency, with
an optional delay between requests to the same domain. Requests beyond
`SCRAPE_QUEUE_MAX` are rejected with `503 QUEUE_FULL`; those that wait past
`SCRAPE_QUEUE_TIMEOUT_MS` get `503 QUEUE_TIMEOUT`. Live queue depth is visible at
`GET /health/detailed` and `GET /api/usage`.

```bash
SCRAPE_MAX_CONCURRENCY=10
SCRAPE_PER_DOMAIN_CONCURRENCY=2
SCRAPE_PER_DOMAIN_DELAY_MS=0
```

## ⚙️ Configuration

All settings are environment variables — see [config.env.example](config.env.example)
for the complete, commented list. The most common:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `API_KEYS` | *(empty)* | Comma-separated keys; empty = open (warns at boot) |
| `RATE_LIMIT` / `SCRAPER_RATE_LIMIT` | `100` / `20` | Requests per window (general / scrape) |
| `SCRAPER_TIMEOUT` | `10000` | Per-request fetch timeout (ms) |
| `RENDER_ENABLED` | `true` | Allow JS rendering / screenshots / PDF |
| `RESPECT_ROBOTS` | `false` | Honor target `robots.txt` |
| `CACHE_ENABLED` | `true` | Response caching |
| `REDIS_URL` | *(empty)* | Shared cache + rate limits across instances |
| `SERVE_UI` | `false` | Serve the built web console at `/app` |
| `METRICS_ENABLED` | `true` | Expose `/metrics` |
| `LOG_LEVEL` | `info` | `trace`…`fatal` |

## 🐳 Deployment

### Docker

```bash
# Static scraping (small image, no browser)
docker build -t url-scraper-api .
docker run -p 3000:3000 -e API_KEYS=changeme url-scraper-api

# With JavaScript rendering (bundles Chromium)
docker build -f Dockerfile.playwright -t url-scraper-api:render .
```

### docker-compose

```bash
docker compose up                        # app only
docker compose --profile with-redis up   # app + Redis (shared limits/cache)
```

### PM2

```bash
npm run pm2:start     # cluster mode; set REDIS_URL for correct shared limits
```

### Nginx reverse proxy

```nginx
server {
  listen 80;
  server_name your-domain.com;
  location / {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for cloud-specific guides.

## 📈 Observability

- **`GET /metrics`** — Prometheus (`http_request_duration_seconds`,
  `scrape_requests_total`, `scrape_duration_seconds`, `scrape_cache_hits_total`,
  plus default Node process metrics).
- **`GET /api/usage`** — human-friendly JSON summary: totals, cache-hit/error rates,
  breakdown by mode and error code, top target domains, per-API-key usage, and live
  queue depth.
- **`GET /health` / `GET /health/detailed`** — liveness + enabled-features report.
- Structured JSON logs (pino) with an `x-request-id` on every request/response.

## 🧪 Development

```bash
npm run dev            # nodemon + pretty logs
npm test               # jest — 77 tests, no network required
npm run test:coverage  # tests + coverage report
npm run lint           # eslint
```

The test suite is hermetic: SSRF blocking, extractors, the queue, analytics, auth,
the HTTP endpoints, and the SDK are all covered without hitting the network.

## 📦 Project structure

```
app.js            Express app factory (no side effects)
server.js         Bootstrap + graceful shutdown (entrypoint)
config/           Centralized, validated configuration
routes/           scraper, health, metrics
middleware/       auth, validator, errorHandler
security/         ssrf (guard + safe fetch), robots
utils/            WebScraper (orchestrator), extractors, renderer (render/screenshot/pdf)
lib/              logger, cache, rateLimit, metrics, errors, asyncHandler, queue, scrapeQueue, analytics
docs/             OpenAPI spec
sdk/              typed client (index.js + index.d.ts)
web/              React + Vite web console (playground, capture, dashboard)
tests/            unit + integration tests (77)
```

## 📄 License

MIT — see [LICENSE](LICENSE). Changes are tracked in [CHANGELOG.md](CHANGELOG.md).

> **Scrape responsibly.** Respect each site's Terms of Service and `robots.txt`
> (set `RESPECT_ROBOTS=true`), and follow the laws that apply to you.
