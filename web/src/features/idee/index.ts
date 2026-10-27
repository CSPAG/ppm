/**
 * Öffentliche Schnittstelle des Features «Ideen» (Router, Suche und Navigation importieren nur von hier; AP-E4-1,
 * AP-E4-2): leichte Teile (Adressen, Suchparameter, Texte) direkt, die Seiten über `ideeSeiten()` bei Bedarf (Q-L6).
 */
export { ideeNeuPfad, nummerAusPfad, validateIdeeNeuSearch, validateIdeeSearch, type IdeeNeuSearch, type IdeeSearch, type SetIdeeSearch } from './search.ts';
export { validateIdeenSearch, type IdeenSearch, type SetIdeenSearch } from './PoolSuche.ts';
export { TI as ideeTexte } from './texte.ts';
export const ideeSeiten = () => import('./seiten.ts');
