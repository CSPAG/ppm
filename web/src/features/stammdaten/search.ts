/**
 * Suchparameter der Seiten «Organisation» und «Codetabellen» (I-N5): Ansicht, Suche, Filter und geöffnete Schublade
 * (`o` = ID, `o=neu` zum Anlegen; bei Codetabellen der Schlüssel der Tabelle).
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface OrganisationSearch { ansicht?: 'feiertage'; q?: string; aktiv?: 'alle'; jahr?: number; o?: string }

/** Prüft die rohen Suchparameter; Unbekanntes und Ungültiges fällt weg. */
export function validateOrganisationSearch(raw: Record<string, unknown>): OrganisationSearch {
  const out: OrganisationSearch = {};
  if (raw.ansicht === 'feiertage') out.ansicht = 'feiertage';
  if (typeof raw.q === 'string' && raw.q.trim()) out.q = raw.q.slice(0, 200);
  if (raw.aktiv === 'alle') out.aktiv = 'alle';
  const jahr = typeof raw.jahr === 'number' ? raw.jahr : typeof raw.jahr === 'string' ? Number(raw.jahr) : NaN;
  if (Number.isInteger(jahr) && jahr >= 2000 && jahr <= 2100) out.jahr = jahr;
  if (typeof raw.o === 'string' && (raw.o === 'neu' || UUID.test(raw.o))) out.o = raw.o;
  return out;
}

export type SetOrganisationSearch = (next: Partial<Record<keyof OrganisationSearch, string | number | undefined>>, o?: { replace?: boolean }) => void;

export interface CodetabellenSearch { o?: string }

export function validateCodetabellenSearch(raw: Record<string, unknown>): CodetabellenSearch {
  return typeof raw.o === 'string' && /^[a-z_]{1,40}$/.test(raw.o) ? { o: raw.o } : {};
}

export type SetCodetabellenSearch = (next: Partial<Record<keyof CodetabellenSearch, string | undefined>>, o?: { replace?: boolean }) => void;
