/** Öffentliche Schnittstelle des Features «Priorisierung» (Router, Suche und Navigation importieren nur von hier); AP-E5-1. */
// Seiten lädt der Router mit `seite()` erst bei Bedarf (Q-L6); hier nur, was Router und Navigation sofort brauchen
export { NAV as priorisierungTexte, PFAD as priorisierungPfad } from './pfade.ts';
export { validateSzenarioSearch, type SetSzenarioSearch, type SzenarioSearch } from './SzenarioSearch.ts';
export { validateBewertungSearch, validateMatrixSearch, validateModellSearch, type BewertungSearch, type MatrixSearch, type ModellSearch, type SetBewertungSearch, type SetMatrixSearch, type SetModellSearch } from './search.ts';
