/** Öffentliche Schnittstelle des Features «Projekte» (Router und App importieren nur von hier). */
export type { Reiter } from './ProjektAkte.tsx';
export { validateProjekteSearch, NUMMER as PROJEKTNUMMER, type ProjekteSearch, type SetProjekteSearch } from './search.ts';
export { sucheProjekte, suchePersonen as sucheProjektPersonen } from './api.ts';
// Texte für Navigation, Befehlspalette und Reiter ohne die Texte der Seiten (Q-L6)
export { NAV as projektNav } from './nav.ts';
