/**
 * Routen des Phasenmodells (BC AM.02.03, UC-017 Schritte 3 und 5): Versionen auflisten, Entwurf aus der Version in
 * Kraft oder der Vorgabe anlegen, Entwurf ändern (ETag/If-Match), verwerfen und in Kraft setzen. Muster der
 * Handlungsfelder: Rechte über `req.need`, Lesesicht über `req.tx`, Fähigkeiten `can`, Audit und Ereignis mit `record`.
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  actorOf, conflict, decodeCursor, encodeCursor, etag, IdempotencyHeaders, IdParams, IfMatchHeaders, invalid, notFound,
  preconditionFailed, requireIfMatch, type Deps, type Tx,
} from '@vollholz/platform';
import { record } from '../../platform.ts';
import { einheitPasst, pruefe } from './pruefung.ts';
import {
  GATES, ListQuery, Phasenmodell, PhasenmodellCreate, PhasenmodellKurz, PhasenmodellList, PhasenmodellPatch,
  type PhasenmodellCreateIn, type PhasenmodellKurzOut, type PhasenmodellOut, type PhasenmodellPatchIn,
} from './schemas.ts';
import * as store from './store.ts';
import { VORGABE } from './vorgabe.ts';

const TAG = 'Phasenmodell';
const NAME = 'Phasenmodell';

interface Rechte { write: boolean; activate: boolean }
const rechte = async (req: FastifyRequest): Promise<Rechte> => ({ write: await req.can('phasenmodell:write'), activate: await req.can('phasenmodell:activate') });

function kurz(r: store.Row): PhasenmodellKurzOut {
  return {
    id: r.id, nummer: r.nummer, stand: r.stand, beschreibung: r.beschreibung, inKraftAb: r.in_kraft_ab, inKraftVon: r.in_kraft_by, version: r.version,
    createdAt: r.created_at, createdBy: r.created_by, updatedAt: r.updated_at, updatedBy: r.updated_by,
  };
}

/** Ganze Version mit Prüfbericht; Bearbeiten und In-Kraft-Setzen nur im Entwurf. */
async function lade(tx: Tx, r: store.Row, rr: Rechte): Promise<PhasenmodellOut> {
  const d = await store.dokument(tx, r.id);
  const entwurf = r.stand === 'entwurf';
  return {
    ...kurz(r),
    phasen: d.phasen.map((p, position) => ({ ...p, position })),
    gates: d.gates.map((g, position) => {
      const s = GATES.find(x => x.code === g.code)!;
      return { code: g.code, name: g.name, vonPhase: s.von, nachPhase: s.nach, position, leitfragen: g.leitfragen, pflichtangaben: g.pflichtangaben };
    }),
    kapitelWirkung: d.kapitelWirkung, fristen: d.fristen, toleranzen: d.toleranzen,
    pruefung: pruefe(d),
    can: { write: rr.write && entwurf, activate: rr.activate && entwurf },
  };
}

/** Daten für Audit und Ereignis. */
const snapshot = (r: store.Row) => ({ id: r.id, nummer: r.nummer, stand: r.stand, version: r.version });

/** Inhaltliche Prüfung der Änderung, die das Schema nicht ausdrücken kann (422 mit Pfad je Fehler). */
function pruefeAenderung(p: PhasenmodellPatchIn): void {
  const fehler: { path: string; message: string }[] = [];
  const doppelt = (liste: { code: string }[] | undefined, pfad: string) => liste?.forEach((x, i) => {
    if (liste.findIndex(y => y.code === x.code) !== i) fehler.push({ path: `/${pfad}/${i}/code`, message: `${x.code} ist mehrfach genannt.` });
  });
  doppelt(p.phasen, 'phasen');
  doppelt(p.gates, 'gates');
  p.fristen?.forEach((f, i) => {
    if (p.fristen!.findIndex(y => y.schluessel === f.schluessel) !== i) fehler.push({ path: `/fristen/${i}/schluessel`, message: `${f.schluessel} ist mehrfach genannt.` });
    if (!einheitPasst(f)) {
      fehler.push({
        path: `/fristen/${i}/einheit`,
        message: f.einheit === 'tag_im_monat' ? 'Nur die Fristen des Monatszyklus sind Tage im Monat.' : 'Die Fristen des Monatszyklus sind Tage im Monat (1–31).',
      });
    }
  });
  p.toleranzen?.forEach((t, i) => {
    if (p.toleranzen!.findIndex(y => y.dimension === t.dimension) !== i) fehler.push({ path: `/toleranzen/${i}/dimension`, message: `${t.dimension} ist mehrfach genannt.` });
  });
  if (fehler.length) throw invalid('Die Änderung am Phasenmodell ist nicht gültig.', fehler);
}

export function registerRoutes(app: FastifyInstance, _deps: Deps): void {
  for (const s of [Phasenmodell, PhasenmodellKurz, PhasenmodellList, PhasenmodellCreate, PhasenmodellPatch]) app.addSchema(s);

  app.get('/v1/phasenmodelle', {
    schema: { tags: [TAG], summary: 'Versionen des Phasenmodells auflisten', description: 'Neueste zuerst, Cursor-Paginierung.', querystring: ListQuery, response: { 200: Type.Ref('PhasenmodellList') } },
  }, async req => {
    await req.need('phasenmodell:read');
    const q = req.query as { cursor?: string; limit?: number };
    const limit = q.limit ?? 50;
    const after = decodeCursor<{ n: number }>(q.cursor, v => typeof v.n === 'number');
    const rows = await req.tx(tx => store.list(tx, { after: after?.n ?? null, limit }));
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      items: page.map(kurz),
      nextCursor: rows.length > limit && last ? encodeCursor({ n: last.nummer }) : null,
      can: { create: await req.can('phasenmodell:write') },
    };
  });

  app.get('/v1/phasenmodelle/aktuell', {
    schema: { tags: [TAG], summary: 'Phasenmodell in Kraft lesen', description: 'Die Version, die für neue Projekte und das nächste Gate laufender Projekte gilt (A-13).', response: { 200: Type.Ref('Phasenmodell') } },
  }, async (req, reply) => {
    await req.need('phasenmodell:read');
    const rr = await rechte(req);
    const out = await req.tx(async tx => {
      const r = await store.byStand(tx, 'in_kraft');
      return r ? lade(tx, r, rr) : null;
    });
    if (!out) throw notFound(NAME);
    reply.header('etag', etag(out.version));
    return out;
  });

  app.get('/v1/phasenmodelle/:id', {
    schema: { tags: [TAG], summary: 'Version des Phasenmodells lesen', description: 'Mit Phasen, Gates, Leitfragen, Ergebnissen, Pflichtangaben, Kapitelwirkung, Fristen, Toleranzen und Prüfbericht.', params: IdParams, response: { 200: Type.Ref('Phasenmodell') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await req.need('phasenmodell:read');
    const rr = await rechte(req);
    const out = await req.tx(async tx => {
      const r = await store.get(tx, id);
      return r ? lade(tx, r, rr) : null;
    });
    if (!out) throw notFound(NAME);
    reply.header('etag', etag(out.version));
    return out;
  });

  app.post('/v1/phasenmodelle', {
    schema: {
      tags: [TAG], summary: 'Entwurf anlegen',
      description: 'Kopie der Version in Kraft oder Vorgabe des PM-Handbuchs (ohne Version in Kraft immer die Vorgabe). Höchstens ein Entwurf; besteht einer, 409 mit seiner ID.',
      headers: IdempotencyHeaders, body: Type.Ref('PhasenmodellCreate'), response: { 201: Type.Ref('Phasenmodell') },
    },
  }, async (req, reply) => {
    await req.need('phasenmodell:write');
    const body = req.body as PhasenmodellCreateIn;
    const who = actorOf(req);
    const rr = await rechte(req);
    const out = await req.tx(async tx => {
      const aktuell = await store.byStand(tx, 'in_kraft');
      if (body.quelle === 'aktuell' && !aktuell) throw invalid('Es ist noch keine Version in Kraft. Legen Sie den Entwurf aus der Vorgabe des PM-Handbuchs an.', [{ path: '/quelle', message: 'keine Version in Kraft' }]);
      const quelle = body.quelle ?? (aktuell ? 'aktuell' : 'vorgabe');
      const r = await store.createEntwurf(tx, (body.beschreibung ?? '').trim());
      if (!r) {
        const e = await store.byStand(tx, 'entwurf');
        throw conflict(`Es besteht bereits ein Entwurf (Version ${e?.nummer ?? '?'}). Bearbeiten Sie diesen oder verwerfen Sie ihn zuerst.`, { entwurf: e?.id ?? null });
      }
      await store.schreibeDokument(tx, r.id, quelle === 'aktuell' ? await store.dokument(tx, aktuell!.id) : VORGABE);
      await record(tx, who, { action: 'phasenmodell.created', resourceType: 'phasenmodell', resourceId: r.id, data: { ...snapshot(r), quelle, basis: quelle === 'aktuell' ? aktuell!.nummer : null }, event: snapshot(r) });
      return lade(tx, r, rr);
    });
    return reply.code(201).header('location', `/v1/phasenmodelle/${out.id}`).header('etag', etag(out.version)).send(out);
  });

  app.patch('/v1/phasenmodelle/:id', {
    schema: {
      tags: [TAG], summary: 'Entwurf ändern',
      description: 'Nur mit `If-Match`. Jede angegebene Liste ersetzt die bisherige (je Phase bzw. Gate nur die genannten Teile). Versionen in Kraft oder abgelöst sind unveränderlich (409).',
      params: IdParams, headers: IfMatchHeaders, body: Type.Ref('PhasenmodellPatch'), response: { 200: Type.Ref('Phasenmodell') },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('phasenmodell:write');
    const body = req.body as PhasenmodellPatchIn;
    pruefeAenderung(body);
    const who = actorOf(req);
    const rr = await rechte(req);
    const out = await req.tx(async tx => {
      const before = await store.get(tx, id);
      if (!before) throw notFound(NAME);
      if (before.version !== version) throw preconditionFailed(before.version);
      if (before.stand !== 'entwurf') throw conflict(`Version ${before.nummer} ist ${before.stand === 'in_kraft' ? 'in Kraft' : 'abgelöst'} und unveränderlich. Legen Sie einen Entwurf an.`);
      for (const p of body.phasen ?? []) await store.ersetzePhase(tx, id, p);
      for (const g of body.gates ?? []) await store.ersetzeGate(tx, id, g);
      if (body.kapitelWirkung) await store.ersetzeWirkung(tx, id, body.kapitelWirkung);
      if (body.fristen) await store.setzeFristen(tx, id, body.fristen);
      if (body.toleranzen) await store.setzeToleranzen(tx, id, body.toleranzen);
      const r = await store.touch(tx, id, version, body.beschreibung);
      if (!r) throw preconditionFailed(before.version);
      await record(tx, who, { action: 'phasenmodell.updated', resourceType: 'phasenmodell', resourceId: id, data: { ...snapshot(r), aenderung: body }, event: snapshot(r) });
      return lade(tx, r, rr);
    });
    reply.header('etag', etag(out.version));
    return out;
  });

  app.delete('/v1/phasenmodelle/:id', {
    schema: { tags: [TAG], summary: 'Entwurf verwerfen', description: 'Nur mit `If-Match` und nur als Entwurf; Versionen in Kraft oder abgelöst bleiben (409).', params: IdParams, headers: IfMatchHeaders, response: { 204: Type.Null({ description: 'Verworfen' }) } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('phasenmodell:write');
    const who = actorOf(req);
    await req.tx(async tx => {
      const before = await store.get(tx, id);
      if (!before) throw notFound(NAME);
      if (before.version !== version) throw preconditionFailed(before.version);
      if (before.stand !== 'entwurf') throw conflict(`Version ${before.nummer} ist kein Entwurf und bleibt erhalten.`);
      if (!(await store.remove(tx, id, version))) throw preconditionFailed(before.version);
      await record(tx, who, { action: 'phasenmodell.deleted', resourceType: 'phasenmodell', resourceId: id, data: snapshot(before), event: { id } });
    });
    return reply.code(204).send();
  });

  app.post('/v1/phasenmodelle/:id/in-kraft-setzen', {
    schema: {
      tags: [TAG], summary: 'Entwurf in Kraft setzen',
      description: 'UC-017 Schritt 5: Der Entwurf gilt ab sofort für neue Projekte und für laufende ab ihrem nächsten Gate (A-13); die bisherige Version ist abgelöst. Nur mit `If-Match`.',
      params: IdParams, headers: IfMatchHeaders, response: { 200: Type.Ref('Phasenmodell') },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('phasenmodell:activate');
    const who = actorOf(req);
    const rr = await rechte(req);
    const out = await req.tx(async tx => {
      const before = await store.get(tx, id);
      if (!before) throw notFound(NAME);
      if (before.version !== version) throw preconditionFailed(before.version);
      if (before.stand !== 'entwurf') throw conflict(`Version ${before.nummer} ist ${before.stand === 'in_kraft' ? 'bereits in Kraft' : 'abgelöst'}.`);
      const res = await store.inKraft(tx, id, version);
      if (!res) throw preconditionFailed(before.version);
      await record(tx, who, {
        action: 'phasenmodell.activated', resourceType: 'phasenmodell', resourceId: id,
        data: { ...snapshot(res.row), abgeloest: res.abgeloest }, event: { ...snapshot(res.row), abgeloest: res.abgeloest },
      });
      return lade(tx, res.row, rr);
    });
    reply.header('etag', etag(out.version));
    return out;
  });
}
