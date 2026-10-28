/**
 * Öffentliche Schnittstelle des Features «Projektvertrag» (Router importiert nur von hier; Reiter der Projektakte). Die
 * Arbeitsfläche lädt erst beim Öffnen des Reiters nach (Start-Bundle Q-L6).
 */
export { validateVertragSearch, type SetVertragSearch, type VertragSearch } from './search.ts';
export { validateVersionenSearch, type SetVersionenSearch, type VersionenSearch } from './VersionenSearch.ts';
// Texte für Navigation, Befehlspalette und Reiter ohne die Texte der Seiten (Q-L6)
export { NAV as vertragNav } from './nav.ts';
