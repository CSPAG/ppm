/**
 * Lokale `.env` mit Zufallsgeheimnissen (`npm run dev:env`) und Schlüsselpaaren der Keycloak-Clients unter
 * `.local/keys/` (nur für den lokalen Realm; die Schlüssel der Produktion liegen nie im Repository). Bestehende Werte
 * bleiben: fehlende werden ergänzt, nichts überschrieben.
 */
import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { keyPair } from '@vollholz/create-iam-app';

const root = join(import.meta.dirname, '..');
const envFile = join(root, '.env');
const keyDir = join(root, '.local', 'keys');
const pw = () => randomBytes(18).toString('base64url');

mkdirSync(keyDir, { recursive: true, mode: 0o700 });
for (const c of ['platform', 'admin', 'sync', 'mcp']) {
  const pem = join(keyDir, `ppm-${c}.pem`);
  if (existsSync(pem)) continue;
  const k = keyPair();
  writeFileSync(pem, k.pem, { mode: 0o600 });
  writeFileSync(join(keyDir, `ppm-${c}.json`), `${JSON.stringify(k.jwks, null, 2)}\n`);
}
chmodSync(keyDir, 0o700);

const existing = new Map<string, string>();
if (existsSync(envFile)) for (const l of readFileSync(envFile, 'utf8').split('\n')) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l); if (m) existing.set(m[1]!, m[2]!); }
const get = (k: string, v: () => string) => existing.get(k) ?? v();

const sup = get('POSTGRES_SUPERUSER_PASSWORD', pw), owner = get('PPM_OWNER_PASSWORD', pw), runtime = get('PPM_RUNTIME_PASSWORD', pw), worker = get('PPM_WORKER_PASSWORD', pw);
const port = get('POSTGRES_PORT', () => '5433');
const db = (role: string, p: string) => `postgres://${role}:${p}@localhost:${port}/ppm`;

const values: [string, string][] = [
  ['NODE_ENV', 'development'],
  ['PUBLIC_BASE_URL', 'http://localhost:8080'],
  ['LOG_LEVEL', 'info'],
  ['POSTGRES_PORT', port],
  ['POSTGRES_SUPERUSER_PASSWORD', sup],
  ['PPM_OWNER_PASSWORD', owner],
  ['PPM_RUNTIME_PASSWORD', runtime],
  ['PPM_WORKER_PASSWORD', worker],
  ['DATABASE_URL', db('ppm_runtime', runtime)],
  ['DATABASE_ADMIN_URL', db('ppm_owner', owner)],
  ['DATABASE_WORKER_URL', db('ppm_worker', worker)],
  ['KEYCLOAK_ADMIN_PASSWORD', get('KEYCLOAK_ADMIN_PASSWORD', pw)],
  ['OIDC_ISSUER_URL', 'http://localhost:8180/realms/ppm'],
  ['OIDC_BFF_PRIVATE_KEY_FILE', '.local/keys/ppm-platform.pem'],
  ['KEYCLOAK_MGMT_CLIENT_ID', 'ppm-admin'],
  ['KEYCLOAK_MGMT_PRIVATE_KEY_FILE', '.local/keys/ppm-admin.pem'],
  ['KEYCLOAK_SYNC_CLIENT_ID', 'ppm-sync'],
  ['KEYCLOAK_SYNC_PRIVATE_KEY_FILE', '.local/keys/ppm-sync.pem'],
  ['MCP_PRIVATE_KEY_FILE', '.local/keys/ppm-mcp.pem'],
  ['MCP_PUBLIC_URL', 'http://localhost:8081/mcp'],
  ['SESSION_SECRET', get('SESSION_SECRET', () => randomBytes(32).toString('base64url'))],
  ['ENCRYPTION_KEYS', get('ENCRYPTION_KEYS', () => `dev1:${randomBytes(32).toString('base64')}`)],
  ['WEBHOOK_ALLOW_PRIVATE', 'true'],
  ['E2E_PASSWORD', get('E2E_PASSWORD', () => 'Test1234!')],
];

const out = [...values.map(([k, v]) => [k, existing.get(k) ?? v] as const), ...[...existing].filter(([k]) => !values.some(([x]) => x === k))];
writeFileSync(envFile, `# Lokale Entwicklung (npm run dev:env) – nicht committen\n${out.map(([k, v]) => `${k}=${v}`).join('\n')}\n`, { mode: 0o600 });
console.log(`dev:env: ${envFile} (${out.length} Werte), Schlüssel in ${keyDir}`);
