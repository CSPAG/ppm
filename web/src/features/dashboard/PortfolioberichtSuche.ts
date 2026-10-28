/**
 * Suchparameter der Risikolage und des Portfolioberichts (I-N5): `/portfolio/dashboard/risiken?portfolio=transformation`,
 * `/portfolio/auswertungen/portfoliobericht?portfolio=transformation&periode=2026-10` (Portfolio über seinen Schlüssel).
 */
/** Risikolage (UI-18): `w`/`a` wählen ein Feld der Matrix, `massnahme=offen` die Risiken mit offener Massnahme. */
export interface RisikenSearch { portfolio?: string; w?: Stufe; a?: Stufe; massnahme?: 'offen' }
export interface PortfolioberichtSearch { portfolio?: string; periode?: string }

const PERIODE = /^[0-9]{4}-(0[1-9]|1[0-2])$/;
const SCHLUESSEL = /^[a-z0-9_-]{1,40}$/;

type Stufe = 'hoch' | 'mittel' | 'tief';
const STUFE = (v: unknown): v is Stufe => v === 'hoch' || v === 'mittel' || v === 'tief';

export function validateRisikenSearch(raw: Record<string, unknown>): RisikenSearch {
  const out: RisikenSearch = {};
  if (typeof raw.portfolio === 'string' && SCHLUESSEL.test(raw.portfolio)) out.portfolio = raw.portfolio;
  if (STUFE(raw.w)) out.w = raw.w;
  if (STUFE(raw.a)) out.a = raw.a;
  if (raw.massnahme === 'offen') out.massnahme = 'offen';
  return out;
}

export function validatePortfolioberichtSearch(raw: Record<string, unknown>): PortfolioberichtSearch {
  const out: PortfolioberichtSearch = {};
  if (typeof raw.portfolio === 'string' && SCHLUESSEL.test(raw.portfolio)) out.portfolio = raw.portfolio;
  if (typeof raw.periode === 'string' && PERIODE.test(raw.periode)) out.periode = raw.periode;
  return out;
}

export type SetRisikenSearch = (next: Partial<Record<keyof RisikenSearch, string | undefined>>, o?: { replace?: boolean }) => void;
export type SetPortfolioberichtSearch = (next: Partial<Record<keyof PortfolioberichtSearch, string | undefined>>, o?: { replace?: boolean }) => void;
