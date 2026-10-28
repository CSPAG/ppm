/** Öffentliche Schnittstelle des Features «Ideen» (Router, Suche, Navigation und Startseite importieren nur von hier); AP-E4-1. */
export { ideeNeuPfad, nummerAusPfad, validateIdeeNeuSearch, validateIdeeSearch, type IdeeNeuSearch, type IdeeSearch, type SetIdeeSearch } from './search.ts';
export { validateIdeenSearch, type IdeenSearch, type SetIdeenSearch } from './PoolSuche.ts';
export { sucheIdeen } from './api.ts';
// Texte für Navigation, Befehlspalette und Reiter ohne die Texte der Seiten (Q-L6)
export { NAV as ideeNav } from './nav.ts';
