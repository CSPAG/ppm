/** Öffentliche Schnittstelle des Features «Stammdaten» (Router und Navigation importieren nur von hier). */
export { OrganisationPage } from './OrganisationPage.tsx';
export { CodetabellenPage } from './CodetabellenPage.tsx';
export {
  validateCodetabellenSearch, validateOrganisationSearch, type CodetabellenSearch, type OrganisationSearch, type SetCodetabellenSearch,
  type SetOrganisationSearch,
} from './search.ts';
export { stammdatenKeys, sucheOrgEinheiten } from './api.ts';
export { TS as stammdatenTexte } from './texte.ts';
