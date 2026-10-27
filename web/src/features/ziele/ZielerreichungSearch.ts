/**
 * Adresse der Zielerreichung (informationsarchitektur.md: `/ziele/2026/zielerreichung?quartal=q3`, I-N5): Jahr im Pfad,
 * Quartal `q1`–`q4` als Suchparameter. Ohne Quartal gilt das zuletzt abgeschlossene (Erfassung nach Quartalsende, UC-012).
 */
export type QuartalNr = 1 | 2 | 3 | 4;
export interface ZielerreichungSearch { quartal?: `q${QuartalNr}` }

export function validateZielerreichungSearch(raw: Record<string, unknown>): ZielerreichungSearch {
  return typeof raw.quartal === 'string' && /^q[1-4]$/.test(raw.quartal) ? { quartal: raw.quartal as `q${QuartalNr}` } : {};
}

/** Zuletzt abgeschlossenes Quartal am Tag `heute` (am 27.10.2026: Q3 2026; im Januar: Q4 des Vorjahres). */
export function abgeschlossenesQuartal(heute: Date = new Date()): { jahr: number; quartal: QuartalNr } {
  const laufend = Math.floor(heute.getMonth() / 3) + 1;
  return laufend === 1 ? { jahr: heute.getFullYear() - 1, quartal: 4 } : { jahr: heute.getFullYear(), quartal: (laufend - 1) as QuartalNr };
}

/** Nachbarquartal (`schritt` −1 oder +1) über den Jahreswechsel. */
export function nachbarQuartal(jahr: number, quartal: QuartalNr, schritt: -1 | 1): { jahr: number; quartal: QuartalNr } {
  const n = jahr * 4 + (quartal - 1) + schritt;
  return { jahr: Math.floor(n / 4), quartal: ((n % 4) + 1) as QuartalNr };
}

/** Schlüssel der API («2026-Q3»). */
export const quartalSchluessel = (jahr: number, quartal: QuartalNr) => `${jahr}-Q${quartal}`;

export type SetZielerreichungQuartal = (jahr: number, quartal: QuartalNr) => void;
