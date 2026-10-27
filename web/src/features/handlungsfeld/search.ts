/** Suchparameter der Seite «Handlungsfelder»: Suche `q`, offene Schublade `o` (ID) oder `o=neu` zum Anlegen. */
export interface HandlungsfeldSearch { q?: string; o?: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Prüft die rohen Suchparameter; Unbekanntes und Ungültiges fällt weg. */
export function validateHandlungsfeldSearch(raw: Record<string, unknown>): HandlungsfeldSearch {
  const out: HandlungsfeldSearch = {};
  if (typeof raw.q === 'string' && raw.q.trim()) out.q = raw.q.slice(0, 200);
  if (typeof raw.o === 'string' && (raw.o === 'neu' || UUID.test(raw.o))) out.o = raw.o;
  return out;
}

export type SetHandlungsfeldSearch = (next: Partial<Record<keyof HandlungsfeldSearch, string | undefined>>, o?: { replace?: boolean }) => void;
