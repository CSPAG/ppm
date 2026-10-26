/**
 * Prüfung des Formulars wie die API (Spezifikation 5.3): Bezeichnung Pflicht, Beginn und Ende nur gemeinsam, Ende nicht
 * vor Beginn. Gleiche Feldpfade und Texte wie `zeitraumErrors` des Backends, damit Fehler vor und nach dem Senden gleich
 * aussehen.
 */

export interface ProjektValues {
  label: string;
  beschreibung: string;
  beginn: string;
  ende: string;
  classification: 0 | 1 | 2;
}

export type ProjektField = keyof ProjektValues;
export type FieldErrors = Partial<Record<ProjektField, string>>;

export const MESSAGES = {
  labelRequired: 'Gib eine Bezeichnung ein.',
  labelTooLong: 'Die Bezeichnung darf höchstens 200 Zeichen lang sein.',
  together: 'Beginn und Ende gibt es nur gemeinsam.',
  endBeforeStart: 'Das Ende liegt vor dem Beginn.',
  beschreibungTooLong: 'Die Beschreibung darf höchstens 10 000 Zeichen lang sein.',
} as const;

/** Nur der Zeitraum (wie `zeitraumErrors` der API, Pfade `/beginn` bzw. `/ende`). */
export function zeitraumErrors(v: { beginn: string | null; ende: string | null }): { path: '/beginn' | '/ende'; message: string }[] {
  if ((v.beginn === null) !== (v.ende === null)) return [{ path: v.beginn === null ? '/beginn' : '/ende', message: MESSAGES.together }];
  if (v.beginn !== null && v.ende !== null && v.ende < v.beginn) return [{ path: '/ende', message: MESSAGES.endBeforeStart }];
  return [];
}

export function validateProjekt(v: ProjektValues): FieldErrors {
  const out: FieldErrors = {};
  if (!/\S/.test(v.label)) out.label = MESSAGES.labelRequired;
  else if (v.label.length > 200) out.label = MESSAGES.labelTooLong;
  if (v.beschreibung.length > 10000) out.beschreibung = MESSAGES.beschreibungTooLong;
  for (const e of zeitraumErrors({ beginn: v.beginn || null, ende: v.ende || null })) out[e.path.slice(1) as 'beginn' | 'ende'] = e.message;
  return out;
}
