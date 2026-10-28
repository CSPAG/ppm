/**
 * Testumgebung des Backends: Wegwerf-Datenbank je Testdatei (Werkzeuge des Test-Kits) mit allen Migrationen, Rollen
 * wie in Produktion. Verbindungen laufen als Superuser mit gesetzter Rolle (`options=-c role=<rolle>`), so braucht es
 * keine Passwörter; RLS gilt für die gesetzte Rolle.
 *
 * Umgebung: `TEST_POSTGRES_URL` oder `POSTGRES_SUPERUSER_PASSWORD` (+ `POSTGRES_PORT`, Standard 5433). Testdateien mit
 * Datenbank nehmen `describe`, `test` und Hooks aus `dbTests(await postgresSkip())` (Test-Kit): ohne Konfiguration zählt
 * jeder Test als übersprungen, konfiguriert, aber nicht erreichbar, scheitert der Lauf.
 */
import pg from 'pg';
import { superuserUrlFrom, testDatabases, type TestDb } from '@vollholz/iam-testkit';
import type { Tx } from '@vollholz/platform';
import { app } from '../../src/app.ts';
import { fullTx } from '../../src/platform.ts';

export const P = 'ppm';

export const superuser = superuserUrlFrom();

/** Adresse des Superusers mit gesetzter Rolle. */
export function asRole(url: string, role: string): string {
  const u = new URL(url);
  u.searchParams.set('options', `-c role=${role}`);
  return u.toString();
}

/** Rollen nach Spezifikation 5.3 (clusterweit, idempotent, auch bei parallelen Testdateien). */
export async function ensureRoles(): Promise<void> {
  const c = new pg.Client({ connectionString: superuser! });
  await c.connect();
  try {
    await c.query("SELECT pg_advisory_lock(hashtext('ppm-test-roles'))");
    for (const sql of [
      `CREATE ROLE ${P}_owner NOLOGIN NOSUPERUSER NOCREATEROLE NOBYPASSRLS`,
      `CREATE ROLE ${P}_app NOLOGIN NOBYPASSRLS`,
      `CREATE ROLE ${P}_sched NOLOGIN NOBYPASSRLS`,
      `CREATE ROLE ${P}_runtime NOLOGIN NOBYPASSRLS IN ROLE ${P}_app`,
      `CREATE ROLE ${P}_worker NOLOGIN NOBYPASSRLS IN ROLE ${P}_app, ${P}_sched`,
    ]) await c.query(sql).catch((e: { code?: string }) => { if (e.code !== '42710' && e.code !== '23505') throw e; });
  } finally { await c.end(); }
}

/**
 * Pool, dessen `close()` wartet, bis jede Verbindung getrennt ist. `pg.Pool#end()` löst schon auf, wenn die Clients aus
 * dem Pool genommen sind, und trennt sie erst danach; läuft `DROP DATABASE … WITH (FORCE)` dazwischen, endet eine noch
 * offene Verbindung mit «terminating connection due to administrator command» als Fehler des Pools ohne Abnehmer
 * (uncaughtException, der Test-Runner meldet ihn am `before`, das den Pool angelegt hat).
 */
function pool(url: string, max: number): pg.Pool & { close(): Promise<void> } {
  const p = new pg.Pool({ connectionString: url, max });
  const getrennt: Promise<void>[] = [];
  p.on('connect', c => { getrennt.push(new Promise(r => c.once('end', () => r()))); });
  return Object.assign(p, { close: async () => { await p.end(); await Promise.all(getrennt); } });
}

const su = superuser ?? 'postgres://x@localhost/x';
const dbs = testDatabases<ReturnType<typeof pool>>({
  prefix: `${P}_test_`, owner: `${P}_owner`, connect: [`${P}_app`, `${P}_sched`],
  env: {
    ...process.env,
    DATABASE_URL: asRole(su, `${P}_runtime`), DATABASE_ADMIN_URL: asRole(su, `${P}_owner`), DATABASE_WORKER_URL: asRole(su, `${P}_worker`),
  },
  // Wie im Betrieb: IAM, App (db/migrations), Übernahme der Plattform-Migration
  migrate: url => app.migrate(url),
  runtime: url => pool(url, 5),
  closeRuntime: p => p.close(),
});

export type Harness = TestDb<pg.Pool> & { worker: pg.Pool };

/** Wegwerf-Datenbank mit Migrationen; `runtime` = API (ppm_runtime), `worker` = Worker (ppm_worker). */
export async function createTestDb(o: { migrationsDir?: string } = {}): Promise<Harness> {
  await ensureRoles();
  const t = await dbs.createTestDb(o);
  const worker = pool(t.workerUrl, 3);
  return { ...t, worker, drop: async () => { await worker.close(); await t.drop(); } };
}

/** Mandant anlegen (wie die erste Anmeldung) und seine ID liefern. */
export async function tenant(db: pg.Pool, alias: string): Promise<string> {
  return (await db.query<{ id: string }>('SELECT app.resolve_tenant($1, null, $1, true) AS id', [alias])).rows[0]!.id;
}

/** Testdaten mit voller Sicht im Mandanten. */
export const full = <T>(db: pg.Pool, tenantId: string, fn: (tx: Tx) => Promise<T>) => fullTx(db, tenantId, fn);
