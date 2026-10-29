/**
 * Routen des Zielzyklus (BC ZM.02.01, ZM.02.03, ZM.02.04, PP.02.05; UC-011 Schritte 1–5; Kernablauf K6) nach dem Muster
 * der Handlungsfelder: Rechte über `req.need`, Lesesicht über `req.tx`, Fähigkeiten `can`, ETag/If-Match (412),
 * Idempotenz (Querschnitt), Audit und Ereignis in derselben Transaktion.
 *
 * Bearbeiten nur, solange das Zieljahr «in Arbeit» ist: ab «zur Freigabe» sind die Jahresziele bis zum Entscheid des VR
 * gesperrt (UC-011 Schritt 6, K6 Z9); Vorlegen und Freigabe setzt AP-E6-2.
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  actorOf, conflict, decodeCursor, encodeCursor, etag, IdempotencyHeaders, IdParams, IfMatchHeaders, invalid, notFound, preconditionFailed,
  requireIfMatch, type Deps, type Tx,
} from '@vollholz/platform';
import { record } from '../../platform.ts';
import { aufgabe } from '../eingang/index.ts';
import {
  Hauptaktivitaet, HauptaktivitaetCreate, HauptaktivitaetList, HauptaktivitaetPatch, HauptaktivitaetQuery, JahrParams, Jahresziel,
  JahreszielCreate, JahreszielList, JahreszielPatch, JahreszielQuery, Person, ProjektZiel, ProjektZielCreate, ProjektZielList,
  ProjektZielParams, ZielProjekt, Zieljahr, ZieljahrCreate, ZieljahrPatch, Zielzyklus,
  type HauptaktivitaetOut, type JahreszielOut, type ProjektZielOut, type ZieljahrOut,
} from './zyklus-schemas.ts';
import * as store from './zyklus-store.ts';
import { nachVorlage } from './verlauf.ts';

const TAG = 'Ziele';

const STAND_TEXT: Record<store.Stand, string> = { in_arbeit: 'in Arbeit', zur_freigabe: 'liegen dem VR zur Freigabe vor', in_kraft: 'sind in Kraft' };

/**
 * Zieljahr lesen und für die Dauer der Transaktion gegen Vorlegen sperren; 404 ohne Zielzyklus. Nach der Vorlage bleibt
 * Ändern möglich und ist markiert «geändert nach Vorlage» (K6 Z9, A-75: `nachVorlage` nach der Änderung); Löschen nur
 * «in Arbeit» (409, gelöscht werden nur Entwürfe).
 */
async function jahrBearbeitbar(tx: Tx, jahr: number, o: { loeschen?: boolean } = {}): Promise<store.ZieljahrRow> {
  const zj = await store.getJahr(tx, jahr, true);
  if (!zj) throw notFound(`Zielzyklus ${jahr}`);
  if (o.loeschen && zj.stand !== 'in_arbeit') {
    throw conflict(`Die Jahresziele ${jahr} ${STAND_TEXT[zj.stand]}; gelöscht wird nach der Vorlage nichts mehr. Ändere den Eintrag, die Änderung ist markiert.`, { reason: 'gesperrt', stand: zj.stand });
  }
  return zj;
}

/** Aufgabe «Jahresziele vervollständigen» (Fachmodell 4.2; K6 Einstieg). Schliesst die Vorlage an den VR (AP-E6-2). */
export const VERVOLLSTAENDIGEN = 'jahresziele.vervollstaendigen';
export const zieljahrBezug = (zj: { id: string }) => ({ typ: 'zieljahr', id: zj.id });

/**
 * Aufgabe an alle mit `ziel:write` öffnen bzw. nachführen (idempotent): «Jahresziele 2027 vervollständigen · Vorlage an
 * den VR bis 15.11.2026», Frist = geplante Vorlage.
 */
async function aufgabeVervollstaendigen(tx: Tx, zj: store.ZieljahrRow): Promise<void> {
  await aufgabe.oeffnen(tx, {
    art: VERVOLLSTAENDIGEN, bezug: zieljahrBezug(zj), empfaenger: { recht: 'ziel:write' },
    titel: `Jahresziele ${zj.jahr} vervollständigen`,
    kontext: zj.vorlage_bis ? `Vorlage an den VR bis ${zj.vorlage_bis.split('-').reverse().join('.')}` : null,
    link: `/ziele/${zj.jahr}`,
    frist: zj.vorlage_bis ? { datum: zj.vorlage_bis, art: 'kalendertage' } : null,
  });
}

export const zieljahrOut = (r: store.ZieljahrRow, write: boolean): ZieljahrOut => ({
  jahr: r.jahr, stand: r.stand, vorlageBis: r.vorlage_bis, vorgelegtAt: r.vorgelegt_at, freigabeAt: r.freigabe_at, freigabeText: r.freigabe_text,
  geaendertNachVorlage: r.geaendert_nach_vorlage_at,
  // nach der Vorlage bleibt Ändern möglich, markiert (A-75)
  version: r.version, createdAt: r.created_at, updatedAt: r.updated_at, can: { write },
});

const jahreszielOut = (r: store.JahreszielRow, write: boolean): JahreszielOut => ({
  id: r.id, jahr: r.jahr, strategischesZielId: r.strategisches_ziel_id, nummer: r.nummer, text: r.text, metrik: r.metrik, zielwert: r.zielwert,
  geaendertNachVorlage: r.geaendert_nach_vorlage_at,
  version: r.version, createdAt: r.created_at, createdBy: r.created_by, updatedAt: r.updated_at, updatedBy: r.updated_by, can: { write },
});
const jahreszielSnapshot = (r: store.JahreszielRow) => ({
  id: r.id, jahr: r.jahr, strategischesZielId: r.strategisches_ziel_id, nummer: r.nummer, text: r.text, metrik: r.metrik, zielwert: r.zielwert, version: r.version,
});

const person = (id: string | null, name: string | null) => (id ? { id, name } : null);
const hauptaktivitaetOut = (r: store.HauptaktivitaetRow, write: boolean): HauptaktivitaetOut => ({
  id: r.id, jahreszielId: r.jahresziel_id, text: r.text, verantwortlich: person(r.verantwortlich, r.verantwortlich_name), position: r.position,
  version: r.version, createdAt: r.created_at, updatedAt: r.updated_at, can: { write },
});
const hauptaktivitaetSnapshot = (r: store.HauptaktivitaetRow) => ({
  id: r.id, jahreszielId: r.jahresziel_id, text: r.text, verantwortlich: r.verantwortlich, position: r.position, version: r.version,
});

/** Adresse eines Ziels im Arbeitsraum Ziele (informationsarchitektur.md: `/ziele/2027?o=ziel:2.1`). */
const zielLink = (r: store.ProjektZielRow) => (r.jz_jahr !== null
  ? `/ziele/${r.jz_jahr}?o=ziel:${r.jz_nummer}`
  : `/ziele/strategische-ziele?o=ziel:${r.sz_nummer}`);

const projektZielOut = (r: store.ProjektZielRow): ProjektZielOut => ({
  id: r.id, projektId: r.projekt_id,
  strategischesZiel: { id: r.sz_id, nummer: r.sz_nummer, text: r.sz_text },
  jahresziel: r.jz_id ? { id: r.jz_id, jahr: r.jz_jahr!, nummer: r.jz_nummer!, text: r.jz_text! } : null,
  link: zielLink(r), createdAt: r.created_at,
});
const projektZielSnapshot = (r: store.ProjektZielRow) => ({
  id: r.id, projektId: r.projekt_id, strategischesZielId: r.sz_id, jahreszielId: r.jz_id,
});

/** Darf die Person Ziele pflegen (Rolle an der Organisation, z. B. GL). */
const darfSchreiben = (req: FastifyRequest) => req.can('ziel:write');

/** Unbekanntes strategisches Ziel (auch eines anderer Organisationen) als 404 statt als Konflikt aus dem Fremdschlüssel. */
async function strategischesZielPruefen<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if ((e as { code?: string }).code === '23503') throw notFound('Strategisches Ziel');
    throw e;
  }
}

async function verantwortlichPruefen(tx: Tx, id: string | null | undefined): Promise<void> {
  if (id && !(await store.personVorhanden(tx, id))) {
    throw invalid('Die verantwortliche Person ist nicht gültig.', [{ path: '/verantwortlich', message: 'Diese Person gibt es in der Organisation nicht.' }]);
  }
}

export function registerZyklusRoutes(app: FastifyInstance, _deps: Deps): void {
  for (const s of [Zieljahr, ZieljahrCreate, ZieljahrPatch, Person, ZielProjekt, Zielzyklus, Jahresziel, JahreszielCreate, JahreszielPatch, JahreszielList,
    Hauptaktivitaet, HauptaktivitaetCreate, HauptaktivitaetPatch, HauptaktivitaetList, ProjektZiel, ProjektZielList, ProjektZielCreate]) app.addSchema(s);

  // ---------------------------------------------------------------- Zielzyklus (UC-011 Schritt 1)

  app.get('/v1/ziele/:jahr', {
    schema: {
      tags: [TAG], summary: 'Zielzyklus eines Jahres', params: JahrParams, response: { 200: Type.Ref('Zielzyklus') },
      description: 'Strategische Ziele mit Jahreszielen, Hauptaktivitäten und zugeordneten Projekten (nur sichtbare), dazu der Prüfbericht: Jahresziele ohne Metrik, ohne Hauptaktivität und Projekt. Ohne gestarteten Zielzyklus `zieljahr: null`.',
    },
  }, async req => {
    const { jahr } = req.params as { jahr: number };
    await req.need('ziel:read');
    const write = await darfSchreiben(req);
    const d = await req.tx(async tx => {
      const zieljahr = await store.getJahr(tx, jahr);
      const ziele = await store.strategischeZiele(tx);
      const jz = zieljahr ? await store.alleJahresziele(tx, jahr) : [];
      const ha = await store.listHauptaktivitaeten(tx, jz.map(j => j.id));
      const pr = await store.baumProjekte(tx, jahr);
      return { zieljahr, ziele, jz, ha, pr };
    });
    const projekt = (p: store.BaumProjektRow) => ({ zuordnungId: p.zuordnung_id, projektId: p.projekt_id, nummer: p.nummer, name: p.name, phase: p.phase, lebenszyklus: p.lebenszyklus });
    const jahresziele = d.jz.map(j => ({
      strategischesZielId: j.strategisches_ziel_id,
      knoten: {
        id: j.id, nummer: j.nummer, text: j.text, metrik: j.metrik, zielwert: j.zielwert, version: j.version, geaendertNachVorlage: j.geaendert_nach_vorlage_at,
        hauptaktivitaeten: d.ha.filter(h => h.jahresziel_id === j.id).map(h => ({ id: h.id, text: h.text, verantwortlich: person(h.verantwortlich, h.verantwortlich_name), position: h.position, version: h.version })),
        projekte: d.pr.filter(p => p.jahresziel_id === j.id).map(projekt),
      },
    }));
    return {
      jahr,
      zieljahr: d.zieljahr && zieljahrOut(d.zieljahr, write),
      strategischeZiele: d.ziele.map(s => ({
        id: s.id, handlungsfeldId: s.handlungsfeld_id, nummer: s.nummer, text: s.text, metrik: s.metrik, zielwert: s.zielwert,
        projekte: d.pr.filter(p => p.jahresziel_id === null && p.strategisches_ziel_id === s.id).map(projekt),
        jahresziele: jahresziele.filter(j => j.strategischesZielId === s.id).map(j => j.knoten),
      })),
      pruefung: {
        // jedes Ziel hat eine Metrik mit Zielwert (UC-011 Schritt 5, ZM.02.04)
        ohneMetrik: jahresziele.filter(j => !j.knoten.metrik || !j.knoten.zielwert).map(j => ({ id: j.knoten.id, nummer: j.knoten.nummer })),
        ohneUmsetzung: jahresziele.filter(j => !j.knoten.hauptaktivitaeten.length && !j.knoten.projekte.length).map(j => ({ id: j.knoten.id, nummer: j.knoten.nummer })),
      },
      can: { start: write && !d.zieljahr, write: write && d.zieljahr?.stand === 'in_arbeit', zuordnen: write },
    };
  });

  app.post('/v1/ziele/:jahr', {
    schema: {
      tags: [TAG], summary: 'Zielzyklus starten', params: JahrParams, headers: IdempotencyHeaders, body: Type.Ref('ZieljahrCreate'), response: { 201: Type.Ref('Zieljahr') },
      description: 'Legt das Zieljahr «in Arbeit» an (UC-011 Schritt 1) und öffnet allen mit `ziel:write` die Aufgabe «Jahresziele vervollständigen» mit der geplanten Vorlage als Frist; schon gestartet: 409.',
    },
  }, async (req, reply) => {
    const { jahr } = req.params as { jahr: number };
    await req.need('ziel:write');
    const body = req.body as typeof ZieljahrCreate.static;
    const who = actorOf(req);
    const row = await req.tx(async tx => {
      if (await store.getJahr(tx, jahr)) throw conflict(`Der Zielzyklus ${jahr} ist schon gestartet.`, { reason: 'gestartet' });
      const r = await store.createJahr(tx, jahr, body.vorlageBis ?? null);
      await aufgabeVervollstaendigen(tx, r);
      const snap = { id: r.id, jahr: r.jahr, stand: r.stand, vorlageBis: r.vorlage_bis, version: r.version };
      await record(tx, who, { action: 'zieljahr.created', resourceType: 'zieljahr', resourceId: r.id, data: snap, event: snap });
      return r;
    });
    return reply.code(201).header('location', `/v1/ziele/${jahr}`).header('etag', etag(row.version)).send(zieljahrOut(row, true));
  });

  app.patch('/v1/ziele/:jahr', {
    schema: {
      tags: [TAG], summary: 'Zielzyklus ändern', params: JahrParams, headers: IfMatchHeaders, body: Type.Ref('ZieljahrPatch'), response: { 200: Type.Ref('Zieljahr') },
      description: 'Geplante Vorlage an den VR; nur «in Arbeit» (sonst 409) und mit `If-Match` (412).',
    },
  }, async (req, reply) => {
    const { jahr } = req.params as { jahr: number };
    const version = requireIfMatch(req);
    await req.need('ziel:write');
    const body = req.body as typeof ZieljahrPatch.static;
    const who = actorOf(req);
    const row = await req.tx(async tx => {
      const before = await jahrBearbeitbar(tx, jahr);
      if (before.version !== version) throw preconditionFailed(before.version);
      const r = await store.updateJahr(tx, jahr, version, body.vorlageBis);
      if (!r) throw preconditionFailed(before.version);
      await nachVorlage(tx, before);
      await aufgabeVervollstaendigen(tx, r);
      await record(tx, who, { action: 'zieljahr.updated', resourceType: 'zieljahr', resourceId: r.id, data: { before: { vorlageBis: before.vorlage_bis }, after: { vorlageBis: r.vorlage_bis } }, event: { id: r.id, jahr, vorlageBis: r.vorlage_bis, version: r.version } });
      return r;
    });
    reply.header('etag', etag(row.version));
    return zieljahrOut(row, true);
  });

  // ---------------------------------------------------------------- Jahresziele (ZM.02.01, ZM.02.04; UC-011 Schritte 3, 5)

  app.get('/v1/jahresziele', {
    schema: { tags: [TAG], summary: 'Jahresziele auflisten', description: 'Sortiert nach Jahr und Nummer, Cursor-Paginierung, Filter nach Jahr und strategischem Ziel.', querystring: JahreszielQuery, response: { 200: Type.Ref('JahreszielList') } },
  }, async req => {
    await req.need('ziel:read');
    const q = req.query as { jahr?: number; strategischesZiel?: string; cursor?: string; limit?: number };
    const limit = q.limit ?? 50;
    const filter = `${q.jahr ?? ''}|${q.strategischesZiel ?? ''}`;
    const after = decodeCursor<{ j: number; s: number[]; i: string; f: string }>(q.cursor,
      v => Number.isInteger(v.j) && Array.isArray(v.s) && v.s.every(n => Number.isInteger(n)) && typeof v.i === 'string' && v.f === filter);
    const rows = await req.tx(tx => store.listJahresziele(tx, { jahr: q.jahr, strategischesZiel: q.strategischesZiel, after: after && { jahr: after.j, sort: after.s, id: after.i }, limit }));
    const page = rows.slice(0, limit);
    const write = await darfSchreiben(req);
    const last = page[page.length - 1];
    return {
      items: page.map(r => jahreszielOut(r, write)),
      nextCursor: rows.length > limit && last ? encodeCursor({ j: last.jahr, s: last.nummer_sort, i: last.id, f: filter }) : null,
    };
  });

  app.get('/v1/jahresziele/:id', {
    schema: { tags: [TAG], summary: 'Jahresziel lesen', params: IdParams, response: { 200: Type.Ref('Jahresziel') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await req.need('ziel:read');
    const row = await req.tx(tx => store.getJahresziel(tx, id));
    if (!row) throw notFound('Jahresziel');
    reply.header('etag', etag(row.version));
    return jahreszielOut(row, await darfSchreiben(req));
  });

  app.post('/v1/jahresziele', {
    schema: {
      tags: [TAG], summary: 'Jahresziel hinzufügen', headers: IdempotencyHeaders, body: Type.Ref('JahreszielCreate'), response: { 201: Type.Ref('Jahresziel') },
      description: 'Unter einem strategischen Ziel (unbekannt: 404) im gestarteten Zielzyklus «in Arbeit» (sonst 404 bzw. 409). Ohne Nummer: Nummer des strategischen Ziels und laufende Nummer («2.1.3»); Nummer schon vergeben: 409.',
    },
  }, async (req, reply) => {
    await req.need('ziel:write');
    const body = req.body as typeof JahreszielCreate.static;
    const who = actorOf(req);
    const row = await strategischesZielPruefen(() => req.tx(async tx => {
      const zj = await jahrBearbeitbar(tx, body.jahr);
      const nummer = body.nummer ?? await store.naechsteNummer(tx, body.jahr, body.strategischesZielId);
      if (!nummer) throw notFound('Strategisches Ziel');
      let r = await store.createJahresziel(tx, { ...body, nummer });
      if (await nachVorlage(tx, zj, r.id)) r = (await store.getJahresziel(tx, r.id))!;
      await record(tx, who, { action: 'jahresziel.created', resourceType: 'jahresziel', resourceId: r.id, data: jahreszielSnapshot(r), event: jahreszielSnapshot(r) });
      return r;
    }));
    return reply.code(201).header('location', `/v1/jahresziele/${row.id}`).header('etag', etag(row.version)).send(jahreszielOut(row, true));
  });

  app.patch('/v1/jahresziele/:id', {
    schema: { tags: [TAG], summary: 'Jahresziel ändern', description: 'Text, Nummer, Metrik und Zielwert; nur «in Arbeit» (409) und mit `If-Match` (412).', params: IdParams, headers: IfMatchHeaders, body: Type.Ref('JahreszielPatch'), response: { 200: Type.Ref('Jahresziel') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('ziel:write');
    const who = actorOf(req);
    const row = await req.tx(async tx => {
      const before = await store.getJahresziel(tx, id);
      if (!before) throw notFound('Jahresziel');
      const zj = await jahrBearbeitbar(tx, before.jahr);
      if (before.version !== version) throw preconditionFailed(before.version);
      let r = await store.updateJahresziel(tx, id, version, req.body as typeof JahreszielPatch.static);
      if (!r) throw preconditionFailed(before.version);
      if (await nachVorlage(tx, zj, id)) r = (await store.getJahresziel(tx, id))!;
      await record(tx, who, { action: 'jahresziel.updated', resourceType: 'jahresziel', resourceId: id, data: { before: jahreszielSnapshot(before), after: jahreszielSnapshot(r) }, event: jahreszielSnapshot(r) });
      return r;
    });
    reply.header('etag', etag(row.version));
    return jahreszielOut(row, true);
  });

  app.delete('/v1/jahresziele/:id', {
    schema: { tags: [TAG], summary: 'Jahresziel löschen', description: 'Mit seinen Hauptaktivitäten; zugeordnete Projekte bleiben beim strategischen Ziel. Nur «in Arbeit» und mit `If-Match`.', params: IdParams, headers: IfMatchHeaders, response: { 204: Type.Null({ description: 'Gelöscht' }) } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('ziel:write');
    const who = actorOf(req);
    await req.tx(async tx => {
      const before = await store.getJahresziel(tx, id);
      if (!before) throw notFound('Jahresziel');
      await jahrBearbeitbar(tx, before.jahr, { loeschen: true });
      if (before.version !== version || !(await store.removeJahresziel(tx, id, version))) throw preconditionFailed(before.version);
      await record(tx, who, { action: 'jahresziel.deleted', resourceType: 'jahresziel', resourceId: id, data: jahreszielSnapshot(before), event: { id } });
    });
    return reply.code(204).send();
  });

  // ---------------------------------------------------------------- Hauptaktivitäten (ZM.02.03; UC-011 Schritt 4)

  app.get('/v1/hauptaktivitaeten', {
    schema: { tags: [TAG], summary: 'Hauptaktivitäten eines Jahresziels', querystring: HauptaktivitaetQuery, response: { 200: Type.Ref('HauptaktivitaetList') } },
  }, async req => {
    const { jahresziel } = req.query as { jahresziel: string };
    await req.need('ziel:read');
    const rows = await req.tx(async tx => {
      if (!(await store.getJahresziel(tx, jahresziel))) throw notFound('Jahresziel');
      return store.listHauptaktivitaeten(tx, [jahresziel]);
    });
    const write = await darfSchreiben(req);
    return { items: rows.map(r => hauptaktivitaetOut(r, write)) };
  });

  app.get('/v1/hauptaktivitaeten/:id', {
    schema: { tags: [TAG], summary: 'Hauptaktivität lesen', params: IdParams, response: { 200: Type.Ref('Hauptaktivitaet') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await req.need('ziel:read');
    const row = await req.tx(tx => store.getHauptaktivitaet(tx, id));
    if (!row) throw notFound('Hauptaktivität');
    reply.header('etag', etag(row.version));
    return hauptaktivitaetOut(row, await darfSchreiben(req));
  });

  app.post('/v1/hauptaktivitaeten', {
    schema: { tags: [TAG], summary: 'Hauptaktivität hinzufügen', description: 'Unter einem Jahresziel (unbekannt: 404) mit verantwortlicher Person; nur «in Arbeit».', headers: IdempotencyHeaders, body: Type.Ref('HauptaktivitaetCreate'), response: { 201: Type.Ref('Hauptaktivitaet') } },
  }, async (req, reply) => {
    await req.need('ziel:write');
    const body = req.body as typeof HauptaktivitaetCreate.static;
    const who = actorOf(req);
    const row = await req.tx(async tx => {
      const jz = await store.getJahresziel(tx, body.jahreszielId);
      if (!jz) throw notFound('Jahresziel');
      const zj = await jahrBearbeitbar(tx, jz.jahr);
      await verantwortlichPruefen(tx, body.verantwortlich);
      const r = (await store.getHauptaktivitaet(tx, await store.createHauptaktivitaet(tx, body)))!;
      await nachVorlage(tx, zj, jz.id);
      await record(tx, who, { action: 'hauptaktivitaet.created', resourceType: 'hauptaktivitaet', resourceId: r.id, data: hauptaktivitaetSnapshot(r), event: hauptaktivitaetSnapshot(r) });
      return r;
    });
    return reply.code(201).header('location', `/v1/hauptaktivitaeten/${row.id}`).header('etag', etag(row.version)).send(hauptaktivitaetOut(row, true));
  });

  app.patch('/v1/hauptaktivitaeten/:id', {
    schema: { tags: [TAG], summary: 'Hauptaktivität ändern', description: 'Nur «in Arbeit» (409) und mit `If-Match` (412).', params: IdParams, headers: IfMatchHeaders, body: Type.Ref('HauptaktivitaetPatch'), response: { 200: Type.Ref('Hauptaktivitaet') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('ziel:write');
    const body = req.body as typeof HauptaktivitaetPatch.static;
    const who = actorOf(req);
    const row = await req.tx(async tx => {
      const before = await store.getHauptaktivitaet(tx, id);
      if (!before) throw notFound('Hauptaktivität');
      const jz = (await store.getJahresziel(tx, before.jahresziel_id))!;
      const zj = await jahrBearbeitbar(tx, jz.jahr);
      if (before.version !== version) throw preconditionFailed(before.version);
      await verantwortlichPruefen(tx, body.verantwortlich);
      if (!(await store.updateHauptaktivitaet(tx, id, version, body))) throw preconditionFailed(before.version);
      await nachVorlage(tx, zj, jz.id);
      const r = (await store.getHauptaktivitaet(tx, id))!;
      await record(tx, who, { action: 'hauptaktivitaet.updated', resourceType: 'hauptaktivitaet', resourceId: id, data: { before: hauptaktivitaetSnapshot(before), after: hauptaktivitaetSnapshot(r) }, event: hauptaktivitaetSnapshot(r) });
      return r;
    });
    reply.header('etag', etag(row.version));
    return hauptaktivitaetOut(row, true);
  });

  app.delete('/v1/hauptaktivitaeten/:id', {
    schema: { tags: [TAG], summary: 'Hauptaktivität löschen', description: 'Nur «in Arbeit» und mit `If-Match`.', params: IdParams, headers: IfMatchHeaders, response: { 204: Type.Null({ description: 'Gelöscht' }) } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('ziel:write');
    const who = actorOf(req);
    await req.tx(async tx => {
      const before = await store.getHauptaktivitaet(tx, id);
      if (!before) throw notFound('Hauptaktivität');
      const jz = (await store.getJahresziel(tx, before.jahresziel_id))!;
      await jahrBearbeitbar(tx, jz.jahr, { loeschen: true });
      if (before.version !== version || !(await store.removeHauptaktivitaet(tx, id, version))) throw preconditionFailed(before.version);
      await record(tx, who, { action: 'hauptaktivitaet.deleted', resourceType: 'hauptaktivitaet', resourceId: id, data: hauptaktivitaetSnapshot(before), event: { id } });
    });
    return reply.code(204).send();
  });

  // ---------------------------------------------------------------- Zuordnung Projekt ↔ Ziel (PP.02.05; UC-011 Schritt 4)

  app.get('/v1/projekte/:id/ziele', {
    schema: { tags: [TAG], summary: 'Ziele eines Projekts', description: 'Strategische Ziele und Jahresziele, zu denen das Projekt beiträgt, mit Adresse im Arbeitsraum Ziele (K6-2).', params: IdParams, response: { 200: Type.Ref('ProjektZielList') } },
  }, async req => {
    const { id } = req.params as { id: string };
    await req.need('ziel:read');
    const rows = await req.tx(async tx => {
      if (!(await store.projektSichtbar(tx, id))) throw notFound('Projekt');
      return store.projektZiele(tx, id);
    });
    return { items: rows.map(projektZielOut), can: { write: await req.can('ziel:write', { type: 'projekt', id }) } };
  });

  app.post('/v1/projekte/:id/ziele', {
    schema: {
      tags: [TAG], summary: 'Projekt einem Ziel zuordnen', headers: IdempotencyHeaders, params: IdParams, body: Type.Ref('ProjektZielCreate'), response: { 201: Type.Ref('ProjektZiel') },
      description: 'Zu einem strategischen Ziel oder einem Jahresziel (das strategische Ziel folgt daraus; widersprechen sie sich: 422). Unbekanntes Projekt oder Ziel: 404; schon zugeordnet: 409.',
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await req.need('ziel:read');
    await req.need('ziel:write', { type: 'projekt', id });
    const body = req.body as typeof ProjektZielCreate.static;
    const who = actorOf(req);
    const row = await strategischesZielPruefen(() => req.tx(async tx => {
      if (!(await store.projektSichtbar(tx, id))) throw notFound('Projekt');
      let strategisch = body.strategischesZielId;
      if (body.jahreszielId) {
        const jz = await store.getJahresziel(tx, body.jahreszielId);
        if (!jz) throw notFound('Jahresziel');
        if (strategisch && strategisch !== jz.strategisches_ziel_id) {
          throw invalid('Das Jahresziel gehört zu einem anderen strategischen Ziel.', [{ path: '/jahreszielId', message: 'Gehört nicht zum gewählten strategischen Ziel.' }]);
        }
        strategisch = jz.strategisches_ziel_id;
      }
      const zid = await store.zuordnen(tx, id, strategisch!, body.jahreszielId ?? null);
      const r = (await store.getProjektZiel(tx, id, zid))!;
      await record(tx, who, { action: 'ziel_projekt.created', resourceType: 'ziel_projekt', resourceId: zid, data: projektZielSnapshot(r), event: projektZielSnapshot(r) });
      return r;
    }));
    return reply.code(201).send(projektZielOut(row));
  });

  app.delete('/v1/projekte/:id/ziele/:zuordnungId', {
    schema: { tags: [TAG], summary: 'Zuordnung lösen', params: ProjektZielParams, response: { 204: Type.Null({ description: 'Gelöst' }) } },
  }, async (req, reply) => {
    const { id, zuordnungId } = req.params as { id: string; zuordnungId: string };
    await req.need('ziel:read');
    await req.need('ziel:write', { type: 'projekt', id });
    const who = actorOf(req);
    await req.tx(async tx => {
      const before = await store.getProjektZiel(tx, id, zuordnungId);
      if (!before || !(await store.zuordnungLoesen(tx, id, zuordnungId))) throw notFound('Zuordnung');
      await record(tx, who, { action: 'ziel_projekt.deleted', resourceType: 'ziel_projekt', resourceId: zuordnungId, data: projektZielSnapshot(before), event: { id: zuordnungId } });
    });
    return reply.code(204).send();
  });
}
