# URL Scraper — Web Console

A React + Vite single-page app: a scrape **playground**, **screenshot/PDF** capture,
and a live **usage dashboard** for the URL Scraper API.

## Develop

```bash
cd web
npm install
npm run dev        # http://localhost:5173
```

The dev server proxies `/api`, `/health`, and `/metrics` to the API at
`http://localhost:3000` (so start the API too: `npm start` in the repo root).
Point the proxy elsewhere with `VITE_PROXY_TARGET=http://host:port npm run dev`.

## Build

```bash
npm run build      # type-checks, then outputs static files to web/dist
npm run preview    # preview the production build
```

`web/dist` is a static bundle you can host anywhere (Netlify, S3, Nginx, …).

## Serve it from the API (single process)

The API can serve the built console itself:

```bash
cd web && npm install && npm run build      # once
cd .. && SERVE_UI=true npm start            # console now at http://localhost:3000/app
```

## Configure at runtime

Use the top bar in the app to set:
- **API base** — leave blank for same-origin (dev proxy or `/app` mode), or point
  at a remote instance (e.g. `https://scraper.example.com`).
- **API key** — sent as `x-api-key` when the server has auth enabled.

Both are saved in `localStorage`.

## Stack

React 18 · Vite · TypeScript · zero UI/runtime dependencies. Charts are hand-built
SVG/CSS using the project's validated data-viz palette (light/dark aware).
