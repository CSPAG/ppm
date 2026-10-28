/**
 * Suchparameter der Seiten «Schnittstellen» (UI-49: `o` = ID der Schnittstelle, `o=neu` zum Einrichten) und
 * «Änderungsprotokoll» (UI-50: Objekttyp, Objekt-ID, Zeitraum als Kalendertage) nach I-N5.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATUM = /^\d{4}-\d{2}-\d{2}$/;

export interface SchnittstellenSearch { o?: string }

export function validateSchnittstellenSearch(raw: Record<string, unknown>): SchnittstellenSearch {
  return typeof raw.o === 'string' && (raw.o === 'neu' || UUID.test(raw.o)) ? { o: raw.o } : {};
}

export type SetSchnittstellenSearch = (next: Partial<Record<keyof SchnittstellenSearch, string | undefined>>, o?: { replace?: boolean }) => void;

export interface ProtokollSearch { objekt?: string; objektId?: string; von?: string; bis?: string }

export function validateProtokollSearch(raw: Record<string, unknown>): ProtokollSearch {
  const out: ProtokollSearch = {};
  if (typeof raw.objekt === 'string' && /^[a-z][a-z0-9_.-]{0,79}$/.test(raw.objekt)) out.objekt = raw.objekt;
  if (typeof raw.objektId === 'string' && UUID.test(raw.objektId)) out.objektId = raw.objektId.toLowerCase();
  for (const k of ['von', 'bis'] as const) if (typeof raw[k] === 'string' && DATUM.test(raw[k])) out[k] = raw[k];
  return out;
}

export type SetProtokollSearch = (next: Partial<Record<keyof ProtokollSearch, string | undefined>>, o?: { replace?: boolean }) => void;
