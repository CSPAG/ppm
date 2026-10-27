/// <reference types="vitest/config" />
/**
 * Build der Oberfläche: ausgeliefert vom api-Prozess (`modules/auth/ui.ts`) aus `web/dist`. Keine Inline-Skripte (CSP
 * ohne `unsafe-inline`), Schriften lokal. Im Entwicklungsmodus leitet Vite `/auth` und `/v1` an die lokale API weiter,
 * damit der Browser weiterhin nur dieselbe Herkunft sieht.
 */
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const api = process.env.API_URL ?? 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    sourcemap: true,
    // Baukasten (iam-web) und Router im Hauptteil; Verwalten-Seiten laden getrennt
    chunkSizeWarningLimit: 700,
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/auth': api, '/v1': api },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
