/**
 * Routen des Moduls «projekt» – Vorlage für alle späteren Module: Cursor-Liste mit Suche, ETag/If-Match (428/412),
 * Idempotenz (POST), Rechte über `req.need` und Fähigkeiten `can`, Klassifizierung, Audit und Ereignisse, langer Lauf
 * als Aktion mit 202 und Location.
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { invalid, notFound, preconditionFailed } from '../../core/errors.ts';
import type { Deps } from '../../http/app.ts';
import { encodeCursor, IdempotencyHeaders, IdParams, IfMatchHeaders, pageCursor, record, requireIfMatch, sendWithEtag } from '../../http/route-kit.ts';
import { enqueue } from '../../worker/queue.ts';
import { SUMMARY_JOB } from './jobs.ts';
import { ProjektListQuery, SCHEMAS, zeitraumErrors, type Projekt as ProjektT, type ProjektCreate, type ProjektPatch } from './schemas.ts';
import { projekte } from './store.ts';

const TAG = 'Projekte';
const ref = (id: string) => ({ type: 'projekt', id });
const by = (req: FastifyRequest) => req.requirePrincipal().principalId;
const event = (type: string, p: ProjektT) => ({ type: `projekt.${type}`, subject: `projekt/${p.id}`, data: { id: p.id, label: p.label, version: p.version, classification: p.classification } });

async function withCan(req: FastifyRequest, items: ProjektT[]): Promise<ProjektT[]> {
  const can = await req.capabilities(items.map(p => ref(p.id)));
  return items.map(p => ({ ...p, can: can('projekt', p.id) }));
}

export function registerProjektRoutes(app: FastifyInstance, _deps: Deps): void {
  for (const s of SCHEMAS) app.addSchema(s);

  app.get('/v1/projekte', {
    schema: { tags: [TAG], summary: 'Projekte auflisten', description: 'Nur Projekte, die du lesen darfst (Lesesicht). Sortiert nach Bezeichnung, Cursor-Paginierung.', querystring: ProjektListQuery, response: { 200: Type.Ref('ProjektList') } },
  }, async req => {
    await req.needSomewhere('projekt:read');
    const { q = '', limit = 50, cursor } = req.query as { q?: string; limit?: number; cursor?: string };
    const after = pageCursor<{ q: string; label: string; id: string }>(cursor, q);
    const rows = await req.tx(tx => projekte.list(tx, { q, limit: limit + 1, after }));
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return { items: await withCan(req, page), next: rows.length > limit && last ? encodeCursor({ q, label: last.label, id: last.id }) : null };
  });

  app.post('/v1/projekte', {
    schema: { tags: [TAG], summary: 'Projekt anlegen', headers: IdempotencyHeaders, body: Type.Ref('ProjektCreate'), response: { 201: Type.Ref('Projekt') } },
  }, async (req, reply) => {
    const body = req.body as ProjektCreate;
    await req.need('projekt:write');
    if (body.classification) await req.needClearance(body.classification as 0 | 1 | 2);
    const errors = zeitraumErrors({ beginn: body.beginn ?? null, ende: body.ende ?? null });
    if (errors.length) throw invalid('Der Zeitraum ist ungültig.', errors);
    const p = await req.tx(async tx => {
      const created = await projekte.create(tx, body, by(req));
      await record(req, tx, { action: 'projekt.created', resourceType: 'projekt', resourceId: created.id, data: { label: created.label, classification: created.classification } }, event('created', created));
      return created;
    });
    const [out] = await withCan(req, [p]);
    reply.header('location', `/v1/projekte/${p.id}`);
    return sendWithEtag(reply, out!, 201);
  });

  app.get('/v1/projekte/:id', {
    schema: { tags: [TAG], summary: 'Projekt lesen', params: IdParams, response: { 200: Type.Ref('Projekt') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await req.need('projekt:read', ref(id));
    const p = await req.tx(tx => projekte.get(tx, id));
    if (!p) throw notFound('Projekt');
    const [out] = await withCan(req, [p]);
    return sendWithEtag(reply, out!);
  });

  app.patch('/v1/projekte/:id', {
    schema: { tags: [TAG], summary: 'Projekt ändern', description: 'Braucht `If-Match` mit dem ETag der gelesenen Fassung (428 ohne, 412 bei veralteter Fassung).', params: IdParams, headers: Type.Composite([IfMatchHeaders, IdempotencyHeaders]), body: Type.Ref('ProjektPatch'), response: { 200: Type.Ref('Projekt') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const patch = req.body as ProjektPatch;
    await req.need('projekt:write', ref(id));
    if (patch.classification !== undefined) await req.needClearance(patch.classification as 0 | 1 | 2);
    const p = await req.tx(async tx => {
      const cur = await projekte.get(tx, id, true);
      if (!cur) throw notFound('Projekt');
      requireIfMatch(req, cur.version);
      const merged = { beginn: patch.beginn !== undefined ? patch.beginn : cur.beginn, ende: patch.ende !== undefined ? patch.ende : cur.ende };
      const errors = zeitraumErrors(merged);
      if (errors.length) throw invalid('Der Zeitraum ist ungültig.', errors);
      const next = await projekte.update(tx, id, patch, cur.version, by(req));
      if (!next) throw preconditionFailed(cur.version);
      const changed = Object.keys(patch);
      await record(req, tx, { action: 'projekt.updated', resourceType: 'projekt', resourceId: id, data: { changed } }, event('updated', next));
      if (patch.classification !== undefined && patch.classification !== cur.classification) {
        await req.audit(tx, { action: 'object.classified', resourceType: 'projekt', resourceId: id, data: { from: cur.classification, to: patch.classification } });
      }
      return next;
    });
    const [out] = await withCan(req, [p]);
    return sendWithEtag(reply, out!);
  });

  app.delete('/v1/projekte/:id', {
    schema: { tags: [TAG], summary: 'Projekt löschen', params: IdParams, headers: Type.Composite([IfMatchHeaders, IdempotencyHeaders]), response: { 204: Type.Null({ description: 'Gelöscht' }) } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await req.need('projekt:delete', ref(id));
    await req.tx(async tx => {
      const cur = await projekte.get(tx, id, true);
      if (!cur) throw notFound('Projekt');
      requireIfMatch(req, cur.version);
      if (!(await projekte.remove(tx, cur, by(req)))) throw preconditionFailed(cur.version);
      await record(req, tx, { action: 'projekt.deleted', resourceType: 'projekt', resourceId: id, data: { label: cur.label } }, event('deleted', cur));
    });
    return reply.status(204).send();
  });

  app.get('/v1/projekte/:id/history', {
    schema: { tags: [TAG], summary: 'Verlauf eines Projekts', params: IdParams, response: { 200: Type.Ref('ProjektHistory') } },
  }, async req => {
    const { id } = req.params as { id: string };
    await req.need('projekt:read', ref(id));
    const items = await req.tx(tx => projekte.history(tx, id));
    // Verlauf gibt es auch für gelöschte Projekte; ohne Fassung (unbekannt oder nicht lesbar) wie ein fehlendes Projekt
    if (!items.length) throw notFound('Projekt');
    return { items };
  });

  // Langer Lauf als Aktion: 202 mit Location auf den Vorgang
  app.post('/v1/projekte::zusammenfassen', {
    schema: { tags: [TAG], summary: 'Kennzahlen der Projekte berechnen (Vorgang)', description: 'Startet einen Vorgang im Hintergrund; das Ergebnis steht unter der Adresse aus `Location`.', headers: IdempotencyHeaders, response: { 202: Type.Object({ id: Type.String({ format: 'uuid' }), status: Type.String() }, { additionalProperties: false }) } },
  }, async (req, reply) => {
    await req.need('projekt:read');
    const id = await req.tx(tx => enqueue(tx, SUMMARY_JOB.kind, {}, { createdBy: by(req), maxAttempts: 3 }));
    reply.header('location', `/v1/vorgaenge/${id}`);
    return reply.status(202).send({ id: id!, status: 'queued' });
  });

}
