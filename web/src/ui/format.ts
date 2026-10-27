/** Darstellung von Zeiten und Daten (de-CH). */
const dt = new Intl.DateTimeFormat('de-CH', { dateStyle: 'medium', timeStyle: 'short' });
export const fmtDateTime = (iso: string): string => dt.format(new Date(iso));
