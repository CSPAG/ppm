/**
 * Suchparameter des Dashboards (I-N5, docs/ux/informationsarchitektur.md «Adressen»):
 * `/portfolio/dashboard?portfolio=transformation&ansicht=funnel&periode=2026-10`; Portfolio über seinen Schlüssel,
 * `phase` filtert die Liste (aus dem Funnel).
 */
export interface DashboardSearch { portfolio?: string; periode?: string; ansicht?: 'funnel'; phase?: 'P0' | 'P1' | 'P2' | 'P3' | 'P4' }

const PERIODE = /^[0-9]{4}-(0[1-9]|1[0-2])$/;
const SCHLUESSEL = /^[a-z0-9_-]{1,40}$/;
const PHASEN = ['P0', 'P1', 'P2', 'P3', 'P4'] as const;

/** Prüft die rohen Suchparameter; Unbekanntes und Ungültiges fällt weg. */
export function validateDashboardSearch(raw: Record<string, unknown>): DashboardSearch {
  const out: DashboardSearch = {};
  if (typeof raw.portfolio === 'string' && SCHLUESSEL.test(raw.portfolio)) out.portfolio = raw.portfolio;
  if (typeof raw.periode === 'string' && PERIODE.test(raw.periode)) out.periode = raw.periode;
  if (raw.ansicht === 'funnel') out.ansicht = 'funnel';
  if (typeof raw.phase === 'string' && (PHASEN as readonly string[]).includes(raw.phase)) out.phase = raw.phase as DashboardSearch['phase'];
  return out;
}

export type SetDashboardSearch = (next: Partial<Record<keyof DashboardSearch, string | undefined>>, o?: { replace?: boolean }) => void;
