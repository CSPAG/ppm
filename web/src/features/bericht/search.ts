/** Suchparameter der Seite «Bericht» (UI-13, I-N5): Periode `?periode=2026-10`; ohne Angabe die laufende Periode. */
export interface BerichtSearch { periode?: string }

const PERIODE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function validateBerichtSearch(raw: Record<string, unknown>): BerichtSearch {
  return typeof raw.periode === 'string' && PERIODE.test(raw.periode) ? { periode: raw.periode } : {};
}

/** Laufende Periode nach Schweizer Zeit. */
export const laufendePeriode = (): string => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' }).slice(0, 7);
