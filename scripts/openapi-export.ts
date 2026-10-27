/**
 * Schreibt die OpenAPI-Beschreibung der API nach `web/openapi.json` (Grundlage von `web/src/api/schema.d.ts`).
 * Mit `--check`: Exit 1, wenn die Datei nicht aktuell ist (CI).
 *
 *   node scripts/openapi-export.ts [--check]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from '../src/app.ts';
import { ROOT } from './lib.ts';

const file = join(ROOT, 'web', 'openapi.json');
const text = `${JSON.stringify(await app.openApi(), null, 2)}\n`;
if (process.argv.includes('--check')) {
  const have = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (have !== text) { console.error('openapi:export: web/openapi.json ist nicht aktuell (npm run openapi:export && npm run api:types)'); process.exit(1); }
  console.log('openapi:export: aktuell');
} else {
  writeFileSync(file, text);
  console.log('openapi:export: web/openapi.json geschrieben');
}
