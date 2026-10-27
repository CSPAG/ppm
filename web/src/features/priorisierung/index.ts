/** Öffentliche Schnittstelle des Features «Priorisierung» (Router, Suche und Navigation importieren nur von hier); AP-E5-1. */
// Seiten lädt der Router erst bei Bedarf (seiten.ts), damit sie nicht im Start-Bundle liegen (Q-L6)
export { NAV as priorisierungTexte, PFAD as priorisierungPfad } from './pfade.ts';
export { validateBewertungSearch, validateModellSearch, type BewertungSearch, type ModellSearch, type SetBewertungSearch, type SetModellSearch } from './search.ts';
