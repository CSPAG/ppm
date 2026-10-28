/** Öffentliche Schnittstelle des Features «Eingang» (UI-01; Router und App importieren nur von hier). */
export { validateEingangSearch, type EingangSearch, type SetEingangSearch } from './search.ts';
export { anzahlOffen } from './api.ts';
export type { KopfKarte } from './kopf.ts';
// Texte für Navigation, Befehlspalette und Reiter ohne die Texte der Seiten (Q-L6)
export { NAV as eingangNav } from './nav.ts';
