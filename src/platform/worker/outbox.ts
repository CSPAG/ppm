/**
 * Verteilung der Outbox (Profil outbox) als feste Aufgabe: unverteilte Ereignisse über alle Mandanten der Reihe nach
 * an die Abnehmer der Module (`OUTBOX_CONSUMERS`); jeder Abnehmer im Mandanten des Ereignisses mit voller Sicht.
 * Ein Ereignis gilt als verteilt, wenn alle passenden Abnehmer es angenommen haben. Abnehmer müssen idempotent sein
 * (nach einem Absturz kann ein Ereignis zweimal kommen). Nach 10 gescheiterten Versuchen bleibt es mit Fehler liegen
 * (`dispatched_at` gesetzt, `last_error`).
 */
import type { OutboxConsumer, StoredEvent } from '../core/events.ts';
import { withTx, type Db, type Tx } from '../db/pool.ts';
import { outboxDispatched } from '../ops/metrics.ts';
import type { PeriodicTask } from './queue.ts';

export const OUTBOX_MAX_ATTEMPTS = 10;

interface Row { tenant_id: string; id: string; type: string; subject: string | null; data: Record<string, unknown>; source: string; occurred_at: Date; attempts: number }

const wants = (c: OutboxConsumer, type: string) => c.types === '*' || c.types.includes(type);

/** Ein Durchgang: bis zu `batch` Ereignisse; liefert die Anzahl verteilter. */
export async function dispatchOutbox(db: Db, consumers: OutboxConsumer[], tenantTx: <T>(tenantId: string, fn: (tx: Tx) => Promise<T>) => Promise<T>, batch = 100): Promise<number> {
  return withTx(db, async tx => {
    const rows = (await tx.query<Row>(
      `SELECT tenant_id, id, type, subject, data, source, occurred_at, attempts FROM ppm.outbox_event
       WHERE dispatched_at IS NULL AND NOT (tenant_id = ANY (app.suspended_tenants()))
       ORDER BY occurred_at, id LIMIT $1 FOR UPDATE SKIP LOCKED`, [batch])).rows;
    let n = 0;
    for (const r of rows) {
      const e: StoredEvent = { tenantId: r.tenant_id, id: r.id, type: r.type, subject: r.subject, data: r.data, source: r.source, occurredAt: r.occurred_at };
      try {
        await tenantTx(r.tenant_id, async t => { for (const c of consumers) if (wants(c, r.type)) await c.handle(t, e); });
        await tx.query('UPDATE ppm.outbox_event SET dispatched_at = now(), attempts = attempts + 1, last_error = NULL WHERE tenant_id = $1 AND id = $2', [r.tenant_id, r.id]);
        outboxDispatched.add(1, { type: r.type, result: 'ok' });
        n++;
      } catch (err) {
        const last = r.attempts + 1 >= OUTBOX_MAX_ATTEMPTS;
        await tx.query(`UPDATE ppm.outbox_event SET attempts = attempts + 1, last_error = $3${last ? ', dispatched_at = now()' : ''} WHERE tenant_id = $1 AND id = $2`,
          [r.tenant_id, r.id, (err as Error).message.slice(0, 1000)]);
        outboxDispatched.add(1, { type: r.type, result: last ? 'dead' : 'retry' });
      }
    }
    return n;
  });
}

export function outboxTask(db: Db, consumers: OutboxConsumer[], tenantTx: <T>(tenantId: string, fn: (tx: Tx) => Promise<T>) => Promise<T>, intervalMs = 1000): PeriodicTask {
  return {
    name: 'outbox', intervalMs,
    async run() { while ((await dispatchOutbox(db, consumers, tenantTx)) > 0) { /* nächster Stapel */ } },
  };
}
