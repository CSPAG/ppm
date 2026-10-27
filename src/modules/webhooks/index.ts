/** Modul Webhooks: öffentliche Schnittstelle. */
import { defineModule, type Rewrapper } from '@vollholz/platform';
import { reseal, SCHEMA } from '../../platform.ts';
import { deliverTask, deliveryRetentionTask, SECRET_PURPOSE, webhookConsumer } from './deliver.ts';
import { registerRoutes } from './routes.ts';

export { sign, verify } from './signature.ts';

/** Geheimnisse der Abonnements mit dem ersten Hauptschlüssel neu verpacken (rotate-keys). */
const webhooksRewrapper: Rewrapper = {
  name: 'webhooks',
  async run(tx, keys, tenantId) {
    const rows = (await tx.query<{ id: string; secret_enc: string }>(`SELECT id, secret_enc FROM ${SCHEMA}.webhook_subscription FOR UPDATE`)).rows;
    let n = 0;
    for (const r of rows) {
      const next = reseal(keys, tenantId, SECRET_PURPOSE, r.id, r.secret_enc);
      if (next) { await tx.query(`UPDATE ${SCHEMA}.webhook_subscription SET secret_enc = $2, updated_at = now() WHERE id = $1`, [r.id, next]); n++; }
    }
    return n;
  },
};

export const webhooksModule = defineModule({
  name: 'webhooks',
  tags: [{ name: 'Webhooks', description: 'Ausgehende Ereignisse (CloudEvents, Standard Webhooks) an Systeme der Organisation.' }],
  register: registerRoutes,
  tasks: [deliverTask, deliveryRetentionTask],
  consumers: [webhookConsumer],
  rewrappers: [webhooksRewrapper],
});
