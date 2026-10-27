/** Öffentliche Schnittstelle des Features «Projekte» (Router und App importieren nur von hier). */
export { MeineProjektePage } from './MeineProjektePage.tsx';
export { ProjektAkte, type Reiter } from './ProjektAkte.tsx';
export { ProjektUebersicht } from './ProjektUebersicht.tsx';
export { validateProjekteSearch, NUMMER as PROJEKTNUMMER, type ProjekteSearch, type SetProjekteSearch } from './search.ts';
export { projektKeys, sucheProjekte } from './api.ts';
export { TP as projektTexte } from './texte.ts';
