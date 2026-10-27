/** Öffentliche Schnittstelle des Features «Ressourcen» (Router, Suche und Navigation importieren nur von hier); AP-E5-4. */
export { validateBedarfSearch, type BedarfSearch, type SetBedarfSearch } from './BedarfSearch.ts';
export {
  validateAuslastungSearch, validateKapazitaetSearch, type AuslastungSearch, type KapazitaetSearch, type SetAuslastungSearch, type SetKapazitaetSearch,
} from './search.ts';
export { PFAD as ressourcenPfad } from './Kopf.tsx';
export { TR as ressourcenTexte } from './texte.ts';
