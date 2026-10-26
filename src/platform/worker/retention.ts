/**
 * Aufbewahrung (feste Aufgaben): erledigte und endgültig gescheiterte Jobs sowie verteilte Ereignisse nach
 * `JOB_RETENTION`, abgelaufene Idempotency-Keys, dazu Rate-Limit und Replay-Schutz (alle 5 Minuten).
 */
import { purgeSharedState } from '../core/shared-state.ts';
import { SCHEMA } from '../config/env.ts';
import type { Db } from '../db/pool.ts';
import type { PeriodicTask } from './queue.ts';

export function retentionTask(db: Db, retentionMs: number): PeriodicTask {
  return {
    name: 'retention', intervalMs: 15 * 60_000,
    async run({ log }) {
      const ms = String(retentionMs);
      const jobs = await db.query(`DELETE FROM ppm.job WHERE status IN ('done', 'failed') AND finished_at < now() - ($1 || ' milliseconds')::interval`, [ms]);
      const events = await db.query(`DELETE FROM ppm.outbox_event WHERE dispatched_at < now() - ($1 || ' milliseconds')::interval`, [ms]);
      const keys = await db.query('DELETE FROM ppm.idempotency_key WHERE expires_at < now()');
      log.info({ jobs: jobs.rowCount, events: events.rowCount, idempotencyKeys: keys.rowCount }, 'Aufbewahrung');
    },
  };
}

export function sharedStateTask(db: Db): PeriodicTask {
  return { name: 'shared-state', intervalMs: 5 * 60_000, async run() { await purgeSharedState(db, SCHEMA); } };
}
