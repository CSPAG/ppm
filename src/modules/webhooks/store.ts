/** Datenzugriff der Webhooks: Abonnements im Mandanten (Rolle _app), Zustellung über alle Mandanten (Rolle _sched). */
import type { Db, Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';

export interface SubscriptionRow { id: string; url: string; description: string; event_types: string[]; active: boolean; created_at: Date; created_by: string | null }
const COLS = 'id, url, description, event_types, active, created_at, created_by';

export async function list(tx: Tx): Promise<SubscriptionRow[]> {
  return (await tx.query<SubscriptionRow>(`SELECT ${COLS} FROM ${SCHEMA}.webhook_subscription ORDER BY created_at, id`)).rows;
}

export async function create(tx: Tx, o: { id: string; url: string; description: string; eventTypes: string[]; secretEnc: string }): Promise<SubscriptionRow> {
  return (await tx.query<SubscriptionRow>(
    `INSERT INTO ${SCHEMA}.webhook_subscription (tenant_id, id, url, description, event_types, secret_enc) VALUES (app.tenant_id(), $1, $2, $3, $4, $5) RETURNING ${COLS}`,
    [o.id, o.url, o.description, o.eventTypes, o.secretEnc])).rows[0]!;
}

export async function remove(tx: Tx, id: string): Promise<boolean> {
  return ((await tx.query(`DELETE FROM ${SCHEMA}.webhook_subscription WHERE id = $1`, [id])).rowCount ?? 0) > 0;
}

/**
 * Ereignisse der Outbox in Zustellungen je passendem Abonnement übersetzen (Verteilung, Rolle _sched). Die Zustellung
 * trägt die Ereignisdaten selbst: Versand und Wiederholung brauchen das Outbox-Ereignis nicht mehr (Aufbewahrung).
 */
export async function fanOut(tx: Tx, events: { tenant_id: string; id: string; type: string; subject: string | null; data: Record<string, unknown>; created_at: Date }[]): Promise<number> {
  if (!events.length) return 0;
  const r = await tx.query(
    `INSERT INTO ${SCHEMA}.webhook_delivery (tenant_id, subscription_id, event_id, event_type, event_subject, event_data, event_created_at)
     SELECT e.tenant_id, s.id, e.id, e.type, e.subject, e.data, e.created_at
       FROM unnest($1::uuid[], $2::uuid[], $3::text[], $4::text[], $5::jsonb[], $6::timestamptz[]) AS e(tenant_id, id, type, subject, data, created_at)
       JOIN ${SCHEMA}.webhook_subscription s ON s.tenant_id = e.tenant_id AND s.active AND (e.type = ANY (s.event_types) OR '*' = ANY (s.event_types))
     ON CONFLICT DO NOTHING`,
    [events.map(e => e.tenant_id), events.map(e => e.id), events.map(e => e.type), events.map(e => e.subject),
      events.map(e => JSON.stringify(e.data)), events.map(e => e.created_at)]);
  return r.rowCount ?? 0;
}

export interface DueDelivery {
  tenant_id: string; tenant_alias: string; id: string; attempts: number; url: string; secret_enc: string; subscription_id: string;
  event_id: string; type: string; subject: string | null; data: Record<string, unknown>; created_at: Date;
}

/** Fällige Zustellungen reservieren (Zeitfenster `holdSec`), damit keine zweite Instanz sie gleichzeitig zustellt. */
export async function claimDue(tx: Tx, limit: number, holdSec: number): Promise<DueDelivery[]> {
  return (await tx.query<DueDelivery>(
    `WITH due AS (
       SELECT d.tenant_id, d.id FROM ${SCHEMA}.webhook_delivery d
        WHERE d.status = 'pending' AND d.next_attempt_at <= now() AND NOT (d.tenant_id = ANY (app.suspended_tenants()))
        ORDER BY d.next_attempt_at LIMIT $1 FOR UPDATE SKIP LOCKED)
     UPDATE ${SCHEMA}.webhook_delivery d SET next_attempt_at = now() + make_interval(secs => $2), attempts = d.attempts + 1
       FROM due WHERE (d.tenant_id, d.id) = (due.tenant_id, due.id)
     RETURNING d.tenant_id, d.id, d.attempts, d.subscription_id, d.event_id,
       (SELECT url FROM ${SCHEMA}.webhook_subscription s WHERE s.tenant_id = d.tenant_id AND s.id = d.subscription_id) AS url,
       (SELECT secret_enc FROM ${SCHEMA}.webhook_subscription s WHERE s.tenant_id = d.tenant_id AND s.id = d.subscription_id) AS secret_enc,
       d.event_type AS type,
       d.event_subject AS subject,
       d.event_data AS data,
       d.event_created_at AS created_at,
       (SELECT alias FROM app.platform_tenants() t WHERE t.id = d.tenant_id) AS tenant_alias`,
    [limit, holdSec])).rows;
}

/**
 * Abgeschlossene Zustellungen (zugestellt oder endgültig gescheitert) samt Ereignisdaten nach der Aufbewahrung löschen;
 * offene bleiben. Seit 004 hängen Zustellungen nicht mehr an der Outbox und gehen nicht mehr mit ihr.
 */
export async function purgeFinished(db: Db, retentionSec: number): Promise<number> {
  const r = await db.query(
    `DELETE FROM ${SCHEMA}.webhook_delivery
      WHERE status IN ('delivered', 'failed') AND coalesce(delivered_at, next_attempt_at) < now() - make_interval(secs => $1)`, [retentionSec]);
  return r.rowCount ?? 0;
}

export async function finish(tx: Tx, d: { tenant_id: string; id: string }, o: { delivered: boolean; failed: boolean; status: number | null; error: string | null; retryInSec: number }): Promise<void> {
  await tx.query(
    `UPDATE ${SCHEMA}.webhook_delivery SET status = $3, last_status = $4, last_error = $5,
       delivered_at = CASE WHEN $3 = 'delivered' THEN now() END, next_attempt_at = now() + make_interval(secs => $6)
     WHERE tenant_id = $1 AND id = $2`,
    [d.tenant_id, d.id, o.delivered ? 'delivered' : o.failed ? 'failed' : 'pending', o.status, o.error, o.retryInSec]);
}
