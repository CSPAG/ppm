/** Darstellung von Datum und Zeitraum (Schweizer Schreibweise). */
const DATE = new Intl.DateTimeFormat('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
const DATETIME = new Intl.DateTimeFormat('de-CH', { dateStyle: 'medium', timeStyle: 'short' });

/** `2026-03-01` → `01.03.2026`. */
export const fmtDay = (iso: string): string => DATE.format(new Date(`${iso}T00:00:00Z`));
export const fmtDateTime = (iso: string): string => DATETIME.format(new Date(iso));

export function fmtZeitraum(beginn: string | null, ende: string | null): string {
  return beginn && ende ? `${fmtDay(beginn)} – ${fmtDay(ende)}` : 'Kein Zeitraum';
}
