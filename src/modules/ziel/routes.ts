/**
 * Routen der strategischen Ziele (BC ZM.01.02, UC-011 Schritt 2) nach dem Muster der Handlungsfelder: Rechte über
 * `req.need`, Lesesicht über `req.tx`, Fähigkeiten `can`, Cursor, ETag/If-Match (412), Idempotenz (Querschnitt), Audit
 * und Ereignis in derselben Transaktion, Verlauf jeder Fassung.
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  actorOf, decodeCursor, encodeCursor, etag, IdempotencyHeaders, IdParams, IfMatchHeaders, notFound, preconditionFailed,
  requireIfMatch, type Deps,
} from '@vollholz/platform';
import { record } from '../../platform.ts';
import {
  ListQuery, StrategischesZiel, StrategischesZielCreate, StrategischesZielHistory, StrategischesZielList, StrategischesZielPatch,
  StrategischesZielVersion, type StrategischesZielOut,
} from './schemas.ts';
import * as store from './store.ts';

const TAG = 'Ziele';

/** Fähigkeiten der Person: strategische Ziele haben keine Freigaben je Objekt, es zählt die Rolle an der Organisation. */
type Can = { write: boolean };
const capabilities = async (req: FastifyRequest): Promise<Can> => ({ write: await req.can('ziel:write') });

function out(r: store.Row, can: Can): StrategischesZielOut {
  return {
    id: r.id, handlungsfeldId: r.handlungsfeld_id, nummer: r.nummer, text: r.text, horizont: r.horizont, metrik: r.metrik, zielwert: r.zielwert,
    version: r.version, createdAt: r.created_at, createdBy: r.created_by, updatedAt: r.updated_at, updatedBy: r.updated_by,
    can,
  };
}

/** Daten für Audit und Ereignis (ohne Fähigkeiten). */
const snapshot = (r: store.Row) => ({
  id: r.id, handlungsfeldId: r.handlungsfeld_id, nummer: r.nummer, text: r.text, horizont: r.horizont, metrik: r.metrik, zielwert: r.zielwert, version: r.version,
});

/**
 * Unbekanntes Handlungsfeld (auch eines anderer Organisationen) wie jede unbekannte ID als 404 statt als Konflikt aus dem
 * Fremdschlüssel: fremde und nirgends vorhandene IDs ergeben dieselbe Antwort (Mandantentrennung).
 */
async function handlungsfeldPruefen<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if ((e as { code?: string }).code === '23503') throw notFound('Handlungsfeld');
    throw e;
  }
}

export function registerRoutes(app: FastifyInstance, _deps: Deps): void {
  for (const s of [StrategischesZiel, StrategischesZielList, StrategischesZielVersion, StrategischesZielHistory, StrategischesZielCreate, StrategischesZielPatch]) app.addSchema(s);

  app.get('/v1/strategische-ziele', {
    schema: { tags: [TAG], summary: 'Strategische Ziele auflisten', description: 'Sortiert nach Nummer (2.9 vor 2.10), Cursor-Paginierung, Filter nach Handlungsfeld, Suche in Nummer und Text.', querystring: ListQuery, response: { 200: Type.Ref('StrategischesZielList') } },
  }, async req => {
    await req.need('ziel:read');
    const q = req.query as { handlungsfeld?: string; q?: string; cursor?: string; limit?: number };
    const limit = q.limit ?? 50;
    const filter = `${q.handlungsfeld ?? ''}|${q.q ?? ''}`;
    const after = decodeCursor<{ s: number[]; i: string; f: string }>(q.cursor,
      v => Array.isArray(v.s) && v.s.every(n => Number.isInteger(n)) && typeof v.i === 'string' && v.f === filter);
    const rows = await req.tx(tx => store.list(tx, { handlungsfeld: q.handlungsfeld, q: q.q, after: after && { sort: after.s, id: after.i }, limit }));
    const page = rows.slice(0, limit);
    const can = await capabilities(req);
    const last = page[page.length - 1];
    return {
      items: page.map(r => out(r, can)),
      nextCursor: rows.length > limit && last ? encodeCursor({ s: last.nummer_sort, i: last.id, f: filter }) : null,
    };
  });

  app.get('/v1/strategische-ziele/:id', {
    schema: { tags: [TAG], summary: 'Strategisches Ziel lesen', params: IdParams, response: { 200: Type.Ref('StrategischesZiel') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await req.need('ziel:read');
    const row = await req.tx(tx => store.get(tx, id));
    if (!row) throw notFound('Strategisches Ziel');
    const can = await capabilities(req);
    reply.header('etag', etag(row.version));
    return out(row, can);
  });

  app.post('/v1/strategische-ziele', {
    schema: { tags: [TAG], summary: 'Strategisches Ziel anlegen', description: 'Unter einem Handlungsfeld (unbekannt: 404); Nummer eindeutig in der Organisation (sonst 409).', headers: IdempotencyHeaders, body: Type.Ref('StrategischesZielCreate'), response: { 201: Type.Ref('StrategischesZiel') } },
  }, async (req, reply) => {
    await req.need('ziel:write');
    const body = req.body as typeof StrategischesZielCreate.static;
    const who = actorOf(req);
    const row = await handlungsfeldPruefen(() => req.tx(async tx => {
      const r = await store.create(tx, body);
      await record(tx, who, { action: 'strategisches_ziel.created', resourceType: 'strategisches_ziel', resourceId: r.id, data: snapshot(r), event: snapshot(r) });
      return r;
    }));
    const can = await capabilities(req);
    return reply.code(201).header('location', `/v1/strategische-ziele/${row.id}`).header('etag', etag(row.version)).send(out(row, can));
  });

  app.patch('/v1/strategische-ziele/:id', {
    schema: { tags: [TAG], summary: 'Strategisches Ziel ändern', description: 'Nur mit `If-Match` (ETag der gelesenen Version); bei abweichender Version 412. Jede Fassung bleibt im Verlauf.', params: IdParams, headers: IfMatchHeaders, body: Type.Ref('StrategischesZielPatch'), response: { 200: Type.Ref('StrategischesZiel') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('ziel:write');
    const who = actorOf(req);
    const row = await handlungsfeldPruefen(() => req.tx(async tx => {
      const before = await store.get(tx, id);
      if (!before) throw notFound('Strategisches Ziel');
      if (before.version !== version) throw preconditionFailed(before.version);
      const r = await store.update(tx, id, version, req.body as typeof StrategischesZielPatch.static);
      if (!r) throw preconditionFailed(before.version);
      await record(tx, who, { action: 'strategisches_ziel.updated', resourceType: 'strategisches_ziel', resourceId: id, data: { before: snapshot(before), after: snapshot(r) }, event: snapshot(r) });
      return r;
    }));
    const can = await capabilities(req);
    reply.header('etag', etag(row.version));
    return out(row, can);
  });

  app.delete('/v1/strategische-ziele/:id', {
    schema: { tags: [TAG], summary: 'Strategisches Ziel löschen', description: 'Nur mit `If-Match`; der Verlauf bleibt erhalten.', params: IdParams, headers: IfMatchHeaders, response: { 204: Type.Null({ description: 'Gelöscht' }) } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('ziel:write');
    const who = actorOf(req);
    await req.tx(async tx => {
      const before = await store.get(tx, id);
      if (!before) throw notFound('Strategisches Ziel');
      if (before.version !== version || !(await store.remove(tx, id, version))) throw preconditionFailed(before.version);
      await record(tx, who, { action: 'strategisches_ziel.deleted', resourceType: 'strategisches_ziel', resourceId: id, data: snapshot(before), event: { id } });
    });
    return reply.code(204).send();
  });

  app.get('/v1/strategische-ziele/:id/history', {
    schema: { tags: [TAG], summary: 'Verlauf eines strategischen Ziels', description: 'Alle Fassungen, neueste zuerst; auch nach dem Löschen (UC-011 Schritt 2, G11).', params: IdParams, response: { 200: Type.Ref('StrategischesZielHistory') } },
  }, async req => {
    const { id } = req.params as { id: string };
    await req.need('ziel:read');
    const rows = await req.tx(tx => store.history(tx, id));
    if (!rows.length) throw notFound('Strategisches Ziel');
    return {
      items: rows.map(v => ({
        version: v.version, action: v.action, handlungsfeldId: v.handlungsfeld_id, nummer: v.nummer, text: v.text, horizont: v.horizont,
        metrik: v.metrik, zielwert: v.zielwert, changedAt: v.changed_at, changedBy: v.changed_by,
      })),
    };
  });
}
