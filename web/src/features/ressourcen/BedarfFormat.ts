/** Gemeinsame Bausteine der Seite «Bedarf» (AP-E7-2): Anteil in FTE prüfen, Bearbeitungsstand des Bedarfs. */

/** Bearbeitungsstand eines Bedarfs (darstellung.md, Familien). */
export const STAND_FAMILIE = { offen: 'wartet', teilweise: 'entwurf', gedeckt: 'positiv', ungedeckt: 'negativ' } as const;

const ANTEIL = /^(0?[.,]\d{1,2}|1([.,]0{1,2})?)$/;
/** Anteil «0,5» → 0.5; ungültig (nicht in 0,05er-Schritten zwischen 0,05 und 1) → null. */
export function anteil(text: string): number | null {
  const t = text.trim();
  if (!ANTEIL.test(t)) return null;
  const n = Number(t.replace(',', '.'));
  return n > 0 && n <= 1 && Math.abs(Math.round(n * 20) - n * 20) < 1e-9 ? n : null;
}

/** Zahl mit Dezimalkomma für Eingabefelder. */
export const zahl = (n: number) => String(n).replace('.', ',');

/** FTE mit bis zu zwei Nachkommastellen («1,25 FTE»): Anteile gehen in 0,05er-Schritten, eine Stelle würde 1,25 zu 1,3 runden. */
export const fte = (n: number) => `${n.toLocaleString('de-CH', { maximumFractionDigits: 2 }).replace('.', ',')}\u00a0FTE`;
