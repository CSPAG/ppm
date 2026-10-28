/** Öffentliche Schnittstelle des Features «Zugang» (UC-016 A1, AP-E7-8; Router und App nur von hier, Seiten über `seite`). */
export { validateZugaengeSearch, type SetZugaengeSearch, type ZugaengeSearch } from './search.ts';
export { suchePersonen } from './api.ts';
// Texte für Navigation, Befehlspalette und Reiter ohne die Texte der Seiten (Q-L6)
export { NAV as zugangNav } from './nav.ts';
