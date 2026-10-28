/**
 * Gate-Modus und Gate-Entscheid (AP-E3-3; BC PS.02.01, PS.02.02, PS.02.05, RK.02.05, PC.03.02; UC-003, UC-002
 * Schritt 11; Kernablauf K2, Entscheid in K3; fachmodell.md 2.9, 2.10):
 *
 * - Anlass `gate` (UC-003 Schritt 2): Entwurf für die nächste Phase aus der Baseline, Nummer «n.0» für die Phase Pn
 *   (K3 «Gate P1–P2 freigegeben: Version 2.0 wird Baseline»), Standard-Lieferergebnisse der Zielphase vorausgefüllt.
 * - Gate-Antrag je Version mit den Leitfragen der Version des Phasenmodells, die ab diesem Gate gilt (A-13).
 * - Nach der dritten Unterschrift (UC-002 Schritt 10, UC-003 Schritt 8) das Traktandum der Art `gate` beim Gremium aus
 *   dem Gremienweg des Portfolios (SNS-VR: «via SNS-VR» setzt `sitzung`). Bezug ist das Projekt, damit ein von der UE
 *   bereits eingeplantes Gate-Review (PP.04.05) dasselbe Traktandum bleibt.
 * - Art `gate` in der Registry der Sitzung: Gate Review Packet aus Vertrag, Business Case, Leitfragen und
 *   Hauptänderungen (UC-003 Schritt 9, K2-5) und die Folge des Entscheids in dessen Transaktion (UC-003 Schritt 10, A6):
 *   freigegeben = Baseline, Phase, Phasenmodell; mit Auflagen oder zurückgestellt = wieder «in Arbeit», Baseline bleibt;
 *   gestoppt = «abgelehnt», weiter in UC-015 (AP-E7-1 über `gateEntscheid.registrieren`). Eine Korrektur in der Sitzung
 *   (A-30) nimmt die vorige Folge zurück.
 */
import { systemActor, type Tx } from '@vollholz/platform';
import { aufgabe } from '../eingang/index.ts';
import { aktuellesPhasenmodell } from '../phasenmodell/index.ts';
import { gremienwegFuerGate } from '../portfolio/index.ts';
import { projekt as projektAktion } from '../projekt/index.ts';
import { registriereTraktandenart, traktandum, type EntscheidFolge, type Unterlage } from '../sitzung/index.ts';
import { SCHEMA } from '../../platform.ts';
// Folge eines Gremiumsentscheids mit `app.vertrag_intern` (Muster aus AP-E3-4, 200_vertrag_aenderung)
import { intern } from './aenderung.ts';
import { baselineSetzen } from './baseline.ts';
import { entwurfsanlass } from './entwurf.ts';
import * as gs from './gate-store.ts';
import { leer, PHASEN, type Phase } from './kapitel.ts';
import { unterzeichnung } from './pruefung.ts';
import * as store from './store.ts';

/** Gate in die Zielphase (fest wie im Phasenmodell); Exit P4 gehört zum Abschluss (UC-015). */
export const GATE_IN: Readonly<Partial<Record<Phase, gs.GateCode>>> = { P1: 'P0_P1', P2: 'P1_P2', P3: 'P2_P3', P4: 'P3_P4' };
const NACH: Readonly<Record<gs.GateCode, Phase>> = { P0_P1: 'P1', P1_P2: 'P2', P2_P3: 'P3', P3_P4: 'P4' };
const NAECHSTE: Readonly<Partial<Record<Phase, Phase>>> = { P0: 'P1', P1: 'P2', P2: 'P3', P3: 'P4' };

/** «P1–P2» für Texte (darstellung.md). */
export const gateLabel = (g: gs.GateCode) => g.replace('_', '–');
/** Nutzenprüfung ab dem Gate in die Stabilisierung (UC-003 A2: «Gate ab P3»). */
export const mitNutzen = (g: gs.GateCode) => g === 'P2_P3' || g === 'P3_P4';

export const ART_VORBEREITEN = 'gate.vorbereiten';
export const ERGEBNISSE = [
  { schluessel: 'freigegeben', label: 'Freigegeben' },
  { schluessel: 'mit_auflagen', label: 'Mit Auflagen freigegeben' },
  { schluessel: 'zurueckgestellt', label: 'Zurückgestellt' },
  { schluessel: 'abgelehnt', label: 'Gestoppt' },
] as const satisfies readonly { schluessel: gs.Ergebnis; label: string }[];

/** Gate einer Version: Anlass erster Vertrag oder Gate, Zielphase P1 bis P4. */
export function gateVon(v: Pick<store.VersionRow, 'anlass' | 'zielphase'>): gs.GateCode | null {
  return v.anlass === 'aenderung' ? null : GATE_IN[v.zielphase] ?? null;
}

/**
 * Antrag der Version: bestehend, sonst angelegt mit der Version des Phasenmodells in Kraft (A-13: sie gilt ab diesem
 * Gate). Nur mit Schreibrecht bzw. im Ablauf (volle Sicht); null, wenn die Version kein Gate hat.
 */
export async function antragSichern(tx: Tx, v: store.VersionRow): Promise<gs.AntragRow | null> {
  const gate = gateVon(v);
  if (!gate) return null;
  return (await gs.antrag(tx, v.id)) ?? gs.antragAnlegen(tx, { projektId: v.projekt_id, versionId: v.id, gateCode: gate, phasenmodellId: (await aktuellesPhasenmodell(tx))?.id ?? null });
}

/** Version des Phasenmodells für die Leitfragen: die des Antrags, sonst die in Kraft. */
export async function modellFuer(tx: Tx, a: gs.AntragRow | null): Promise<string | null> {
  return a?.phasenmodell_id ?? (await aktuellesPhasenmodell(tx))?.id ?? null;
}

// ---------------------------------------------------------------- Anlass «gate» (UC-003 Schritt 2)

/** Nummer «n.0» für die Zielphase Pn; ist sie vergeben (früherer Versuch abgelehnt), die nächste freie «n.k». */
export function gateNummer(zielphase: Phase, vergeben: readonly string[]): string {
  const n = PHASEN.indexOf(zielphase);
  for (let k = 0; ; k++) if (!vergeben.includes(`${n}.${k}`)) return `${n}.${k}`;
}

const ANLASS_GATE: Parameters<typeof entwurfsanlass.registrieren>[1] = {
  moeglich: ({ projekt, versionen }) => {
    if (projekt.lebenszyklus !== 'aktiv') return `Das Projekt ${projekt.nummer} ist nicht aktiv; ein Gate ist nicht möglich.`;
    const ziel = NAECHSTE[projekt.phase];
    if (!ziel) return projekt.phase === 'P4' ? 'Das Projekt ist in P4; der Abschluss folgt über das Exit-Gate (Projektakte › Abschluss).' : 'Für diese Phase gibt es kein Gate.';
    if (!versionen.some(v => v.baseline)) return 'Das Projekt hat noch keinen freigegebenen Projektvertrag; zuerst wird der erste Vertrag freigegeben.';
    return null;
  },
  plan: async ({ tx, modell, projekt, versionen }) => {
    const basis = versionen.find(v => v.baseline)!;
    const zielphase = NAECHSTE[projekt.phase]!;
    const kapitel: Record<number, Record<string, unknown>> = Object.fromEntries((await store.kapitel(tx, basis.id)).map(k => [k.kapitel, k.inhalt]));
    // Standard-Lieferergebnisse und -Meilensteine der Zielphase (I-F2, UC-003 Schritt 1), soweit sie noch fehlen
    const k7 = { ...leer(7), ...(kapitel[7] ?? {}) } as Record<string, unknown> & { meilensteine: { phase: string; text: string }[] };
    const da = new Set(k7.meilensteine.map(m => `${m.phase}|${m.text}`));
    const neu = (modell?.phasen.find(p => p.code === zielphase)?.ergebnisse ?? [])
      .filter(e => !da.has(`${zielphase}|${e.text}`))
      .map(e => ({ registerId: null, phase: zielphase, art: e.art, text: e.text, termin: null }));
    kapitel[7] = { ...k7, meilensteine: [...k7.meilensteine, ...neu] };
    return { nummer: gateNummer(zielphase, versionen.map(v => v.nummer)), zielphase, basisVersionId: basis.id, kapitel };
  },
};

// ---------------------------------------------------------------- Traktandum nach der dritten Unterschrift

const titelVon = (g: gs.GateCode, p: Pick<store.ProjektKopf, 'nummer' | 'name'>) => `Gate ${gateLabel(g)} ${p.nummer} ${p.name}`;
const antragVon = (g: gs.GateCode, v: Pick<store.VersionRow, 'nummer'>) => `Projektvertrag Version ${v.nummer} und Phase ${NACH[g]} freigeben`;

/**
 * Vollständig unterzeichnet (UC-002 Schritt 10, UC-003 Schritt 8): Traktandum beim Gremium des Gremienwegs, sonst beim
 * entscheidenden Gremium des Portfolios (A-45); die Version ist «traktandiert». Ohne Gremium (Portfolio C ohne
 * Pflicht-Gates, A-08) bleibt sie «unterzeichnet»; die UE traktandiert dann von Hand.
 */
async function traktandieren(tx: Tx, o: { version: store.VersionRow; projekt: store.ProjektKopf }): Promise<void> {
  const gate = gateVon(o.version);
  const pg = gate ? await gs.projektGate(tx, o.projekt.id) : null;
  if (!gate || !pg) return;
  const a = await antragSichern(tx, o.version);
  const weg = await gremienwegFuerGate(tx, pg.portfolio_id, gate);
  let id: string;
  try {
    id = await traktandum.vorschlagen(tx, {
      art: 'gate', bezug: { typ: 'projekt', id: o.projekt.id }, projektId: o.projekt.id, ...(weg ? { gremiumId: weg.gremium.id } : {}),
      titel: titelVon(gate, o.projekt), antrag: antragVon(gate, o.version),
    });
  } catch (err) {
    if ((err as { status?: number }).status === 409) return;
    throw err;
  }
  await gs.traktandiert(tx, a!.id, id);
  await store.standSetzen(tx, o.version.id, null, ['unterzeichnet'], 'traktandiert');
  await aufgabe.erledigen(tx, { art: ART_VORBEREITEN, bezug: { typ: 'projekt', id: o.projekt.id } });
}


// ---------------------------------------------------------------- Art «gate» in der Registry der Sitzung

/** Laufender Entwurf mit Gate des Projekts (Bezug des Traktandums ist das Projekt). */
async function gateVersion(tx: Tx, projektId: string): Promise<{ v: store.VersionRow; a: gs.AntragRow | null; gate: gs.GateCode } | null> {
  const v = (await store.versionen(tx, projektId)).find(x => store.ENTWURF.includes(x.stand));
  const gate = v ? gateVon(v) : null;
  return v && gate ? { v, a: await gs.antrag(tx, v.id), gate } : null;
}

/** Leitfragen mit Antworten (Reihenfolge des Phasenmodells). */
export async function leitfragenMitAntwort(tx: Tx, a: gs.AntragRow | null, gate: gs.GateCode, modellId: string | null) {
  const fragen = await gs.leitfragen(tx, modellId, gate);
  const antworten = new Map((a ? await gs.antworten(tx, a.id) : []).map(x => [x.leitfrage_id, x]));
  return fragen.map(f => ({ ...f, antwort: antworten.get(f.id) ?? null }));
}

/** Letzter bestätigter Quality-Check der Version (UC-006 A2: Unterlagen erst mit bestandenem Check). */
async function qualityCheckBestanden(tx: Tx, versionId: string): Promise<Date | null> {
  return (await tx.query<{ at: Date }>(
    `SELECT at FROM ${SCHEMA}.quality_check WHERE version_id = $1 AND ergebnis = 'bestaetigt' ORDER BY at DESC LIMIT 1`, [versionId])).rows[0]?.at ?? null;
}

const kurz = (d: Date) => new Intl.DateTimeFormat('de-CH', { timeZone: 'Europe/Zurich', day: 'numeric', month: 'numeric' }).format(d);

/**
 * Gate Review Packet (UC-003 Schritt 9, K2-5): aus dem System zusammengestellt, ohne Dateien von Hand. Bereit, sobald
 * die Version unterzeichnet ist; mit Stand des Quality-Checks.
 */
export async function packet(tx: Tx, projektId: string): Promise<Unterlage[]> {
  const g = await gateVersion(tx, projektId);
  if (!g) return [];
  const { v, a, gate } = g;
  const kapitel = await store.kapitel(tx, v.id);
  const inhalt = (nr: number) => kapitel.find(k => k.kapitel === nr)?.inhalt ?? {};
  const fragen = await leitfragenMitAntwort(tx, a, gate, await modellFuer(tx, a));
  const qc = await qualityCheckBestanden(tx, v.id);
  const unterzeichnet = ['unterzeichnet', 'traktandiert', 'abgenommen'].includes(v.stand);
  const k3 = inhalt(3), k9 = inhalt(9);
  return [{
    art: 'packet', titel: `Gate Review Packet ${gateLabel(gate)} · Version ${v.nummer}`, bereit: unterzeichnet,
    qualityCheck: qc && unterzeichnet ? 'bestanden' : 'offen',
    hinweis: qc ? `Quality-Check bestanden ${kurz(qc)}` : 'Quality-Check offen',
    inhalt: {
      version: v.nummer, gate, zielphase: v.zielphase,
      kapitelGeaendert: kapitel.filter(k => k.geaendert).map(k => k.kapitel),
      businessCase: { ziele: k3.ziele ?? '', nutzen: k3.nutzen ?? '', kpis: k3.kpis ?? [], kosten: k9.kosten ?? [] },
      leitfragen: fragen.map(f => ({ wertestrom: f.wertestrom, text: f.text, antwort: f.antwort?.antwort ?? null, zutreffend: f.antwort?.zutreffend ?? null })),
      hauptaenderungen: v.hauptaenderungen, andere: v.andere,
      nutzenpruefung: mitNutzen(gate) ? await gs.nutzen(tx, v.id) : null,
    },
  }];
}

/** Nach dem Gate-Entscheid (z. B. Abschluss bei «Gestoppt», AP-E7-1): registriert beim Laden des Pakets. */
export interface GateEntscheid { projektId: string; versionId: string; gate: gs.GateCode; ergebnis: gs.Ergebnis; begruendung: string }
type BeiGateEntscheid = (tx: Tx, e: GateEntscheid) => Promise<void>;
const nachEntscheid: BeiGateEntscheid[] = [];
export const gateEntscheid = {
  /** Verhalten in der Transaktion des Gate-Entscheids (nach der Folge dieses Pakets). */
  registrieren(fn: BeiGateEntscheid) { nachEntscheid.push(fn); },
};

/** Aufgabe «Projektvertrag überarbeiten» an die Projektleitung (fachmodell.md 4.2, UC-003 A6). */
async function ueberarbeiten(tx: Tx, v: store.VersionRow, p: store.ProjektKopf, grund: string): Promise<void> {
  for (const person of await gs.projektleitung(tx, p.id)) {
    await aufgabe.oeffnen(tx, {
      art: 'vertrag.ueberarbeiten', bezug: { typ: 'vertrag_version', id: v.id }, empfaenger: { person },
      titel: `Projektvertrag ${p.name} überarbeiten`, kontext: `${p.nummer} ${p.name} · Version ${v.nummer} · ${grund}`,
      link: `/projekte/${p.nummer}/vertrag?version=entwurf`,
    });
  }
}

/** Folge eines früheren Entscheids zurücknehmen (Korrektur in der Sitzung, A-30). */
async function zuruecknehmen(tx: Tx, a: gs.AntragRow, v: store.VersionRow, p: store.ProjektKopf): Promise<void> {
  const who = systemActor('system');
  if (a.ergebnis === 'freigegeben') {
    await gs.abnahmeZuruecknehmen(tx, v.id);
    if (a.vorher_baseline_id) await gs.baselineWiederherstellen(tx, a.vorher_baseline_id);
    if (a.vorher_phase && a.vorher_phase !== p.phase) await projektAktion.phaseSetzen(tx, who, p.id, a.vorher_phase, a.vorher_phasenmodell_id);
  } else {
    await store.standSetzen(tx, v.id, null, ['in_arbeit', 'abgelehnt'], 'traktandiert');
    await aufgabe.entfallen(tx, { art: 'vertrag.ueberarbeiten', bezug: { typ: 'vertrag_version', id: v.id } });
  }
  await gs.entscheidZuruecknehmen(tx, a.id);
}

/**
 * Folge des Gate-Entscheids (fachmodell.md 2.9; UC-003 Schritt 10, A6; UC-002 Schritt 11) in der Transaktion des
 * Entscheids; bei «via SNS-VR» ruft `sitzung` sie erst mit dem Entscheid des SNS-VR auf (UC-006 A1).
 */
export async function beiEntscheid(tx: Tx, f: EntscheidFolge): Promise<void> {
  if (f.bezug.typ !== 'projekt') return;
  await intern(tx, async () => {
    const a0 = await gs.antragZumTraktandum(tx, f.bezug.id, f.traktandumId);
    if (!a0) return;
    let v = await store.version(tx, a0.version_id);
    let p = await store.projekt(tx, a0.projekt_id);
    if (!v || !p) return;
    if (a0.stand === 'entschieden') {
      if (a0.ergebnis === f.ergebnis) return;
      await zuruecknehmen(tx, a0, v, p);
      v = (await store.version(tx, v.id))!;
      p = (await store.projekt(tx, p.id))!;
    }
    if (v.stand !== 'traktandiert') return;
    const ergebnis = f.ergebnis as gs.Ergebnis;
    const pg = (await gs.projektGate(tx, p.id))!;
    const vorherBaseline = (await store.versionen(tx, p.id)).find(x => x.baseline)?.id ?? null;
    const who = systemActor('system');
    if (ergebnis === 'freigegeben') {
      await baselineSetzen(tx, who, v.id);
      // Phase der Zielphase und Version des Phasenmodells ab diesem Gate (A-13); erster Vertrag einer späteren Phase: nur Baseline
      const modell = a0.phasenmodell_id ?? pg.phasenmodell_id;
      if (v.zielphase !== p.phase || modell !== pg.phasenmodell_id) await projektAktion.phaseSetzen(tx, who, p.id, v.zielphase, modell);
      await aufgabe.erledigen(tx, { art: ART_VORBEREITEN, bezug: { typ: 'projekt', id: p.id } });
    } else if (ergebnis === 'abgelehnt') {
      await store.standSetzen(tx, v.id, null, ['traktandiert'], 'abgelehnt');
    } else {
      await store.standSetzen(tx, v.id, null, ['traktandiert'], 'in_arbeit');
      const grund = ergebnis === 'mit_auflagen' ? `Gate ${gateLabel(a0.gate_code)} mit Auflagen freigegeben` : `Gate ${gateLabel(a0.gate_code)} zurückgestellt`;
      const b = f.begruendung.trim().replace(/\s+/g, ' ');
      await ueberarbeiten(tx, v, p, b ? `${grund}: ${b.length > 140 ? `${b.slice(0, 139)}…` : b}` : grund);
    }
    await gs.entschieden(tx, a0.id, {
      ergebnis, begruendung: f.begruendung, sitzungId: null,
      vorherBaselineId: ergebnis === 'freigegeben' ? vorherBaseline : null, vorherPhase: pg.phase, vorherPhasenmodellId: pg.phasenmodell_id,
    });
    for (const fn of nachEntscheid) await fn(tx, { projektId: p.id, versionId: v.id, gate: a0.gate_code, ergebnis, begruendung: f.begruendung });
  });
}

/**
 * Anlass `gate`, Traktandieren nach der letzten Unterschrift und Art `gate` in der Registry der Sitzung (fachmodell.md
 * 2.9, 7.2); einmal beim Laden des Moduls.
 */
export function registriereGate(): void {
  entwurfsanlass.registrieren('gate', ANLASS_GATE);
  unterzeichnung.registrieren(traktandieren);
  registriereTraktandenart({
    art: 'gate',
    label: 'Gate-Review',
    dauerMin: 35,
    ergebnisse: ERGEBNISSE,
    zusammenfassung: async (tx, bezug) => {
      const p = bezug.typ === 'projekt' ? await store.projekt(tx, bezug.id) : null;
      if (!p) return null;
      const g = await gateVersion(tx, p.id);
      if (g) return { titel: titelVon(g.gate, p), antrag: antragVon(g.gate, g.v) };
      // eingeplant, bevor der Entwurf besteht (PP.04.05): das nächste Gate aus der Phase
      const ziel = NAECHSTE[p.phase];
      const gate = ziel ? GATE_IN[ziel] : undefined;
      return gate ? { titel: titelVon(gate, p), antrag: `Phase ${NACH[gate]} freigeben` } : null;
    },
    unterlagen: async (tx, bezug) => (bezug.typ === 'projekt' ? packet(tx, bezug.id) : []),
    beiEntscheid,
  });
}
