/**
 * Suchparameter der Seite «Strategische Ziele»: Suche `q`, offene Schublade `o=ziel:<nummer>` (Schlüssel in der
 * Oberfläche statt interner ID, I-N5; Form wie K6 `?o=ziel:2.1`) oder `o=neu` zum Anlegen. Das Präfix hält den Wert
 * nichtnumerisch, sonst schriebe der Router «2.1» als JSON mit Anführungszeichen in die Adresse.
 */
export interface ZielSearch { q?: string; o?: string }

const O = /^ziel:[0-9]{1,3}(\.[0-9]{1,3}){0,3}$/;

/** Wert von `o` zur Nummer und zurück. */
export const zielO = (nummer: string) => `ziel:${nummer}`;
export const nummerAusO = (o: string) => o.slice('ziel:'.length);

/** Prüft die rohen Suchparameter; Unbekanntes und Ungültiges fällt weg. */
export function validateZielSearch(raw: Record<string, unknown>): ZielSearch {
  const out: ZielSearch = {};
  if (typeof raw.q === 'string' && raw.q.trim()) out.q = raw.q.slice(0, 200);
  if (typeof raw.o === 'string' && (raw.o === 'neu' || O.test(raw.o))) out.o = raw.o;
  return out;
}

export type SetZielSearch = (next: Partial<Record<keyof ZielSearch, string | undefined>>, o?: { replace?: boolean }) => void;
