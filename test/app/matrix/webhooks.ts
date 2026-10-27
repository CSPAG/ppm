/** Modul webhooks (002_webhooks): Abonnements und Zustellung über alle Mandanten im Worker. */
import assert from 'node:assert/strict';
import type { Matrix } from './typ.ts';

export const matrix: Matrix = {
  tables: {
    webhook_subscription: async (tx, t) => {
      await tx.query("INSERT INTO ppm.webhook_subscription (tenant_id, url, secret_enc, event_types) VALUES ($1, 'https://example.ch/probe', 'x', '{handlungsfeld.created}')", [t]);
      return "url = 'https://example.ch/probe'";
    },
    webhook_delivery: async (tx, t) => {
      await tx.query(`INSERT INTO ppm.webhook_delivery (tenant_id, subscription_id, event_id, event_type, event_data, event_created_at)
        SELECT $1, s.id, e.id, e.type, e.data, e.created_at FROM ppm.webhook_subscription s, ppm.outbox_event e
         WHERE s.url = 'https://example.ch/probe' AND e.type = 'probe.created'`, [t]);
      return 'true';
    },
  },
  policies: [
    'ppm.webhook_delivery.sched_read PERMISSIVE SELECT ppm_sched USING true CHECK -',
    'ppm.webhook_delivery.sched_write PERMISSIVE ALL ppm_sched USING ((app.tenant_id() IS NULL) OR (tenant_id = app.tenant_id())) CHECK ((app.tenant_id() IS NULL) OR (tenant_id = app.tenant_id()))',
    'ppm.webhook_subscription.sched_read PERMISSIVE SELECT ppm_sched USING true CHECK -',
  ],
  tags: ['Webhooks'],
  seed: async (api, a, mark) => {
    const w = await api.app.inject({ method: 'POST', url: '/v1/webhooks', headers: a, payload: { url: 'http://127.0.0.1:9/geheim-a', description: mark, eventTypes: ['*'] } });
    assert.equal(w.statusCode, 201, w.body);
    return { webhook: w.json().subscription.id };
  },
  cases: {
    'GET /v1/webhooks': () => ({ method: 'GET', url: '/v1/webhooks', kind: 'list' }),
    'POST /v1/webhooks': () => ({ method: 'POST', url: '/v1/webhooks', body: { url: 'http://127.0.0.1:9/b', eventTypes: ['*'] }, kind: 'create' }),
    'DELETE /v1/webhooks/:id': i => ({ method: 'DELETE', url: `/v1/webhooks/${i.webhook}`, kind: 'foreign' }),
  },
  unchanged: async (api, a) => {
    assert.equal((await api.app.inject({ method: 'GET', url: '/v1/webhooks', headers: a })).json().items.length, 1);
  },
};
