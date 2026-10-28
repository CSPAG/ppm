/**
 * Öffentliche Schnittstelle des Features «Abschluss» (UI-14 Reiter der Projektakte, UI-32 Lessons Learned; Router und
 * Navigation importieren nur von hier). Die Seiten laden erst beim Öffnen nach (Start-Bundle Q-L6).
 */
export { validateLessonsSearch, type LessonsSearch, type SetLessonsSearch } from './search.ts';
// Texte für Navigation, Befehlspalette und Reiter ohne die Texte der Seiten (Q-L6)
export { NAV as abschlussNav } from './nav.ts';
