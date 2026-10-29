/**
 * Weiter ohne Vermerk (AP-E8-4; UC-002 A7, UC-003 A7; Master G1, A-74, UX-E12): Die Projektleitung legt den Vertrag dem
 * Gremium vor, bevor Quality-Check oder Unterschriften vorliegen, und beginnt die nächste Phase vor dem Gate-Entscheid.
 * Die Aufgaben bleiben im Eingang, bis die Vermerke nachgetragen sind; die Vermerke liest `GET …/vermerke`.
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { actorOf, conflict, IdParams, IfMatchHeaders, notFound, preconditionFailed, requireIfMatch, type Deps, type Tx } from '@vollholz/platform';
import { initialisierungsvermerke } from '../idee/index.ts';
import { projekt as projektAktion } from '../projekt/index.ts';
import { fullTx, record } from '../../platform.ts';
import { STAND_TEXT } from './entwurf.ts';
import { NAECHSTE, vorlegen } from './gate.ts';
import { TAG } from './routes.ts';
import * as store from './store.ts';
import { phaseVermerke, versionVermerke, type Vermerk } from './vermerk.ts';

const projektOrt = (id: string) => ({ type: 'projekt', id });
const VORLEGBAR: readonly store.Stand[] = ['in_pruefung', 'zur_unterzeichnung', 'unterzeichnet'];
const VermerkT = Type.Object({ art: Type.String(), text: Type.String() }, { additionalProperties: false });
const PhaseBeginnenIn = Type.Object({ phase: Type.Union(['P1', 'P2', 'P3', 'P4'].map(p => Type.Literal(p)), { description: 'Phase, die beginnt (die nächste).' }) }, { additionalProperties: false });

const VertragVermerke = Type.Object({
  projekt: Type.Array(VermerkT, { description: 'Vermerke am Projekt, z. B. «ohne Gate-Entscheid» (UC-003 A7).' }),
  versionen: Type.Array(Type.Object({ versionId: Type.String(), nummer: Type.String(), vermerke: Type.Array(VermerkT) }, { additionalProperties: false }),
    { description: 'Versionen mit offenen Vermerken (Quality-Check offen, Unterschrift offen oder verweigert).' }),
  can: Type.Object({
    phaseBeginnen: Nullable(Type.String({ description: 'Phase, die die Projektleitung jetzt beginnen kann (vor dem Gate-Entscheid); null, wenn nicht möglich.' })),
    vorlegen: Type.Union([Type.Object({ versionId: Type.String(), nummer: Type.String(), version: Type.Integer(), fehlt: Type.Array(VermerkT) }, { additionalProperties: false }), Type.Null()],
      { description: 'Version, die die Person jetzt dem Gremium vorlegen kann, mit den Vermerken, die dann offen sind (Wirkung vor dem Klick); null, wenn keine.' }),
  }, { additionalProperties: false }),
}, { $id: 'VertragVermerke', additionalProperties: false });

function Nullable<T extends ReturnType<typeof Type.String>>(t: T) { return Type.Union([t, Type.Null()]); }

/** Projekt unter der Lesesicht, sonst 404. */
async function projektSichtbar(tx: Tx, id: string): Promise<store.ProjektKopf> {
  const p = await store.projekt(tx, id);
  if (!p) throw notFound('Projekt');
  return p;
}

/** Version zur nächsten Phase, mit der die Phase beginnen kann: Erstvertrag bzw. Gate, eingereicht und nicht verworfen. */
async function versionZurNaechstenPhase(tx: Tx, p: store.ProjektKopf): Promise<store.VersionRow | null> {
  const ziel = NAECHSTE[p.phase];
  if (!ziel || p.lebenszyklus !== 'aktiv') return null;
  return (await store.versionen(tx, p.id)).find(v => v.anlass !== 'aenderung' && v.zielphase === ziel
    && ['in_pruefung', 'zur_unterzeichnung', 'unterzeichnet', 'traktandiert'].includes(v.stand)) ?? null;
}

async function vermerkeVon(req: FastifyRequest, tx: Tx, p: store.ProjektKopf) {
  const versionen = [];
  for (const v of await store.versionen(tx, p.id)) {
    const vermerke: Vermerk[] = await versionVermerke(tx, v);
    if (vermerke.length) versionen.push({ versionId: v.id, nummer: v.nummer, vermerke });
  }
  const naechste = await versionZurNaechstenPhase(tx, p);
  // vorlegbar: eingereichter Erstvertrag bzw. Gate-Vertrag, der noch nicht beim Gremium liegt
  const vorlegbar = (await store.versionen(tx, p.id)).find(v => v.anlass !== 'aenderung' && VORLEGBAR.includes(v.stand));
  return {
    projekt: [...await initialisierungsvermerke(tx, p.id), ...await phaseVermerke(tx, p)],
    versionen,
    can: {
      phaseBeginnen: naechste && await req.can('projekt:write', projektOrt(p.id)) ? naechste.zielphase : null,
      vorlegen: vorlegbar && await req.can('vertrag:write', projektOrt(p.id))
        ? { versionId: vorlegbar.id, nummer: vorlegbar.nummer, version: vorlegbar.version, fehlt: await versionVermerke(tx, { ...vorlegbar, stand: 'traktandiert' }) }
        : null,
    },
  };
}

export function registerVermerkRoutes(app: FastifyInstance, deps: Deps): void {
  app.addSchema(VertragVermerke);
  const voll = <T>(req: FastifyRequest, fn: (tx: Tx) => Promise<T>) => fullTx(deps.db, req.requirePrincipal().tenantId, fn);

  app.get('/v1/projekte/:id/vermerke', {
    schema: {
      tags: [TAG], summary: 'Offene Vermerke des Projektvertrags', params: IdParams, response: { 200: Type.Ref('VertragVermerke') },
      description: 'Was ohne Vermerk weiterging (A-74): Phase ohne Gate-Entscheid, Versionen mit offenem Quality-Check oder offenen Unterschriften; dazu, ob die Projektleitung die nächste Phase jetzt beginnen kann.',
    },
  }, async req => {
    const { id } = req.params as { id: string };
    await req.need('projekt:read', projektOrt(id));
    return req.tx(async tx => vermerkeVon(req, tx, await projektSichtbar(tx, id)));
  });

  app.post('/v1/vertragsversionen/:id/vorlegen', {
    schema: {
      tags: [TAG], summary: 'Dem Gremium vorlegen', params: IdParams, headers: IfMatchHeaders, response: { 200: Type.Ref('VertragVermerke') },
      description: 'UC-002 A7, UC-003 A7 (A-74): legt den eingereichten Erstvertrag bzw. Gate-Vertrag dem Gremium des Gremienwegs vor, auch wenn Quality-Check oder Unterschriften fehlen; die Version ist «traktandiert» mit Vermerk, die Aufgaben bleiben offen. Mit `vertrag:write` am Projekt; «in Arbeit» (Pflichtangaben nicht eingereicht): 409; ohne Gremium: 409. `If-Match` = Version der Vertragsversion.',
    },
  }, async req => {
    const { id } = req.params as { id: string };
    const erwartet = requireIfMatch(req);
    const { v, p } = await req.tx(async tx => {
      const v = await store.version(tx, id);
      const p = v && await store.projekt(tx, v.projekt_id);
      if (!v || !p) throw notFound('Vertragsversion');
      return { v, p };
    });
    await req.need('vertrag:write', projektOrt(p.id));
    if (v.anlass === 'aenderung') throw conflict('Eine Änderung entscheidet die Projektauftraggeber:in; sie geht nicht über das Gate.', { reason: 'anlass' });
    if (!VORLEGBAR.includes(v.stand)) {
      throw conflict(`Version ${v.nummer} ist ${STAND_TEXT[v.stand]}. Vorlegen lässt sich eine eingereichte Version; reiche sie zuerst ein (Pflichtangaben).`, { reason: 'stand', stand: v.stand });
    }
    if (v.version !== erwartet) throw preconditionFailed(v.version);
    const who = actorOf(req);
    // Traktandum und Stand mit voller Sicht (die Sitzung schreibt die UE), Recht oben geprüft – wie nach der letzten Unterschrift
    await voll(req, async tx => {
      const r = (await store.version(tx, id))!;
      if (!(await vorlegen(tx, { version: r, projekt: p }))) {
        throw conflict('Für dieses Gate gibt es kein Gremium im Gremienweg des Portfolios, oder das Gate ist schon traktandiert. Die Unternehmensentwicklung plant es von Hand ein.', { reason: 'gremium' });
      }
      const daten = { id, projektId: p.id, nummer: r.nummer, vorher: r.stand, vermerke: (await versionVermerke(tx, { ...r, stand: 'traktandiert' })).map(x => x.art) };
      await record(tx, who, { action: 'vertrag.submitted_to_board', resourceType: 'vertrag_version', resourceId: id, data: { ...daten, projekt: p.nummer }, event: daten });
    });
    return req.tx(async tx => vermerkeVon(req, tx, await projektSichtbar(tx, p.id)));
  });

  app.post('/v1/projekte/:id/phase-beginnen', {
    schema: {
      tags: [TAG], summary: 'Nächste Phase beginnen', params: IdParams, body: PhaseBeginnenIn, response: { 200: Type.Ref('VertragVermerke') },
      description: 'UC-002 A7, UC-003 A7 (A-74): Die Projektleitung beginnt die nächste Phase vor dem Gate-Entscheid; das Projekt trägt «ohne Gate-Entscheid», bis das Gremium freigibt. Voraussetzung: eingereichter Vertrag zur nächsten Phase (sonst 409). `phase` nennt die Phase, die beginnt; ist das Projekt schon weiter, 409 (kein doppelter Schritt). Mit `projekt:write`.',
    },
  }, async req => {
    const { id } = req.params as { id: string };
    const { phase } = req.body as { phase: string };
    await req.need('projekt:write', projektOrt(id));
    const who = actorOf(req);
    const out = await req.tx(async tx => {
      const p = await projektSichtbar(tx, id);
      const v = await versionZurNaechstenPhase(tx, p);
      if (NAECHSTE[p.phase] !== phase) throw conflict(`Das Projekt ist in ${p.phase}; ${phase} ist nicht die nächste Phase.`, { reason: 'phase', phase: p.phase });
      if (!v) throw conflict('Für die nächste Phase liegt kein eingereichter Projektvertrag vor. Reiche den Vertrag zur nächsten Phase zuerst ein.', { reason: 'vertrag' });
      await projektAktion.phaseSetzen(tx, who, id, v.zielphase);
      const daten = { projektId: id, nummer: p.nummer, von: p.phase, nach: v.zielphase, versionId: v.id, vermerk: 'ohne_gate_entscheid' };
      await record(tx, who, { action: 'projekt.phase_started', resourceType: 'projekt', resourceId: id, data: daten, event: daten });
      return vermerkeVon(req, tx, await projektSichtbar(tx, id));
    });
    return out;
  });
}
