/** Öffentliche Schnittstelle des Features «Stammdaten» (Router und Navigation importieren nur von hier). */
export {
  validateCodetabellenSearch, validateOrganisationSearch, type CodetabellenSearch, type OrganisationSearch, type SetCodetabellenSearch,
  type SetOrganisationSearch,
} from './search.ts';
export { sucheOrgEinheiten } from './api.ts';
// Texte für Navigation, Befehlspalette und Reiter ohne die Texte der Seiten (Q-L6)
export { NAV as stammdatenNav } from './nav.ts';
