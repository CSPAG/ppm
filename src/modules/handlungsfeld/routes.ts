/**
 * Routen der Handlungsfelder – das Muster für alle Module: Rechte über `req.need`, Lesesicht über `req.tx`, Fähigkeiten
 * `can`, Cursor, ETag/If-Match (412), Idempotenz (Querschnitt), Audit und Ereignis in derselben Transaktion.
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  actorOf, decodeCursor, encodeCursor, etag, IdempotencyHeaders, IdParams, IfMatchHeaders, notFound, preconditionFailed,
  requireIfMatch, type Deps,
} from '@vollholz/platform';
import { record } from '../../platform.ts';
import {
  Handlungsfeld, HandlungsfeldCreate, HandlungsfeldHistory, HandlungsfeldList, HandlungsfeldPatch, HandlungsfeldVersion, ListQuery,
  type HandlungsfeldOut,
} from './schemas.ts';
import * as store from './store.ts';

const TAG = 'Handlungsfelder';

/** Fähigkeiten der Person: Handlungsfelder haben keine Freigaben je Objekt, es zählt die Rolle an der Organisation. */
type Can = { write: boolean; delete: boolean };
const capabilities = async (req: FastifyRequest): Promise<Can> => ({ write: await req.can('handlungsfeld:write'), delete: await req.can('handlungsfeld:delete') });

function out(r: store.Row, can: Can): HandlungsfeldOut {
  return {
    id: r.id, label: r.label, leitsatz: r.leitsatz, stossrichtungen: r.stossrichtungen, position: r.position, version: r.version,
    createdAt: r.created_at, createdBy: r.created_by, updatedAt: r.updated_at, updatedBy: r.updated_by,
    can,
  };
}

/** Daten für Audit und Ereignis (ohne Fähigkeiten). */
const snapshot = (r: store.Row) => ({ id: r.id, label: r.label, leitsatz: r.leitsatz, stossrichtungen: r.stossrichtungen, position: r.position, version: r.version });

export function registerRoutes(app: FastifyInstance, _deps: Deps): void {
  for (const s of [Handlungsfeld, HandlungsfeldList, HandlungsfeldVersion, HandlungsfeldHistory, HandlungsfeldCreate, HandlungsfeldPatch]) app.addSchema(s);

  app.get('/v1/handlungsfelder', {
    schema: { tags: [TAG], summary: 'Handlungsfelder auflisten', description: 'Sortiert nach Reihenfolge und Name, Cursor-Paginierung, Suche im Namen.', querystring: ListQuery, response: { 200: Type.Ref('HandlungsfeldList') } },
  }, async req => {
    await req.need('handlungsfeld:read');
    const q = req.query as { q?: string; cursor?: string; limit?: number };
    const limit = q.limit ?? 50;
    const after = decodeCursor<{ p: number; l: string; i: string; q: string }>(q.cursor,
      v => typeof v.p === 'number' && typeof v.l === 'string' && typeof v.i === 'string' && v.q === (q.q ?? ''));
    const rows = await req.tx(tx => store.list(tx, { q: q.q, after: after && { position: after.p, label: after.l, id: after.i }, limit }));
    const page = rows.slice(0, limit);
    const can = await capabilities(req);
    const last = page[page.length - 1];
    return {
      items: page.map(r => out(r, can)),
      nextCursor: rows.length > limit && last ? encodeCursor({ p: last.position, l: last.label, i: last.id, q: q.q ?? '' }) : null,
    };
  });

  app.get('/v1/handlungsfelder/:id', {
    schema: { tags: [TAG], summary: 'Handlungsfeld lesen', params: IdParams, response: { 200: Type.Ref('Handlungsfeld') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await req.need('handlungsfeld:read');
    const row = await req.tx(tx => store.get(tx, id));
    if (!row) throw notFound('Handlungsfeld');
    const can = await capabilities(req);
    reply.header('etag', etag(row.version));
    return out(row, can);
  });

  app.post('/v1/handlungsfelder', {
    schema: { tags: [TAG], summary: 'Handlungsfeld anlegen', headers: IdempotencyHeaders, body: Type.Ref('HandlungsfeldCreate'), response: { 201: Type.Ref('Handlungsfeld') } },
  }, async (req, reply) => {
    await req.need('handlungsfeld:write');
    const body = req.body as typeof HandlungsfeldCreate.static;
    const who = actorOf(req);
    const row = await req.tx(async tx => {
      const r = await store.create(tx, body);
      await record(tx, who, { action: 'handlungsfeld.created', resourceType: 'handlungsfeld', resourceId: r.id, data: snapshot(r), event: snapshot(r) });
      return r;
    });
    const can = await capabilities(req);
    return reply.code(201).header('location', `/v1/handlungsfelder/${row.id}`).header('etag', etag(row.version)).send(out(row, can));
  });

  app.patch('/v1/handlungsfelder/:id', {
    schema: { tags: [TAG], summary: 'Handlungsfeld ändern', description: 'Nur mit `If-Match` (ETag der gelesenen Version); bei abweichender Version 412.', params: IdParams, headers: IfMatchHeaders, body: Type.Ref('HandlungsfeldPatch'), response: { 200: Type.Ref('Handlungsfeld') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('handlungsfeld:write');
    const who = actorOf(req);
    const row = await req.tx(async tx => {
      const before = await store.get(tx, id);
      if (!before) throw notFound('Handlungsfeld');
      if (before.version !== version) throw preconditionFailed(before.version);
      const r = await store.update(tx, id, version, req.body as typeof HandlungsfeldPatch.static);
      if (!r) throw preconditionFailed(before.version);
      await record(tx, who, { action: 'handlungsfeld.updated', resourceType: 'handlungsfeld', resourceId: id, data: { before: snapshot(before), after: snapshot(r) }, event: snapshot(r) });
      return r;
    });
    const can = await capabilities(req);
    reply.header('etag', etag(row.version));
    return out(row, can);
  });

  app.delete('/v1/handlungsfelder/:id', {
    schema: { tags: [TAG], summary: 'Handlungsfeld löschen', description: 'Nur mit `If-Match`; der Verlauf bleibt erhalten.', params: IdParams, headers: IfMatchHeaders, response: { 204: Type.Null({ description: 'Gelöscht' }) } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('handlungsfeld:delete');
    const who = actorOf(req);
    await req.tx(async tx => {
      const before = await store.get(tx, id);
      if (!before) throw notFound('Handlungsfeld');
      if (before.version !== version || !(await store.remove(tx, id, version))) throw preconditionFailed(before.version);
      await record(tx, who, { action: 'handlungsfeld.deleted', resourceType: 'handlungsfeld', resourceId: id, data: snapshot(before), event: { id } });
    });
    return reply.code(204).send();
  });

  app.get('/v1/handlungsfelder/:id/history', {
    schema: { tags: [TAG], summary: 'Verlauf eines Handlungsfelds', description: 'Alle Versionen, neueste zuerst; auch nach dem Löschen.', params: IdParams, response: { 200: Type.Ref('HandlungsfeldHistory') } },
  }, async req => {
    const { id } = req.params as { id: string };
    await req.need('handlungsfeld:read');
    const rows = await req.tx(tx => store.history(tx, id));
    if (!rows.length) throw notFound('Handlungsfeld');
    return {
      items: rows.map(v => ({
        version: v.version, action: v.action, label: v.label, leitsatz: v.leitsatz, stossrichtungen: v.stossrichtungen, position: v.position,
        changedAt: v.changed_at, changedBy: v.changed_by,
      })),
    };
  });
}
