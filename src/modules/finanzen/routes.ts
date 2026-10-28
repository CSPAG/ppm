/**
 * Routen der Finanzen (UC-010; BC PC.01.02, PC.01.04, PC.01.05) nach dem Muster der Handlungsfelder: Rechte über
 * `req.need`, Lesesicht über `req.tx`, Fähigkeiten `can`, If-Match (412), Audit und Ereignis in derselben Transaktion.
 * Beträge nur mit `finanzen:read` (A-33); Ereignisse ohne Beträge.
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { actorOf, conflict, etag, IdParams, IfMatchHeaders, invalid, notFound, preconditionFailed, requireIfMatch, type Deps, type Tx } from '@vollholz/platform';
import { record, SCHEMA } from '../../platform.ts';
import { abweichungenPruefen, uebergabeAufgabe } from './aufgaben.ts';
import { bedarf, finanzen, type ProjektFinanzen } from './lesen.ts';
import { periode } from './rechnen.ts';
import {
  BegruendungList, BegruendungOut, BegruendungParams, BegruendungPut, Budgetuebergabe, BudgetuebergabePut, FinanzProjekt, FinanzQuery, Finanzuebersicht,
  JahrParams, KostentraegerPut, type BudgetuebergabeOut, type BudgetuebergabePutIn, type FinanzuebersichtOut,
} from './schemas.ts';
import * as store from './store.ts';

export const TAG = 'Finanzen';
const portfolioOrt = (id: string) => ({ type: 'portfolio', id });
const projektOrt = (id: string) => ({ type: 'projekt', id });
const rund = (n: number) => Math.round(n * 100) / 100;
/** Kennung des Jahres für das Audit (wie `periodeKennung` im Statusbericht): `…-00000000JJJJ`. */
const jahrKennung = (jahr: number) => `00000000-0000-0000-0000-00000000${jahr}`;

async function portfolioKopf(tx: Tx, id: string) {
  return (await tx.query<{ id: string; schluessel: string; name: string; kategorie: string }>(`SELECT id, schluessel, name, kategorie FROM ${SCHEMA}.portfolio WHERE id = $1`, [id])).rows[0] ?? null;
}

function summe(ps: readonly ProjektFinanzen[]): FinanzuebersichtOut['summe'] {
  const s = (f: (p: ProjektFinanzen) => number | null) => rund(ps.reduce((x, p) => x + (f(p) ?? 0), 0));
  return {
    budget: s(p => p.budget), prognose: s(p => p.prognose),
    ist: ps.some(p => p.ist !== null) ? s(p => p.ist) : null,
    abweichung: s(p => p.abweichung.betrag),
  };
}

/** If-Match der Übergabe: beim ersten Speichern darf er fehlen (es gibt keine Fassung), danach Pflicht (428). */
const fassung = (req: FastifyRequest, vorhanden: boolean): number => (!vorhanden && req.headers['if-match'] === undefined ? 0 : requireIfMatch(req));

const begr = (b: store.BegruendungRow) => ({ periode: b.periode, text: b.text, version: b.version, geaendertAt: b.updated_at.toISOString() });

export function registerRoutes(app: FastifyInstance, _deps: Deps): void {
  for (const s of [FinanzProjekt, Finanzuebersicht, KostentraegerPut, BegruendungOut, BegruendungList, BegruendungPut, Budgetuebergabe, BudgetuebergabePut]) app.addSchema(s);

  /** Übersicht bzw. Abweichungen: Recht am Portfolio oder (ohne Portfolio) an der Organisation. */
  async function uebersicht(req: FastifyRequest, nurAbweichungen: boolean): Promise<FinanzuebersichtOut> {
    const q = req.query as { portfolio?: string; alle?: boolean };
    // Recht irgendwo genügt: die Lesesicht zeigt nur Projekte mit sichtbaren Beträgen (BETRAG), z. B. der PL nur ihre
    await req.needSomewhere('finanzen:read');
    const write = await req.can('finanzen:write');
    return req.tx(async tx => {
      const pf = q.portfolio ? await portfolioKopf(tx, q.portfolio) : null;
      if (q.portfolio && !pf) throw notFound('Portfolio');
      let ps = await finanzen(tx, await store.projekte(tx, { ...(q.portfolio ? { portfolioId: q.portfolio } : {}), alle: !!q.alle }));
      if (nurAbweichungen) {
        ps = ps.filter(p => (p.abweichung.betrag ?? 0) !== 0 || p.abweichung.wesentlich)
          .sort((a, b) => Number(b.abweichung.wesentlich) - Number(a.abweichung.wesentlich) || (b.abweichung.betrag ?? 0) - (a.abweichung.betrag ?? 0));
      }
      const stand = ps.map(p => p.istBis).filter((m): m is string => m !== null).sort().at(-1) ?? null;
      return { portfolio: pf, projekte: ps, summe: summe(ps), istStand: stand, ohneProjekt: write ? await store.ohneProjekt(tx) : [], can: { write } };
    });
  }

  app.get('/v1/finanzen', {
    schema: {
      tags: [TAG], summary: 'Finanzübersicht',
      description: 'Je Projekt Budget und Prognose (Register Kosten, je Phase und CAPEX/OPEX), Ist-Kosten aus dem ERP über den Kostenträger (A-16), Abweichung mit Toleranz (A-10) und letzte Begründung; Summe des Portfolios (UC-010 Schritt 2). finanzen:read an der Organisation, am Portfolio oder am Projekt; die Liste enthält nur Projekte mit sichtbaren Beträgen.',
      querystring: FinanzQuery, response: { 200: Type.Ref('Finanzuebersicht') },
    },
  }, req => uebersicht(req, false));

  app.get('/v1/finanzen/abweichungen', {
    schema: {
      tags: [TAG], summary: 'Budgetabweichungen',
      description: 'Projekte mit Abweichung der Prognose vom Budget, wesentliche zuerst, mit Verlauf der Ist-Kosten je Monat und Begründung (UC-010 Schritt 3, PC.01.04).',
      querystring: FinanzQuery, response: { 200: Type.Ref('Finanzuebersicht') },
    },
  }, req => uebersicht(req, true));

  app.put('/v1/projekte/:id/kostentraeger', {
    schema: {
      tags: [TAG], summary: 'Kostenträger zuordnen',
      description: 'Kostenträger des Projekts im ERP (A-16, UC-010 A1.1); `null` hebt die Zuordnung auf. Schon vergeben → 409. Die Ist-Kosten des Kostenträgers erscheinen ohne neuen Lauf.',
      params: IdParams, body: Type.Ref('KostentraegerPut'), response: { 200: Type.Ref('FinanzProjekt') },
    },
  }, async req => {
    const { id } = req.params as { id: string };
    await req.need('finanzen:write');
    const { nummer } = req.body as { nummer: string | null };
    const who = actorOf(req);
    return req.tx(async tx => {
      const p = await store.projekt(tx, id);
      if (!p) throw notFound('Projekt');
      if (!(await store.kostentraegerSetzen(tx, id, nummer))) throw conflict(`Der Kostenträger ${nummer} ist schon einem anderen Projekt zugeordnet.`);
      await record(tx, who, { action: 'kostentraeger.assigned', resourceType: 'projekt', resourceId: id, data: { kostentraeger: nummer }, event: { projektId: id, kostentraeger: nummer } });
      return (await finanzen(tx, [p]))[0]!;
    });
  });

  app.get('/v1/projekte/:id/abweichungsbegruendungen', {
    schema: {
      tags: [TAG], summary: 'Begründungen der Abweichungen',
      description: 'Begründungen je Periode, neueste zuerst (UC-010 Schritt 4).',
      params: IdParams, response: { 200: Type.Ref('BegruendungList') },
    },
  }, async req => {
    const { id } = req.params as { id: string };
    await req.need('finanzen:read', projektOrt(id));
    const write = (await req.can('finanzen:write')) || (await req.can('projekt:write', projektOrt(id)));
    const rows = await req.tx(async tx => {
      if (!(await store.projekt(tx, id))) throw notFound('Projekt');
      return store.begruendungen(tx, [id]);
    });
    return { items: rows.map(begr), can: { write } };
  });

  app.put('/v1/projekte/:id/abweichungsbegruendungen/:periode', {
    schema: {
      tags: [TAG], summary: 'Abweichung begründen',
      description: 'Begründung der Abweichung für die Periode festhalten bzw. ändern (UC-010 Schritt 4): PL des Projekts (projekt:write) oder FI. `If-Match` mit der gelesenen Version (`W/"0"` beim ersten Festhalten). Erledigt die Aufgabe «Abweichung klären» der laufenden Periode.',
      params: BegruendungParams, headers: IfMatchHeaders, body: Type.Ref('BegruendungPut'), response: { 200: Type.Ref('Begruendung') },
    },
  }, async (req, reply) => {
    const { id, periode: per } = req.params as { id: string; periode: string };
    const version = requireIfMatch(req);
    await req.need('finanzen:read', projektOrt(id));
    if (!(await req.can('finanzen:write')) && !(await req.can('projekt:write', projektOrt(id)))) await req.need('finanzen:write');
    if (per > periode()) throw invalid('Die Periode liegt in der Zukunft.', [{ path: '/periode', message: 'höchstens die laufende Periode' }]);
    const { text } = req.body as { text: string };
    if (!text.trim()) throw invalid('Die Begründung fehlt.', [{ path: '/text', message: 'Pflichtfeld' }]);
    const who = actorOf(req);
    const b = await req.tx(async tx => {
      const p = await store.projekt(tx, id);
      if (!p) throw notFound('Projekt');
      const alt = await store.begruendung(tx, id, per);
      if ((alt?.version ?? 0) !== version) throw preconditionFailed(alt?.version ?? 0);
      const neu = await store.begruendungSetzen(tx, id, per, text, alt ? version : null);
      if (!neu) throw preconditionFailed((await store.begruendung(tx, id, per))?.version ?? 0);
      await record(tx, who, { action: alt ? 'abweichung.justification_changed' : 'abweichung.justified', resourceType: 'projekt', resourceId: id, data: { periode: per, text: neu.text }, event: { projektId: id, periode: per } });
      await abweichungenPruefen(tx, [p]);
      return neu;
    });
    reply.header('etag', etag(b.version));
    return begr(b);
  });

  /** Übergabe lesen: berechnet mit Korrekturen (Entwurf) bzw. der übergebene Inhalt. */
  async function uebergabeLesen(tx: Tx, jahr: number, write: boolean): Promise<BudgetuebergabeOut> {
    const u = await store.uebergabe(tx, jahr);
    if (u?.stand === 'uebergeben') {
      const inhalt = u.inhalt as unknown as Pick<BudgetuebergabeOut, 'positionen' | 'summe'>;
      return { jahr, stand: 'uebergeben', version: u.version, uebergebenAt: u.uebergeben_at!.toISOString(), positionen: inhalt.positionen, summe: inhalt.summe, can: { write: false } };
    }
    const korr = new Map((u?.inhalt.korrekturen ?? []).map(k => [k.projektId, k]));
    const positionen = (await bedarf(tx, jahr)).map(b => {
      const k = korr.get(b.projektId);
      return {
        projektId: b.projektId, nummer: b.nummer, name: b.name, portfolioId: b.portfolioId,
        berechnet: { capex: b.capex, opex: b.opex },
        korrektur: k ? { capex: k.capex, opex: k.opex, bemerkung: k.bemerkung } : null,
        wert: { capex: k?.capex ?? b.capex, opex: k?.opex ?? b.opex },
        ohneTermine: b.ohneTermine,
      };
    });
    const s = (a: 'capex' | 'opex') => rund(positionen.reduce((x, p) => x + p.wert[a], 0));
    return { jahr, stand: u ? 'entwurf' : 'neu', version: u?.version ?? 0, uebergebenAt: null, positionen, summe: { capex: s('capex'), opex: s('opex') }, can: { write } };
  }

  app.get('/v1/budgetuebergaben/:jahr', {
    schema: {
      tags: [TAG], summary: 'Jahresbedarf für den Budgetprozess',
      description: 'Jahresbedarf CAPEX und OPEX je aktivem Projekt, zeitanteilig aus Prognose je Phase und Phasenterminen (A-17), mit den Korrekturen von FI; nach der Übergabe der übergebene Inhalt (UC-010 Schritt 5). finanzen:read an der Organisation.',
      params: JahrParams, response: { 200: Type.Ref('Budgetuebergabe') },
    },
  }, async (req, reply) => {
    const { jahr } = req.params as { jahr: number };
    await req.need('finanzen:read');
    const write = await req.can('finanzen:write');
    const u = await req.tx(tx => uebergabeLesen(tx, jahr, write));
    reply.header('etag', etag(u.version));
    return u;
  });

  app.put('/v1/budgetuebergaben/:jahr', {
    schema: {
      tags: [TAG], summary: 'Jahresbedarf korrigieren',
      description: 'Korrekturen von FI je Projekt (A-17: «durch FI korrigierbar»); `null` übernimmt den berechneten Wert. Ganze Liste, `If-Match` mit der gelesenen Version (beim ersten Speichern ohne oder `W/"0"`). Öffnet die Aufgabe «Jahresbedarf übergeben».',
      params: JahrParams, headers: IfMatchHeaders, body: Type.Ref('BudgetuebergabePut'), response: { 200: Type.Ref('Budgetuebergabe') },
    },
  }, async (req, reply) => {
    const { jahr } = req.params as { jahr: number };
    await req.need('finanzen:write');
    const body = req.body as BudgetuebergabePutIn;
    const who = actorOf(req);
    const u = await req.tx(async tx => {
      const alt = await store.uebergabe(tx, jahr);
      const version = fassung(req, !!alt);
      if (alt?.stand === 'uebergeben') throw conflict(`Der Jahresbedarf ${jahr} ist schon übergeben.`);
      if ((alt?.version ?? 0) !== version) throw preconditionFailed(alt?.version ?? 0);
      const ids = new Set((await store.projekte(tx)).map(p => p.id));
      const fehler = body.korrekturen.flatMap((k, i) => [
        ...(ids.has(k.projektId) ? [] : [{ path: `/korrekturen/${i}/projektId`, message: 'kein aktives Projekt' }]),
        ...(body.korrekturen.findIndex(x => x.projektId === k.projektId) !== i ? [{ path: `/korrekturen/${i}/projektId`, message: 'Projekt mehrfach genannt' }] : []),
      ]);
      if (fehler.length) throw invalid('Die Korrekturen passen nicht zu den Projekten.', fehler);
      const korrekturen = body.korrekturen.filter(k => k.capex !== null || k.opex !== null).map(k => ({ projektId: k.projektId, capex: k.capex, opex: k.opex, bemerkung: (k.bemerkung ?? '').trim() }));
      if (!(await store.korrekturenSetzen(tx, jahr, version, korrekturen))) throw preconditionFailed((await store.uebergabe(tx, jahr))?.version ?? 0);
      await record(tx, who, { action: 'budget.corrected', resourceType: 'budgetuebergabe', resourceId: jahrKennung(jahr), data: { jahr, korrekturen }, event: { jahr, anzahl: korrekturen.length } });
      await uebergabeAufgabe(tx, jahr, 'entwurf');
      return uebergabeLesen(tx, jahr, true);
    });
    reply.header('etag', etag(u.version));
    return u;
  });

  app.post('/v1/budgetuebergaben/:jahr/export', {
    schema: {
      tags: [TAG], summary: 'Jahresbedarf übergeben (Export)',
      description: 'Hält den Jahresbedarf mit den Korrekturen fest, protokolliert die Übergabe und liefert den Inhalt für den Budgetprozess (UC-010 Schritt 6). Danach unveränderlich; die ausgehende Schnittstelle «Budgetprozess · Jahresbedarf» liefert diesen Inhalt. `If-Match` mit der gelesenen Version (ohne gespeicherten Entwurf ohne oder `W/"0"`).',
      params: JahrParams, headers: IfMatchHeaders, response: { 200: Type.Ref('Budgetuebergabe') },
    },
  }, async (req, reply) => {
    const { jahr } = req.params as { jahr: number };
    await req.need('finanzen:write');
    const who = actorOf(req);
    const u = await req.tx(async tx => {
      const alt = await store.uebergabe(tx, jahr);
      const version = fassung(req, !!alt);
      if (alt?.stand === 'uebergeben') throw conflict(`Der Jahresbedarf ${jahr} ist schon übergeben.`);
      if ((alt?.version ?? 0) !== version) throw preconditionFailed(alt?.version ?? 0);
      const jetzt = await uebergabeLesen(tx, jahr, true);
      const inhalt = { korrekturen: alt?.inhalt.korrekturen ?? [], positionen: jetzt.positionen, summe: jetzt.summe };
      if (!(await store.uebergeben(tx, jahr, version, inhalt))) throw preconditionFailed((await store.uebergabe(tx, jahr))?.version ?? 0);
      await record(tx, who, { action: 'budget.handed_over', resourceType: 'budgetuebergabe', resourceId: jahrKennung(jahr), data: { jahr, summe: jetzt.summe, projekte: jetzt.positionen.length }, event: { jahr, projekte: jetzt.positionen.length } });
      await uebergabeAufgabe(tx, jahr, 'uebergeben');
      return uebergabeLesen(tx, jahr, true);
    });
    reply.header('etag', etag(u.version));
    return u;
  });
}
