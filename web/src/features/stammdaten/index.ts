/** Öffentliche Schnittstelle des Features «Stammdaten» (Router und Navigation importieren nur von hier). */
export {
  validateCodetabellenSearch, validateOrganisationSearch, type CodetabellenSearch, type OrganisationSearch, type SetCodetabellenSearch,
  type SetOrganisationSearch,
} from './search.ts';
export { stammdatenKeys, sucheOrgEinheiten } from './api.ts';
export { TS as stammdatenTexte } from './texte.ts';
