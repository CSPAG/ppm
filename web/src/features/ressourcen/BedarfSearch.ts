/** Suchparameter der Seite «Bedarf» (UI-25; I-N5: Zeitraum, Filter, Ansicht und geöffneter Bedarf in der Adresse). */

export type BedarfStand = 'offen' | 'teilweise' | 'gedeckt' | 'ungedeckt';
export const STAENDE: readonly BedarfStand[] = ['offen', 'teilweise', 'ungedeckt', 'gedeckt'];

export interface BedarfSearch {
  von?: string;
  bis?: string;
  /** Stand-Filter; ohne Angabe alle. */
  stand?: BedarfStand;
  /** `konflikte`: Überbuchungen statt der Bedarfsliste (Link der Aufgabe «Überbuchungen auflösen»). */
  ansicht?: 'konflikte';
  /** Geöffneter Bedarf (ID). */
  o?: string;
}
export type SetBedarfSearch = (next: Partial<BedarfSearch>, o?: { replace?: boolean }) => void;

const MONAT = /^[0-9]{4}-(0[1-9]|1[0-2])$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (v: unknown, re: RegExp) => (typeof v === 'string' && re.test(v) ? v : undefined);

export function validateBedarfSearch(raw: Record<string, unknown>): BedarfSearch {
  const s: BedarfSearch = {};
  const von = text(raw.von, MONAT); const bis = text(raw.bis, MONAT); const o = text(raw.o, UUID);
  if (von) s.von = von;
  if (bis) s.bis = bis;
  if (o) s.o = o;
  if (typeof raw.stand === 'string' && (STAENDE as readonly string[]).includes(raw.stand)) s.stand = raw.stand as BedarfStand;
  if (raw.ansicht === 'konflikte') s.ansicht = 'konflikte';
  return s;
}
