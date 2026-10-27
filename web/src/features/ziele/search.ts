/**
 * Suchparameter der Seite «Strategische Ziele»: Suche `q`, offene Schublade `o` mit der Nummer des Ziels (Schlüssel in
 * der Oberfläche, keine interne ID, I-N5) oder `o=neu` zum Anlegen.
 */
export interface ZielSearch { q?: string; o?: string }

const NUMMER = /^[0-9]{1,3}(\.[0-9]{1,3}){0,3}$/;

/** Prüft die rohen Suchparameter; Unbekanntes und Ungültiges fällt weg. */
export function validateZielSearch(raw: Record<string, unknown>): ZielSearch {
  const out: ZielSearch = {};
  if (typeof raw.q === 'string' && raw.q.trim()) out.q = raw.q.slice(0, 200);
  // Router wandelt «2» ggf. in eine Zahl um
  const o = typeof raw.o === 'number' ? String(raw.o) : raw.o;
  if (typeof o === 'string' && (o === 'neu' || NUMMER.test(o))) out.o = o;
  return out;
}

export type SetZielSearch = (next: Partial<Record<keyof ZielSearch, string | undefined>>, o?: { replace?: boolean }) => void;
