/**
 * Vite für die Webapp: Entwicklung mit Proxy auf den api-Prozess (gleiche Herkunft für Cookie, CSRF und BFF),
 * Produktions-Build ohne Inline-Skripte und ohne eingebettete Dateien (CSP: `script-src 'self'`, `font-src 'self'`).
 */
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const API = process.env.PPM_API ?? 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/v1': { target: API, changeOrigin: false },
      '/auth': { target: API, changeOrigin: false },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2023',
    sourcemap: true,
    // Schriften und Bilder als eigene Dateien, nie als data:-Adresse (font-src 'self')
    assetsInlineLimit: 0,
    // Kein Polyfill für modulepreload: wäre ein zusätzliches Skript ohne Nutzen in aktuellen Browsern
    modulePreload: { polyfill: false },
    // Bibliotheken in eigene Dateien: ändern selten, bleiben im Cache des Browsers
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'tanstack', test: /node_modules[\\/]@tanstack[\\/]/ },
            // Kern von iam-web; die Verwalten-Seiten (`dist/pages`) laden weiter erst bei Bedarf
            { name: 'iam', test: /node_modules[\\/]@vollholz[\\/]iam-web[\\/]dist[\\/](?!pages[\\/])/ },
          ],
        },
      },
    },
  },
});
