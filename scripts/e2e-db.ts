/**
 * Eigene Datenbank für die E2E-Tests (`ppm_e2e`, Teil von `npm run e2e`): neu anlegen (Besitzer ppm_owner), Migrationen,
 * Testpersonen aus `.local/people.json` (von keycloak-setup). Schreibt `.local/e2e.env` für die zweite Instanz der API
 * auf Port 8090 (Playwright startet sie mit `--env-file=.env --env-file=.local/e2e.env`).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { model } from '../src/platform/authz/model.ts';
import { runMigrations } from '../src/platform/db/migrate.ts';
import { seedPeople, type People } from './lib/people.ts';

const root = join(import.meta.dirname, '..');
const env = process.env;
const port = env.POSTGRES_PORT ?? '5433';
const su = `postgres://postgres:${encodeURIComponent(env.POSTGRES_SUPERUSER_PASSWORD ?? '')}@localhost:${port}/postgres`;
const url = (role: string, pw: string) => `postgres://${role}:${encodeURIComponent(pw)}@localhost:${port}/ppm_e2e`;

const c = new pg.Client({ connectionString: su });
await c.connect();
try {
  await c.query('DROP DATABASE IF EXISTS ppm_e2e WITH (FORCE)');
  await c.query('CREATE DATABASE ppm_e2e OWNER ppm_owner');
  await c.query('REVOKE ALL ON DATABASE ppm_e2e FROM PUBLIC');
  await c.query('GRANT CONNECT ON DATABASE ppm_e2e TO ppm_app, ppm_sched');
} finally { await c.end(); }

const adminUrl = url('ppm_owner', env.PPM_OWNER_PASSWORD ?? '');
await runMigrations(adminUrl, model);
await seedPeople(adminUrl, JSON.parse(readFileSync(join(root, '.local', 'people.json'), 'utf8')) as People);
writeFileSync(join(root, '.local', 'e2e.env'), [
  `DATABASE_URL=${url('ppm_runtime', env.PPM_RUNTIME_PASSWORD ?? '')}`,
  `DATABASE_ADMIN_URL=${adminUrl}`,
  `DATABASE_WORKER_URL=${url('ppm_worker', env.PPM_WORKER_PASSWORD ?? '')}`,
  'HTTP_PORT=8090', 'OPS_PORT=9091', 'PUBLIC_BASE_URL=http://localhost:8090', 'RATE_LIMIT_NAMESPACE=e2e', 'LOG_LEVEL=warn', 'WEB_DIST_DIR=web/dist', '',
].join('\n'), { mode: 0o600 });
console.log('e2e-db: ppm_e2e neu angelegt, Testpersonen eingetragen, .local/e2e.env geschrieben');
