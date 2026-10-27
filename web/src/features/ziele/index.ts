/** Öffentliche Schnittstelle des Features «Ziele» (Router, Suche und Navigation importieren nur von hier); AP-E0-9. */
export { ZielePage } from './ZielePage.tsx';
export { validateZielSearch, zielO, type SetZielSearch, type ZielSearch } from './search.ts';
export { sucheZiele, zielKeys } from './api.ts';
export { TZ as zieleTexte } from './texte.ts';
export { ZielzyklusPage, type ZielzyklusPageProps } from './ZielzyklusPage.tsx';
export { validateZielzyklusSearch, ZIELJAHR, type SetZielzyklusSearch, type ZielzyklusSearch } from './ZielzyklusSearch.ts';
export { TZZ as zielzyklusTexte } from './ZielzyklusTexte.ts';
export { ZielerreichungPage } from './ZielerreichungPage.tsx';
export { abgeschlossenesQuartal, validateZielerreichungSearch, type QuartalNr, type ZielerreichungSearch } from './ZielerreichungSearch.ts';
export { TZE as zielerreichungTexte } from './ZielerreichungTexte.ts';
