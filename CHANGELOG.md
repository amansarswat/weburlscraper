# Changelog

All notable changes to this project are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

## [2.3.0] - 2026-07-05

### Removed / Changed
- **Removed the `genesis-original` extraction mode** and all project branding.
  Extraction modes are now: `headings-paragraphs`, `all-text`, `articles`, `lists`,
  `tables`, `custom` (6 total). This is a breaking change for any caller that used
  `mode: "genesis-original"` — use `headings-paragraphs` instead.

## [2.2.0] - 2026-07-05

### Added
- **Web console** ([web/](web/)) — a React + Vite + TypeScript single-page app with
  a scrape **playground** (typed result rendering + JSON view), **screenshot/PDF**
  capture with preview/download, and a live **usage dashboard** (stat tiles + charts
  built on the validated data-viz palette, light/dark aware). Zero runtime deps.
  Verified end-to-end in a real headless browser.
- **`SERVE_UI`** flag: the API can serve the built console at `/app`, so a single
  process hosts both API and UI. Configurable build path via `UI_DIR`.

## [2.1.0] - 2026-07-05

### Added
- **Screenshots & PDF**: `POST /api/screenshot` (PNG/JPEG, full-page or viewport)
  and `POST /api/pdf` (Chromium PDF). Both return a base64 JSON envelope by default
  or raw bytes with `"encoding":"binary"`. SSRF-guarded like all rendering.
- **Throttled request queue** ([lib/queue.js](lib/queue.js)): caps global and
  per-domain scrape concurrency with an optional politeness delay; overflow →
  `503 QUEUE_FULL`, excessive wait → `503 QUEUE_TIMEOUT`. Live depth in
  `/health/detailed` and `/api/usage`. Configurable via `SCRAPE_MAX_CONCURRENCY`,
  `SCRAPE_PER_DOMAIN_CONCURRENCY`, `SCRAPE_PER_DOMAIN_DELAY_MS`, etc.
- **Usage analytics** ([lib/analytics.js](lib/analytics.js)) at `GET /api/usage`:
  totals, cache-hit/error rates, breakdown by mode and error code, top target
  domains, and per-API-key usage.
- **Typed client SDK** (`url-scraper-api/sdk`): isomorphic, zero-dependency
  `UrlScraperClient` with bundled TypeScript declarations; exposed via package
  `exports` and `types`. Errors surface as a typed `ScraperApiError`.
- Package `files` allowlist for clean publishing.

### Changed
- `GET /api/modes` now also reports available `outputs` (`content`, `screenshot`, `pdf`).
- Graceful shutdown now drains the scrape queue's pending timers.

## [2.0.0] - 2026-07-05

Major production-hardening release. Some response fields changed; see "Breaking".

### Security
- **SSRF protection rewritten.** URLs are now resolved via DNS and every resolved
  IP is checked against loopback/private/link-local/unique-local/CGNAT/reserved
  ranges (incl. IPv6 and IPv4-mapped IPv6). Redirects are followed manually and
  re-validated at every hop, and the socket is **pinned to the validated IP** to
  defeat DNS-rebinding. The cloud metadata endpoint (`169.254.169.254`) and
  redirect-to-internal attacks are now blocked. Batch requests are validated too.
- **Optional API-key authentication** (`API_KEYS`), constant-time comparison,
  via `x-api-key` header or `Authorization: Bearer`. Off by default with a loud
  startup warning.
- Dependencies upgraded to patched versions — `npm audit` reports **0 vulnerabilities**
  (previously 15, including an SSRF CVE in axios). Non-HTTP(S) protocols rejected.

### Added
- **JavaScript rendering via Playwright** (`"render": true`), lazy-loaded and
  opt-in, with a shared browser, concurrency cap, and SSRF pre-checks.
- **Response caching** (in-memory LRU; shared Redis when `REDIS_URL` is set).
- **Prometheus metrics** at `GET /metrics` (request + scrape histograms, cache hits).
- **OpenAPI 3.0 spec** at `/api/openapi.json` and **Swagger UI** at `/api/docs`.
- **robots.txt compliance** (`RESPECT_ROBOTS`, cached).
- **Structured logging** (pino) with per-request IDs (`x-request-id`).
- Cluster-safe **rate limiting** via optional Redis store; limits key by API key
  then IP.
- Centralized, validated **config module**; typed error classes and a central
  error handler; graceful shutdown that drains in-flight requests.
- Comprehensive test suite (61 tests): SSRF, extractors, API, auth, orchestration.
- CI workflow (lint + test on Node 18/20/22 + Docker build), ESLint config,
  `LICENSE`, `CHANGELOG`, `Dockerfile.playwright`.

### Fixed
- App no longer calls `listen()` on import (`app.js` is a factory; `server.js`
  bootstraps), fixing `EADDRINUSE` during tests.
- Batch endpoint now rejects empty arrays and validates each URL + mode.
- DNS/validation failures fail fast instead of retrying; retries apply only to
  transient network errors.

### Breaking
- Requires **Node.js >= 18** and uses **Express 5**.
- Start command is now `node server.js` (was `node app.js`); `app.js` exports an
  app factory (`require('./app')()`).
- `GET /api/docs` now serves Swagger UI (was JSON); the machine-readable spec is
  at `GET /api/openapi.json`.
- Scrape result: `data.url` is the **final** URL after redirects; `data.requestedUrl`
  holds the original. Added `data.metadata.rendered` and top-level `cached`.
- Error responses now always include a machine-readable `code`.

## [1.0.0]
- Initial release: multiple scraping modes, basic security, Docker, docs.
