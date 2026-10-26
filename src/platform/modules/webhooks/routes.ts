/**
 * Routen des Moduls «webhooks»: Verwaltung ausgehender Webhooks (nur Personen mit webhook:admin, d. h. org-admin; das
 * Recht steht in keinem Scope). Das Geheimnis gibt es nur einmal, in der Antwort auf das Anlegen.
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { invalid, notFound, preconditionFailed } from '../../core/errors.ts';
import { checkUrl, SsrfError } from '../../core/ssrf.ts';
import type { Deps } from '../../http/app.ts';
import { DateTime, IdempotencyHeaders, IdParams, IfMatchHeaders, Nullable, record, requireIfMatch, sendWithEtag, Uuid } from '../../http/route-kit.ts';
import { webhooks } from './store.ts';
import { newSecret } from './sign.ts';

const TAG = 'Webhooks';
const EventName = Type.String({ pattern: '^(\\*|[a-z][a-z0-9_.-]{1,127})$', description: 'Ereignistyp, z. B. `projekt.created`, oder `*` für alle.' });

const Webhook = Type.Object({
  id: Uuid, url: Type.String(), description: Type.String(), events: Type.Array(Type.String()), active: Type.Boolean(),
  version: Type.Integer(), createdAt: DateTime, updatedAt: DateTime,
}, { $id: 'Webhook', additionalProperties: false });
const WebhookCreated = Type.Object({
  webhook: Type.Ref('Webhook'),
  secret: Type.String({ description: 'Geheimnis zum Prüfen der Signatur (Standard Webhooks, `whsec_…`). Wird nur jetzt angezeigt.' }),
}, { $id: 'WebhookCreated', additionalProperties: false });
const WebhookCreate = Type.Object({
  url: Type.String({ minLength: 8, maxLength: 2000 }),
  description: Type.Optional(Type.String({ maxLength: 500 })),
  events: Type.Array(EventName, { minItems: 1, maxItems: 50, uniqueItems: true }),
}, { $id: 'WebhookCreate', additionalProperties: false });
const WebhookPatch = Type.Object({
  url: Type.Optional(Type.String({ minLength: 8, maxLength: 2000 })),
  description: Type.Optional(Type.String({ maxLength: 500 })),
  events: Type.Optional(Type.Array(EventName, { minItems: 1, maxItems: 50, uniqueItems: true })),
  active: Type.Optional(Type.Boolean()),
}, { $id: 'WebhookPatch', additionalProperties: false, minProperties: 1 });
const Delivery = Type.Object({
  id: Uuid, eventId: Uuid, eventType: Type.String(), status: Type.String(), attempts: Type.Integer(),
  responseStatus: Nullable(Type.Integer()), error: Nullable(Type.String()), createdAt: DateTime, deliveredAt: Nullable(DateTime),
}, { $id: 'WebhookDelivery', additionalProperties: false });

export function registerWebhookRoutes(app: FastifyInstance, deps: Deps): void {
  for (const s of [Webhook, WebhookCreated, WebhookCreate, WebhookPatch, Delivery]) app.addSchema(s);
  const keys = deps.cfg.iam.encryptionKeys;
  const url = (u: string) => {
    try { checkUrl(u, { allowPrivate: deps.cfg.webhooks.allowPrivate }); } catch (e) {
      if (e instanceof SsrfError) throw invalid('Die Adresse ist nicht erlaubt.', [{ path: '/url', message: e.message }]);
      throw e;
    }
  };
  const admin = (req: FastifyRequest) => req.need('webhook:admin');

  app.get('/v1/webhooks', {
    schema: { tags: [TAG], summary: 'Webhooks auflisten', response: { 200: Type.Object({ items: Type.Array(Type.Ref('Webhook')) }, { additionalProperties: false }) } },
  }, async req => { await admin(req); return { items: await req.tx(tx => webhooks.list(tx)) }; });

  app.post('/v1/webhooks', {
    schema: { tags: [TAG], summary: 'Webhook anlegen', headers: IdempotencyHeaders, body: Type.Ref('WebhookCreate'), response: { 201: Type.Ref('WebhookCreated') } },
  }, async (req, reply) => {
    await admin(req);
    const body = req.body as { url: string; description?: string; events: string[] };
    url(body.url);
    if (!keys.length) throw invalid('Webhooks brauchen ENCRYPTION_KEYS auf dem Server.');
    const p = req.requirePrincipal();
    const secret = newSecret();
    const w = await req.tx(async tx => {
      const created = await webhooks.create(tx, keys, p.tenantId, body, secret, p.principalId);
      await record(req, tx, { action: 'webhook.created', resourceType: 'webhook', resourceId: created.id, data: { url: created.url, events: created.events } });
      return created;
    });
    reply.header('location', `/v1/webhooks/${w.id}`).header('etag', `W/"${w.version}"`).header('cache-control', 'no-store');
    return reply.status(201).send({ webhook: w, secret });
  });

  app.get('/v1/webhooks/:id', {
    schema: { tags: [TAG], summary: 'Webhook lesen', params: IdParams, response: { 200: Type.Ref('Webhook') } },
  }, async (req, reply) => {
    await admin(req);
    const w = await req.tx(tx => webhooks.get(tx, (req.params as { id: string }).id));
    if (!w) throw notFound('Webhook');
    return sendWithEtag(reply, w);
  });

  app.patch('/v1/webhooks/:id', {
    schema: { tags: [TAG], summary: 'Webhook ändern', params: IdParams, headers: Type.Composite([IfMatchHeaders, IdempotencyHeaders]), body: Type.Ref('WebhookPatch'), response: { 200: Type.Ref('Webhook') } },
  }, async (req, reply) => {
    await admin(req);
    const { id } = req.params as { id: string };
    const patch = req.body as { url?: string };
    if (patch.url) url(patch.url);
    const w = await req.tx(async tx => {
      const cur = await webhooks.get(tx, id, true);
      if (!cur) throw notFound('Webhook');
      requireIfMatch(req, cur.version);
      const next = await webhooks.update(tx, id, cur.version, patch);
      if (!next) throw preconditionFailed(cur.version);
      await record(req, tx, { action: 'webhook.updated', resourceType: 'webhook', resourceId: id, data: { changed: Object.keys(patch) } });
      return next;
    });
    return sendWithEtag(reply, w);
  });

  app.delete('/v1/webhooks/:id', {
    schema: { tags: [TAG], summary: 'Webhook löschen', params: IdParams, headers: Type.Composite([IfMatchHeaders, IdempotencyHeaders]), response: { 204: Type.Null({ description: 'Gelöscht' }) } },
  }, async (req, reply) => {
    await admin(req);
    const { id } = req.params as { id: string };
    await req.tx(async tx => {
      const cur = await webhooks.get(tx, id, true);
      if (!cur) throw notFound('Webhook');
      requireIfMatch(req, cur.version);
      if (!(await webhooks.remove(tx, id, cur.version))) throw preconditionFailed(cur.version);
      await record(req, tx, { action: 'webhook.deleted', resourceType: 'webhook', resourceId: id, data: { url: cur.url } });
    });
    return reply.status(204).send();
  });

  app.get('/v1/webhooks/:id/deliveries', {
    schema: { tags: [TAG], summary: 'Letzte Zustellungen eines Webhooks', params: IdParams, response: { 200: Type.Object({ items: Type.Array(Type.Ref('WebhookDelivery')) }, { additionalProperties: false }) } },
  }, async req => {
    await admin(req);
    const { id } = req.params as { id: string };
    return req.tx(async tx => {
      if (!(await webhooks.get(tx, id))) throw notFound('Webhook');
      return { items: await webhooks.deliveries(tx, id) };
    });
  });
}
