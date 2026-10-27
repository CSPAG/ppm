/** Suchparameter der Entscheide und Auflagen (UI-36, I-N5): Filter und geöffnete Schublade. */
export interface EntscheideSearch { gremium?: string; auflagen?: 'offen'; vr?: '1'; e?: string; auflage?: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Prüft die rohen Suchparameter; Unbekanntes fällt weg. */
export function validateEntscheideSearch(raw: Record<string, unknown>): EntscheideSearch {
  const s: EntscheideSearch = {};
  if (typeof raw.gremium === 'string' && /^[a-z0-9][a-z0-9-]{0,39}$/.test(raw.gremium)) s.gremium = raw.gremium;
  if (raw.auflagen === 'offen') s.auflagen = 'offen';
  if (raw.vr === '1' || raw.vr === 1) s.vr = '1';
  if (typeof raw.e === 'string' && UUID.test(raw.e)) s.e = raw.e;
  if (typeof raw.auflage === 'string' && UUID.test(raw.auflage)) s.auflage = raw.auflage;
  return s;
}

export type SetEntscheideSearch = (next: { [K in keyof EntscheideSearch]?: EntscheideSearch[K] | undefined }, o?: { replace?: boolean }) => void;
