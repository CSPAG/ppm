/**
 * Zustellung (Worker): Abnehmer der Outbox legt je passendem Webhook eine Zustellung an und reiht den Job
 * `webhook.deliver` ein; der Job sendet das CloudEvent signiert über `safeFetch` (SSRF-Schutz, feste Gesamtfrist,
 * Grössengrenze). Scheitert eine Zustellung, plant der Job einen neuen Versuch mit Backoff (höchstens 8).
 */
import type { Keyring } from '@vollholz/iam';
import { toCloudEvent, type OutboxConsumer } from '../../core/events.ts';
import { clip } from '../../core/redact.ts';
import { safeFetch } from '../../core/ssrf.ts';
import type { Tx } from '../../db/pool.ts';
import { webhookDeliveries } from '../../ops/metrics.ts';
import { backoffMs, enqueue, type JobDefinition } from '../../worker/queue.ts';
import { signedHeaders } from './sign.ts';
import { webhooks } from './store.ts';

export const DELIVER_KIND = 'webhook.deliver';
export const MAX_DELIVERY_ATTEMPTS = 8;

export const webhookConsumer: OutboxConsumer = {
  name: 'webhooks', types: '*',
  async handle(tx, e) {
    const ce = toCloudEvent(e);
    for (const w of await webhooks.subscribers(tx, e.type)) {
      const r = await tx.query<{ id: string }>(
        `INSERT INTO ppm.webhook_delivery (tenant_id, webhook_id, event_id, event_type, payload) VALUES (app.tenant_id(), $1, $2, $3, $4)
         ON CONFLICT (tenant_id, webhook_id, event_id) DO NOTHING RETURNING id`, [w.id, e.id, e.type, JSON.stringify(ce)]);
      if (r.rows[0]) await enqueue(tx, DELIVER_KIND, { deliveryId: r.rows[0].id }, { dedupeKey: `${r.rows[0].id}:1`, maxAttempts: 1 });
    }
  },
};

export interface DeliveryConfig { keys: Keyring; timeoutMs: number; maxResponseBytes: number; allowPrivate: boolean }

export function deliverJob(c: DeliveryConfig): JobDefinition<{ deliveryId: string }> {
  return {
    kind: DELIVER_KIND, maxAttempts: 1,
    async handle(tx: Tx, { deliveryId }, job) {
      const d = (await tx.query<{ webhook_id: string; event_id: string; payload: unknown; attempts: number; status: string; url: string; active: boolean }>(
        `SELECT d.webhook_id, d.event_id, d.payload, d.attempts, d.status, w.url, w.active FROM ppm.webhook_delivery d
         JOIN ppm.webhook w ON w.tenant_id = d.tenant_id AND w.id = d.webhook_id WHERE d.id = $1 FOR UPDATE OF d`, [deliveryId])).rows[0];
      if (!d || d.status !== 'pending' || !d.active) return;
      const secret = (await webhooks.secret(tx, c.keys, job.tenantId, d.webhook_id))!;
      const body = JSON.stringify(d.payload);
      const attempt = d.attempts + 1;
      let status: number | null = null, error: string | null = null;
      try {
        const r = await safeFetch(d.url, { method: 'POST', headers: signedHeaders(secret, d.event_id, body), body, timeoutMs: c.timeoutMs, maxBytes: c.maxResponseBytes, allowPrivate: c.allowPrivate });
        status = r.status;
        if (r.status < 200 || r.status >= 300) error = `HTTP ${r.status}: ${clip(r.body, 200)}`;
      } catch (e) { error = clip((e as Error).message, 300); }
      const ok = error === null;
      const final = !ok && attempt >= MAX_DELIVERY_ATTEMPTS;
      await tx.query(
        `UPDATE ppm.webhook_delivery SET attempts = $2, response_status = $3, last_error = $4,
           status = CASE WHEN $5 THEN 'delivered' WHEN $6 THEN 'failed' ELSE 'pending' END, delivered_at = CASE WHEN $5 THEN now() END WHERE id = $1`,
        [deliveryId, attempt, status, error, ok, final]);
      webhookDeliveries.add(1, { result: ok ? 'delivered' : final ? 'failed' : 'retry' });
      if (!ok && !final) await enqueue(tx, DELIVER_KIND, { deliveryId }, { dedupeKey: `${deliveryId}:${attempt + 1}`, maxAttempts: 1, runAt: new Date(Date.now() + backoffMs(attempt)) });
      return { delivered: ok, attempt };
    },
  };
}
