/** Suchparameter der Startseite «Eingang» (I-N5): Filter `frist` (`/eingang?filter=frist`, informationsarchitektur.md). */
export interface EingangSearch { filter?: 'frist' }

export function validateEingangSearch(raw: Record<string, unknown>): EingangSearch {
  return raw.filter === 'frist' ? { filter: 'frist' } : {};
}

export type SetEingangSearch = (next: Partial<EingangSearch>, o?: { replace?: boolean }) => void;
