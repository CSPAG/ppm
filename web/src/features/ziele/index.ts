/** Öffentliche Schnittstelle des Features «Ziele» (Router, Suche und Navigation importieren nur von hier); AP-E0-9. */
export { ZielePage } from './ZielePage.tsx';
export { validateZielSearch, type SetZielSearch, type ZielSearch } from './search.ts';
export { sucheZiele, zielKeys } from './api.ts';
export { TZ as zieleTexte } from './texte.ts';
