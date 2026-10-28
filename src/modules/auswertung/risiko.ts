/**
 * Risikolage des Portfolios (BC PC.02.02, UC-014 Schritt 2; Kernablauf K3 Schritt 7; AP-E2-3): Projekt- und
 * Portfoliorisiken mit Bewertung und Massnahme, Verteilung über Wahrscheinlichkeit × Auswirkung, Abhängigkeiten und
 * offene Eskalationen. Bewertung so, wie sie im Register steht (hoch, mittel, tief).
 */
import type { RisikolageOut, RisikolageRisikoOut } from './risiko-schemas.ts';
import type * as store from './risiko-store.ts';

export const STUFEN = ['hoch', 'mittel', 'tief'] as const;
const rang = (s: string) => STUFEN.indexOf(s as (typeof STUFEN)[number]);

export function risiko(r: store.RisikoRow): RisikolageRisikoOut {
  return {
    id: r.id, ebene: r.projekt_id ? 'projekt' : 'portfolio',
    projekt: r.projekt_id ? { id: r.projekt_id, nummer: r.nummer ?? '', name: r.name ?? '' } : null,
    portfolioId: r.portfolio_id, text: r.text, wahrscheinlichkeit: r.wahrscheinlichkeit, auswirkung: r.auswirkung,
    massnahme: r.massnahme, massnahmeStand: r.massnahme_stand, verantwortlich: r.verantwortlich,
  };
}

/** Höchste Auswirkung, dann Wahrscheinlichkeit zuerst; offene Massnahmen vor umgesetzten; sonst nach Projekt (I-L5). */
export function sortieren(rs: RisikolageRisikoOut[]): RisikolageRisikoOut[] {
  return [...rs].sort((a, b) => rang(a.auswirkung) - rang(b.auswirkung) || rang(a.wahrscheinlichkeit) - rang(b.wahrscheinlichkeit)
    || Number(a.massnahmeStand === 'umgesetzt') - Number(b.massnahmeStand === 'umgesetzt')
    || (a.projekt?.nummer ?? '').localeCompare(b.projekt?.nummer ?? '') || a.text.localeCompare(b.text));
}

/** Anzahl je Feld der 3 × 3-Matrix, alle Felder (hoch zuerst). */
export function matrix(rs: RisikolageRisikoOut[]): RisikolageOut['matrix'] {
  return STUFEN.flatMap(wahrscheinlichkeit => STUFEN.map(auswirkung => ({
    wahrscheinlichkeit, auswirkung, anzahl: rs.filter(r => r.wahrscheinlichkeit === wahrscheinlichkeit && r.auswirkung === auswirkung).length,
  })));
}

/** Risikolage aus den gelesenen Zeilen (ohne Portfolios und Zeitpunkt). */
export function lage(rows: { risiken: store.RisikoRow[]; abhaengigkeiten: store.AbhaengigkeitRow[]; eskalationen: store.EskalationRow[] }):
  Pick<RisikolageOut, 'matrix' | 'abhaengigkeiten' | 'eskalationen'> & { risiken: RisikolageRisikoOut[] } {
  const risiken = sortieren(rows.risiken.map(risiko));
  return {
    risiken, matrix: matrix(risiken),
    abhaengigkeiten: rows.abhaengigkeiten.map(a => ({
      id: a.id, von: { id: a.von_id, nummer: a.von_nummer, name: a.von_name }, zu: { id: a.zu_id, nummer: a.zu_nummer, name: a.zu_name }, text: a.text,
    })),
    eskalationen: rows.eskalationen.map(e => ({
      id: e.id, projekt: { id: e.projekt_id, nummer: e.nummer, name: e.name }, periode: e.periode, grund: e.grund, massnahme: e.massnahme, stand: e.stand,
    })),
  };
}
