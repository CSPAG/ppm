/**
 * Suchparameter der Seite «Zugänge» (I-N5): `o=entziehen` öffnet das Entziehen in der Schublade, `person` ist die dort
 * gewählte Person, `offen` zeigt nur Neubesetzungen mit offener Aufgabe.
 */
export interface ZugaengeSearch { o?: 'entziehen'; person?: string; offen?: boolean }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function validateZugaengeSearch(raw: Record<string, unknown>): ZugaengeSearch {
  const s: ZugaengeSearch = {};
  if (raw.o === 'entziehen') s.o = 'entziehen';
  if (s.o && typeof raw.person === 'string' && UUID.test(raw.person)) s.person = raw.person;
  if (raw.offen === true || raw.offen === 'true') s.offen = true;
  return s;
}

export type SetZugaengeSearch = (next: Partial<ZugaengeSearch>, o?: { replace?: boolean }) => void;
