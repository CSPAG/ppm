/**
 * Datenbank für die E2E-Tests (`npm run e2e`): `ppm_e2e` leeren und neu migrieren, dann
 * `web/e2e/.env.e2e` mit den Verbindungen schreiben. Rollen und Datenbank legt deploy/dev/postgres-init.sh beim ersten
 * Start an; fehlt die Datenbank, legt dieses Skript sie als Superuser an.
 *
 *   node --env-file=.env scripts/e2e-db.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { app } from '../src/app.ts';
import { ROOT } from './lib.ts';

const E2E = 'ppm_e2e';
const need = (k: string) => process.env[k] || (() => { console.error(`e2e-db: ${k} fehlt (npm run dev:env)`); process.exit(78); })();
const port = process.env.POSTGRES_PORT ?? '5433';
const superuser = `postgres://postgres:${encodeURIComponent(need('POSTGRES_SUPERUSER_PASSWORD'))}@127.0.0.1:${port}/postgres`;
const url = (role: string, pwVar: string) => `postgres://ppm_${role}:${encodeURIComponent(need(pwVar))}@127.0.0.1:${port}/${E2E}`;

const su = new pg.Client({ connectionString: superuser });
await su.connect();
try {
  // Neu anlegen statt leeren: so gibt es keine Reste aus früheren Läufen (auch nicht in public.schema_migrations)
  await su.query(`DROP DATABASE IF EXISTS ${E2E} WITH (FORCE)`);
  await su.query(`CREATE DATABASE ${E2E} OWNER ppm_owner`);
  await su.query(`REVOKE ALL ON DATABASE ${E2E} FROM PUBLIC`);
  await su.query(`GRANT CONNECT ON DATABASE ${E2E} TO ppm_app, ppm_sched`);
} finally { await su.end(); }

const admin = url('owner', 'DB_OWNER_PASSWORD');
const r = await app.migrate(admin);
mkdirSync(join(ROOT, 'web', 'e2e'), { recursive: true });
writeFileSync(join(ROOT, 'web', 'e2e', '.env.e2e'), [
  `DATABASE_URL=${url('runtime', 'DB_RUNTIME_PASSWORD')}`,
  `DATABASE_ADMIN_URL=${admin}`,
  `DATABASE_WORKER_URL=${url('worker', 'DB_WORKER_PASSWORD')}`,
  'RATE_LIMIT_NAMESPACE=e2e',
  // Alle Specs einer Organisation laufen als dieselbe Person, parallel in drei Projekten (hell, dunkel, 360 px) und mit
  // Testdaten über die API (web/e2e/daten.ts): die 600 Anfragen je Minute und Principal reichen dafür nicht
  'API_RATE_LIMIT=6000',
  '',
].join('\n'), { mode: 0o600 });
console.log(`e2e-db: ${E2E} neu angelegt, ${r.applied.length} Migrationen, web/e2e/.env.e2e geschrieben`);
