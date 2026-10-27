/** Öffentliche Schnittstelle des Features «Eingang» (UI-01; Router und App importieren nur von hier). */
export { EingangPage } from './EingangPage.tsx';
export { validateEingangSearch, type EingangSearch, type SetEingangSearch } from './search.ts';
export { E as eingangTexte } from './texte.ts';
export { anzahlOffen } from './api.ts';
