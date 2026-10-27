/**
 * Suchparameter des Zielzyklus `/ziele/<jahr>` (UI-38, K6): gewähltes Ziel `o=ziel:<nummer>` – strategisches Ziel
 * («2.1») oder Jahresziel («2.1.3») über die Nummer statt der internen ID (I-N5, informationsarchitektur.md
 * «/ziele/2027?o=ziel:2.1»).
 */
export interface ZielzyklusSearch { o?: string }

const O = /^ziel:[0-9]{1,3}(\.[0-9]{1,3}){0,4}$/;

/** Jahr in der Adresse: vierstellig, 2000–2100 (sonst unbekannte Seite). */
export const ZIELJAHR = /^(20[0-9]{2}|2100)$/;

export function validateZielzyklusSearch(raw: Record<string, unknown>): ZielzyklusSearch {
  return typeof raw.o === 'string' && O.test(raw.o) ? { o: raw.o } : {};
}

export type SetZielzyklusSearch = (next: Partial<Record<keyof ZielzyklusSearch, string | undefined>>, o?: { replace?: boolean }) => void;
