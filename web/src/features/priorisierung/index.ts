/** Öffentliche Schnittstelle des Features «Priorisierung» (Router, Suche und Navigation importieren nur von hier); AP-E5-1. */
// Seiten lädt der Router mit `seite()` erst bei Bedarf (Q-L6); hier nur, was Router und Navigation sofort brauchen
export { NAV as priorisierungTexte, PFAD as priorisierungPfad } from './pfade.ts';
export { validateBewertungSearch, validateModellSearch, type BewertungSearch, type ModellSearch, type SetBewertungSearch, type SetModellSearch } from './search.ts';
