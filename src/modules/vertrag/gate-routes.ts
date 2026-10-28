/**
 * Routen des Gate-Modus (AP-E3-3; fachmodell.md 5: `/vertragsversionen/:id/gate`) nach dem Muster der Handlungsfelder:
 * Lesesicht über `req.tx`, Rechte am Projekt, `can`, ETag/If-Match (412), Audit und Ereignis in derselben Transaktion.
 * Leitfragen beantwortet die Projektleitung (UC-003 Schritt 4, `vertrag:write`), die Nutzenprüfung ab P3 PL oder SP
 * (UC-003 A2, auch `vertrag:decide`), beides nur am Entwurf «in Arbeit».
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  actorOf, conflict, etag, IdParams, IfMatchHeaders, invalid, notFound, preconditionFailed, requireIfMatch, type Deps, type Tx,
} from '@vollholz/platform';
import { gremienwegFuerGate } from '../portfolio/index.ts';
import { projektdaten } from '../projektdaten/index.ts';
import { aktuellesPhasenmodell } from '../phasenmodell/index.ts';
import { record } from '../../platform.ts';
import { STAND_TEXT } from './entwurf.ts';
import { antragSichern, gateLabel, gateVon, leitfragenMitAntwort, mitNutzen, modellFuer } from './gate.ts';
import * as gs from './gate-store.ts';
import {
  GateParams, Leitfrage, LeitfrageAntwortIn, NutzenIn, VertragGate, type LeitfrageAntwortInT, type NutzenInT, type VertragGateOut,
} from './gate-schemas.ts';
import { TAG } from './routes.ts';
import * as store from './store.ts';

const projektOrt = (id: string) => ({ type: 'projekt', id });
const NACH: Readonly<Record<gs.GateCode, store.VersionRow['zielphase']>> = { P0_P1: 'P1', P1_P2: 'P2', P2_P3: 'P3', P3_P4: 'P4' };
const VON: Readonly<Record<gs.GateCode, store.VersionRow['zielphase']>> = { P0_P1: 'P0', P1_P2: 'P1', P2_P3: 'P2', P3_P4: 'P3' };

/** Version mit Gate unter der Lesesicht, sonst 404 (fremde und unbekannte IDs gleich); Änderung ohne Gate: 409. */
async function sichtbar(tx: Tx, id: string): Promise<{ v: store.VersionRow; p: store.ProjektKopf; gate: gs.GateCode }> {
  const v = await store.version(tx, id);
  const p = v && await store.projekt(tx, v.projekt_id);
  if (!v || !p) throw notFound('Vertragsversion');
  const gate = gateVon(v);
  if (!gate) throw conflict(`Version ${v.nummer} ist eine Änderung während der Phase; sie hat kein Gate.`, { reason: 'anlass' });
  return { v, p, gate };
}

const antwortOut = (a: gs.AntwortRow | null) => a && { text: a.antwort, zutreffend: a.zutreffend, version: a.version, updatedAt: a.updated_at, updatedBy: a.updated_by };

async function ausgabe(req: FastifyRequest, tx: Tx, v: store.VersionRow, p: store.ProjektKopf, gate: gs.GateCode): Promise<VertragGateOut> {
  const a = await gs.antrag(tx, v.id);
  const pg = await gs.projektGate(tx, p.id);
  const weg = pg ? await gremienwegFuerGate(tx, pg.portfolio_id, gate) : null;
  const modellId = await modellFuer(tx, a);
  const fragen = await leitfragenMitAntwort(tx, a, gate, modellId);
  // Standard-Lieferergebnisse der laufenden Phase mit Stand aus dem Register (erreicht am)
  const modell = await aktuellesPhasenmodell(tx);
  const von = VON[gate];
  const register = await projektdaten.lesen(tx, 'meilenstein', { projektId: p.id });
  const lieferergebnisse = (modell?.phasen.find(x => x.code === von)?.ergebnisse ?? []).map(e => ({
    phase: von, art: e.art, text: e.text,
    erreichtAm: (register.find(r => r.phase === von && r.text === e.text)?.erreichtAm as string | null | undefined) ?? null,
  }));
  const inArbeit = v.stand === 'in_arbeit';
  let nutzen: VertragGateOut['nutzen'] = null;
  if (mitNutzen(gate)) {
    const n = await gs.nutzen(tx, v.id);
    const kpis = await projektdaten.lesen(tx, 'kpi', { projektId: p.id });
    nutzen = {
      beurteilung: n?.beurteilung ?? '', werte: n?.werte ?? [], version: n?.version ?? 0,
      kpis: kpis.map(k => ({ id: k.id, text: String(k.text ?? ''), einheit: String(k.einheit ?? ''), zielwert: (k.zielwert as string | null) ?? null })),
    };
  }
  return {
    versionId: v.id, nummer: v.nummer, stand: v.stand,
    gate: { code: gate, label: gateLabel(gate), von, nach: NACH[gate] },
    gremienweg: weg && {
      gremium: { kuerzel: weg.gremium.kuerzel, name: weg.gremium.name },
      zusaetzlich: weg.zusaetzlich && { kuerzel: weg.zusaetzlich.kuerzel, name: weg.zusaetzlich.name }, viaSns: weg.viaSns,
    },
    leitfragen: fragen.map(f => ({ id: f.id, wertestrom: f.wertestrom, text: f.text, antwort: antwortOut(f.antwort) })),
    fortschritt: { beantwortet: fragen.filter(f => f.antwort).length, gesamt: fragen.length },
    lieferergebnisse,
    nutzen,
    entscheid: a?.ergebnis && a.entschieden_at ? { ergebnis: a.ergebnis, begruendung: a.begruendung, at: a.entschieden_at } : null,
    can: {
      antworten: inArbeit && await req.can('vertrag:write', projektOrt(p.id)),
      nutzen: inArbeit && mitNutzen(gate) && (await req.can('vertrag:write', projektOrt(p.id)) || await req.can('vertrag:decide', projektOrt(p.id))),
    },
  };
}

/** Am Entwurf «in Arbeit» änderbar (K2 Z8: in Prüfung und danach gesperrt). */
function pruefeInArbeit(v: store.VersionRow): void {
  if (v.stand !== 'in_arbeit') throw conflict(`Version ${v.nummer} ist ${STAND_TEXT[v.stand]}; Leitfragen und Nutzenprüfung sind gesperrt.`, { reason: 'stand', stand: v.stand });
}

export function registerGateRoutes(app: FastifyInstance, _deps: Deps): void {
  for (const s of [Leitfrage, VertragGate, LeitfrageAntwortIn, NutzenIn]) app.addSchema(s);

  app.get('/v1/vertragsversionen/:id/gate', {
    schema: {
      tags: [TAG], summary: 'Gate-Modus der Version', params: IdParams, response: { 200: Type.Ref('VertragGate') },
      description: 'Gate in die Zielphase mit Gremienweg (PRAT, GLPA, via SNS-VR), Leitfragen je Wertestrom mit Antworten und Fortschritt, Standard-Lieferergebnisse der '
        + 'laufenden Phase mit Stand, ab dem Gate P2–P3 die Nutzenprüfung (UC-003 Schritte 1, 4, A2) und nach dem Entscheid dessen Ergebnis. Nur Versionen mit Gate '
        + '(erster Vertrag oder Gate); eine Änderung: 409.',
    },
  }, async (req) => {
    const { id } = req.params as { id: string };
    const { v, p, gate } = await req.tx(tx => sichtbar(tx, id));
    await req.need('projekt:read', projektOrt(p.id));
    return req.tx(tx => ausgabe(req, tx, v, p, gate));
  });

  app.put('/v1/vertragsversionen/:id/gate/leitfragen/:leitfrageId', {
    schema: {
      tags: [TAG], summary: 'Leitfrage beantworten', params: GateParams, headers: IfMatchHeaders,
      body: Type.Ref('VertragLeitfrageAntwortIn'), response: { 200: Type.Ref('VertragLeitfrage') },
      description: 'Antwort der Projektleitung (UC-003 Schritt 4, PS.02.01), automatisch gespeichert; leer entfernt die Antwort. «Trifft nicht zu» mit Begründung '
        + '(`zutreffend: false`). Nur am Entwurf «in Arbeit», mit `vertrag:write`. `If-Match` = Stand der Antwort, `W/"0"` für eine neue.',
    },
  }, async (req, reply) => {
    const { id, leitfrageId } = req.params as { id: string; leitfrageId: string };
    const erwartet = requireIfMatch(req);
    const body = req.body as LeitfrageAntwortInT;
    const zutreffend = body.zutreffend ?? true;
    const text = body.antwort.trim();
    if (!zutreffend && !text) {
      throw invalid('Begründung fehlt: Begründe, warum die Leitfrage nicht zutrifft.', [{ path: '/antwort', message: 'Pflicht bei «trifft nicht zu»' }]);
    }
    const { v, p, gate } = await req.tx(tx => sichtbar(tx, id));
    await req.need('vertrag:write', projektOrt(p.id));
    const who = actorOf(req);
    const out = await req.tx(async tx => {
      pruefeInArbeit(v);
      const a = (await antragSichern(tx, v))!;
      const frage = (await leitfragenMitAntwort(tx, a, gate, a.phasenmodell_id)).find(f => f.id === leitfrageId);
      if (!frage) throw notFound('Leitfrage');
      const vorher = frage.antwort?.version ?? 0;
      if (vorher !== erwartet) throw preconditionFailed(vorher);
      if (text) {
        if (!(await gs.antwortSetzen(tx, a, leitfrageId, vorher || null, { antwort: text, zutreffend }))) throw preconditionFailed(vorher + 1);
      } else {
        await gs.antwortLoeschen(tx, a.id, leitfrageId);
      }
      const neu = (await gs.antworten(tx, a.id)).find(x => x.leitfrage_id === leitfrageId) ?? null;
      const daten = { id: a.id, versionId: v.id, projektId: p.id, gate, leitfrageId, beantwortet: !!neu, zutreffend: neu?.zutreffend ?? null };
      await record(tx, who, { action: 'gate_antrag.answered', resourceType: 'gate_antrag', resourceId: a.id, data: { ...daten, projekt: p.nummer, nummer: v.nummer }, event: daten });
      return { id: frage.id, wertestrom: frage.wertestrom, text: frage.text, antwort: antwortOut(neu), version: neu?.version ?? 0 };
    });
    reply.header('etag', etag(out.version));
    const { version: _v, ...rest } = out;
    return rest;
  });

  app.put('/v1/vertragsversionen/:id/gate/nutzen', {
    schema: {
      tags: [TAG], summary: 'Nutzenprüfung erfassen', params: IdParams, headers: IfMatchHeaders,
      body: Type.Ref('VertragNutzenIn'), response: { 200: Type.Ref('VertragGate') },
      description: 'Erreichte Werte je KPI und Beurteilung am Gate ab P3 (UC-003 A2, PC.03.02) durch Projektleitung (`vertrag:write`) oder Sponsor (`vertrag:decide`). '
        + 'Nur am Entwurf «in Arbeit»; KPIs aus dem Register des Projekts. `If-Match` = `nutzen.version`, `W/"0"` beim ersten Erfassen.',
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const erwartet = requireIfMatch(req);
    const body = req.body as NutzenInT;
    const { v, p, gate } = await req.tx(tx => sichtbar(tx, id));
    if (!(await req.can('vertrag:write', projektOrt(p.id)))) await req.need('vertrag:decide', projektOrt(p.id));
    const who = actorOf(req);
    const out = await req.tx(async tx => {
      pruefeInArbeit(v);
      if (!mitNutzen(gate)) throw conflict(`Die Nutzenprüfung gehört zum Gate ab P3; Version ${v.nummer} führt zum Gate ${gateLabel(gate)}.`, { reason: 'gate' });
      const kpis = new Set((await projektdaten.lesen(tx, 'kpi', { projektId: p.id })).map(k => k.id));
      const fehler = body.werte.flatMap((w, i) => (kpis.has(w.kpiId) ? [] : [{ path: `/werte/${i}/kpiId`, message: 'KPI nicht im Register des Projekts' }]));
      if (new Set(body.werte.map(w => w.kpiId)).size !== body.werte.length) fehler.push({ path: '/werte', message: 'KPI doppelt' });
      if (fehler.length) throw invalid('Die Werte passen nicht zu den KPIs des Projekts.', fehler);
      const vorher = (await gs.nutzen(tx, v.id))?.version ?? 0;
      if (vorher !== erwartet) throw preconditionFailed(vorher);
      const werte = body.werte.map(w => ({ kpiId: w.kpiId, wert: w.wert.trim(), bemerkung: w.bemerkung.trim() }));
      if (!(await gs.nutzenSetzen(tx, p.id, v.id, vorher || null, { beurteilung: body.beurteilung, werte }))) throw preconditionFailed(vorher + 1);
      const daten = { versionId: v.id, projektId: p.id, gate, werte: werte.length };
      await record(tx, who, { action: 'nutzenpruefung.updated', resourceType: 'vertrag_version', resourceId: v.id, data: { ...daten, projekt: p.nummer, nummer: v.nummer }, event: daten });
      return ausgabe(req, tx, v, p, gate);
    });
    reply.header('etag', etag(out.nutzen?.version ?? 0));
    return out;
  });
}
