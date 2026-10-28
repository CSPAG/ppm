/** Öffentliche Schnittstelle des Features «Ziele» (Router, Suche und Navigation importieren nur von hier); AP-E0-9. */
export { validateZielSearch, zielO, type SetZielSearch, type ZielSearch } from './search.ts';
export { sucheZiele } from './api.ts';
export type { ZielzyklusPageProps } from './ZielzyklusPage.tsx';
export { validateZielzyklusSearch, ZIELJAHR, type SetZielzyklusSearch, type ZielzyklusSearch } from './ZielzyklusSearch.ts';
export { abgeschlossenesQuartal, validateZielerreichungSearch, type QuartalNr, type ZielerreichungSearch } from './ZielerreichungSearch.ts';
export type { FreigabePageProps } from './FreigabePage.tsx';
export type { RoadmapPageProps } from './RoadmapPage.tsx';
export { validateRoadmapSearch, type RoadmapSearch, type SetRoadmapSearch } from './RoadmapSearch.ts';
// Texte für Navigation, Befehlspalette und Reiter ohne die Texte der Seiten (Q-L6)
export { NAV as zieleNav } from './nav.ts';
