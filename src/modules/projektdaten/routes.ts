/**
 * Routen der Register je Projekt nach dem Muster der Handlungsfelder (fachmodell.md 5): Rechte über `req.need` am
 * Projekt (bzw. Portfolio), Lesesicht über `req.tx`, Fähigkeiten `can`, Cursor, ETag/If-Match (412), Idempotenz
 * (Querschnitt), Audit und Ereignis in derselben Transaktion. Lesen mit `projekt:read`, pflegen mit `projekt:write`
 * (KPI-Werte mit `kpi:write`, PC.03.03); Beträge zusätzlich nur mit `finanzen:read` (UX-OF-12, A-33).
 * Endzustände des Projekts sind lesend (UC-015 Schritt 6).
 */
import { Type, type TObject } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  actorOf, conflict, decodeCursor, encodeCursor, etag, IdempotencyHeaders, IdParams, IfMatchHeaders, invalid, notFound, preconditionFailed,
  requireIfMatch, type Deps, type Tx,
} from '@vollholz/platform';
import type { Permission } from '../../authz/model.ts';
import { record } from '../../platform.ts';
import {
  Abhaengigkeit, EintragParams, Kosten, Kpi, KpiParams, KpiWert, KpiWertList, KpiWertParams, KpiWertPut, ListQuery, Meilenstein, MeilensteinQuery,
  Meldung, MeldungCreate, MeldungList, Ressourcenbedarf, Risiko, SeiteQuery, Stakeholder, type KpiWertPutIn, type MeldungCreateIn,
} from './schemas.ts';
import * as store from './store.ts';
import { projekt as projektAktion } from '../projekt/index.ts';

export const TAG = 'Projektdaten';

const projektOrt = (id: string) => ({ type: 'projekt', id });

// ---------------------------------------------------------------- gemeinsame Bausteine

/**
 * Register bleiben nach dem Abschluss pflegbar, markiert «geändert nach Abschluss» (UC-015 Schritt 6, A-75); zurückgezogene
 * Projekte sind lesend. Regel und Markierung im Modul projekt.
 */
const aenderbar = (p: store.ProjektKopf) => p.lebenszyklus !== 'zurueckgezogen';

async function pruefeAenderbar(tx: Tx, p: store.ProjektKopf): Promise<void> {
  projektAktion.pruefeAenderbar(p);
  await projektAktion.nachAbschluss(tx, p);
}

/** Projekt unter der Lesesicht oder 404 (Recht vorher mit `need` geprüft). */
async function projekt(tx: Tx, id: string): Promise<store.ProjektKopf> {
  const p = await store.projekt(tx, id);
  if (!p) throw notFound('Projekt');
  return p;
}

/** Seite über einen Versatz; der Cursor gilt nur für dieselbe Liste und dieselben Filter. */
function seite(q: { cursor?: string; limit?: number }, filter: string): { offset: number; limit: number } {
  const c = decodeCursor<{ o: number; f: string }>(q.cursor, v => typeof v.o === 'number' && Number.isInteger(v.o) && v.o >= 0 && v.f === filter);
  return { offset: c?.o ?? 0, limit: q.limit ?? 50 };
}
function weiter<T>(rows: T[], s: { offset: number; limit: number }, filter: string): { page: T[]; nextCursor: string | null } {
  return { page: rows.slice(0, s.limit), nextCursor: rows.length > s.limit ? encodeCursor({ o: s.offset + s.limit, f: filter }) : null };
}

/**
 * Fehler der Datenbank als Antwort: Prüfregel verletzt (z. B. Grösse und FTE zugleich) → 422, doppelter Eintrag → 409,
 * unbekanntes anderes Projekt → 404 wie jede unbekannte ID (Mandantentrennung).
 */
async function db<T>(label: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === '23514') throw invalid(`Die Angaben zu ${label} sind nicht gültig.`, [{ path: '/', message: GRUND[(e as { constraint?: string }).constraint ?? ''] ?? 'Prüfregel verletzt.' }]);
    if (code === '23505') throw conflict(`${label}: Diesen Eintrag gibt es schon.`, { reason: 'doppelt' });
    if (code === '23503') throw notFound('Projekt');
    throw e;
  }
}

/** Prüfregeln mit eigener Meldung (Namen wie PostgreSQL sie vergibt). */
const GRUND: Record<string, string> = {
  ressourcenbedarf_check: 'Entweder eine Grösse (S/M/L) oder FTE mit Monat von und bis (von ≤ bis) angeben, nicht beides (A-20).',
  meilenstein_check: 'Abgenommen werden nur Meilensteine mit Abnahme durch das Gremium.',
};

/** Daten für Ereignisse ohne vertrauliche Felder (Beträge gehen nicht in die Outbox, A-33). */
function ereignis(r: store.Register, e: store.Eintrag): Record<string, unknown> {
  const { can: _, createdAt: __, updatedAt: ___, ...rest } = e as store.Eintrag & { can?: unknown };
  for (const k of r.vertraulich ?? []) delete rest[k];
  return rest;
}
const audit = (e: store.Eintrag): Record<string, unknown> => { const { createdAt: _, updatedAt: __, ...rest } = e; return rest; };

// ---------------------------------------------------------------- Register unter dem Projekt

interface RegisterRoute {
  reg: store.Register;
  /** Pfad unter `/v1/projekte/:id/`. */
  pfad: string;
  schemas: { Out: TObject; List: TObject; Create: TObject; Patch: TObject };
  query: TObject;
  /** Filter der Liste (Felder der API). */
  filter: readonly string[];
  /** Zusätzliches Recht zum Lesen und Pflegen (Beträge). */
  zusaetzlich?: Permission;
  beschreibung: { liste: string; anlegen: string };
  /** Ausgabe ergänzen (berechnete Felder). */
  aus?: (e: store.Eintrag) => store.Eintrag;
  /** Prüfung vor dem Speichern in der Transaktion (z. B. anderes Projekt sichtbar). */
  vorher?: (tx: Tx, p: store.ProjektKopf, input: Record<string, unknown>) => Promise<void>;
  /** Eintrag lesen, wenn die Ausgabe mehr braucht als die Zeile (Standard `store.get`). */
  lesen?: (tx: Tx, projektId: string, eintragId: string) => Promise<store.Eintrag | null>;
  /** false: eigene Liste statt der allgemeinen. */
  liste?: false;
}

function registerRoutes(app: FastifyInstance, r: RegisterRoute): void {
  const { reg } = r;
  const basis = `/v1/projekte/:id/${r.pfad}`;
  const label = reg.label;

  async function rechte(req: FastifyRequest, id: string, perm: Permission): Promise<void> {
    await req.need(perm, projektOrt(id));
    if (r.zusaetzlich) await req.need(r.zusaetzlich, projektOrt(id));
  }
  const darf = async (req: FastifyRequest, p: store.ProjektKopf) =>
    aenderbar(p) && await req.can('projekt:write', projektOrt(p.id)) && (!r.zusaetzlich || await req.can(r.zusaetzlich, projektOrt(p.id)));
  const out = (e: store.Eintrag, write: boolean) => ({ ...(r.aus ? r.aus(e) : e), can: { write } });
  const lesen = r.lesen ?? ((tx: Tx, projektId: string, eintragId: string) => store.get(tx, reg, eintragId, { projektId }));

  if (r.liste !== false) app.get(basis, {
    schema: { tags: [TAG], summary: `${label}: Liste`, description: r.beschreibung.liste, params: IdParams, querystring: r.query, response: { 200: Type.Ref(r.schemas.List.$id!) } },
  }, async req => {
    const { id } = req.params as { id: string };
    await rechte(req, id, 'projekt:read');
    const q = req.query as Record<string, string | undefined> & { cursor?: string; limit?: number };
    const gleich = Object.fromEntries(r.filter.map(k => [k, q[k]]));
    const f = JSON.stringify(gleich);
    const s = seite(q, f);
    const [p, rows] = await req.tx(async tx => [await projekt(tx, id), await store.list(tx, reg, { projektId: id, gleich, ...s })] as const);
    const write = await darf(req, p);
    const { page, nextCursor } = weiter(rows, s, f);
    return { items: page.map(e => out(e, write)), nextCursor, can: { write } };
  });

  app.post(basis, {
    schema: { tags: [TAG], summary: `${label}: anlegen`, description: r.beschreibung.anlegen, params: IdParams, headers: IdempotencyHeaders, body: Type.Ref(r.schemas.Create.$id!), response: { 201: Type.Ref(r.schemas.Out.$id!) } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await rechte(req, id, 'projekt:write');
    const body = req.body as Record<string, unknown>;
    const who = actorOf(req);
    const [p, e] = await db(label, () => req.tx(async tx => {
      const p = await projekt(tx, id);
      await pruefeAenderbar(tx, p);
      await r.vorher?.(tx, p, body);
      const neu = await store.create(tx, reg, { projektId: id }, body);
      const e = (await lesen(tx, id, neu))!;
      await record(tx, who, { action: `${reg.name}.created`, resourceType: reg.name, resourceId: neu, data: { nummer: p.nummer, ...audit(e) }, event: ereignis(reg, e) });
      return [p, e] as const;
    }));
    return reply.code(201).header('location', `/v1/projekte/${id}/${r.pfad}/${e.id}`).header('etag', etag(e.version)).send(out(e, await darf(req, p)));
  });

  app.patch(`${basis}/:eintragId`, {
    schema: { tags: [TAG], summary: `${label}: ändern`, description: 'Nur mit `If-Match` (ETag des Eintrags); bei abweichender Version 412, im Endzustand des Projekts 409.', params: EintragParams, headers: IfMatchHeaders, body: Type.Ref(r.schemas.Patch.$id!), response: { 200: Type.Ref(r.schemas.Out.$id!) } },
  }, async (req, reply) => {
    const { id, eintragId } = req.params as { id: string; eintragId: string };
    const version = requireIfMatch(req);
    await rechte(req, id, 'projekt:write');
    const body = req.body as Record<string, unknown>;
    const who = actorOf(req);
    const [p, e] = await db(label, () => req.tx(async tx => {
      const p = await projekt(tx, id);
      const before = await lesen(tx, id, eintragId);
      if (!before) throw notFound(label);
      if (before.version !== version) throw preconditionFailed(before.version);
      await pruefeAenderbar(tx, p);
      await r.vorher?.(tx, p, body);
      if (!(await store.update(tx, reg, eintragId, version, body))) throw preconditionFailed(before.version);
      const e = (await lesen(tx, id, eintragId))!;
      await record(tx, who, { action: `${reg.name}.updated`, resourceType: reg.name, resourceId: eintragId, data: { nummer: p.nummer, before: audit(before), after: audit(e) }, event: ereignis(reg, e) });
      return [p, e] as const;
    }));
    reply.header('etag', etag(e.version));
    return out(e, await darf(req, p));
  });

  app.delete(`${basis}/:eintragId`, {
    schema: { tags: [TAG], summary: `${label}: löschen`, description: 'Nur mit `If-Match`; im Endzustand des Projekts 409.', params: EintragParams, headers: IfMatchHeaders, response: { 204: Type.Null({ description: 'Gelöscht' }) } },
  }, async (req, reply) => {
    const { id, eintragId } = req.params as { id: string; eintragId: string };
    const version = requireIfMatch(req);
    await rechte(req, id, 'projekt:write');
    const who = actorOf(req);
    await req.tx(async tx => {
      const p = await projekt(tx, id);
      const before = await lesen(tx, id, eintragId);
      if (!before) throw notFound(label);
      if (before.version !== version) throw preconditionFailed(before.version);
      await pruefeAenderbar(tx, p);
      if (!(await store.remove(tx, reg, eintragId, version))) throw preconditionFailed(before.version);
      await record(tx, who, { action: `${reg.name}.deleted`, resourceType: reg.name, resourceId: eintragId, data: { nummer: p.nummer, ...audit(before) }, event: { id: eintragId, projektId: id } });
    });
    return reply.code(204).send();
  });
}

// ---------------------------------------------------------------- Ressourcenbedarf: Anzahl Monate

const monate = (e: store.Eintrag): store.Eintrag => {
  const [v, b] = [e.vonMonat, e.bisMonat] as [string | null, string | null];
  if (!v || !b) return { ...e, monate: null };
  const [vj, vm] = v.split('-').map(Number) as [number, number];
  const [bj, bm] = b.split('-').map(Number) as [number, number];
  return { ...e, monate: (bj - vj) * 12 + (bm - vm) + 1 };
};

// ---------------------------------------------------------------- Abhängigkeiten (beidseitig sichtbar)

/** Das andere Projekt muss die Person sehen (wählen kann sie nur, was sie sieht) und darf nicht dasselbe sein. */
async function anderesProjekt(tx: Tx, p: store.ProjektKopf, input: Record<string, unknown>): Promise<void> {
  const zu = input.zuProjektId as string | undefined;
  if (zu === undefined) return;
  if (zu === p.id) throw invalid('Ein Projekt kann nicht von sich selbst abhängen.', [{ path: '/zuProjektId', message: 'Ein anderes Projekt wählen.' }]);
  if (!(await store.projekt(tx, zu))) throw notFound('Projekt');
}

/** Ausgabe einer Abhängigkeit: das andere Projekt nur, wenn die Person es sehen darf. */
function abhaengigkeitAus(e: store.Eintrag): store.Eintrag {
  const { anderesId, anderesNummer, anderesName, ...rest } = e as store.AbhaengigkeitRow;
  return { ...rest, anderesProjekt: anderesNummer ? { id: anderesId, nummer: anderesNummer, name: anderesName ?? '' } : null };
}

function abhaengigkeitRoutes(app: FastifyInstance): void {
  registerRoutes(app, {
    reg: store.REGISTER.abhaengigkeit, pfad: 'abhaengigkeiten', schemas: Abhaengigkeit, query: SeiteQuery, filter: [], liste: false,
    vorher: anderesProjekt, aus: abhaengigkeitAus, lesen: store.abhaengigkeit,
    beschreibung: { liste: '', anlegen: 'Abhängigkeit zu einem anderen Projekt mit Ansprechperson (PP.02.03, UC-002 Schritt 5); erscheint auch beim anderen Projekt. Das andere Projekt muss sichtbar sein (sonst 404).' },
  });

  app.get('/v1/projekte/:id/abhaengigkeiten', {
    schema: {
      tags: [TAG], summary: 'Abhängigkeit: Liste',
      description: 'Abhängigkeiten dieses Projekts zu anderen (`ausgehend`, hier gepflegt) und anderer Projekte zu diesem (`eingehend`, beim anderen Projekt gepflegt; UC-002 Schritt 5).',
      params: IdParams, querystring: SeiteQuery, response: { 200: Type.Ref('AbhaengigkeitList') },
    },
  }, async req => {
    const { id } = req.params as { id: string };
    await req.need('projekt:read', projektOrt(id));
    const q = req.query as { cursor?: string; limit?: number };
    const s = seite(q, '');
    const [p, rows] = await req.tx(async tx => [await projekt(tx, id), await store.abhaengigkeiten(tx, id, s.offset, s.limit)] as const);
    const write = aenderbar(p) && await req.can('projekt:write', projektOrt(id));
    const { page, nextCursor } = weiter(rows, s, '');
    return { items: page.map(e => ({ ...abhaengigkeitAus(e), can: { write: write && e.richtung === 'ausgehend' } })), nextCursor, can: { write } };
  });
}

// ---------------------------------------------------------------- KPI-Werte (PC.03.03)

/** KPI-Werte ab der Implementierung (PC.03.03: ab P2). */
const WERTE_AB: readonly string[] = ['P2', 'P3', 'P4'];

function kpiWertRoutes(app: FastifyInstance): void {
  const wertOut = (w: store.KpiWertRow, write: boolean) => ({
    kpiId: w.kpi_id, periode: w.periode, wert: Number(w.wert), kommentar: w.kommentar, version: w.version, updatedAt: w.updated_at, can: { write },
  });
  const darf = async (req: FastifyRequest, p: store.ProjektKopf) => aenderbar(p) && WERTE_AB.includes(p.phase) && await req.can('kpi:write', projektOrt(p.id));
  /** Projekt und KPI unter der Lesesicht oder 404. */
  const kpi = async (tx: Tx, id: string, kpiId: string) => {
    const p = await projekt(tx, id);
    if (!(await store.get(tx, store.REGISTER.kpi, kpiId, { projektId: id }))) throw notFound('KPI');
    return p;
  };

  app.get('/v1/projekte/:id/kpis/:kpiId/werte', {
    schema: { tags: [TAG], summary: 'KPI-Werte: Liste', description: 'Ist-Werte des KPI je Periode, neueste zuerst (PC.03.03).', params: KpiParams, querystring: SeiteQuery, response: { 200: Type.Ref('KpiWertList') } },
  }, async req => {
    const { id, kpiId } = req.params as { id: string; kpiId: string };
    await req.need('projekt:read', projektOrt(id));
    const s = seite(req.query as { cursor?: string; limit?: number }, kpiId);
    const [p, rows] = await req.tx(async tx => [await kpi(tx, id, kpiId), await store.kpiWerte(tx, kpiId, s.offset, s.limit)] as const);
    const write = await darf(req, p);
    const { page, nextCursor } = weiter(rows, s, kpiId);
    return { items: page.map(w => wertOut(w, write)), nextCursor, can: { write } };
  });

  app.put('/v1/projekte/:id/kpis/:kpiId/werte/:periode', {
    schema: {
      tags: [TAG], summary: 'KPI-Wert erfassen',
      description: 'Ist-Wert der Periode «JJJJ-MM» erfassen oder ändern (PC.03.03, mit `kpi:write` am Projekt, ab Phase P2, sonst 409). `If-Match: W/"0"` für einen neuen Wert, sonst der ETag des Werts (412 bei Abweichung).',
      params: KpiWertParams, headers: IfMatchHeaders, body: Type.Ref('KpiWertPut'), response: { 200: Type.Ref('KpiWert') },
    },
  }, async (req, reply) => {
    const { id, kpiId, periode } = req.params as { id: string; kpiId: string; periode: string };
    const version = requireIfMatch(req);
    await req.need('kpi:write', projektOrt(id));
    const body = req.body as KpiWertPutIn;
    const who = actorOf(req);
    const [p, w] = await req.tx(async tx => {
      const p = await kpi(tx, id, kpiId);
      await pruefeAenderbar(tx, p);
      if (!WERTE_AB.includes(p.phase)) throw conflict(`KPI-Werte werden ab der Implementierung (Phase P2) erfasst; das Projekt ${p.nummer} ist in ${p.phase}.`, { reason: 'phase', phase: p.phase });
      const before = await store.kpiWert(tx, kpiId, periode);
      if ((before?.version ?? 0) !== version) throw preconditionFailed(before?.version ?? 0);
      if (!(await store.kpiWertSetzen(tx, id, kpiId, periode, version, body.wert, (body.kommentar ?? '').trim()))) throw preconditionFailed(before?.version ?? 0);
      const w = (await store.kpiWert(tx, kpiId, periode))!;
      const daten = { projektId: id, kpiId, periode, wert: Number(w.wert), kommentar: w.kommentar, version: w.version };
      await record(tx, who, { action: 'kpi_wert.recorded', resourceType: 'kpi', resourceId: kpiId, data: { nummer: p.nummer, before: before && { wert: Number(before.wert), kommentar: before.kommentar }, after: daten }, event: daten });
      return [p, w] as const;
    });
    reply.header('etag', etag(w.version));
    return wertOut(w, await darf(req, p));
  });

  app.delete('/v1/projekte/:id/kpis/:kpiId/werte/:periode', {
    schema: { tags: [TAG], summary: 'KPI-Wert löschen', description: 'Nur mit `If-Match`.', params: KpiWertParams, headers: IfMatchHeaders, response: { 204: Type.Null({ description: 'Gelöscht' }) } },
  }, async (req, reply) => {
    const { id, kpiId, periode } = req.params as { id: string; kpiId: string; periode: string };
    const version = requireIfMatch(req);
    await req.need('kpi:write', projektOrt(id));
    const who = actorOf(req);
    await req.tx(async tx => {
      const p = await kpi(tx, id, kpiId);
      const before = await store.kpiWert(tx, kpiId, periode);
      if (!before) throw notFound('KPI-Wert');
      if (before.version !== version) throw preconditionFailed(before.version);
      await pruefeAenderbar(tx, p);
      if (!(await store.kpiWertLoeschen(tx, kpiId, periode, version))) throw preconditionFailed(before.version);
      await record(tx, who, { action: 'kpi_wert.deleted', resourceType: 'kpi', resourceId: kpiId, data: { nummer: p.nummer, periode, wert: Number(before.wert) }, event: { projektId: id, kpiId, periode } });
    });
    return reply.code(204).send();
  });
}

// ---------------------------------------------------------------- Meldung ICT/Infrastruktur (RK.02.06, A-22)

const STELLE_TEXT = { dti: 'ICT (DTI)', dbi: 'Infrastruktur (DBI)' } as const;

function meldungRoutes(app: FastifyInstance): void {
  const meldungOut = (m: store.MeldungRow) => ({ id: m.id, projektId: m.projekt_id, stelle: m.stelle, text: m.text, gemeldetAt: m.gemeldet_at, gemeldetBy: m.gemeldet_by });

  app.get('/v1/projekte/:id/meldungen', {
    schema: { tags: [TAG], summary: 'Meldungen: Liste', description: 'Gemeldeter ICT- und Infrastrukturbedarf (RK.02.06), neueste zuerst.', params: IdParams, querystring: SeiteQuery, response: { 200: Type.Ref('MeldungList') } },
  }, async req => {
    const { id } = req.params as { id: string };
    await req.need('projekt:read', projektOrt(id));
    const s = seite(req.query as { cursor?: string; limit?: number }, '');
    const [p, rows] = await req.tx(async tx => [await projekt(tx, id), await store.meldungen(tx, id, s.offset, s.limit)] as const);
    const { page, nextCursor } = weiter(rows, s, '');
    return { items: page.map(meldungOut), nextCursor, can: { write: aenderbar(p) && await req.can('projekt:write', projektOrt(id)) } };
  });

  app.post('/v1/projekte/:id/meldungen', {
    schema: {
      tags: [TAG], summary: 'ICT- oder Infrastrukturbedarf melden',
      description: 'Meldung an die zuständige Stelle (`dti` ICT, `dbi` Infrastruktur; UC-002 A2, RK.02.06). Keine Schnittstelle (A-22, K24 offen): Die Meldung steht im System und geht als Ereignis `meldung.created` in die Outbox.',
      params: IdParams, headers: IdempotencyHeaders, body: Type.Ref('MeldungCreate'), response: { 201: Type.Ref('Meldung') },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await req.need('projekt:write', projektOrt(id));
    const body = req.body as MeldungCreateIn;
    const who = actorOf(req);
    const m = await req.tx(async tx => {
      const p = await projekt(tx, id);
      await pruefeAenderbar(tx, p);
      const m = await store.melden(tx, id, body.stelle, body.text);
      const daten = { id: m.id, projektId: id, nummer: p.nummer, name: p.name, stelle: m.stelle, stelleText: STELLE_TEXT[m.stelle], text: m.text, gemeldetAt: m.gemeldet_at };
      await record(tx, who, { action: 'meldung.created', resourceType: 'meldung', resourceId: m.id, data: daten, event: daten });
      return m;
    });
    return reply.code(201).header('location', `/v1/projekte/${id}/meldungen`).send(meldungOut(m));
  });
}

// ---------------------------------------------------------------- Portfoliorisiken (PC.02.01)

function portfolioRisikoRoutes(app: FastifyInstance): void {
  const reg = store.REGISTER.risiko;
  const portfolioOrt = (id: string) => ({ type: 'portfolio', id });
  /** Portfolio unter der Lesesicht oder 404. */
  const portfolio = async (tx: Tx, id: string) => {
    if (!(await store.portfolioSichtbar(tx, id))) throw notFound('Portfolio');
  };
  const darf = (req: FastifyRequest) => req.can('projekt:write');
  const out = (e: store.Eintrag, write: boolean) => ({ ...e, can: { write } });

  app.get('/v1/portfolios/:id/risiken', {
    schema: { tags: [TAG], summary: 'Portfoliorisiken: Liste', description: 'Vorhabenübergreifende Risiken des Portfolios mit Bewertung und Massnahme (PC.02.01), höchste Auswirkung zuerst.', params: IdParams, querystring: SeiteQuery, response: { 200: Type.Ref('RisikoList') } },
  }, async req => {
    const { id } = req.params as { id: string };
    await req.need('projekt:read', portfolioOrt(id));
    const s = seite(req.query as { cursor?: string; limit?: number }, '');
    const rows = await req.tx(async tx => { await portfolio(tx, id); return store.list(tx, reg, { portfolioId: id, ...s }); });
    const write = await darf(req);
    const { page, nextCursor } = weiter(rows, s, '');
    return { items: page.map(e => out(e, write)), nextCursor, can: { write } };
  });

  app.post('/v1/portfolios/:id/risiken', {
    schema: { tags: [TAG], summary: 'Portfoliorisiko erfassen', description: 'Mit `projekt:write` an der Organisation (PC.02.01: UE).', params: IdParams, headers: IdempotencyHeaders, body: Type.Ref('RisikoCreate'), response: { 201: Type.Ref('Risiko') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await req.need('projekt:read', portfolioOrt(id));
    await req.need('projekt:write');
    const who = actorOf(req);
    const e = await req.tx(async tx => {
      await portfolio(tx, id);
      const neu = await store.create(tx, reg, { portfolioId: id }, req.body as Record<string, unknown>);
      const e = (await store.get(tx, reg, neu, { portfolioId: id }))!;
      await record(tx, who, { action: 'risiko.created', resourceType: 'risiko', resourceId: neu, data: audit(e), event: ereignis(reg, e) });
      return e;
    });
    return reply.code(201).header('location', `/v1/portfolios/${id}/risiken/${e.id}`).header('etag', etag(e.version)).send(out(e, await darf(req)));
  });

  app.patch('/v1/portfolios/:id/risiken/:eintragId', {
    schema: { tags: [TAG], summary: 'Portfoliorisiko ändern', description: 'Nur mit `If-Match`; bei abweichender Version 412.', params: EintragParams, headers: IfMatchHeaders, body: Type.Ref('RisikoPatch'), response: { 200: Type.Ref('Risiko') } },
  }, async (req, reply) => {
    const { id, eintragId } = req.params as { id: string; eintragId: string };
    const version = requireIfMatch(req);
    await req.need('projekt:read', portfolioOrt(id));
    await req.need('projekt:write');
    const who = actorOf(req);
    const e = await req.tx(async tx => {
      await portfolio(tx, id);
      const before = await store.get(tx, reg, eintragId, { portfolioId: id });
      if (!before) throw notFound(reg.label);
      if (before.version !== version || !(await store.update(tx, reg, eintragId, version, req.body as Record<string, unknown>))) throw preconditionFailed(before.version);
      const e = (await store.get(tx, reg, eintragId, { portfolioId: id }))!;
      await record(tx, who, { action: 'risiko.updated', resourceType: 'risiko', resourceId: eintragId, data: { before: audit(before), after: audit(e) }, event: ereignis(reg, e) });
      return e;
    });
    reply.header('etag', etag(e.version));
    return out(e, await darf(req));
  });

  app.delete('/v1/portfolios/:id/risiken/:eintragId', {
    schema: { tags: [TAG], summary: 'Portfoliorisiko löschen', description: 'Nur mit `If-Match`.', params: EintragParams, headers: IfMatchHeaders, response: { 204: Type.Null({ description: 'Gelöscht' }) } },
  }, async (req, reply) => {
    const { id, eintragId } = req.params as { id: string; eintragId: string };
    const version = requireIfMatch(req);
    await req.need('projekt:read', portfolioOrt(id));
    await req.need('projekt:write');
    const who = actorOf(req);
    await req.tx(async tx => {
      await portfolio(tx, id);
      const before = await store.get(tx, reg, eintragId, { portfolioId: id });
      if (!before) throw notFound(reg.label);
      if (before.version !== version || !(await store.remove(tx, reg, eintragId, version))) throw preconditionFailed(before.version);
      await record(tx, who, { action: 'risiko.deleted', resourceType: 'risiko', resourceId: eintragId, data: audit(before), event: { id: eintragId, portfolioId: id } });
    });
    return reply.code(204).send();
  });
}

// ---------------------------------------------------------------- Routen des Moduls

export function registerProjektdatenRoutes(app: FastifyInstance, _deps: Deps): void {
  for (const s of [Meilenstein, Kosten, Risiko, Kpi, Stakeholder, Abhaengigkeit, Ressourcenbedarf]) for (const x of Object.values(s)) app.addSchema(x);
  for (const s of [KpiWert, KpiWertList, KpiWertPut, Meldung, MeldungList, MeldungCreate]) app.addSchema(s);

  registerRoutes(app, {
    reg: store.REGISTER.meilenstein, pfad: 'meilensteine', schemas: Meilenstein, query: MeilensteinQuery, filter: ['phase', 'art'],
    beschreibung: {
      liste: 'Meilensteinplan (PS.02.04): Lieferergebnisse, Meilensteine und Kommunikationsmassnahmen (PS.05.02) je Phase mit Termin der Baseline und aufdatiert, nach Phase und Termin.',
      anlegen: 'Lieferergebnis, Meilenstein oder Kommunikationsmassnahme anlegen; erledigt melden über `erreichtAm` (PS.05.03).',
    },
  });
  registerRoutes(app, {
    reg: store.REGISTER.kosten, pfad: 'kosten', schemas: Kosten, query: ListQuery, filter: ['phase'], zusaetzlich: 'finanzen:read',
    beschreibung: {
      liste: 'Kosten je Phase mit Lieferant, Offerte, CAPEX/OPEX, Budget der Baseline, Prognose und Ist (PC.01.01, PC.01.03). Nur mit `finanzen:read` (A-33).',
      anlegen: 'Kostenposition anlegen; Prognose aufdatiert (PC.01.03). Nur mit `finanzen:read` (A-33).',
    },
  });
  registerRoutes(app, {
    reg: store.REGISTER.risiko, pfad: 'risiken', schemas: Risiko, query: SeiteQuery, filter: [],
    beschreibung: {
      liste: 'Projektrisiken mit Eintrittswahrscheinlichkeit und Auswirkung (hoch/mittel/tief), Massnahme und Stand (PC.02.04, PC.02.03), höchste Auswirkung zuerst.',
      anlegen: 'Projektrisiko erfassen (PC.02.04).',
    },
  });
  registerRoutes(app, {
    reg: store.REGISTER.kpi, pfad: 'kpis', schemas: Kpi, query: SeiteQuery, filter: [],
    beschreibung: { liste: 'Klinische, nicht-klinische und Projekt-KPIs mit Einheit und Zielwert (PC.03.01).', anlegen: 'KPI festlegen (PC.03.01).' },
  });
  registerRoutes(app, {
    reg: store.REGISTER.stakeholder, pfad: 'stakeholder', schemas: Stakeholder, query: SeiteQuery, filter: [],
    beschreibung: { liste: 'Stakeholder mit Interesse, Einfluss und geplanten Massnahmen (PS.05.01).', anlegen: 'Stakeholder erfassen (PS.05.01).' },
  });
  registerRoutes(app, {
    reg: store.REGISTER.ressourcenbedarf, pfad: 'ressourcenbedarf', schemas: Ressourcenbedarf, query: ListQuery, filter: ['phase'], aus: monate,
    beschreibung: {
      liste: 'Ressourcenbedarf je Rolle und Phase: Grösse S/M/L bis Gate P1–P2 (RK.02.01), danach FTE × Monate (RK.02.05, A-20).',
      anlegen: 'Bedarf je Rolle und Phase anmelden: entweder `groesse` oder `fte` mit `vonMonat` und `bisMonat`; je Rolle und Phase ein Eintrag (sonst 409).',
    },
  });
  abhaengigkeitRoutes(app);
  kpiWertRoutes(app);
  meldungRoutes(app);
  portfolioRisikoRoutes(app);
}
