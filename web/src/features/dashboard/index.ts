/** Öffentliche Schnittstelle des Features «Dashboard» (Router, Suche und Navigation importieren nur von hier); AP-E1-3. */
export { validateDashboardSearch, type DashboardSearch, type SetDashboardSearch } from './search.ts';
export { validatePortfolioberichtSearch, validateRisikenSearch, type SetPortfolioberichtSearch, type SetRisikenSearch } from './PortfolioberichtSuche.ts';
export { validateAuswertungenSearch, type SetAuswertungenSearch } from './AuswertungenIndex.ts';
// Texte für Navigation, Befehlspalette und Reiter ohne die Texte der Seiten (Q-L6)
export { NAV as dashboardNav } from './nav.ts';
