# 🚀 Quick Start Guide

Get the URL Scraper API running in 2 minutes!

## 📦 Installation

```bash
# 1. Navigate to the package directory
cd url-scraper-package

# 2. Install dependencies
npm install

# 3. Start the server
npm start
```

That's it! The API is now running on `http://localhost:3000`

## ✅ Test the API

### Health Check
```bash
curl http://localhost:3000/health
```

### Basic Scraping
```bash
curl -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

### JavaScript-rendered page (SPA)
```bash
# One-time setup: npm install playwright && npx playwright install chromium
curl -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "render": true}'
```

### Interactive docs
Open **http://localhost:3000/api/docs** (Swagger UI) in a browser.

## 🎯 Available Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health`, `/health/detailed` | GET | Health check + diagnostics |
| `/api/scrape` | POST | Scrape single URL (supports `render: true`) |
| `/api/scrape/batch` | POST | Scrape multiple URLs |
| `/api/modes` | GET | List available modes |
| `/api/docs` | GET | Interactive Swagger UI |
| `/api/openapi.json` | GET | OpenAPI 3.0 spec |
| `/metrics` | GET | Prometheus metrics |

## 🔑 Enable API keys (before exposing publicly)

```bash
# In .env — clients then send `x-api-key: my-secret` or `Authorization: Bearer my-secret`
API_KEYS=my-secret,another-key
```

## 🔧 Scraping Modes

- **`headings-paragraphs`** (default) - Extract headings with paragraphs
- **`all-text`** - Extract all text content
- **`articles`** - Extract article content
- **`lists`** - Extract lists
- **`tables`** - Extract tables
- **`custom`** - Use custom CSS selector

## 🐳 Docker Quick Start

```bash
# Build and run with Docker
npm run docker:build
npm run docker:run
```

Or with Docker Compose:
```bash
docker-compose up
```

## 🔗 Next Steps

1. Check out `examples/client-examples.js` for detailed usage examples
2. See `examples/react-example.jsx` for React integration
3. Read the full `README.md` for comprehensive documentation
4. Configure environment variables in `.env` file

## 💡 Pro Tips

- Use `mode: "custom"` with `options.selector` to target exactly the elements you want
- Enable detailed logging with `NODE_ENV=development`
- Check `/health/detailed` for system diagnostics
- Use batch scraping for multiple URLs to save time

Happy scraping! 🎉
