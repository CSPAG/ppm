/**
 * Lokale Umgebung: schreibt `.env` mit Zufallsgeheimnissen und die Client-Schlüssel nach `.local/keys/` (nur wenn
 * `.env` fehlt; `--force` überschreibt). Die Namen passen zu deploy/compose.dev.yaml (PostgreSQL 17 auf
 * 127.0.0.1:5433, Keycloak 26 auf 127.0.0.1:8180, Mailpit auf 127.0.0.1:1025/8025) und zu scripts/keycloak-setup.ts.
 *
 *   node scripts/dev-env.ts [--force]
 */
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib.ts';

const file = join(ROOT, '.env');
if (existsSync(file) && !process.argv.includes('--force')) {
  console.log('dev:env: .env besteht schon (überschreiben mit --force)');
  process.exit(0);
}

const pw = (n = 24) => randomBytes(n).toString('base64url');
const db = (role: string, password: string) => `postgres://ppm_${role}:${password}@127.0.0.1:5433/ppm`;

// Client-Schlüssel (EC P-256, PKCS#8) als Dateien: Keycloak erhält nur den öffentlichen Teil (keycloak-setup)
const keyDir = join(ROOT, '.local', 'keys');
mkdirSync(keyDir, { recursive: true, mode: 0o700 });
const keys: Record<string, string> = {
  OIDC_BFF_PRIVATE_KEY: 'ppm-platform',
  KEYCLOAK_MGMT_PRIVATE_KEY: 'ppm-admin',
  KEYCLOAK_SYNC_PRIVATE_KEY: 'ppm-sync',
  MCP_PRIVATE_KEY: 'ppm-mcp',
  MCP_DPOP_KEY: 'mcp-dpop',
};
const keyVars: string[] = [];
for (const [name, client] of Object.entries(keys)) {
  const path = join(keyDir, `${client}.pem`);
  if (!existsSync(path) || process.argv.includes('--force')) {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    writeFileSync(path, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
    chmodSync(path, 0o600);
  }
  keyVars.push(`${name}_FILE=${path}`);
}

const owner = pw(), runtime = pw(), worker = pw();
const lines = [
  '# Lokale Umgebung (npm run dev:env) – nie committen. Beschreibung aller Variablen: docs/konfiguration.md',
  'NODE_ENV=development',
  'PUBLIC_BASE_URL=http://localhost:8080',
  'LOG_LEVEL=info',
  '',
  '# PostgreSQL (deploy/compose.dev.yaml)',
  `POSTGRES_SUPERUSER_PASSWORD=${pw()}`,
  'POSTGRES_PORT=5433',
  `DB_OWNER_PASSWORD=${owner}`,
  `DB_RUNTIME_PASSWORD=${runtime}`,
  `DB_WORKER_PASSWORD=${worker}`,
  `DATABASE_URL=${db('runtime', runtime)}`,
  `DATABASE_ADMIN_URL=${db('owner', owner)}`,
  `DATABASE_WORKER_URL=${db('worker', worker)}`,
  '',
  '# Keycloak (deploy/compose.dev.yaml, Realm über npm run keycloak:setup)',
  `KEYCLOAK_ADMIN_PASSWORD=${pw()}`,
  'KEYCLOAK_PORT=8180',
  'OIDC_ISSUER_URL=http://localhost:8180/realms/ppm',
  'KEYCLOAK_MGMT_CLIENT_ID=ppm-admin',
  'KEYCLOAK_SYNC_CLIENT_ID=ppm-sync',
  'TENANT_AUTO_PROVISION=false',
  'DPOP_MODE=required-for-clients',
  ...keyVars,
  '',
  '# Sitzung und Verschlüsselung',
  `SESSION_SECRET=${randomBytes(36).toString('base64url')}`,
  `ENCRYPTION_KEYS=k1:${randomBytes(32).toString('base64')}`,
  '',
  '# MCP und Webhooks',
  'MCP_PUBLIC_URL=http://localhost:8081/mcp',
  'MCP_API_URL=http://localhost:8080',
  'WEBHOOK_ALLOW_PRIVATE=true',
  '',
  '# E-Mail an Mailpit (deploy/compose.dev.yaml, Ansicht http://localhost:8025)',
  'MAIL_ADAPTER=smtp',
  'MAIL_FROM="PPM <noreply@ppm.localhost>"',
  'SMTP_URL=smtp://localhost:1025',
  'SMTP_ALLOW_INSECURE=true',
  '',
  '# Betrieb',
  'METRICS_ENABLED=true',
  '',
];
writeFileSync(file, lines.join('\n'), { mode: 0o600 });
console.log(`dev:env: .env und ${Object.keys(keys).length} Schlüssel unter .local/keys/ geschrieben`);
