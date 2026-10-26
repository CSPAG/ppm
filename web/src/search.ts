/**
 * Typisierte Suchparameter aller Routen (eine Quelle für Router, Features und Tests). Jede Route prüft ihre Parameter
 * hier; unbekannte oder ungültige Werte fallen weg, statt die Seite zu stören.
 */

const text = (v: unknown, max = 200): string | undefined => {
  if (typeof v === 'number') v = String(v);
  if (typeof v !== 'string') return undefined;
  const s = v.trim().slice(0, max);
  return s ? s : undefined;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id = (v: unknown): string | undefined => (typeof v === 'string' && UUID.test(v) ? v.toLowerCase() : undefined);
const flag = (v: unknown): true | undefined => (v === true || v === 'true' || v === 1 || v === '1' ? true : undefined);

/** Liste der Projekte: `q` Suche, `o` offenes Projekt (Schublade), `neu` Formular «Neues Projekt». */
export interface ProjekteSearch {
  q?: string;
  o?: string;
  neu?: true;
}

/**
 * Alle Schlüssel immer setzen (ungültig = `undefined`): Der Router legt das Ergebnis über die rohen Parameter, ein
 * fehlender Schlüssel liesse den ungeprüften Wert stehen.
 */
export function projekteSearch(raw: Record<string, unknown>): ProjekteSearch {
  return { q: text(raw.q), o: id(raw.o), neu: flag(raw.neu) };
}
