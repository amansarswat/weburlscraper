import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The API server (default http://localhost:3000) is proxied in dev so the SPA can
// call /api, /health and /metrics without CORS. Override the target with
// VITE_PROXY_TARGET. `base: './'` keeps built asset paths relative so the dist
// can be served from any path (including the API's optional /app mount).
export default defineConfig(() => {
    const target = process.env.VITE_PROXY_TARGET || 'http://localhost:3000';
    return {
        base: './',
        plugins: [react()],
        server: {
            port: 5173,
            proxy: {
                '/api': { target, changeOrigin: true },
                '/health': { target, changeOrigin: true },
                '/metrics': { target, changeOrigin: true },
            },
        },
        build: { outDir: 'dist', sourcemap: false },
    };
});
