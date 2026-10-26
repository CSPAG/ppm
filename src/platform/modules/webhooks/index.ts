/**
 * Modul «webhooks» (Profil outbox): ausgehende Webhooks nach Standard Webhooks für Ereignisse der Organisation.
 */
import type { Module } from '../../http/app.ts';
import type { Rotation } from '../../ops/rotation.ts';
import { deliverJob, webhookConsumer, type DeliveryConfig } from './delivery.ts';
import { registerWebhookRoutes } from './routes.ts';
import { webhooks } from './store.ts';

export const webhooksModule: Module = { name: 'webhooks', register: registerWebhookRoutes };
export const webhookJobs = (c: DeliveryConfig) => [deliverJob(c)];
export { webhookConsumer };
export { newSecret, sign, signedHeaders, verify } from './sign.ts';
export const webhookRotation: Rotation = { name: 'webhooks', rewrap: (tx, keys, tenantId, dryRun) => webhooks.rewrapAll(tx, keys, tenantId, dryRun) };
