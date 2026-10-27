/**
 * Typisierte Suchparameter je Seite (TanStack Router `validateSearch`). Jede Seite beschreibt ihre Parameter in ihrem
 * Feature; hier werden sie den Routen zugeordnet.
 */
import { validateEingangSearch } from './features/eingang/index.ts';
import { type HandlungsfeldSearch, validateHandlungsfeldSearch } from './features/handlungsfeld/index.ts';
import { type ProjekteSearch, validateProjekteSearch } from './features/projekt/index.ts';
import { validateIdeeNeuSearch, validateIdeenSearch, validateIdeeSearch } from './features/idee/index.ts';
import { type AuslastungSearch, type KapazitaetSearch, validateAuslastungSearch, validateKapazitaetSearch } from './features/ressourcen/index.ts';
import { validateMonatsabschlussSearch } from './features/monatsabschluss/index.ts';
import { type PhasenmodellSearch, validatePhasenmodellSearch } from './features/phasenmodell/index.ts';
import { type PortfoliosSearch, validatePortfoliosSearch } from './features/portfolios/index.ts';
import { type SitzungSearch, validateSitzungSearch } from './features/sitzung/index.ts';
import { validateCodetabellenSearch, validateOrganisationSearch } from './features/stammdaten/index.ts';
import { validateKontoSearch } from './features/konto/index.ts';
import { validateZielerreichungSearch, validateZielSearch, validateZielzyklusSearch, type ZielerreichungSearch, type ZielSearch, type ZielzyklusSearch } from './features/ziele/index.ts';

export const searchOf = {
  eingang: validateEingangSearch,
  stellvertretung: validateKontoSearch,
  handlungsfelder: validateHandlungsfeldSearch,
  projekte: validateProjekteSearch,
  strategischeZiele: validateZielSearch,
  zielzyklus: validateZielzyklusSearch,
  ideen: validateIdeenSearch,
  ideeNeu: validateIdeeNeuSearch,
  idee: validateIdeeSearch,
  zielerreichung: validateZielerreichungSearch,
  auslastung: validateAuslastungSearch,
  kapazitaet: validateKapazitaetSearch,
  monatsabschluss: validateMonatsabschlussSearch,
  organisation: validateOrganisationSearch,
  codetabellen: validateCodetabellenSearch,
  phasenmodell: validatePhasenmodellSearch,
  portfolios: validatePortfoliosSearch,
  sitzung: validateSitzungSearch,
} satisfies Record<string, (raw: Record<string, unknown>) => object>;

export type { AuslastungSearch, HandlungsfeldSearch, KapazitaetSearch, PhasenmodellSearch, PortfoliosSearch, ProjekteSearch, SitzungSearch, ZielSearch, ZielerreichungSearch, ZielzyklusSearch };
