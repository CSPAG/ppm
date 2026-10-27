/** Suchparameter der Seite «Phasenmodell»: Version `v` (ID) und gewählter Abschnitt `e` (Phase, Gate oder Teil). */
export interface PhasenmodellSearch { v?: string; e?: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ELEMENT = /^[a-z0-9_]{1,20}$/i;

/** Prüft die rohen Suchparameter; Unbekanntes und Ungültiges fällt weg. */
export function validatePhasenmodellSearch(raw: Record<string, unknown>): PhasenmodellSearch {
  const out: PhasenmodellSearch = {};
  if (typeof raw.v === 'string' && UUID.test(raw.v)) out.v = raw.v;
  if (typeof raw.e === 'string' && ELEMENT.test(raw.e)) out.e = raw.e;
  return out;
}

export type SetPhasenmodellSearch = (next: Partial<Record<keyof PhasenmodellSearch, string | undefined>>, o?: { replace?: boolean }) => void;
