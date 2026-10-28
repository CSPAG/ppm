/** Öffentliche Schnittstelle des Features «Dashboard» (Router, Suche und Navigation importieren nur von hier); AP-E1-3. */
export { validateDashboardSearch, type DashboardSearch, type SetDashboardSearch } from './search.ts';
export { TD as dashboardTexte } from './texte.ts';
export { TP as portfolioberichtTexte, TR as risikenTexte } from './PortfolioberichtTexte.ts';
export { validatePortfolioberichtSearch, validateRisikenSearch, type SetPortfolioberichtSearch, type SetRisikenSearch } from './PortfolioberichtSuche.ts';
export { validateAuswertungenSearch, type SetAuswertungenSearch, TA as auswertungenTexte } from './AuswertungenIndex.ts';
