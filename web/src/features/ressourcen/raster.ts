/** Eingabe und Fenster des Kapazitätsrasters (rein, ohne React; getestet in KapazitaetPage.test.tsx). */

/** Eingabe einer Zelle → FTE; leer → null (Angebot entfernen); ungültig → undefined. Komma oder Punkt (de-CH). */
export function fteAusEingabe(text: string): number | null | undefined {
  const t = text.trim().replace(/[’']/g, '');
  if (!t) return null;
  if (!/^[0-9]{1,4}([.,][0-9]{1,2})?$/.test(t)) return undefined;
  const n = Number(t.replace(',', '.'));
  return n <= 1000 ? n : undefined;
}

/** FTE als Eingabetext: «0,5», «5». */
export const eingabeAusFte = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n).replace('.', ','));

/** Zeilenhöhe des Rasters in px (CSS `.res-raster tbody tr`), Grundlage der Virtualisierung (Q-L5). */
export const ZEILE = 36;
const VORLAUF = 5;

/** Sichtbare Zeilen [von, bis) bei Bildlauf `oben` und Höhe `hoehe`; ohne Höhe (z. B. vor dem Layout) 600 px. */
export function fenster(anzahl: number, oben: number, hoehe: number): { von: number; bis: number } {
  const h = hoehe > 0 ? hoehe : 600;
  return { von: Math.max(0, Math.floor(oben / ZEILE) - VORLAUF), bis: Math.min(anzahl, Math.ceil((oben + h) / ZEILE) + VORLAUF) };
}
