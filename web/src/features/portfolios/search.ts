/**
 * Suchparameter der Seite «Portfolios und Gremien» (I-N5, keine internen IDs): offenes Portfolio `o` (Schlüssel, z. B.
 * `transformation`) oder `o=neu`; darin offenes Gremium `g` (Kürzel, z. B. `prat`) oder `g=neu`.
 */
export interface PortfoliosSearch { o?: string; g?: string }

const KEY = /^[a-z0-9][a-z0-9-]{0,39}$/;

/** Prüft die rohen Suchparameter; Unbekanntes und Ungültiges fällt weg, ein Gremium nur mit Portfolio. */
export function validatePortfoliosSearch(raw: Record<string, unknown>): PortfoliosSearch {
  const out: PortfoliosSearch = {};
  if (typeof raw.o === 'string' && KEY.test(raw.o)) out.o = raw.o;
  if (out.o && out.o !== 'neu' && typeof raw.g === 'string' && KEY.test(raw.g)) out.g = raw.g;
  return out;
}

export type SetPortfoliosSearch = (next: Partial<Record<keyof PortfoliosSearch, string | undefined>>, o?: { replace?: boolean }) => void;
