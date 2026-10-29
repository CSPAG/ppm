/**
 * Routen von Portfolios, Gremien, Gremienweg und Sitzungsterminen (BC AM.02.04; UC-017 Schritt 4, A1) nach dem Muster der
 * Handlungsfelder: Rechte über `req.need`, Lesesicht über `req.tx`, Fähigkeiten `can`, Cursor, ETag/If-Match (412),
 * Audit und Ereignis in derselben Transaktion. Lesen mit `portfolio:read`, Pflegen mit `portfolio:admin` (UE, ADM).
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  actorOf, conflict, decodeCursor, encodeCursor, etag, IdempotencyHeaders, IdParams, IfMatchHeaders, invalid, notFound,
  preconditionFailed, requireIfMatch, type Deps, type Tx,
} from '@vollholz/platform';
import { record } from '../../platform.ts';
import { schritte } from './gremienweg.ts';
import {
  Gremienschritt, Gremienweg, GremienwegPut, GremienQuery, Gremium, GremiumCreate, GremiumList, GremiumPatch, ListQuery, Portfolio,
  PortfolioCreate, PortfolioList, PortfolioPatch, Sitzungstermin, SitzungsterminCreate, SitzungsterminList, TermineQuery, TerminParams,
  type GremienwegPutIn, type GremiumCreateIn, type GremiumOut, type GremiumPatchIn, type PortfolioCreateIn, type PortfolioOut, type PortfolioPatchIn,
} from './schemas.ts';
import * as store from './store.ts';

const TAG = 'Portfolios';

/** Fähigkeiten: Portfolios und Gremien pflegt, wer `portfolio:admin` an der Organisation hat. */
type Can = { admin: boolean };
const capabilities = async (req: FastifyRequest): Promise<Can> => ({ admin: await req.can('portfolio:admin') });

function portfolioOut(r: store.PortfolioRow, can: Can): PortfolioOut {
  return {
    id: r.id, kategorie: r.kategorie, schluessel: r.schluessel, name: r.name, pflichten: r.pflichten, orgEinheitId: r.org_einheit_id,
    version: r.version, createdAt: r.created_at, createdBy: r.created_by, updatedAt: r.updated_at, updatedBy: r.updated_by, can,
  };
}
const portfolioSnapshot = (r: store.PortfolioRow) => ({ id: r.id, kategorie: r.kategorie, schluessel: r.schluessel, name: r.name, pflichten: r.pflichten, orgEinheitId: r.org_einheit_id, version: r.version });

function gremiumOut(r: store.GremiumRow, can: Can): GremiumOut {
  return {
    id: r.id, portfolioId: r.portfolio_id, kuerzel: r.kuerzel, name: r.name, art: r.art, rhythmus: r.rhythmus,
    version: r.version, createdAt: r.created_at, createdBy: r.created_by, updatedAt: r.updated_at, updatedBy: r.updated_by, can,
  };
}
const gremiumSnapshot = (r: store.GremiumRow) => ({ id: r.id, portfolioId: r.portfolio_id, kuerzel: r.kuerzel, name: r.name, art: r.art, rhythmus: r.rhythmus, version: r.version });

const terminOut = (t: store.TerminRow) => ({ id: t.id, gremiumId: t.gremium_id, datum: t.datum, createdAt: t.created_at, createdBy: t.created_by });

/** Datum im Kalender (das Schema prüft nur die Form). */
function pruefeDatum(d: string, path: string): void {
  const t = new Date(`${d}T00:00:00Z`);
  if (Number.isNaN(t.getTime()) || t.toISOString().slice(0, 10) !== d) throw invalid('Das Datum gibt es nicht.', [{ path, message: 'kein gültiges Datum' }]);
}

/** Direktion nur bei Kategorie C (A-23, A-08). */
function pruefeDirektion(kategorie: store.Kategorie, orgEinheitId: string | null | undefined): void {
  if (kategorie !== 'C' && orgEinheitId) throw invalid('Eine Direktion hat nur ein Portfolio der Kategorie C.', [{ path: '/orgEinheitId', message: 'nur bei Kategorie C' }]);
}

/**
 * Gremienweg prüfen (fachmodell.md 2.4): jedes Gate höchstens einmal; entscheidet das entscheidende Gremium des
 * Portfolios (A-45); zusätzlich nur ein externes Gremium desselben Portfolios (SNS-VR, A-02).
 */
function pruefeGremienweg(body: GremienwegPutIn, gremien: readonly store.GremiumRow[]): void {
  const byId = new Map(gremien.map(g => [g.id, g]));
  const errors: { path: string; message: string }[] = [];
  const gesehen = new Set<string>();
  body.schritte.forEach((s, i) => {
    if (gesehen.has(s.gate)) errors.push({ path: `/schritte/${i}/gate`, message: 'Gate doppelt' });
    gesehen.add(s.gate);
    const g = byId.get(s.gremiumId);
    if (!g) errors.push({ path: `/schritte/${i}/gremiumId`, message: 'kein Gremium dieses Portfolios' });
    else if (g.art !== 'entscheidend') errors.push({ path: `/schritte/${i}/gremiumId`, message: 'am Gate entscheidet das entscheidende Gremium' });
    if (s.zusaetzlichGremiumId) {
      const z = byId.get(s.zusaetzlichGremiumId);
      if (!z) errors.push({ path: `/schritte/${i}/zusaetzlichGremiumId`, message: 'kein Gremium dieses Portfolios' });
      else if (z.art !== 'extern') errors.push({ path: `/schritte/${i}/zusaetzlichGremiumId`, message: 'zusätzlich nur ein externes Gremium' });
    }
  });
  if (errors.length) throw invalid('Der Gremienweg ist nicht vollständig gültig.', errors);
}

export function registerRoutes(app: FastifyInstance, _deps: Deps): void {
  for (const s of [Portfolio, PortfolioList, PortfolioCreate, PortfolioPatch, Gremium, GremiumList, GremiumCreate, GremiumPatch,
    Gremienschritt, Gremienweg, GremienwegPut, Sitzungstermin, SitzungsterminList, SitzungsterminCreate]) app.addSchema(s);

  // --- Portfolios ---------------------------------------------------------------------------------------------------

  app.get('/v1/portfolios', {
    schema: { tags: [TAG], summary: 'Portfolios auflisten', description: 'Sortiert nach Kategorie und Name, Cursor-Paginierung.', querystring: ListQuery, response: { 200: Type.Ref('PortfolioList') } },
  }, async req => {
    await req.need('portfolio:read');
    const q = req.query as { cursor?: string; limit?: number };
    const limit = q.limit ?? 50;
    const after = decodeCursor<{ k: string; n: string; i: string }>(q.cursor, v => typeof v.k === 'string' && typeof v.n === 'string' && typeof v.i === 'string');
    const rows = await req.tx(tx => store.listPortfolios(tx, { after: after && { kategorie: after.k, name: after.n, id: after.i }, limit }));
    const page = rows.slice(0, limit);
    const can = await capabilities(req);
    const last = page[page.length - 1];
    return { items: page.map(r => portfolioOut(r, can)), nextCursor: rows.length > limit && last ? encodeCursor({ k: last.kategorie, n: last.name, i: last.id }) : null };
  });

  app.get('/v1/portfolios/:id', {
    schema: { tags: [TAG], summary: 'Portfolio lesen', params: IdParams, response: { 200: Type.Ref('Portfolio') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await req.need('portfolio:read');
    const row = await req.tx(tx => store.getPortfolio(tx, id));
    if (!row) throw notFound('Portfolio');
    reply.header('etag', etag(row.version));
    return portfolioOut(row, await capabilities(req));
  });

  app.post('/v1/portfolios', {
    schema: {
      tags: [TAG], summary: 'Portfolio anlegen',
      description: 'Pflichten folgen der Kategorie: A und B mit Pflichten (A-07), C ohne Pflicht-Gates und Pflicht-Reporting (A-08). Kategorie und Schlüssel sind danach fest.',
      headers: IdempotencyHeaders, body: Type.Ref('PortfolioCreate'), response: { 201: Type.Ref('Portfolio') },
    },
  }, async (req, reply) => {
    await req.need('portfolio:admin');
    const body = req.body as PortfolioCreateIn;
    pruefeDirektion(body.kategorie, body.orgEinheitId);
    const who = actorOf(req);
    const row = await req.tx(async tx => {
      const r = await store.createPortfolio(tx, body);
      await record(tx, who, { action: 'portfolio.created', resourceType: 'portfolio', resourceId: r.id, data: portfolioSnapshot(r), event: portfolioSnapshot(r) });
      return r;
    });
    return reply.code(201).header('location', `/v1/portfolios/${row.id}`).header('etag', etag(row.version)).send(portfolioOut(row, await capabilities(req)));
  });

  app.patch('/v1/portfolios/:id', {
    schema: { tags: [TAG], summary: 'Portfolio ändern', description: 'Name und Direktion (nur Kategorie C); nur mit `If-Match`.', params: IdParams, headers: IfMatchHeaders, body: Type.Ref('PortfolioPatch'), response: { 200: Type.Ref('Portfolio') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('portfolio:admin');
    const body = req.body as PortfolioPatchIn;
    const who = actorOf(req);
    const row = await req.tx(async tx => {
      const before = await store.getPortfolio(tx, id);
      if (!before) throw notFound('Portfolio');
      if (before.version !== version) throw preconditionFailed(before.version);
      pruefeDirektion(before.kategorie, body.orgEinheitId);
      const r = await store.updatePortfolio(tx, id, version, body);
      if (!r) throw preconditionFailed(before.version);
      await record(tx, who, { action: 'portfolio.updated', resourceType: 'portfolio', resourceId: id, data: { before: portfolioSnapshot(before), after: portfolioSnapshot(r) }, event: portfolioSnapshot(r) });
      return r;
    });
    reply.header('etag', etag(row.version));
    return portfolioOut(row, await capabilities(req));
  });

  app.delete('/v1/portfolios/:id', {
    schema: { tags: [TAG], summary: 'Portfolio löschen', description: 'Nur mit `If-Match` und nur ohne Gremien und Projekte (sonst 409).', params: IdParams, headers: IfMatchHeaders, response: { 204: Type.Null({ description: 'Gelöscht' }) } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('portfolio:admin');
    const who = actorOf(req);
    await req.tx(async tx => {
      const before = await store.getPortfolio(tx, id);
      if (!before) throw notFound('Portfolio');
      if (before.version !== version) throw preconditionFailed(before.version);
      if (await store.hatGremien(tx, id)) throw conflict('Das Portfolio hat noch Gremien. Entferne zuerst die Gremien.');
      if (!(await store.removePortfolio(tx, id, version))) throw preconditionFailed(before.version);
      await record(tx, who, { action: 'portfolio.deleted', resourceType: 'portfolio', resourceId: id, data: portfolioSnapshot(before), event: { id } });
    });
    return reply.code(204).send();
  });

  // --- Gremienweg ---------------------------------------------------------------------------------------------------

  const gremienwegOut = async (req: FastifyRequest, p: store.PortfolioRow, tx: Tx) => {
    // nacheinander: eine Transaktion, eine Verbindung
    const weg = await store.gremienweg(tx, p.id);
    const gremien = await store.listGremien(tx, { portfolioId: p.id });
    return { portfolioId: p.id, version: p.version, schritte: schritte(weg, gremien), can: await capabilities(req) };
  };

  app.get('/v1/portfolios/:id/gremienweg', {
    schema: {
      tags: [TAG], summary: 'Gremienweg eines Portfolios',
      description: 'Zuständiges Gremium je Gate und ob das Geschäft zusätzlich über den SNS-VR läuft (`viaSns`, Q8 Kap. 5.1, UC-006 A1). ETag = Version des Portfolios.',
      params: IdParams, response: { 200: Type.Ref('Gremienweg') },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await req.need('portfolio:read');
    const out = await req.tx(async tx => {
      const p = await store.getPortfolio(tx, id);
      if (!p) throw notFound('Portfolio');
      return gremienwegOut(req, p, tx);
    });
    reply.header('etag', etag(out.version));
    return out;
  });

  app.put('/v1/portfolios/:id/gremienweg', {
    schema: {
      tags: [TAG], summary: 'Gremienweg festlegen',
      description: 'Ersetzt den Gremienweg vollständig: je Gate das entscheidende Gremium des Portfolios (A-45) und optional ein externes Gremium zusätzlich (SNS-VR, A-02). Nur mit `If-Match` (Version des Portfolios); erhöht die Version des Portfolios.',
      params: IdParams, headers: IfMatchHeaders, body: Type.Ref('GremienwegPut'), response: { 200: Type.Ref('Gremienweg') },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('portfolio:admin');
    const body = req.body as GremienwegPutIn;
    const who = actorOf(req);
    const out = await req.tx(async tx => {
      const before = await store.getPortfolio(tx, id);
      if (!before) throw notFound('Portfolio');
      if (before.version !== version) throw preconditionFailed(before.version);
      pruefeGremienweg(body, await store.listGremien(tx, { portfolioId: id }));
      const vorher = await store.gremienweg(tx, id);
      const p = await store.touchPortfolio(tx, id, version);
      if (!p) throw preconditionFailed(before.version);
      await store.replaceGremienweg(tx, id, body.schritte.map(s => ({ gateCode: s.gate, gremiumId: s.gremiumId, zusaetzlichGremiumId: s.zusaetzlichGremiumId ?? null })));
      const o = await gremienwegOut(req, p, tx);
      const nachher = o.schritte.map(s => ({ gate: s.gate, gremiumId: s.gremium.id, zusaetzlichGremiumId: s.zusaetzlich?.id ?? null }));
      await record(tx, who, {
        action: 'gremienweg.updated', resourceType: 'portfolio', resourceId: id,
        data: { before: vorher.map(w => ({ gate: w.gate_code, gremiumId: w.gremium_id, zusaetzlichGremiumId: w.zusaetzlich_gremium_id })), after: nachher },
        event: { portfolioId: id, version: p.version, schritte: nachher },
      });
      return o;
    });
    reply.header('etag', etag(out.version));
    return out;
  });

  // --- Gremien ------------------------------------------------------------------------------------------------------

  app.get('/v1/gremien', {
    schema: { tags: [TAG], summary: 'Gremien auflisten', description: 'Sortiert nach Name, Filter `portfolio`, Cursor-Paginierung.', querystring: GremienQuery, response: { 200: Type.Ref('GremiumList') } },
  }, async req => {
    await req.need('portfolio:read');
    const q = req.query as { portfolio?: string; cursor?: string; limit?: number };
    const limit = q.limit ?? 50;
    const after = decodeCursor<{ n: string; i: string; p: string }>(q.cursor, v => typeof v.n === 'string' && typeof v.i === 'string' && v.p === (q.portfolio ?? ''));
    const rows = await req.tx(tx => store.listGremien(tx, { portfolioId: q.portfolio, after: after && { name: after.n, id: after.i }, limit }));
    const page = rows.slice(0, limit);
    const can = await capabilities(req);
    const last = page[page.length - 1];
    return { items: page.map(r => gremiumOut(r, can)), nextCursor: rows.length > limit && last ? encodeCursor({ n: last.name, i: last.id, p: q.portfolio ?? '' }) : null };
  });

  app.get('/v1/gremien/:id', {
    schema: { tags: [TAG], summary: 'Gremium lesen', params: IdParams, response: { 200: Type.Ref('Gremium') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await req.need('portfolio:read');
    const row = await req.tx(tx => store.getGremium(tx, id));
    if (!row) throw notFound('Gremium');
    reply.header('etag', etag(row.version));
    return gremiumOut(row, await capabilities(req));
  });

  app.post('/v1/gremien', {
    schema: {
      tags: [TAG], summary: 'Gremium anlegen',
      description: 'Je Portfolio genau ein entscheidendes Gremium (A-45, sonst 409); unbekanntes Portfolio 404; externe Gremien ohne Benutzer (SNS-VR, A-02). Portfolio und Kürzel sind danach fest.',
      headers: IdempotencyHeaders, body: Type.Ref('GremiumCreate'), response: { 201: Type.Ref('Gremium') },
    },
  }, async (req, reply) => {
    await req.need('portfolio:admin');
    const body = req.body as GremiumCreateIn;
    const who = actorOf(req);
    const row = await req.tx(async tx => {
      if (!(await store.getPortfolio(tx, body.portfolioId))) throw notFound('Portfolio');
      const r = await store.createGremium(tx, body);
      await record(tx, who, { action: 'gremium.created', resourceType: 'gremium', resourceId: r.id, data: gremiumSnapshot(r), event: gremiumSnapshot(r) });
      return r;
    });
    return reply.code(201).header('location', `/v1/gremien/${row.id}`).header('etag', etag(row.version)).send(gremiumOut(row, await capabilities(req)));
  });

  app.patch('/v1/gremien/:id', {
    schema: { tags: [TAG], summary: 'Gremium ändern', description: 'Name, Art und Rhythmus; nur mit `If-Match`. Ein Gremium im Gremienweg behält seine Art (sonst 409).', params: IdParams, headers: IfMatchHeaders, body: Type.Ref('GremiumPatch'), response: { 200: Type.Ref('Gremium') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('portfolio:admin');
    const body = req.body as GremiumPatchIn;
    const who = actorOf(req);
    const row = await req.tx(async tx => {
      const before = await store.getGremium(tx, id);
      if (!before) throw notFound('Gremium');
      if (before.version !== version) throw preconditionFailed(before.version);
      if (body.art && body.art !== before.art) {
        const weg = await store.gremienweg(tx, before.portfolio_id);
        if (weg.some(w => w.gremium_id === id || w.zusaetzlich_gremium_id === id)) throw conflict('Das Gremium steht im Gremienweg. Passe zuerst den Gremienweg an.');
      }
      const r = await store.updateGremium(tx, id, version, body);
      if (!r) throw preconditionFailed(before.version);
      await record(tx, who, { action: 'gremium.updated', resourceType: 'gremium', resourceId: id, data: { before: gremiumSnapshot(before), after: gremiumSnapshot(r) }, event: gremiumSnapshot(r) });
      return r;
    });
    reply.header('etag', etag(row.version));
    return gremiumOut(row, await capabilities(req));
  });

  app.delete('/v1/gremien/:id', {
    schema: { tags: [TAG], summary: 'Gremium löschen', description: 'Nur mit `If-Match` und nur, wenn es nicht im Gremienweg steht (sonst 409); geplante Termine entfallen.', params: IdParams, headers: IfMatchHeaders, response: { 204: Type.Null({ description: 'Gelöscht' }) } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('portfolio:admin');
    const who = actorOf(req);
    await req.tx(async tx => {
      const before = await store.getGremium(tx, id);
      if (!before) throw notFound('Gremium');
      if (before.version !== version) throw preconditionFailed(before.version);
      const weg = await store.gremienweg(tx, before.portfolio_id);
      if (weg.some(w => w.gremium_id === id || w.zusaetzlich_gremium_id === id)) throw conflict('Das Gremium steht im Gremienweg. Passe zuerst den Gremienweg an.');
      if (!(await store.removeGremium(tx, id, version))) throw preconditionFailed(before.version);
      await record(tx, who, { action: 'gremium.deleted', resourceType: 'gremium', resourceId: id, data: gremiumSnapshot(before), event: { id } });
    });
    return reply.code(204).send();
  });

  // --- Sitzungstermine ----------------------------------------------------------------------------------------------

  app.get('/v1/gremien/:id/termine', {
    schema: { tags: [TAG], summary: 'Sitzungstermine eines Gremiums', description: 'Geplante Termine aufsteigend, optional im Zeitraum `von`–`bis`.', params: IdParams, querystring: TermineQuery, response: { 200: Type.Ref('SitzungsterminList') } },
  }, async req => {
    const { id } = req.params as { id: string };
    const q = req.query as { von?: string; bis?: string };
    if (q.von) pruefeDatum(q.von, '/von');
    if (q.bis) pruefeDatum(q.bis, '/bis');
    await req.need('portfolio:read');
    const items = await req.tx(async tx => {
      if (!(await store.getGremium(tx, id))) throw notFound('Gremium');
      return store.termine(tx, id, q);
    });
    return { items: items.map(terminOut), can: await capabilities(req) };
  });

  app.post('/v1/gremien/:id/termine', {
    schema: { tags: [TAG], summary: 'Sitzungstermin planen', description: 'Ein Termin je Gremium und Tag (sonst 409).', params: IdParams, headers: IdempotencyHeaders, body: Type.Ref('SitzungsterminCreate'), response: { 201: Type.Ref('Sitzungstermin') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { datum } = req.body as { datum: string };
    pruefeDatum(datum, '/datum');
    await req.need('portfolio:admin');
    const who = actorOf(req);
    const t = await req.tx(async tx => {
      const g = await store.getGremium(tx, id);
      if (!g) throw notFound('Gremium');
      const r = await store.createTermin(tx, g, datum);
      const data = { gremiumId: id, portfolioId: g.portfolio_id, datum: r.datum };
      await record(tx, who, { action: 'sitzungstermin.created', resourceType: 'gremium', resourceId: id, data, event: data });
      return r;
    });
    return reply.code(201).header('location', `/v1/gremien/${id}/termine/${t.datum}`).send(terminOut(t));
  });

  app.delete('/v1/gremien/:id/termine/:datum', {
    schema: { tags: [TAG], summary: 'Sitzungstermin entfernen', params: TerminParams, response: { 204: Type.Null({ description: 'Entfernt' }) } },
  }, async (req, reply) => {
    const { id, datum } = req.params as { id: string; datum: string };
    pruefeDatum(datum, '/datum');
    await req.need('portfolio:admin');
    const who = actorOf(req);
    await req.tx(async tx => {
      const g = await store.getGremium(tx, id);
      if (!g) throw notFound('Gremium');
      if (!(await store.removeTermin(tx, id, datum))) throw notFound('Sitzungstermin');
      const data = { gremiumId: id, portfolioId: g.portfolio_id, datum };
      await record(tx, who, { action: 'sitzungstermin.deleted', resourceType: 'gremium', resourceId: id, data, event: data });
    });
    return reply.code(204).send();
  });
}
