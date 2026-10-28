/**
 * Gremienweg je Gate (PS.02.02, Q8 Kap. 5.1; UC-006 A1): Welches Gremium entscheidet am Gate eines Portfolios, und läuft
 * das Geschäft zusätzlich über den SNS-VR? Schnittstelle für `sitzung` (Traktandum «via SNS-VR») und `vertrag` (Gate-Antrag).
 *
 * Regeln (fachmodell.md 2.4): Der Weg nennt das entscheidende Gremium des Portfolios (A-45) und höchstens ein zusätzliches
 * externes Gremium (SNS-VR, A-02). «via SNS-VR» heisst: Für dieses Gate ist ein zusätzliches Gremium eingetragen.
 */
import type { Tx } from '@vollholz/platform';
import * as store from './store.ts';

export interface GremiumKurz { id: string; kuerzel: string; name: string; art: store.GremiumArt }

export interface Gremienschritt {
  gate: store.GateCode;
  /** entscheidendes Gremium (PRAT, GLPA, Direktion) */
  gremium: GremiumKurz;
  /** zusätzliches Gremium ohne Benutzer (SNS-VR) oder null */
  zusaetzlich: GremiumKurz | null;
  /** Traktandum «via SNS-VR» (UC-006 A1.1) */
  viaSns: boolean;
}

const kurz = (g: store.GremiumRow): GremiumKurz => ({ id: g.id, kuerzel: g.kuerzel, name: g.name, art: g.art });

/** Aus den Zeilen des Gremienwegs und den Gremien des Portfolios die Schritte je Gate (Reihenfolge des Phasenmodells). */
export function schritte(weg: readonly store.GremienwegRow[], gremien: readonly store.GremiumRow[]): Gremienschritt[] {
  const byId = new Map(gremien.map(g => [g.id, g]));
  return weg.flatMap(w => {
    const g = byId.get(w.gremium_id);
    if (!g) return [];
    const z = w.zusaetzlich_gremium_id ? byId.get(w.zusaetzlich_gremium_id) ?? null : null;
    return [{ gate: w.gate_code, gremium: kurz(g), zusaetzlich: z && kurz(z), viaSns: z !== null }];
  });
}

/** Gremienweg eines Portfolios für alle eingetragenen Gates (Lesesicht der aufrufenden Person). */
export async function gremienwegVon(tx: Tx, portfolioId: string): Promise<Gremienschritt[]> {
  // nacheinander: eine Transaktion, eine Verbindung
  const weg = await store.gremienweg(tx, portfolioId);
  return schritte(weg, await store.listGremien(tx, { portfolioId }));
}

/** Gremienweg für ein Gate; null, wenn für das Gate kein Gremium eingetragen ist (z. B. Portfolio C ohne Pflicht-Gates, A-08). */
export async function gremienwegFuerGate(tx: Tx, portfolioId: string, gate: store.GateCode): Promise<Gremienschritt | null> {
  return (await gremienwegVon(tx, portfolioId)).find(s => s.gate === gate) ?? null;
}

/** Entscheidendes Gremium des Portfolios (A-45); null, solange keines erfasst ist. */
export async function entscheidendesGremium(tx: Tx, portfolioId: string): Promise<GremiumKurz | null> {
  const g = (await store.listGremien(tx, { portfolioId })).find(x => x.art === 'entscheidend');
  return g ? kurz(g) : null;
}

/** Geplante Sitzungstermine eines Gremiums ('YYYY-MM-DD'), optional im Zeitraum. */
export async function sitzungstermine(tx: Tx, gremiumId: string, zeitraum: { von?: string; bis?: string } = {}): Promise<string[]> {
  return (await store.termine(tx, gremiumId, zeitraum)).map(t => t.datum);
}
