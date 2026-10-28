/**
 * Routen der Projekte nach dem Muster der Handlungsfelder (fachmodell.md 5): Rechte über `req.need` am Projekt bzw.
 * irgendwo für Listen, Lesesicht über `req.tx`, Fähigkeiten `can`, Cursor, ETag/If-Match (412), Idempotenz
 * (Querschnitt), Audit und Ereignis in derselben Transaktion. Projektorganisation (PP.04.04) mit Tupeln am Projekt.
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  actorOf, decodeCursor, encodeCursor, etag, IdempotencyHeaders, IdParams, IfMatchHeaders, notFound, preconditionFailed,
  requireIfMatch, type Deps,
} from '@vollholz/platform';
import { record } from '../../platform.ts';
import { anlegen, organisationFestlegen, pruefeAenderbar, snapshot, standVon } from './aktionen.ts';
import {
  Kopf, KopfProjekt, ListQuery, Mitglied, Organisation, OrganisationPut, PersonenQuery, Projekt, ProjektCreate, ProjektList, ProjektPatch, ProjektPersonen,
  type Funktion, type Lebenszyklus, type OrganisationOut, type OrganisationPutIn, type Phase, type ProjektCreateIn, type ProjektOut,
  type ProjektPatchIn,
} from './schemas.ts';
import * as store from './store.ts';

const TAG = 'Projekte';

type Caps = (kind: string, id: string) => Record<string, boolean>;
const ort = (id: string) => ({ type: 'projekt', id });

function out(r: store.Row, caps: Caps): ProjektOut {
  const c = caps('projekt', r.id);
  return {
    id: r.id, nummer: r.nummer, name: r.name, portfolioId: r.portfolio_id,
    portfolio: r.pf_schluessel ? { schluessel: r.pf_schluessel, name: r.pf_name!, kategorie: r.pf_kategorie! } : null,
    orgEinheitId: r.org_einheit_id, handlungsfeldId: r.handlungsfeld_id, handlungsfeld: r.hf_label,
    phase: r.phase, phasenmodellId: r.phasenmodell_id, lebenszyklus: r.lebenszyklus, vertraulich: r.vertraulich,
    sponsor: r.sponsor, projektleitung: r.projektleitung, controlling: r.controlling, rollen: r.rollen,
    version: r.version, createdAt: r.created_at, updatedAt: r.updated_at,
    // Endzustände sind lesend (UC-015 Schritt 6)
    can: { write: !!c.write && aenderbar(r), organisation: !!c.organisation && aenderbar(r) },
  };
}

const aenderbar = (r: store.Row) => r.lebenszyklus === 'aktiv' || r.lebenszyklus === 'sistiert';

function organisation(r: store.Row, rows: store.MitgliedRow[], caps: Caps): OrganisationOut {
  return {
    version: standVon(rows),
    mitglieder: rows.map(m => ({ personId: m.person_id, funktion: m.funktion, akv: m.akv })),
    can: { write: !!caps('projekt', r.id).organisation && aenderbar(r) },
  };
}

/** Projekt lesen (Lesesicht) oder 404; Recht vorher mit `need` geprüft. */
async function lesen(req: FastifyRequest, id: string): Promise<store.Row> {
  const r = await req.tx(tx => store.get(tx, id));
  if (!r) throw notFound('Projekt');
  return r;
}

export function registerRoutes(app: FastifyInstance, deps: Deps): void {
  for (const s of [Projekt, ProjektList, ProjektCreate, ProjektPatch, Mitglied, Organisation, OrganisationPut, KopfProjekt, Kopf, ProjektPersonen]) app.addSchema(s);

  app.get('/v1/projekte', {
    schema: {
      tags: [TAG], summary: 'Projekte auflisten',
      description: 'Alle sichtbaren Projekte (Meine Projekte, UI-05), sortiert nach Nummer, mit Filtern und Cursor. `rolle` zeigt nur Projekte, in denen die anfragende Person diese Funktion hat.',
      querystring: ListQuery, response: { 200: Type.Ref('ProjektList') },
    },
  }, async req => {
    await req.needSomewhere('projekt:read');
    const q = req.query as { rolle?: Funktion; portfolio?: string; phase?: Phase; lebenszyklus?: Lebenszyklus[]; nummer?: string; q?: string; cursor?: string; limit?: number };
    const limit = q.limit ?? 50;
    // Der Cursor gilt nur für dieselben Filter
    const filter = JSON.stringify([q.rolle, q.portfolio, q.phase, q.lebenszyklus, q.nummer, q.q]);
    const after = decodeCursor<{ n: string; f: string }>(q.cursor, v => typeof v.n === 'string' && v.f === filter);
    const rows = await req.tx(tx => store.list(tx, { ...q, after: after && { nummer: after.n }, limit }));
    const page = rows.slice(0, limit);
    const caps = await req.capabilities();
    const last = page[page.length - 1];
    return { items: page.map(r => out(r, caps)), nextCursor: rows.length > limit && last ? encodeCursor({ n: last.nummer, f: filter }) : null };
  });

  app.get('/v1/projekte/personen', {
    schema: {
      tags: [TAG], summary: 'Personen in sichtbaren Projekten suchen',
      description: 'Befehlspalette (I-N4): Personen nach Name mit ihren Funktionen in laufenden Projekten, die die anfragende Person sieht; ohne E-Mail. Personen ohne Funktion in einem sichtbaren Projekt erscheinen nicht.',
      querystring: PersonenQuery, response: { 200: Type.Ref('ProjektPersonen') },
    },
  }, async req => {
    await req.needSomewhere('projekt:read');
    const q = req.query as { q: string; limit?: number };
    return { items: await req.tx(tx => store.personen(tx, q.q.trim(), q.limit ?? 8)) };
  });

  app.get('/v1/projekte/kopf', {
    schema: { tags: [TAG], summary: 'Kopf: eigene Projekte', description: 'Laufende Projekte, in denen die anfragende Person eine Funktion hat (Kopfkarte im Eingang).', response: { 200: Type.Ref('ProjektKopf') } },
  }, async req => {
    await req.needSomewhere('projekt:read');
    const { rows, anzahl } = await req.tx(tx => store.kopf(tx, 20));
    return { projekte: rows.map(r => ({ id: r.id, nummer: r.nummer, name: r.name, phase: r.phase, lebenszyklus: r.lebenszyklus, rollen: r.rollen })), anzahl };
  });

  app.post('/v1/projekte', {
    schema: {
      tags: [TAG], summary: 'Projekt anlegen', description: 'Mit `projekt:create` an der Organisation oder am Portfolio; Nummer «JJJJ-NNN» fortlaufend je Jahr (A-47), Phase ohne Angabe P0.',
      headers: IdempotencyHeaders, body: Type.Ref('ProjektCreate'), response: { 201: Type.Ref('Projekt') },
    },
  }, async (req, reply) => {
    const body = req.body as ProjektCreateIn;
    await req.need('projekt:create', { type: 'portfolio', id: body.portfolioId });
    const p = req.requirePrincipal();
    const row = await req.tx(tx => anlegen(tx, { db: deps.db, tenantId: p.tenantId }, actorOf(req), body));
    const caps = await req.capabilities();
    return reply.code(201).header('location', `/v1/projekte/${row.id}`).header('etag', etag(row.version)).send(out(row, caps));
  });

  app.get('/v1/projekte/:id', {
    schema: { tags: [TAG], summary: 'Projekt lesen', description: 'Kopf der Projektakte und Projektübersicht (UI-06).', params: IdParams, response: { 200: Type.Ref('Projekt') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await req.need('projekt:read', ort(id));
    const row = await lesen(req, id);
    const caps = await req.capabilities();
    reply.header('etag', etag(row.version));
    return out(row, caps);
  });

  app.patch('/v1/projekte/:id', {
    schema: {
      tags: [TAG], summary: 'Projekt ändern', description: 'Name, Federführung, Handlungsfeld, «vertraulich»; nur mit `If-Match`, bei abweichender Version 412, im Endzustand 409.',
      params: IdParams, headers: IfMatchHeaders, body: Type.Ref('ProjektPatch'), response: { 200: Type.Ref('Projekt') },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('projekt:write', ort(id));
    const who = actorOf(req);
    const row = await req.tx(async tx => {
      const before = await store.get(tx, id);
      if (!before) throw notFound('Projekt');
      if (before.version !== version) throw preconditionFailed(before.version);
      pruefeAenderbar(before);
      if (!(await store.update(tx, id, version, req.body as ProjektPatchIn))) throw preconditionFailed(before.version);
      const r = (await store.get(tx, id))!;
      await record(tx, who, { action: 'projekt.updated', resourceType: 'projekt', resourceId: id, data: { before: snapshot(before), after: snapshot(r) }, event: snapshot(r) });
      return r;
    });
    const caps = await req.capabilities();
    reply.header('etag', etag(row.version));
    return out(row, caps);
  });

  app.get('/v1/projekte/:id/organisation', {
    schema: {
      tags: [TAG], summary: 'Projektorganisation lesen', description: 'Sponsor, Sponsoren-Koalition, Projektleitung, CTL und Kernteam mit AKV (PP.04.04).',
      params: IdParams, response: { 200: Type.Ref('Organisation') },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await req.need('projekt:read', ort(id));
    const [row, rows] = await req.tx(async tx => [await store.get(tx, id), await store.mitglieder(tx, id)] as const);
    if (!row) throw notFound('Projekt');
    const caps = await req.capabilities();
    const o = organisation(row, rows, caps);
    reply.header('etag', etag(o.version));
    return o;
  });

  app.put('/v1/projekte/:id/organisation', {
    schema: {
      tags: [TAG], summary: 'Projektorganisation festlegen',
      description: 'Ersetzt die Projektorganisation (UC-002 Schritt 2) und gibt den benannten Personen ihre Rolle am Projekt (Sponsor, Projektleitung, CTL, Kernteam); entfernte verlieren sie. Nur mit `If-Match` (Stand der Projektorganisation).',
      params: IdParams, headers: IfMatchHeaders, body: Type.Ref('OrganisationPut'), response: { 200: Type.Ref('Organisation') },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('projekt:organisation', ort(id));
    const p = req.requirePrincipal();
    const body = req.body as OrganisationPutIn;
    const [row, rows] = await req.tx(async tx => {
      const r = await organisationFestlegen(tx, { tuples: deps.iam.tuples, who: actorOf(req), principalId: p.principalId }, id, version, body.mitglieder);
      return [(await store.get(tx, id))!, r] as const;
    });
    const caps = await req.capabilities();
    const o = organisation(row, rows, caps);
    reply.header('etag', etag(o.version));
    return o;
  });
}
