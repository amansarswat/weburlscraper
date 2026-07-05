# ---- Default image: static scraping (small, no headless browser) ----
# For JavaScript rendering (render:true) use Dockerfile.playwright instead,
# which ships Chromium and its system dependencies.
FROM node:20-bookworm-slim

ENV NODE_ENV=production

WORKDIR /app

# Install production dependencies only, excluding optional deps (Playwright,
# Redis clients). Rendering lives in Dockerfile.playwright; the app degrades
# gracefully if Redis clients are absent even when REDIS_URL is set.
COPY package*.json ./
RUN npm ci --omit=dev --omit=optional && npm cache clean --force

COPY . .

# Run as the built-in non-root user.
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
