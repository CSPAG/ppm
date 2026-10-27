/**
 * Zustellung (Worker): Die Verteilung der Outbox legt je passendem Abonnement eine Zustellung an; diese Aufgabe stellt
 * fällige Zustellungen als CloudEvent zu (signiert nach Standard Webhooks, über den SSRF-Schutz von @vollholz/platform), mit exponentiellem
 * Backoff bis `WEBHOOK_MAX_ATTEMPTS`. Abgeschlossene Zustellungen löscht `retentionTask` nach `OUTBOX_RETENTION`.
 */
import { backoffMs, safeRequest, toCloudEvent, withTx, type OutboxConsumer, type PeriodicTask } from '@vollholz/platform';
import { platform, unseal } from '../../platform.ts';
import { sign } from './signature.ts';
import * as store from './store.ts';

export const SECRET_PURPOSE = 'webhook';

export const webhookConsumer: OutboxConsumer = {
  name: 'webhooks',
  accept: async (tx, events) => { await store.fanOut(tx, events); },
};

export const deliverTask: PeriodicTask = {
  name: 'webhooks.deliver',
  intervalMs: () => 5_000,
  async run({ db, cfg, log }) {
    const timeoutMs = cfg.app.events.webhookTimeoutMs;
    const due = await withTx(db, tx => store.claimDue(tx, 50, Math.ceil(timeoutMs / 1000) * 3));
    await Promise.all(due.map(async d => {
      const event = toCloudEvent(platform.context, { id: d.event_id, type: d.type, subject: d.subject, data: d.data, created_at: d.created_at, tenant_alias: d.tenant_alias }, cfg.publicBaseUrl);
      const body = JSON.stringify(event);
      const ts = Math.floor(Date.now() / 1000);
      let status: number | null = null, error: string | null = null;
      try {
        const secret = unseal(cfg.encryptionKeys, d.tenant_id, SECRET_PURPOSE, d.subscription_id, d.secret_enc);
        const res = await safeRequest(d.url, {
          method: 'POST', timeoutMs, allowPrivate: cfg.app.events.allowPrivate, body, userAgent: 'ppm-webhooks/1',
          headers: { 'content-type': 'application/cloudevents+json', 'webhook-id': d.event_id, 'webhook-timestamp': String(ts), 'webhook-signature': sign(secret, d.event_id, ts, body) },
        });
        status = res.status;
        if (res.status < 200 || res.status >= 300) error = `HTTP ${res.status}`;
      } catch (e) { error = (e as Error).message.slice(0, 500); }
      const delivered = error === null;
      const failed = !delivered && d.attempts >= cfg.app.events.webhookMaxAttempts;
      await withTx(db, tx => store.finish(tx, d, { delivered, failed, status, error, retryInSec: backoffMs(d.attempts) / 1000 }));
      if (!delivered) log.warn({ delivery: d.id, tenant: d.tenant_id, attempt: d.attempts, status, error, failed }, 'Webhook nicht zugestellt');
    }));
  },
};

/** Aufbewahrung der Zustellungen: abgeschlossene nach `OUTBOX_RETENTION` löschen (stündlich, offene bleiben). */
export const deliveryRetentionTask: PeriodicTask = {
  name: 'webhooks.retention',
  intervalMs: () => 60 * 60_000,
  async run({ db, cfg, log }) {
    const n = await store.purgeFinished(db, cfg.app.events.outboxRetentionMs / 1000);
    if (n) log.info({ deliveries: n }, 'Aufbewahrung: Zustellungen gelöscht');
  },
};
