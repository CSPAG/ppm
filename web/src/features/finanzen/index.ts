/** Öffentliche Schnittstelle des Features «Finanzen» (Router, Suche und Navigation importieren nur von hier); AP-E7-4. */
// Seiten lädt der Router mit `seite()` erst bei Bedarf (Q-L6); hier nur, was Router und Navigation sofort brauchen
export { NAV as finanzenTexte, PFAD as finanzenPfad } from './pfade.ts';
export { validateBudgetSearch, validateFinanzenSearch, type BudgetSearch, type FinanzenSearch, type SetBudgetSearch, type SetFinanzenSearch } from './search.ts';
