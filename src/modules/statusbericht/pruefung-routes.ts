/**
 * Routen der Prüfung (BC PS.01.02–04, UC-005, Kernablauf K1; AP-E1-2) nach dem Muster der Handlungsfelder: Übersicht
 * der Periode (Posteingang der UE), Bestätigen einzeln und gesammelt (A-28), Rückfrage (A2), Einfordern (A1),
 * Terminabweichungen (Schritt 4) und Kopf für die Startseite. Abschluss der Periode in `abschluss.ts`.
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  actorOf, conflict, decodeCursor, encodeCursor, etag, forbidden, IdempotencyHeaders, IfMatchHeaders, invalid, notFound, preconditionFailed,
  requireIfMatch, type Deps, type Tx,
} from '@vollholz/platform';
import { csv, record } from '../../platform.ts';
import { aufgabe } from '../eingang/index.ts';
import { laufendePeriode } from './bericht.ts';
import { fristen, monat, PERIODE_ABGESCHLOSSEN, register, vorperiodeVon } from './pruefung.ts';
import {
  Auffaelligkeit, Auswahl, PeriodeParams, PeriodeQuery, Periodenstand, PeriodeUebersicht, PeriodeZeile, Rueckfrage, RueckfrageCreate,
  RueckfrageList, Sammelergebnis, StatusberichteKopf, Terminabweichung, TerminabweichungList, TerminabweichungQuery,
  type AuswahlIn, type PeriodeQueryIn, type PeriodeZeileOut, type RueckfrageOut, type TerminabweichungOut,
} from './pruefung-schemas.ts';
import * as pstore from './pruefung-store.ts';
import { filtern, uebersicht, zeile, type Rechte } from './pruefung-uebersicht.ts';
import { BerichtParams } from './schemas.ts';
import * as store from './store.ts';

export const TAG_MONATSABSCHLUSS = 'Monatsabschluss';
const TAG = TAG_MONATSABSCHLUSS;

const REVIEW = 'statusbericht:review';

/** Rechte der Person aus `req.can`: Prüfen an der Organisation oder am Portfolio, Abschliessen an der Organisation. */
export function rechteVon(req: FastifyRequest): Rechte {
  const cache = new Map<string, Promise<boolean>>();
  return {
    pruefen: id => {
      if (!cache.has(id)) cache.set(id, req.can(REVIEW, { type: 'portfolio', id }));
      return cache.get(id)!;
    },
    abschliessen: () => req.can('periode:close'),
  };
}

/** Adresse des Monatsabschlusses (K1, I-N5). */
export const linkMonatsabschluss = (periode: string, stand?: string) => `/portfolio/monatsabschluss?periode=${periode}${stand ? `&stand=${stand}` : ''}`;

/** Prüfrecht am Portfolio des Projekts; 404, wenn das Projekt nicht sichtbar ist (Z10). */
async function projektZumPruefen(req: FastifyRequest, tx: Tx, projektId: string): Promise<store.ProjektRow> {
  const p = await store.projekt(tx, projektId);
  if (!p) throw notFound('Projekt');
  if (!(await req.can(REVIEW, { type: 'portfolio', id: p.portfolio_id }))) throw forbidden('Statusberichte prüft die Unternehmensentwicklung.');
  return p;
}

async function offenePeriode(tx: Tx, periode: string): Promise<void> {
  if ((await store.periodeStand(tx, periode)) === 'abgeschlossen') throw conflict(PERIODE_ABGESCHLOSSEN, { reason: 'periode' });
}

/** Bericht der Periode mit passender Version und erlaubtem Stand; sonst 404, 412 bzw. 409. */
function pruefeBericht(r: store.Row | null, version: number, staende: readonly string[], text: string): store.Row {
  if (!r || r.stand === 'entwurf') throw notFound('Statusbericht');
  if (r.version !== version) throw preconditionFailed(r.version);
  if (!staende.includes(r.stand)) throw conflict(text, { reason: 'stand' });
  return r;
}

const snapshot = (r: { id: string; projekt_id: string; periode: string; stand: string; version: number }) =>
  ({ id: r.id, projektId: r.projekt_id, periode: r.periode, stand: r.stand, version: r.version });

/** Bestätigen (UC-005 Schritt 3) in der Transaktion; ohne Prüfung der Auffälligkeiten (einzeln erlaubt). */
async function bestaetigen(tx: Tx, req: FastifyRequest, r: store.Row): Promise<void> {
  const n = await pstore.pruefstand(tx, r.id, r.version, ['eingereicht'], 'geprueft');
  if (!n) throw preconditionFailed(r.version);
  await record(tx, actorOf(req), { action: 'statusbericht.reviewed', resourceType: 'statusbericht', resourceId: r.id, data: snapshot({ ...r, stand: 'geprueft', version: n.version }), event: snapshot({ ...r, stand: 'geprueft', version: n.version }) });
}

/** Einfordern (UC-005 A1): Einforderung festhalten, Aufgabe «Statusbericht erstellen» an die Projektleitung (Recht am Projekt). */
async function einfordern(tx: Tx, req: FastifyRequest, z: pstore.ZeileRow, periode: string): Promise<void> {
  await store.periodeSichern(tx, periode);
  await pstore.einfordern(tx, periode, z.projekt_id);
  const f = await fristen(tx, periode);
  await aufgabe.oeffnen(tx, {
    art: 'statusbericht.erstellen',
    bezug: berichtBezug(z.projekt_id, periode),
    empfaenger: { recht: 'statusbericht:write', ort: { typ: 'projekt', id: z.projekt_id } },
    titel: `Statusbericht ${monat(periode)} erstellen · eingefordert`,
    kontext: `${z.nummer} ${z.name}`,
    link: `/projekte/${z.nummer}/bericht?periode=${periode}`,
    frist: f.stichtag ? { datum: f.stichtag, art: 'kalendertage' } : null,
  });
  await record(tx, actorOf(req), { action: 'statusbericht.requested', resourceType: 'projekt', resourceId: z.projekt_id, data: { periode }, event: { projektId: z.projekt_id, periode } });
}

/** Bezug der Berichtsaufgabe eines Projekts in einer Periode (Einforderung; auch für die Aufgabe am 18. von AP-E1-1). */
export const berichtBezug = (projektId: string, periode: string) => ({ typ: 'statusbericht_periode', id: `${projektId}:${periode}` });

const rueckfrageOut = (r: pstore.RueckfrageRow): RueckfrageOut => ({
  id: r.id, text: r.text, antwort: r.antwort, gestelltBy: r.gestellt_by ? { id: r.gestellt_by, name: r.gestellt_name ?? 'Unbekannt' } : null,
  gestelltAt: r.gestellt_at, beantwortetAt: r.beantwortet_at,
});

const TAG_MS = 86_400_000;
const tage = (von: string, bis: string) => Math.round((Date.parse(`${bis}T00:00:00Z`) - Date.parse(`${von}T00:00:00Z`)) / TAG_MS);

/** Termine der Baseline und aufdatiert je Phase und Abschluss (PS.01.04); null ohne Baseline. */
function terminabweichung(z: pstore.ZeileRow, meilensteine: Awaited<ReturnType<typeof register>>['meilensteine']): TerminabweichungOut | null {
  const phasen = new Map<string, { baseline: string; aktuell: string }>();
  const einzelwerte: TerminabweichungOut['meilensteine'] = [];
  for (const m of meilensteine) {
    if (m.art !== 'meilenstein' && m.art !== 'lieferergebnis') continue;
    const baseline = typeof m.terminBaseline === 'string' ? m.terminBaseline : null;
    if (!baseline) continue;
    const erreicht = typeof m.erreichtAm === 'string' && !!m.erreichtAm;
    const aktuell = (typeof m.erreichtAm === 'string' && m.erreichtAm) || (typeof m.terminAktuell === 'string' && m.terminAktuell) || baseline;
    einzelwerte.push({ phase: String(m.phase), art: m.art, text: String(m.text ?? ''), erreicht, baseline, aktuell, tage: tage(baseline, aktuell) });
    const p = phasen.get(String(m.phase));
    phasen.set(String(m.phase), { baseline: !p || baseline > p.baseline ? baseline : p.baseline, aktuell: !p || aktuell > p.aktuell ? aktuell : p.aktuell });
  }
  if (!phasen.size) return null;
  const liste = [...phasen].sort(([a], [b]) => a.localeCompare(b)).map(([phase, t]) => ({ phase, ...t, tage: tage(t.baseline, t.aktuell) }));
  const baseline = liste.reduce((m, t) => (t.baseline > m ? t.baseline : m), liste[0]!.baseline);
  const aktuell = liste.reduce((m, t) => (t.aktuell > m ? t.aktuell : m), liste[0]!.aktuell);
  const abschluss = { baseline, aktuell, tage: tage(baseline, aktuell) };
  return {
    projektId: z.projekt_id, projektNummer: z.nummer, projektName: z.name, phase: z.projekt_phase,
    phasen: liste, abschluss, maxTage: Math.max(abschluss.tage, ...liste.map(t => t.tage)),
    meilensteine: einzelwerte.sort((a, b) => a.phase.localeCompare(b.phase) || a.baseline.localeCompare(b.baseline) || a.text.localeCompare(b.text)),
  };
}

export function registerPruefungRoutes(app: FastifyInstance, _deps: Deps): void {
  for (const s of [Auffaelligkeit, PeriodeZeile, Periodenstand, PeriodeUebersicht, Auswahl, Sammelergebnis, RueckfrageCreate, Rueckfrage, RueckfrageList, Terminabweichung, TerminabweichungList, StatusberichteKopf]) app.addSchema(s);

  app.get('/v1/perioden/:periode', {
    schema: {
      tags: [TAG], summary: 'Berichte der Periode (Monatsabschluss)',
      description: 'Posteingang der Unternehmensentwicklung (UC-005 Schritt 1, K1): je berichtspflichtigem Projekt Stand (eingereicht, zurückgegeben, geprüft, ausstehend; nach dem Abschluss geprüft oder nicht gemeldet), Status und Trend mit Vorperiode und Auffälligkeiten (Schritt 2). Standardsortierung «auffällig zuerst» (I-L5). Der Kopf zählt alle Projekte unabhängig vom Filter und zeigt die Wirkung des Abschlusses (I-R1). Recht `statusbericht:review` an der Organisation bzw. mit `portfolio` am Portfolio.',
      params: PeriodeParams, querystring: PeriodeQuery, response: { 200: Type.Ref('PeriodeUebersicht') },
    },
  }, async (req, reply) => {
    const { periode } = req.params as { periode: string };
    const q = req.query as PeriodeQueryIn;
    await req.need(REVIEW, q.portfolio ? { type: 'portfolio', id: q.portfolio } : undefined);
    const u = await req.tx(tx => uebersicht(tx, periode, rechteVon(req)));
    // Version der Periode für `If-Match` beim Abschluss (wie die Antwort des Abschlusses)
    reply.header('etag', etag(u.kopf.version));
    const alle = filtern(u.items, q);
    const start = decodeCursor<{ o: number }>(q.cursor, v => Number.isInteger(v.o) && (v.o as number) >= 0)?.o ?? 0;
    const limit = q.limit ?? 500;
    const items = alle.slice(start, start + limit);
    return { kopf: u.kopf, items, nextCursor: start + limit < alle.length ? encodeCursor({ o: start + limit }) : null };
  });

  app.post('/v1/perioden/:periode/bestaetigen', {
    schema: {
      tags: [TAG], summary: 'Berichte gesammelt bestätigen',
      description: 'Sammelbestätigung (UC-005 Schritt 3, I-L4, A-28): bestätigt die gewählten eingereichten Berichte ohne Auffälligkeit; Berichte mit Auffälligkeit und solche in einem anderen Stand werden übersprungen und genannt.',
      params: PeriodeParams, headers: IdempotencyHeaders, body: Type.Ref('PeriodeAuswahl'), response: { 200: Type.Ref('PeriodeSammelergebnis') },
    },
  }, async req => {
    const { periode } = req.params as { periode: string };
    await req.need(REVIEW);
    const { projekte } = req.body as AuswahlIn;
    const rechte = rechteVon(req);
    return req.tx(async tx => {
      await offenePeriode(tx, periode);
      const ergebnis = { erledigt: [] as string[], uebersprungen: [] as { projektId: string; projektNummer: string; grund: 'auffaellig' | 'stand' }[], unbekannt: 0 };
      for (const id of projekte) {
        const z = await zeile(tx, periode, id, rechte);
        if (!z) { ergebnis.unbekannt++; continue; }
        if (!z.out.can.bestaetigen) { ergebnis.uebersprungen.push({ projektId: id, projektNummer: z.row.nummer, grund: 'stand' }); continue; }
        if (z.out.auffaelligkeiten.length) { ergebnis.uebersprungen.push({ projektId: id, projektNummer: z.row.nummer, grund: 'auffaellig' }); continue; }
        const r = await store.get(tx, id, periode, { sperren: true });
        await bestaetigen(tx, req, pruefeBericht(r, z.out.version, ['eingereicht'], 'Der Bericht ist nicht eingereicht.'));
        ergebnis.erledigt.push(id);
      }
      return { ...ergebnis, kopf: (await uebersicht(tx, periode, rechte)).kopf };
    });
  });

  app.post('/v1/perioden/:periode/einfordern', {
    schema: {
      tags: [TAG], summary: 'Ausstehende Berichte einfordern',
      description: 'Einfordern (UC-005 A1, PS.01.03): die Projektleitung erhält im Eingang «Statusbericht ‹Monat› erstellen · eingefordert»; die Zeile zeigt «eingefordert am». Projekte mit eingereichtem Bericht werden übersprungen.',
      params: PeriodeParams, headers: IdempotencyHeaders, body: Type.Ref('PeriodeAuswahl'), response: { 200: Type.Ref('PeriodeSammelergebnis') },
    },
  }, async req => {
    const { periode } = req.params as { periode: string };
    await req.need(REVIEW);
    const { projekte } = req.body as AuswahlIn;
    const rechte = rechteVon(req);
    return req.tx(async tx => {
      await offenePeriode(tx, periode);
      if (periode > (await laufendePeriode(tx))) throw conflict(`Die Periode ${periode} hat noch nicht begonnen.`, { reason: 'zukunft' });
      const ergebnis = { erledigt: [] as string[], uebersprungen: [] as { projektId: string; projektNummer: string; grund: 'auffaellig' | 'stand' }[], unbekannt: 0 };
      for (const id of projekte) {
        const z = await zeile(tx, periode, id, rechte);
        if (!z) { ergebnis.unbekannt++; continue; }
        if (!z.out.can.einfordern) { ergebnis.uebersprungen.push({ projektId: id, projektNummer: z.row.nummer, grund: 'stand' }); continue; }
        await einfordern(tx, req, z.row, periode);
        ergebnis.erledigt.push(id);
      }
      return { ...ergebnis, kopf: (await uebersicht(tx, periode, rechte)).kopf };
    });
  });

  app.get('/v1/perioden/:periode/terminabweichungen', {
    schema: {
      tags: [TAG], summary: 'Terminabweichungen über alle Projekte',
      description: 'Terminabweichungen (UC-005 Schritt 4, PS.01.04): je berichtspflichtigem Projekt Baseline und aufdatierte Termine je Phase (letzter Meilenstein bzw. letztes Lieferergebnis der Phase, erreicht oder geplant) und des Abschlusses, nach grösster Verschiebung sortiert, mit den Einzelwerten (`meilensteine`). Stand der Register heute. Mit `format=csv` als Export (eine Zeile je Meilenstein bzw. Lieferergebnis).',
      params: PeriodeParams, querystring: TerminabweichungQuery, response: { 200: Type.Ref('TerminabweichungList') },
    },
  }, async (req, reply) => {
    const { periode } = req.params as { periode: string };
    const { format } = req.query as { format?: 'csv' };
    await req.need(REVIEW);
    const liste = await req.tx(async tx => {
      const items: TerminabweichungOut[] = [];
      const ohneBaseline: { projektId: string; projektNummer: string; projektName: string }[] = [];
      for (const z of await pstore.zeilen(tx, periode)) {
        const t = terminabweichung(z, (await register(tx, z.projekt_id)).meilensteine);
        if (t) items.push(t); else ohneBaseline.push({ projektId: z.projekt_id, projektNummer: z.nummer, projektName: z.name });
      }
      items.sort((a, b) => b.maxTage - a.maxTage || a.projektNummer.localeCompare(b.projektNummer));
      return { items, ohneBaseline };
    });
    if (format !== 'csv') return liste;
    // Export (Seitentyp Bericht): eine Zeile je Meilenstein bzw. Lieferergebnis, Projekte in der Reihenfolge der Seite
    const zeilen = liste.items.flatMap(t => t.meilensteine.map(m => [
      t.projektNummer, t.projektName, t.phase, m.phase, m.art === 'meilenstein' ? 'Meilenstein' : 'Lieferergebnis', m.text, m.baseline, m.aktuell, m.tage, m.erreicht ? 'ja' : 'nein',
    ]));
    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="terminabweichungen-${periode}.csv"`)
      .send(csv([['Nummer', 'Projekt', 'Phase des Projekts', 'Phase', 'Art', 'Bezeichnung', 'Baseline', 'Aktuell', 'Abweichung (Tage)', 'Erreicht'], ...zeilen]));
  });

  app.get('/v1/statusberichte/kopf', {
    schema: {
      tags: [TAG], summary: 'Kennzahlen der Statusberichte für die Startseite',
      description: 'Kopf je Rolle (docs/fachmodell.md 4.1): mit `statusbericht:review` die Periode in Arbeit mit eingereichten (zu prüfenden), zurückgegebenen, geprüften, ausstehenden und auffälligen Berichten, Stichtag und Abschluss; sonst `pruefen: null`.',
      response: { 200: Type.Ref('StatusberichteKopf') },
    },
  }, async req => {
    req.requirePrincipal();
    if (!(await req.can(REVIEW))) return { pruefen: null };
    return req.tx(async tx => {
      const laufend = await laufendePeriode(tx);
      const vor = vorperiodeVon(laufend);
      const vorStand = await pstore.periode(tx, vor);
      const periode = vorStand?.stand !== 'abgeschlossen' && (await pstore.hatBerichte(tx, vor)) ? vor : laufend;
      const u = await uebersicht(tx, periode, rechteVon(req));
      const a = u.kopf.anzahl;
      return {
        pruefen: {
          periode, eingereicht: a.eingereicht, ausstehend: a.ausstehend, auffaellig: a.auffaellig, abschlussBis: u.kopf.fristen.abschlussBis,
          projekte: a.projekte, zurueckgegeben: a.zurueckgegeben, geprueft: a.geprueft, stichtag: u.kopf.fristen.stichtag,
        },
      };
    });
  });

  // Übergänge am einzelnen Bericht (UC-005 Schritte 2–3, A2)

  const zeileAntwort = async (req: FastifyRequest, tx: Tx, periode: string, projektId: string): Promise<PeriodeZeileOut> =>
    (await zeile(tx, periode, projektId, rechteVon(req)))!.out;

  app.post('/v1/projekte/:id/berichte/:periode/pruefen', {
    schema: {
      tags: [TAG], summary: 'Statusbericht bestätigen',
      description: 'Bestätigt einen eingereichten Bericht als «geprüft» (UC-005 Schritt 3), auch mit Auffälligkeit. Rückgängig mit `…/pruefung-zuruecknehmen`, solange die Periode offen ist. Nach dem Abschluss trägt die UE so die Prüfung ungeprüfter Berichte nach (Vermerk «nicht geprüft», A-74); ist es der letzte, erledigt sich «Statusberichte prüfen».',
      params: BerichtParams, headers: Type.Composite([IfMatchHeaders, IdempotencyHeaders]), response: { 200: Type.Ref('PeriodeZeile') },
    },
  }, async (req, reply) => {
    const { id, periode } = req.params as { id: string; periode: string };
    const version = requireIfMatch(req);
    const out = await req.tx(async tx => {
      await projektZumPruefen(req, tx, id);
      const r = pruefeBericht(await store.get(tx, id, periode, { sperren: true }), version, ['eingereicht'], 'Nur eingereichte Berichte lassen sich bestätigen.');
      await bestaetigen(tx, req, r);
      // nachgetragen nach dem Abschluss (A-74): letzte ungeprüfte erledigt die Prüfaufgabe der Periode
      if ((await store.periodeStand(tx, periode)) === 'abgeschlossen' && !(await pstore.ungeprueft(tx, periode))) {
        await aufgabe.erledigen(tx, { art: 'statusbericht.pruefen', bezug: { typ: 'periode', id: periode } });
      }
      return zeileAntwort(req, tx, periode, id);
    });
    reply.header('etag', etag(out.version));
    return out;
  });

  app.post('/v1/projekte/:id/berichte/:periode/pruefung-zuruecknehmen', {
    schema: {
      tags: [TAG], summary: 'Bestätigung zurücknehmen',
      description: 'Rückgängig nach dem Bestätigen (Toast, I-R1 Stufe 1): der Bericht ist wieder «eingereicht». Nur in offener Periode.',
      params: BerichtParams, headers: IfMatchHeaders, response: { 200: Type.Ref('PeriodeZeile') },
    },
  }, async (req, reply) => {
    const { id, periode } = req.params as { id: string; periode: string };
    const version = requireIfMatch(req);
    const out = await req.tx(async tx => {
      await projektZumPruefen(req, tx, id);
      await offenePeriode(tx, periode);
      const r = pruefeBericht(await store.get(tx, id, periode, { sperren: true }), version, ['geprueft'], 'Der Bericht ist nicht bestätigt.');
      const n = await pstore.pruefstand(tx, r.id, r.version, ['geprueft'], 'eingereicht');
      if (!n) throw preconditionFailed(r.version);
      await record(tx, actorOf(req), { action: 'statusbericht.review_withdrawn', resourceType: 'statusbericht', resourceId: r.id, data: snapshot({ ...r, stand: 'eingereicht', version: n.version }), event: snapshot({ ...r, stand: 'eingereicht', version: n.version }) });
      return zeileAntwort(req, tx, periode, id);
    });
    reply.header('etag', etag(out.version));
    return out;
  });

  app.get('/v1/projekte/:id/berichte/:periode/rueckfragen', {
    schema: {
      tags: [TAG], summary: 'Rückfragen zum Statusbericht',
      description: 'Rückfragen der Unternehmensentwicklung, neueste zuerst; die offene steht im Bericht der Projektleitung zuoberst (K1 «zurückgegeben»).',
      params: BerichtParams, response: { 200: Type.Ref('RueckfrageList') },
    },
  }, async req => {
    const { id, periode } = req.params as { id: string; periode: string };
    await req.need('projekt:read', { type: 'projekt', id });
    const rows = await req.tx(async tx => {
      if (!(await store.projekt(tx, id))) throw notFound('Projekt');
      const r = await store.get(tx, id, periode);
      return r ? pstore.rueckfragen(tx, r.id) : [];
    });
    return { items: rows.map(rueckfrageOut) };
  });

  app.post('/v1/projekte/:id/berichte/:periode/rueckfragen', {
    schema: {
      tags: [TAG], summary: 'Rückfrage stellen',
      description: 'Rückfrage (UC-005 A2): gibt den eingereichten oder geprüften Bericht mit der Frage an die Projektleitung zurück (Stand «zurückgegeben»); im Eingang erhält sie «Rückfrage zum Statusbericht beantworten»; mit dem erneuten Einreichen ist die Rückfrage beantwortet und der Bericht wieder «eingereicht».',
      params: BerichtParams, headers: Type.Composite([IfMatchHeaders, IdempotencyHeaders]), body: Type.Ref('RueckfrageCreate'), response: { 200: Type.Ref('PeriodeZeile') },
    },
  }, async (req, reply) => {
    const { id, periode } = req.params as { id: string; periode: string };
    const version = requireIfMatch(req);
    const { text } = req.body as { text: string };
    const out = await req.tx(async tx => {
      const p = await projektZumPruefen(req, tx, id);
      await offenePeriode(tx, periode);
      const r = pruefeBericht(await store.get(tx, id, periode, { sperren: true }), version, ['eingereicht', 'geprueft'], 'Der Bericht ist bereits zurückgegeben.');
      if (!text.trim()) throw invalid('Angaben fehlen: Die Rückfrage ist leer. Schreibe, was unklar ist.', [{ path: '/text', message: 'Rückfrage' }]);
      const n = await pstore.pruefstand(tx, r.id, r.version, ['eingereicht', 'geprueft'], 'zurueckgegeben');
      if (!n) throw preconditionFailed(r.version);
      const rf = await pstore.rueckfrageStellen(tx, r.id, text);
      await aufgabe.oeffnen(tx, {
        art: 'statusbericht.rueckfrage',
        bezug: { typ: 'statusbericht', id: r.id },
        empfaenger: { recht: 'statusbericht:write', ort: { typ: 'projekt', id } },
        titel: `Rückfrage zum Statusbericht ${monat(periode)} beantworten`,
        kontext: `${p.nummer} ${p.name}`,
        link: `/projekte/${p.nummer}/bericht?periode=${periode}`,
      });
      await record(tx, actorOf(req), { action: 'statusbericht.returned', resourceType: 'statusbericht', resourceId: r.id, data: { ...snapshot({ ...r, stand: 'zurueckgegeben', version: n.version }), rueckfrage: rf.id, text: text.trim() }, event: { ...snapshot({ ...r, stand: 'zurueckgegeben', version: n.version }), rueckfrage: rf.id } });
      return zeileAntwort(req, tx, periode, id);
    });
    reply.header('etag', etag(out.version));
    return out;
  });
}
