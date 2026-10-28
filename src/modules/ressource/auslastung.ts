/**
 * Auslastung aus Angebot und Ressourcenbedarf (BC RK.02.04, UC-009 Schritt 5, UC-008 Schritt 5). Der Bedarf kommt aus
 * dem Register des Moduls projektdaten (nur über dessen `index.ts`), unter der Lesesicht der Person: gezählt wird der
 * Bedarf der Projekte, die sie sieht. Projekte, die nicht mehr aktiv sind, zählen nicht (UC-015 Schritt 6, `store.inaktiv`).
 */
import type { Tx } from '@vollholz/platform';
import { projektdaten } from '../projektdaten/index.ts';
import { hrList, mitHr } from './hr.ts';
import { auslastung, nachSzenario, type Bedarf, type Ergebnis, type SzenarioPosition } from './rechnung.ts';
import * as store from './store.ts';

/** Szenario, wie es die Priorisierung liefert (AP-E5-3). */
export interface SzenarioAnsicht { id: string; name: string; positionen: SzenarioPosition[] }

/**
 * Quelle der Szenarien: Die Priorisierung nutzt dieses Modul (fachmodell.md 1.1), nicht umgekehrt; sie meldet ihre
 * Szenarien hier an (`szenarioQuelleSetzen` beim Laden ihres Moduls). Ohne Quelle gibt es kein Szenario (404).
 */
export type SzenarioQuelle = (tx: Tx, id: string) => Promise<SzenarioAnsicht | null>;
let quelle: SzenarioQuelle | null = null;
export function szenarioQuelleSetzen(q: SzenarioQuelle | null): void { quelle = q; }
export const szenarioLesen = (tx: Tx, id: string) => (quelle ? quelle(tx, id) : Promise.resolve(null));

/** Bedarf in FTE aller sichtbaren aktiven Projekte, der den Zeitraum berührt (Grösse S/M/L ohne FTE zählt nicht, A-20). */
async function bedarf(tx: Tx, von: string, bis: string): Promise<Bedarf[]> {
  const rows = await projektdaten.bedarfImZeitraum(tx, von, bis);
  const weg = await store.inaktiv(tx, [...new Set(rows.map(r => r.projektId!))]);
  return rows.filter(r => !weg.has(r.projektId!)).map(r => ({
    id: r.id, projektId: r.projektId!, phase: String(r.phase), rolle: String(r.rolle), fte: Number(r.fte),
    vonMonat: String(r.vonMonat), bisMonat: String(r.bisMonat), gedeckt: Boolean(r.gedeckt),
  }));
}

/**
 * Auslastung im Zeitraum, optional nach Szenario-Positionen. Mit Szenario zählt der ganze Bedarf der Projekte, weil
 * eine Verschiebung des Starts Bedarf von ausserhalb in den Zeitraum bringen kann.
 */
export async function berechnen(tx: Tx, von: string, bis: string, positionen?: readonly SzenarioPosition[]): Promise<Ergebnis> {
  // festgelegtes Angebot, wo es fehlt die Kapazität laut HR-System (RK.01.02, Annahme AP-E7-2)
  const angebot = mitHr(await store.list(tx, von, bis), await hrList(tx, von, bis));
  const b = positionen ? nachSzenario(await bedarf(tx, '0001-01', '9999-12'), positionen) : await bedarf(tx, von, bis);
  return auslastung(von, bis, angebot, b);
}
