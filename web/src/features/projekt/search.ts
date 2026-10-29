/**
 * Suchparameter der Seite «Meine Projekte» (UI-05, I-N5): Suche `q`, eigene Rolle `rolle` (Adresse wie in
 * informationsarchitektur.md: `?rolle=auftraggeber`), `phase`, `stand` (laufend, beendet, alle) und die Schublade `o` (Nummer).
 */
export type RolleParam = 'auftraggeber' | 'projektleitung' | 'weitere';
export type StandParam = 'laufend' | 'beendet' | 'alle';
/** `ansicht=alle`: Alle Projekte (UI-52) mit den Kopfdaten aller nicht vertraulichen Projekte. */
export interface ProjekteSearch { q?: string; ansicht?: 'alle'; rolle?: RolleParam; phase?: 'P0' | 'P1' | 'P2' | 'P3' | 'P4'; stand?: StandParam; o?: string }

/** Adresse → Funktion der API. */
export const ROLLE: Record<RolleParam, 'sp' | 'pl' | 'weitere'> = { auftraggeber: 'sp', projektleitung: 'pl', weitere: 'weitere' };
const PHASEN = ['P0', 'P1', 'P2', 'P3', 'P4'] as const;
const STAENDE: readonly StandParam[] = ['laufend', 'beendet', 'alle'];
export const NUMMER = /^\d{4}-\d{3,}$/;

/** Prüft die rohen Suchparameter; Unbekanntes und Ungültiges fällt weg. */
export function validateProjekteSearch(raw: Record<string, unknown>): ProjekteSearch {
  const out: ProjekteSearch = {};
  if (typeof raw.q === 'string' && raw.q.trim()) out.q = raw.q.slice(0, 200);
  if (raw.ansicht === 'alle') out.ansicht = 'alle';
  if (typeof raw.rolle === 'string' && raw.rolle in ROLLE) out.rolle = raw.rolle as RolleParam;
  if (typeof raw.phase === 'string' && (PHASEN as readonly string[]).includes(raw.phase)) out.phase = raw.phase as ProjekteSearch['phase'];
  if (typeof raw.stand === 'string' && (STAENDE as readonly string[]).includes(raw.stand)) out.stand = raw.stand as StandParam;
  if (typeof raw.o === 'string' && NUMMER.test(raw.o)) out.o = raw.o;
  return out;
}

export type SetProjekteSearch = (next: Partial<Record<keyof ProjekteSearch, string | undefined>>, o?: { replace?: boolean }) => void;
