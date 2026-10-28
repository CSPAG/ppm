/**
 * Routen der Stammdaten (UC-017 Schritte 1–2) nach dem Muster der Handlungsfelder: Rechte über `req.need`, Lesesicht über
 * `req.tx`, Fähigkeiten `can`, Cursor, ETag/If-Match (412), Idempotenz (Querschnitt), Audit und Ereignis in derselben
 * Transaktion. Stammdaten sind kein Ort im Modell: es zählt das Recht an der Organisation (fachmodell.md 3.4, Muster ORG).
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  actorOf, decodeCursor, encodeCursor, etag, IdempotencyHeaders, IdParams, IfMatchHeaders, invalid, notFound, preconditionFailed,
  requireIfMatch, type Deps, type Tx,
} from '@vollholz/platform';
import { record } from '../../platform.ts';
import { CODETABELLEN } from './codetabellen.ts';
import {
  Codetabelle, CodetabelleList, Codewert, CodewertCreate, CodewertList, CodewertPatch, CodewertQuery, Feiertag, FeiertagCreate, FeiertagList,
  FeiertagPatch, FeiertagQuery, OrgEinheit, OrgEinheitCreate, OrgEinheitList, OrgEinheitPatch, OrgEinheitQuery, TabelleParams, VorgabeErgebnis,
  WertParams, type CodewertOut, type FeiertagOut, type OrgEinheitOut,
} from './schemas.ts';
import * as store from './store.ts';

const TAG = 'Stammdaten';

const canWrite = (req: FastifyRequest) => req.can('stammdaten:write');

function meta(r: { version: number; created_at: Date; created_by: string | null; updated_at: Date; updated_by: string | null }) {
  return { version: r.version, createdAt: r.created_at, createdBy: r.created_by, updatedAt: r.updated_at, updatedBy: r.updated_by };
}

const orgOut = (r: store.OrgRow, write: boolean): OrgEinheitOut => ({
  id: r.id, parentId: r.parent_id, kuerzel: r.kuerzel, name: r.name, art: r.art, aktiv: r.aktiv, ...meta(r),
  can: { write, delete: write && r.kinder === 0 },
});
const orgSnap = (r: store.OrgRow) => ({ id: r.id, parentId: r.parent_id, kuerzel: r.kuerzel, name: r.name, art: r.art, aktiv: r.aktiv, version: r.version });

const wertOut = (r: store.WertRow, write: boolean): CodewertOut => ({
  id: r.id, codetabelle: r.codetabelle, schluessel: r.schluessel, label: r.label, position: r.position, aktiv: r.aktiv, ...meta(r), can: { write },
});
const wertSnap = (r: store.WertRow) => ({ id: r.id, codetabelle: r.codetabelle, schluessel: r.schluessel, label: r.label, position: r.position, aktiv: r.aktiv, version: r.version });

const ftOut = (r: store.FeiertagRow, write: boolean): FeiertagOut => ({ id: r.id, datum: r.datum, label: r.label, ...meta(r), can: { write, delete: write } });
const ftSnap = (r: store.FeiertagRow) => ({ id: r.id, datum: r.datum, label: r.label, version: r.version });

/** Übergeordnete Einheit prüfen: vorhanden (in der Lesesicht) und kein Kreis. */
async function checkParent(tx: Tx, id: string | null, parentId: string | null | undefined): Promise<void> {
  if (!parentId) return;
  if (!(await store.getOrg(tx, parentId))) throw invalid('Die übergeordnete Einheit gibt es nicht.', [{ path: '/parentId', message: 'unbekannt' }]);
  if (id && (parentId === id || await store.wouldCycle(tx, id, parentId))) {
    throw invalid('Eine Einheit kann nicht sich selbst oder einer ihrer untergeordneten Einheiten unterstellt werden.', [{ path: '/parentId', message: 'Kreis' }]);
  }
}

export function registerRoutes(app: FastifyInstance, _deps: Deps): void {
  for (const s of [OrgEinheit, OrgEinheitList, OrgEinheitCreate, OrgEinheitPatch, Codetabelle, CodetabelleList, VorgabeErgebnis, Codewert, CodewertList, CodewertCreate, CodewertPatch, Feiertag, FeiertagList, FeiertagCreate, FeiertagPatch]) app.addSchema(s);

  // --- Organisationseinheiten (BC AM.02.01, UC-017 Schritt 1)

  app.get('/v1/org-einheiten', {
    schema: { tags: [TAG], summary: 'Organisationseinheiten auflisten', description: 'Sortiert nach Kürzel, Cursor-Paginierung, Suche in Kürzel und Name; die Hierarchie ergibt sich aus `parentId`.', querystring: OrgEinheitQuery, response: { 200: Type.Ref('OrgEinheitList') } },
  }, async req => {
    await req.need('stammdaten:read');
    const q = req.query as { q?: string; art?: string; aktiv?: boolean; cursor?: string; limit?: number };
    const limit = q.limit ?? 50;
    const filter = `${q.q ?? ''}|${q.art ?? ''}|${q.aktiv ?? ''}`;
    const after = decodeCursor<{ k: string; i: string; f: string }>(q.cursor, v => typeof v.k === 'string' && typeof v.i === 'string' && v.f === filter);
    const rows = await req.tx(tx => store.listOrg(tx, { q: q.q, art: q.art, aktiv: q.aktiv, after: after && { kuerzel: after.k, id: after.i }, limit }));
    const page = rows.slice(0, limit);
    const write = await canWrite(req);
    const last = page[page.length - 1];
    return {
      items: page.map(r => orgOut(r, write)),
      nextCursor: rows.length > limit && last ? encodeCursor({ k: last.kuerzel, i: last.id, f: filter }) : null,
      can: { write },
    };
  });

  app.get('/v1/org-einheiten/:id', {
    schema: { tags: [TAG], summary: 'Organisationseinheit lesen', params: IdParams, response: { 200: Type.Ref('OrgEinheit') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await req.need('stammdaten:read');
    const row = await req.tx(tx => store.getOrg(tx, id));
    if (!row) throw notFound('Organisationseinheit');
    reply.header('etag', etag(row.version));
    return orgOut(row, await canWrite(req));
  });

  app.post('/v1/org-einheiten', {
    schema: { tags: [TAG], summary: 'Organisationseinheit anlegen', headers: IdempotencyHeaders, body: Type.Ref('OrgEinheitCreate'), response: { 201: Type.Ref('OrgEinheit') } },
  }, async (req, reply) => {
    await req.need('stammdaten:write');
    const body = req.body as typeof OrgEinheitCreate.static;
    const who = actorOf(req);
    const row = await req.tx(async tx => {
      await checkParent(tx, null, body.parentId);
      const r = await store.createOrg(tx, body);
      await record(tx, who, { action: 'org_einheit.created', resourceType: 'org_einheit', resourceId: r.id, data: orgSnap(r), event: orgSnap(r) });
      return r;
    });
    return reply.code(201).header('location', `/v1/org-einheiten/${row.id}`).header('etag', etag(row.version)).send(orgOut(row, true));
  });

  app.patch('/v1/org-einheiten/:id', {
    schema: { tags: [TAG], summary: 'Organisationseinheit ändern', description: 'Nur mit `If-Match`; bei abweichender Version 412. Nicht mehr bestehende Einheiten werden deaktiviert (`aktiv: false`).', params: IdParams, headers: IfMatchHeaders, body: Type.Ref('OrgEinheitPatch'), response: { 200: Type.Ref('OrgEinheit') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('stammdaten:write');
    const body = req.body as typeof OrgEinheitPatch.static;
    const who = actorOf(req);
    const row = await req.tx(async tx => {
      const before = await store.getOrg(tx, id);
      if (!before) throw notFound('Organisationseinheit');
      if (before.version !== version) throw preconditionFailed(before.version);
      await checkParent(tx, id, body.parentId);
      const r = await store.updateOrg(tx, id, version, body);
      if (!r) throw preconditionFailed(before.version);
      await record(tx, who, { action: 'org_einheit.updated', resourceType: 'org_einheit', resourceId: id, data: { before: orgSnap(before), after: orgSnap(r) }, event: orgSnap(r) });
      return r;
    });
    reply.header('etag', etag(row.version));
    return orgOut(row, true);
  });

  app.delete('/v1/org-einheiten/:id', {
    schema: { tags: [TAG], summary: 'Organisationseinheit löschen', description: 'Nur mit `If-Match` und nur ohne untergeordnete Einheiten und Verweise (sonst 409); sonst deaktivieren.', params: IdParams, headers: IfMatchHeaders, response: { 204: Type.Null({ description: 'Gelöscht' }) } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('stammdaten:write');
    const who = actorOf(req);
    await req.tx(async tx => {
      const before = await store.getOrg(tx, id);
      if (!before) throw notFound('Organisationseinheit');
      if (before.version !== version || !(await store.removeOrg(tx, id, version))) throw preconditionFailed(before.version);
      await record(tx, who, { action: 'org_einheit.deleted', resourceType: 'org_einheit', resourceId: id, data: orgSnap(before), event: { id } });
    });
    return reply.code(204).send();
  });

  // --- Codetabellen und Codewerte (BC AM.02.02, UC-017 Schritt 2)

  app.get('/v1/codetabellen', {
    schema: { tags: [TAG], summary: 'Codetabellen auflisten', description: 'Die Codetabellen sind fest im System; je Tabelle die Anzahl Werte der Organisation.', response: { 200: Type.Ref('CodetabelleList') } },
  }, async req => {
    await req.need('stammdaten:read');
    const n = await req.tx(tx => store.zaehlen(tx));
    return {
      items: CODETABELLEN.map(t => ({ schluessel: t.schluessel, label: t.label, beschreibung: t.beschreibung, anzahl: n.get(t.schluessel)?.anzahl ?? 0, anzahlAktiv: n.get(t.schluessel)?.aktiv ?? 0 })),
      can: { write: await canWrite(req) },
    };
  });

  app.post('/v1/codetabellen/vorgabe', {
    schema: { tags: [TAG], summary: 'Vorgabewerte laden', description: 'Legt die Vorgabewerte aller Codetabellen an (PM-Handbuch); vorhandene Schlüssel, auch deaktivierte, bleiben unverändert. Mehrfach aufrufbar.', headers: IdempotencyHeaders, response: { 200: Type.Ref('VorgabeErgebnis') } },
  }, async req => {
    await req.need('stammdaten:write');
    const who = actorOf(req);
    const rows = await req.tx(async tx => {
      const neu = await store.vorgabeLaden(tx);
      for (const r of neu) await record(tx, who, { action: 'codewert.created', resourceType: 'codewert', resourceId: r.id, data: { ...wertSnap(r), vorgabe: true }, event: wertSnap(r) });
      return neu;
    });
    return { angelegt: rows.length };
  });

  app.get('/v1/codetabellen/:schluessel/werte', {
    schema: { tags: [TAG], summary: 'Werte einer Codetabelle', description: 'Sortiert nach Reihenfolge und Schlüssel, Cursor-Paginierung; Auswahllisten zeigen nur aktive Werte (`aktiv=true`).', params: TabelleParams, querystring: CodewertQuery, response: { 200: Type.Ref('CodewertList') } },
  }, async req => {
    const { schluessel } = req.params as { schluessel: string };
    await req.need('stammdaten:read');
    const q = req.query as { aktiv?: boolean; cursor?: string; limit?: number };
    const limit = q.limit ?? 50;
    const filter = `${schluessel}|${q.aktiv ?? ''}`;
    const after = decodeCursor<{ p: number; s: string; i: string; f: string }>(q.cursor, v => typeof v.p === 'number' && typeof v.s === 'string' && typeof v.i === 'string' && v.f === filter);
    const rows = await req.tx(tx => store.listWerte(tx, schluessel, { aktiv: q.aktiv, after: after && { position: after.p, schluessel: after.s, id: after.i }, limit }));
    const page = rows.slice(0, limit);
    const write = await canWrite(req);
    const last = page[page.length - 1];
    return {
      items: page.map(r => wertOut(r, write)),
      nextCursor: rows.length > limit && last ? encodeCursor({ p: last.position, s: last.schluessel, i: last.id, f: filter }) : null,
      can: { write },
    };
  });

  app.get('/v1/codetabellen/:schluessel/werte/:id', {
    schema: { tags: [TAG], summary: 'Codewert lesen', params: WertParams, response: { 200: Type.Ref('Codewert') } },
  }, async (req, reply) => {
    const { schluessel, id } = req.params as { schluessel: string; id: string };
    await req.need('stammdaten:read');
    const row = await req.tx(tx => store.getWert(tx, schluessel, id));
    if (!row) throw notFound('Codewert');
    reply.header('etag', etag(row.version));
    return wertOut(row, await canWrite(req));
  });

  app.post('/v1/codetabellen/:schluessel/werte', {
    schema: { tags: [TAG], summary: 'Codewert anlegen', description: 'Der Schlüssel ist je Codetabelle eindeutig (sonst 409) und bleibt fest.', params: TabelleParams, headers: IdempotencyHeaders, body: Type.Ref('CodewertCreate'), response: { 201: Type.Ref('Codewert') } },
  }, async (req, reply) => {
    const { schluessel } = req.params as { schluessel: string };
    await req.need('stammdaten:write');
    const who = actorOf(req);
    const row = await req.tx(async tx => {
      const r = await store.createWert(tx, schluessel, req.body as typeof CodewertCreate.static);
      await record(tx, who, { action: 'codewert.created', resourceType: 'codewert', resourceId: r.id, data: wertSnap(r), event: wertSnap(r) });
      return r;
    });
    return reply.code(201).header('location', `/v1/codetabellen/${schluessel}/werte/${row.id}`).header('etag', etag(row.version)).send(wertOut(row, true));
  });

  /** Ändern bzw. (de)aktivieren mit If-Match, Audit und Ereignis. */
  async function changeWert(req: FastifyRequest, patch: typeof CodewertPatch.static & { aktiv?: boolean }, action: 'codewert.updated' | 'codewert.deactivated' | 'codewert.activated') {
    const { schluessel, id } = req.params as { schluessel: string; id: string };
    const version = requireIfMatch(req);
    await req.need('stammdaten:write');
    const who = actorOf(req);
    return req.tx(async tx => {
      const before = await store.getWert(tx, schluessel, id);
      if (!before) throw notFound('Codewert');
      if (before.version !== version) throw preconditionFailed(before.version);
      const r = await store.updateWert(tx, schluessel, id, version, patch);
      if (!r) throw preconditionFailed(before.version);
      await record(tx, who, { action, resourceType: 'codewert', resourceId: id, data: { before: wertSnap(before), after: wertSnap(r) }, event: wertSnap(r) });
      return r;
    });
  }

  app.patch('/v1/codetabellen/:schluessel/werte/:id', {
    schema: { tags: [TAG], summary: 'Codewert ändern', description: 'Text und Reihenfolge; der Schlüssel bleibt fest. Nur mit `If-Match`.', params: WertParams, headers: IfMatchHeaders, body: Type.Ref('CodewertPatch'), response: { 200: Type.Ref('Codewert') } },
  }, async (req, reply) => {
    const row = await changeWert(req, req.body as typeof CodewertPatch.static, 'codewert.updated');
    reply.header('etag', etag(row.version));
    return wertOut(row, true);
  });

  app.post('/v1/codetabellen/:schluessel/werte/:id/deaktivieren', {
    schema: { tags: [TAG], summary: 'Codewert deaktivieren', description: 'Nicht mehr verwendete Werte werden deaktiviert statt gelöscht (UC-017 Schritt 2): Deaktivierte Werte erscheinen nicht mehr zur Auswahl, gespeicherte Angaben behalten ihren Wert. Nur mit `If-Match`.', params: WertParams, headers: IfMatchHeaders, response: { 200: Type.Ref('Codewert') } },
  }, async (req, reply) => {
    const row = await changeWert(req, { aktiv: false }, 'codewert.deactivated');
    reply.header('etag', etag(row.version));
    return wertOut(row, true);
  });

  app.post('/v1/codetabellen/:schluessel/werte/:id/aktivieren', {
    schema: { tags: [TAG], summary: 'Codewert wieder aktivieren', description: 'Nur mit `If-Match`.', params: WertParams, headers: IfMatchHeaders, response: { 200: Type.Ref('Codewert') } },
  }, async (req, reply) => {
    const row = await changeWert(req, { aktiv: true }, 'codewert.activated');
    reply.header('etag', etag(row.version));
    return wertOut(row, true);
  });

  // --- Feiertage (A-43: Arbeitstage = Montag bis Freitag ohne gepflegte Feiertage)

  app.get('/v1/feiertage', {
    schema: { tags: [TAG], summary: 'Feiertage auflisten', description: 'Nach Datum, Cursor-Paginierung, Filter Jahr.', querystring: FeiertagQuery, response: { 200: Type.Ref('FeiertagList') } },
  }, async req => {
    await req.need('stammdaten:read');
    const q = req.query as { jahr?: number; cursor?: string; limit?: number };
    const limit = q.limit ?? 50;
    const filter = String(q.jahr ?? '');
    const after = decodeCursor<{ d: string; i: string; f: string }>(q.cursor, v => typeof v.d === 'string' && typeof v.i === 'string' && v.f === filter);
    const rows = await req.tx(tx => store.listFeiertage(tx, { jahr: q.jahr, after: after && { datum: after.d, id: after.i }, limit }));
    const page = rows.slice(0, limit);
    const write = await canWrite(req);
    const last = page[page.length - 1];
    return {
      items: page.map(r => ftOut(r, write)),
      nextCursor: rows.length > limit && last ? encodeCursor({ d: last.datum, i: last.id, f: filter }) : null,
      can: { write },
    };
  });

  app.get('/v1/feiertage/:id', {
    schema: { tags: [TAG], summary: 'Feiertag lesen', params: IdParams, response: { 200: Type.Ref('Feiertag') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await req.need('stammdaten:read');
    const row = await req.tx(tx => store.getFeiertag(tx, id));
    if (!row) throw notFound('Feiertag');
    reply.header('etag', etag(row.version));
    return ftOut(row, await canWrite(req));
  });

  app.post('/v1/feiertage', {
    schema: { tags: [TAG], summary: 'Feiertag anlegen', description: 'Je Datum höchstens ein Feiertag (sonst 409).', headers: IdempotencyHeaders, body: Type.Ref('FeiertagCreate'), response: { 201: Type.Ref('Feiertag') } },
  }, async (req, reply) => {
    await req.need('stammdaten:write');
    const who = actorOf(req);
    const row = await req.tx(async tx => {
      const r = await store.createFeiertag(tx, req.body as typeof FeiertagCreate.static);
      await record(tx, who, { action: 'feiertag.created', resourceType: 'feiertag', resourceId: r.id, data: ftSnap(r), event: ftSnap(r) });
      return r;
    });
    return reply.code(201).header('location', `/v1/feiertage/${row.id}`).header('etag', etag(row.version)).send(ftOut(row, true));
  });

  app.patch('/v1/feiertage/:id', {
    schema: { tags: [TAG], summary: 'Feiertag ändern', description: 'Nur mit `If-Match`.', params: IdParams, headers: IfMatchHeaders, body: Type.Ref('FeiertagPatch'), response: { 200: Type.Ref('Feiertag') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('stammdaten:write');
    const who = actorOf(req);
    const row = await req.tx(async tx => {
      const before = await store.getFeiertag(tx, id);
      if (!before) throw notFound('Feiertag');
      if (before.version !== version) throw preconditionFailed(before.version);
      const r = await store.updateFeiertag(tx, id, version, req.body as typeof FeiertagPatch.static);
      if (!r) throw preconditionFailed(before.version);
      await record(tx, who, { action: 'feiertag.updated', resourceType: 'feiertag', resourceId: id, data: { before: ftSnap(before), after: ftSnap(r) }, event: ftSnap(r) });
      return r;
    });
    reply.header('etag', etag(row.version));
    return ftOut(row, true);
  });

  app.delete('/v1/feiertage/:id', {
    schema: { tags: [TAG], summary: 'Feiertag löschen', description: 'Nur mit `If-Match`.', params: IdParams, headers: IfMatchHeaders, response: { 204: Type.Null({ description: 'Gelöscht' }) } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('stammdaten:write');
    const who = actorOf(req);
    await req.tx(async tx => {
      const before = await store.getFeiertag(tx, id);
      if (!before) throw notFound('Feiertag');
      if (before.version !== version || !(await store.removeFeiertag(tx, id, version))) throw preconditionFailed(before.version);
      await record(tx, who, { action: 'feiertag.deleted', resourceType: 'feiertag', resourceId: id, data: ftSnap(before), event: { id } });
    });
    return reply.code(204).send();
  });
}
