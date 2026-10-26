/**
 * Warteschlange in PostgreSQL (`ppm.job`) und feste Aufgaben des Workers.
 *
 * - `enqueue(tx, kind, payload, { runAt, dedupeKey, maxAttempts })` in der fachlichen Transaktion (Mandantenkontext);
 *   ein offener Job je `dedupeKey` (`ON CONFLICT … DO NOTHING`).
 * - Abholen serialisiert über eine Advisory-Lock (`CLAIM_LOCK`), höchstens `WORKER_TENANT_LIMIT` laufende Jobs je
 *   Organisation über alle Instanzen; Jobs gesperrter Organisationen werden nicht abgeholt.
 * - Jeder Job läuft im Kontext seines Mandanten mit voller Sicht (`fullTx`), Heartbeat jede Minute, verwaist nach
 *   15 Minuten ohne Heartbeat, Backoff exponentiell, `PermanentJobError` ohne Wiederholung.
 * - Feste Aufgaben (`PeriodicTask`) laufen je Name höchstens einmal gleichzeitig über alle Instanzen
 *   (`pg_try_advisory_lock`).
 *
 * Fachjobs gehören als `JobDefinition` ins Modul (modules/jobs.ts › JOBS), nicht hierher.
 */
import { randomUUID } from 'node:crypto';
import { PermanentJobError } from '../core/errors.ts';
import { withTx, type Db, type Tx } from '../db/pool.ts';
import { jobDuration, jobsTotal } from '../ops/metrics.ts';

export { PermanentJobError };

/** Sperre des Abholens (Vertrag über alle Instanzen und Versionen; nie ändern). */
export const CLAIM_LOCK = 727101;
export const HEARTBEAT_MS = 60_000;
export const ORPHAN_AFTER_MS = 15 * 60_000;

export interface Log { info(o: object, m?: string): void; warn(o: object, m?: string): void; error(o: object, m?: string): void }

export interface JobInfo { id: string; tenantId: string; kind: string; attempts: number; maxAttempts: number }

export interface JobDefinition<P = any> {
  kind: string;
  /** Standard für enqueue ohne Angabe. */
  maxAttempts?: number;
  /**
   * Läuft in einer Transaktion im Mandanten des Jobs (volle Sicht). Fehler: Wiederholung mit Backoff. Ein Rückgabewert
   * (JSON) wird als Ergebnis gespeichert (lange Läufe, `GET /v1/vorgaenge/{id}`).
   */
  handle(tx: Tx, payload: P, job: JobInfo): Promise<unknown>;
}

export interface PeriodicTask {
  name: string;
  intervalMs: number;
  run(ctx: { log: Log }): Promise<void>;
}

export interface EnqueueOptions { runAt?: Date; dedupeKey?: string; maxAttempts?: number; /** Principal, der den Job auslöst (Abfrage über /v1/vorgaenge). */ createdBy?: string | null }

/** Job im Mandanten der Transaktion einreihen; `null`, wenn schon ein offener Job mit diesem `dedupeKey` besteht. */
export async function enqueue(tx: Tx, kind: string, payload: unknown, o: EnqueueOptions = {}): Promise<string | null> {
  const r = await tx.query<{ id: string }>(
    `INSERT INTO ppm.job (tenant_id, kind, payload, run_at, dedupe_key, max_attempts, created_by)
     VALUES (app.tenant_id(), $1, $2, coalesce($3, now()), $4, $5, $6)
     ON CONFLICT (tenant_id, kind, dedupe_key) WHERE dedupe_key IS NOT NULL AND status IN ('queued', 'running') DO NOTHING
     RETURNING id`,
    [kind, JSON.stringify(payload ?? {}), o.runAt ?? null, o.dedupeKey ?? null, o.maxAttempts ?? 5, o.createdBy ?? null]);
  return r.rows[0]?.id ?? null;
}

/** Wartezeit vor dem nächsten Versuch: 10 s · 2^(Versuch-1), höchstens 1 h, ±20 % Streuung. */
export function backoffMs(attempts: number): number {
  const base = Math.min(3_600_000, 10_000 * 2 ** Math.max(0, attempts - 1));
  return Math.round(base * (0.8 + Math.random() * 0.4));
}

interface Claimed { tenant_id: string; id: string; kind: string; payload: unknown; attempts: number; max_attempts: number }

export interface WorkerOptions {
  /** Pool des Workers (ppm_worker: ppm_app und ppm_sched). */
  db: Db;
  jobs: JobDefinition[];
  tasks: PeriodicTask[];
  concurrency: number;
  tenantLimit: number;
  pollMs: number;
  /** Transaktion im Mandanten mit voller Sicht (authz/view.ts › fullTx). */
  tenantTx: <T>(tenantId: string, fn: (tx: Tx) => Promise<T>) => Promise<T>;
  log: Log;
  id?: string;
}

export class Worker {
  readonly id: string;
  private readonly defs = new Map<string, JobDefinition>();
  private readonly running = new Map<string, Promise<void>>();
  private readonly timers: NodeJS.Timeout[] = [];
  private stopped = true;
  private wake: (() => void) | null = null;
  private loop: Promise<void> | null = null;

  private readonly o: WorkerOptions;

  constructor(o: WorkerOptions) {
    this.o = o;
    this.id = o.id ?? `worker-${randomUUID().slice(0, 8)}`;
    for (const d of o.jobs) {
      if (this.defs.has(d.kind)) throw new Error(`Job «${d.kind}» doppelt registriert`);
      this.defs.set(d.kind, d);
    }
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.loop = this.run();
    this.timers.push(setInterval(() => void this.heartbeat(), HEARTBEAT_MS));
    for (const t of this.o.tasks) this.timers.push(setInterval(() => void this.runTask(t), t.intervalMs));
    for (const t of this.timers) t.unref();
  }

  /** Nichts mehr abholen, laufende Jobs abwarten. */
  async stop(): Promise<void> {
    this.stopped = true;
    for (const t of this.timers) clearInterval(t);
    this.timers.length = 0;
    this.wake?.();
    await this.loop;
    await Promise.allSettled([...this.running.values()]);
    await Promise.allSettled([...this.tasksRunning.values()]);
  }

  private async run(): Promise<void> {
    while (!this.stopped) {
      let got = 0;
      try {
        const free = this.o.concurrency - this.running.size;
        if (free > 0) {
          const jobs = await this.claim(free);
          got = jobs.length;
          for (const j of jobs) {
            const p = this.execute(j).finally(() => this.running.delete(j.id));
            this.running.set(j.id, p);
          }
        }
      } catch (e) {
        this.o.log.error({ err: (e as Error).message }, 'Warteschlange: Abholen fehlgeschlagen');
      }
      if (this.stopped) break;
      if (!got || this.running.size >= this.o.concurrency) {
        await new Promise<void>(r => { this.wake = r; const t = setTimeout(r, this.o.pollMs); t.unref(); });
        this.wake = null;
      }
    }
  }

  /** Bis zu `n` fällige Jobs abholen (eine Transaktion, serialisiert über CLAIM_LOCK). */
  async claim(n: number): Promise<Claimed[]> {
    return withTx(this.o.db, async tx => {
      await tx.query('SELECT pg_advisory_xact_lock($1)', [CLAIM_LOCK]);
      return (await tx.query<Claimed>(
        `WITH running AS (SELECT tenant_id, count(*)::int AS n FROM ppm.job WHERE status = 'running' GROUP BY tenant_id),
         cand AS (
           SELECT j.tenant_id, j.id, j.run_at, row_number() OVER (PARTITION BY j.tenant_id ORDER BY j.run_at, j.id) AS rn, coalesce(r.n, 0) AS busy
           FROM ppm.job j LEFT JOIN running r USING (tenant_id)
           WHERE j.status = 'queued' AND j.run_at <= now() AND NOT (j.tenant_id = ANY (app.suspended_tenants()))
           ORDER BY j.run_at LIMIT 500)
         UPDATE ppm.job j SET status = 'running', attempts = j.attempts + 1, locked_by = $1, heartbeat_at = now()
         FROM (SELECT tenant_id, id FROM cand WHERE rn + busy <= $2 ORDER BY run_at LIMIT $3) c
         WHERE j.tenant_id = c.tenant_id AND j.id = c.id
         RETURNING j.tenant_id, j.id, j.kind, j.payload, j.attempts, j.max_attempts`,
        [this.id, this.o.tenantLimit, n])).rows;
    });
  }

  private async execute(j: Claimed): Promise<void> {
    const def = this.defs.get(j.kind);
    const started = performance.now();
    const info: JobInfo = { id: j.id, tenantId: j.tenant_id, kind: j.kind, attempts: j.attempts, maxAttempts: j.max_attempts };
    try {
      if (!def) throw new PermanentJobError(`Unbekannte Job-Art «${j.kind}»`);
      const result = await this.o.tenantTx(j.tenant_id, tx => def.handle(tx, j.payload, info));
      await this.o.db.query(`UPDATE ppm.job SET status = 'done', finished_at = now(), locked_by = NULL, last_error = NULL, result = $3 WHERE tenant_id = $1 AND id = $2`,
        [j.tenant_id, j.id, result === undefined ? null : JSON.stringify(result)]);
      jobsTotal.add(1, { kind: j.kind, result: 'done' });
    } catch (e) {
      const msg = (e as Error).message?.slice(0, 1000) ?? String(e);
      const final = e instanceof PermanentJobError || j.attempts >= j.max_attempts;
      await this.o.db.query(
        final
          ? `UPDATE ppm.job SET status = 'failed', finished_at = now(), locked_by = NULL, last_error = $3 WHERE tenant_id = $1 AND id = $2`
          : `UPDATE ppm.job SET status = 'queued', run_at = now() + ($4 || ' milliseconds')::interval, locked_by = NULL, last_error = $3 WHERE tenant_id = $1 AND id = $2`,
        final ? [j.tenant_id, j.id, msg] : [j.tenant_id, j.id, msg, String(backoffMs(j.attempts))]).catch(() => undefined);
      jobsTotal.add(1, { kind: j.kind, result: final ? 'failed' : 'retry' });
      this.o.log[final ? 'error' : 'warn']({ job: j.id, kind: j.kind, tenant: j.tenant_id, attempts: j.attempts, err: msg }, final ? 'Job endgültig gescheitert' : 'Job gescheitert, neuer Versuch');
    } finally {
      jobDuration.record((performance.now() - started) / 1000, { kind: j.kind });
    }
  }

  private async heartbeat(): Promise<void> {
    if (!this.running.size) return;
    await this.o.db.query(`UPDATE ppm.job SET heartbeat_at = now() WHERE locked_by = $1 AND status = 'running'`, [this.id])
      .catch(e => this.o.log.warn({ err: (e as Error).message }, 'Heartbeat fehlgeschlagen'));
  }

  private readonly tasksRunning = new Map<string, Promise<void>>();

  /** Feste Aufgabe mit Sperre über alle Instanzen; überspringt, wenn sie hier oder anderswo noch läuft. */
  async runTask(t: PeriodicTask): Promise<boolean> {
    if (this.tasksRunning.has(t.name)) return false;
    let resolve!: () => void;
    this.tasksRunning.set(t.name, new Promise<void>(r => { resolve = r; }));
    const c = await this.o.db.connect();
    let locked = false;
    try {
      locked = (await c.query<{ ok: boolean }>('SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS ok', [`ppm-task:${t.name}`])).rows[0]!.ok;
      if (!locked) return false;
      await t.run({ log: this.o.log });
      return true;
    } catch (e) {
      this.o.log.error({ task: t.name, err: (e as Error).message }, 'Feste Aufgabe fehlgeschlagen');
      return false;
    } finally {
      if (locked) await c.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [`ppm-task:${t.name}`]).catch(() => undefined);
      c.release();
      this.tasksRunning.delete(t.name);
      resolve();
    }
  }
}

/** Verwaiste Jobs (kein Heartbeat seit 15 Minuten) wieder einreihen bzw. endgültig scheitern lassen. */
export function orphanTask(db: Db): PeriodicTask {
  return {
    name: 'job-orphans', intervalMs: 60_000,
    async run({ log }) {
      const r = await db.query<{ id: string; status: string }>(
        `UPDATE ppm.job SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'queued' END,
           finished_at = CASE WHEN attempts >= max_attempts THEN now() END, locked_by = NULL,
           last_error = 'verwaist (kein Heartbeat)', run_at = now()
         WHERE status = 'running' AND heartbeat_at < now() - ($1 || ' milliseconds')::interval RETURNING id, status`, [String(ORPHAN_AFTER_MS)]);
      if (r.rowCount) log.warn({ jobs: r.rows }, 'Verwaiste Jobs zurückgesetzt');
    },
  };
}
