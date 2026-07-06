# 📦 Package Contents

Overview of every file in the URL Scraper API package (v2).

## 📁 Structure

```
url-scraper-package/
├── server.js               # Process entrypoint: bootstrap + graceful shutdown
├── app.js                  # Express app FACTORY (no side effects; import-safe)
├── package.json            # Deps, scripts, jest config
├── .eslintrc.json          # Lint rules
├── LICENSE                 # MIT
├── CHANGELOG.md            # Version history
│
├── config/
│   └── index.js            # Centralized, validated env configuration
│
├── routes/
│   ├── scraper.js          # POST /api/scrape, /api/scrape/batch, GET /api/modes
│   ├── health.js           # GET /health, /health/detailed
│   └── metrics.js          # GET /metrics (Prometheus)
│
├── middleware/
│   ├── auth.js             # Optional API-key authentication
│   ├── validator.js        # Request shape validation (single + batch)
│   └── errorHandler.js     # 404 + central typed-error handler
│
├── security/
│   ├── ssrf.js             # SSRF guard: DNS checks, redirect re-validation, IP pinning, safe fetch
│   └── robots.js           # robots.txt compliance (optional)
│
├── utils/
│   ├── WebScraper.js       # Orchestrator: fetch/render -> parse -> extract
│   ├── extractors.js       # Pure extraction functions (6 modes)
│   └── renderer.js         # Playwright JS rendering (lazy-loaded, opt-in)
│
├── lib/
│   ├── logger.js           # Structured logging (pino)
│   ├── cache.js            # LRU / Redis response cache
│   ├── rateLimit.js        # Rate-limiter factory (in-memory / Redis)
│   ├── metrics.js          # Prometheus registry + metrics
│   ├── errors.js           # Typed error classes
│   └── asyncHandler.js     # Async route error forwarding
│
├── docs/
│   └── openapi.js          # OpenAPI 3.0 spec (served at /api/docs & /api/openapi.json)
│
├── tests/                  # Jest suite (61 tests, no network needed)
│   ├── setup.js            # Forces NODE_ENV=test
│   ├── ssrf.test.js        # SSRF guard units
│   ├── extractors.test.js  # Extraction units for all modes
│   ├── webscraper.test.js  # Orchestration (network mocked)
│   ├── scraper.test.js     # API integration
│   └── auth.test.js        # API-key auth
│
├── scripts/
│   ├── setup.js            # First-run setup helper
│   └── test-api.js         # Smoke test against a running server
│
├── examples/
│   ├── client-examples.js  # Node.js client usage
│   └── react-example.jsx   # React integration
│
├── Dockerfile              # Static-scraping image (small)
├── Dockerfile.playwright   # Rendering image (bundles Chromium)
├── docker-compose.yml      # App (+ optional Redis profile)
├── ecosystem.config.js     # PM2 cluster config
├── config.env.example      # All env vars, documented
├── .github/workflows/ci.yml# Lint + test (Node 18/20/22) + Docker build
├── README.md               # Full documentation
├── QUICK_START.md          # 2-minute guide
└── DEPLOYMENT.md           # Deployment guide
```

## 🎯 Capabilities

- **6 extraction modes**: `headings-paragraphs`, `articles`, `lists`, `tables`,
  `all-text`, `custom` (CSS selector).
- **JavaScript rendering** (`render: true`) via Playwright/Chromium — opt-in, lazy-loaded.
- **SSRF-safe fetching**: DNS-resolved IP validation, per-redirect re-checks,
  socket pinning; blocks private/loopback/metadata targets.
- **Optional API-key auth**, per-key **rate limiting**, **caching** (LRU/Redis),
  **Prometheus metrics**, **OpenAPI/Swagger docs**, **robots.txt** compliance,
  structured logging, graceful shutdown.

## 📊 At a glance

- **API endpoints**: 8 (scrape, batch, modes, docs, openapi.json, health×2, metrics)
- **Runtime deps**: 13 core + 3 optional (ioredis, playwright, rate-limit-redis)
- **Tests**: 61 across 5 suites
- **Security posture**: `npm audit` → 0 vulnerabilities
- **Node**: >= 20 · **Express**: 5
