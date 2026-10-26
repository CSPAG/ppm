/**
 * Exportiert die OpenAPI der API nach `web/openapi.json` (Grundlage für `npm run api:types` der Webapp). Braucht weder
 * Datenbank noch Keycloak: die App wird nur zusammengebaut, nicht gestartet.
 *
 *   node scripts/openapi-export.ts [--check]    --check: Code 1, wenn web/openapi.json veraltet ist
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { loadPlatformConfig } from '../src/platform/config/env.ts';
import { createApi } from '../src/platform/main/compose.ts';

const root = join(import.meta.dirname, '..');
const out = join(root, 'web', 'openapi.json');
const cfg = loadPlatformConfig({
  NODE_ENV: 'test', PUBLIC_BASE_URL: 'https://ppm.project-suite.ch', OIDC_ISSUER_URL: 'https://id.project-suite.ch/realms/ppm',
  DATABASE_URL: 'postgres://ppm_runtime@localhost:5433/ppm', LOG_LEVEL: 'silent',
}, null);
const api = await createApi(cfg, { logger: false });
const doc = `${JSON.stringify(api.app.swagger(), null, 2)}\n`;
await api.close();

if (process.argv.includes('--check')) {
  let cur = '';
  try { cur = readFileSync(out, 'utf8'); } catch { /* fehlt */ }
  if (cur !== doc) { console.error('openapi:export: web/openapi.json veraltet – npm run openapi:export'); process.exit(1); }
  console.log('openapi:export: aktuell');
} else {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, doc);
  console.log(`openapi:export: ${out}`);
}
