/** Suchparameter der Sitzung (I-N5: `/gremien/prat/sitzungen/2026-11-12?traktandum=3`): Traktandum nach Position. */
export interface SitzungSearch { traktandum?: string }

/** Prüft die rohen Suchparameter; Unbekanntes und Ungültiges fällt weg. */
export function validateSitzungSearch(raw: Record<string, unknown>): SitzungSearch {
  const t = raw.traktandum;
  return (typeof t === 'string' || typeof t === 'number') && /^[1-9][0-9]{0,2}$/.test(String(t)) ? { traktandum: String(t) } : {};
}

export type SetSitzungSearch = (next: Partial<Record<keyof SitzungSearch, string | undefined>>, o?: { replace?: boolean }) => void;

/** Sitzungen eines Gremiums (IA «Kontext im Kopf»: `/gremien/prat/sitzungen`). */
export const gremiumSitzungenPfad = (kuerzel: string) => `/gremien/${kuerzel}/sitzungen`;

/** Adresse einer Sitzung in der Oberfläche. */
export const sitzungPfad = (kuerzel: string, datum: string) => `/gremien/${kuerzel}/sitzungen/${datum}`;
