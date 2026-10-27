/**
 * Webhooks verwalten (nur org-admin, Recht `webhook:admin`): Abonnements auflisten, anlegen (Geheimnis nur in der
 * Antwort des Anlegens), löschen. Ziel-Adressen prüft der SSRF-Schutz von @vollholz/platform beim Anlegen und bei jeder Zustellung.
 */
import { randomUUID } from 'node:crypto';
import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { actorOf, DateTime, HttpError, IdempotencyHeaders, IdParams, invalid, notFound, Nullable, resolveTarget, SsrfError, Uuid, type Deps } from '@vollholz/platform';
import { record, seal } from '../../platform.ts';
import { SECRET_PURPOSE } from './deliver.ts';
import { newSecret } from './signature.ts';
import * as store from './store.ts';

const TAG = 'Webhooks';
const EventType = Type.String({ pattern: '^(\\*|[a-z][a-z0-9_.-]{0,127})$', description: 'Ereignistyp, z. B. `handlungsfeld.created`, oder `*` für alle.' });

const Subscription = Type.Object({
  id: Uuid, url: Type.String(), description: Type.String(), eventTypes: Type.Array(Type.String()), active: Type.Boolean(), createdAt: DateTime, createdBy: Nullable(Uuid),
}, { $id: 'WebhookSubscription', additionalProperties: false });
const Created = Type.Object({
  subscription: Type.Ref('WebhookSubscription'),
  secret: Type.String({ description: 'Geheimnis für die Signatur (Standard Webhooks). Wird nur jetzt angezeigt.' }),
}, { $id: 'WebhookSubscriptionCreated', additionalProperties: false });
const Create = Type.Object({
  url: Type.String({ maxLength: 2000, pattern: '^https?://' }),
  description: Type.Optional(Type.String({ maxLength: 500 })),
  eventTypes: Type.Array(EventType, { minItems: 1, maxItems: 50, uniqueItems: true }),
}, { $id: 'WebhookSubscriptionCreate', additionalProperties: false });

const out = (r: store.SubscriptionRow) => ({ id: r.id, url: r.url, description: r.description, eventTypes: r.event_types, active: r.active, createdAt: r.created_at, createdBy: r.created_by });

export function registerRoutes(app: FastifyInstance, deps: Deps): void {
  for (const s of [Subscription, Created, Create]) app.addSchema(s);

  app.get('/v1/webhooks', {
    schema: { tags: [TAG], summary: 'Webhooks auflisten', response: { 200: Type.Object({ items: Type.Array(Type.Ref('WebhookSubscription')) }) } },
  }, async req => {
    await req.need('webhook:admin');
    return { items: (await req.tx(tx => store.list(tx))).map(out) };
  });

  app.post('/v1/webhooks', {
    schema: { tags: [TAG], summary: 'Webhook anlegen', headers: IdempotencyHeaders, body: Type.Ref('WebhookSubscriptionCreate'), response: { 201: Type.Ref('WebhookSubscriptionCreated') } },
  }, async (req, reply) => {
    await req.need('webhook:admin');
    const body = req.body as typeof Create.static;
    if (deps.cfg.mode === 'production' && !body.url.startsWith('https://')) throw invalid('In Produktion nur https-Adressen.');
    try { await resolveTarget(body.url, { allowPrivate: deps.cfg.app.events.allowPrivate }); } catch (e) {
      if (e instanceof SsrfError) throw invalid(`Ziel nicht erlaubt: ${e.message}.`);
      throw e;
    }
    if (!deps.cfg.encryptionKeys.length) throw new HttpError(409, 'Konflikt', 'Webhooks brauchen ENCRYPTION_KEYS (Geheimnis verschlüsselt speichern).');
    const p = req.requirePrincipal();
    const id = randomUUID();
    const secret = newSecret();
    const who = actorOf(req);
    const row = await req.tx(async tx => {
      const r = await store.create(tx, { id, url: body.url, description: body.description ?? '', eventTypes: body.eventTypes, secretEnc: seal(deps.cfg.encryptionKeys, p.tenantId, SECRET_PURPOSE, id, secret) });
      await record(tx, who, { action: 'webhook.created', resourceType: 'webhook', resourceId: id, data: { url: r.url, eventTypes: r.event_types } });
      return r;
    });
    return reply.code(201).header('location', `/v1/webhooks/${id}`).send({ subscription: out(row), secret });
  });

  app.delete('/v1/webhooks/:id', {
    schema: { tags: [TAG], summary: 'Webhook löschen', params: IdParams, response: { 204: Type.Null({ description: 'Gelöscht' }) } },
  }, async (req, reply) => {
    await req.need('webhook:admin');
    const { id } = req.params as { id: string };
    const who = actorOf(req);
    await req.tx(async tx => {
      if (!(await store.remove(tx, id))) throw notFound('Webhook');
      await record(tx, who, { action: 'webhook.deleted', resourceType: 'webhook', resourceId: id });
    });
    return reply.code(204).send();
  });
}
