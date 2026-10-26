/**
 * Wegwerf-Datenbanken für die Tests: je Testdatei eine eigene Datenbank mit allen Migrationen (Baukasten und App),
 * Rollen wie in Produktion. Reste abgebrochener Läufe räumt das Test-Kit selbst auf.
 *
 * Verbindungen laufen als Superuser mit gesetzter Rolle (`options=-c role=<rolle>`): So braucht es keine Passwörter,
 * und RLS gilt für die gesetzte Rolle. Umgebung: `TEST_POSTGRES_URL` oder `POSTGRES_SUPERUSER_PASSWORD`
 * (+ `POSTGRES_PORT`, Standard 5433). Ohne erreichbare Datenbank überspringen sich die Tests (`skipDb`).
 */
import pg from 'pg';
import { testDatabases, type TestDb } from '@vollholz/iam-testkit';
import { model } from '../../src/platform/authz/model.ts';
import { runMigrations } from '../../src/platform/db/migrate.ts';

const PORT = process.env.POSTGRES_PORT ?? '5433';
export const superuser = process.env.TEST_POSTGRES_URL
  ?? (process.env.POSTGRES_SUPERUSER_PASSWORD ? `postgres://postgres:${encodeURIComponent(process.env.POSTGRES_SUPERUSER_PASSWORD)}@localhost:${PORT}/postgres` : null);

export function asRole(url: string, role: string): string {
  const u = new URL(url);
  u.searchParams.set('options', `-c role=${role}`);
  return u.toString();
}

async function reachable(): Promise<boolean> {
  if (!superuser) return false;
  const c = new pg.Client({ connectionString: superuser, connectionTimeoutMillis: 1500 });
  try { await c.connect(); await c.end(); return true; } catch { return false; }
}

/** Grund zum Überspringen (für `describe(…, { skip })`), falls keine Datenbank erreichbar ist. */
export const skipDb = async () => (!(await reachable()) && 'PostgreSQL nicht erreichbar (TEST_POSTGRES_URL oder POSTGRES_SUPERUSER_PASSWORD)') || false;

/** Rollen wie db/bootstrap.sql (ohne Login; clusterweit, idempotent, auch bei parallelen Testdateien). */
async function ensureRoles(): Promise<void> {
  const c = new pg.Client({ connectionString: superuser! });
  await c.connect();
  try {
    await c.query("SELECT pg_advisory_lock(hashtext('ppm-test-roles'))");
    for (const sql of [
      'CREATE ROLE ppm_owner NOLOGIN NOSUPERUSER NOCREATEROLE NOBYPASSRLS',
      'CREATE ROLE ppm_app NOLOGIN NOBYPASSRLS',
      'CREATE ROLE ppm_sched NOLOGIN NOBYPASSRLS',
      'CREATE ROLE ppm_runtime NOLOGIN NOBYPASSRLS IN ROLE ppm_app',
      'CREATE ROLE ppm_worker NOLOGIN NOBYPASSRLS IN ROLE ppm_app, ppm_sched',
    ]) await c.query(sql).catch((e: { code?: string }) => { if (e.code !== '42710' && e.code !== '23505') throw e; });
  } finally { await c.end(); }
}

const base = superuser ?? 'postgres://x@localhost/x';
const dbs = testDatabases<pg.Pool>({
  prefix: 'ppm_test_', owner: 'ppm_owner', connect: ['ppm_app', 'ppm_sched'],
  env: {
    ...process.env, TEST_POSTGRES_URL: base,
    DATABASE_URL: asRole(base, 'ppm_runtime'), DATABASE_ADMIN_URL: asRole(base, 'ppm_owner'), DATABASE_WORKER_URL: asRole(base, 'ppm_worker'),
  },
  migrate: url => runMigrations(url, model),
  runtime: url => new pg.Pool({ connectionString: url, max: 5 }),
  closeRuntime: p => p.end(),
});

export interface TestDatabase extends TestDb<pg.Pool> {
  /** Pool des Workers (ppm_worker). */
  worker: pg.Pool;
  /** Pool der Besitzer-Rolle (Skripte, Mandanten). */
  owner: pg.Pool;
}

/** Wegwerf-Datenbank mit Migrationen; `drop()` am Ende der Datei. */
export async function createTestDb(): Promise<TestDatabase> {
  await ensureRoles();
  const t = await dbs.createTestDb();
  const worker = new pg.Pool({ connectionString: t.workerUrl, max: 5 });
  const owner = new pg.Pool({ connectionString: t.adminUrl, max: 2 });
  const drop = t.drop.bind(t);
  return Object.assign(t, {
    worker, owner,
    drop: async () => { await worker.end(); await owner.end(); await drop(); },
  });
}
