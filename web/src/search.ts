/**
 * Typisierte Suchparameter je Seite (TanStack Router `validateSearch`). Jede Seite beschreibt ihre Parameter in ihrem
 * Feature; hier werden sie den Routen zugeordnet.
 */
import { validateBerichtSearch } from './features/bericht/index.ts';
import { validateEingangSearch } from './features/eingang/index.ts';
import { type HandlungsfeldSearch, validateHandlungsfeldSearch } from './features/handlungsfeld/index.ts';
import { type ProjekteSearch, validateProjekteSearch } from './features/projekt/index.ts';
import { validateIdeeNeuSearch, validateIdeeSearch } from './features/idee/index.ts';
import { type AuslastungSearch, type KapazitaetSearch, validateAuslastungSearch, validateKapazitaetSearch } from './features/ressourcen/index.ts';
import { validateMonatsabschlussSearch } from './features/monatsabschluss/index.ts';
import { type PhasenmodellSearch, validatePhasenmodellSearch } from './features/phasenmodell/index.ts';
import { type PortfoliosSearch, validatePortfoliosSearch } from './features/portfolios/index.ts';
import { type BewertungSearch, type ModellSearch, validateBewertungSearch, validateModellSearch } from './features/priorisierung/index.ts';
import { type SitzungSearch, validateSitzungSearch } from './features/sitzung/index.ts';
import { validateCodetabellenSearch, validateOrganisationSearch } from './features/stammdaten/index.ts';
import { validateKontoSearch } from './features/konto/index.ts';
import { validateVertragSearch, type VertragSearch } from './features/vertrag/index.ts';
import { validateZielerreichungSearch, validateZielSearch, validateZielzyklusSearch, type ZielerreichungSearch, type ZielSearch, type ZielzyklusSearch } from './features/ziele/index.ts';

export const searchOf = {
  bewertung: validateBewertungSearch,
  bewertungsmodell: validateModellSearch,
  eingang: validateEingangSearch,
  stellvertretung: validateKontoSearch,
  handlungsfelder: validateHandlungsfeldSearch,
  projekte: validateProjekteSearch,
  bericht: validateBerichtSearch,
  strategischeZiele: validateZielSearch,
  zielzyklus: validateZielzyklusSearch,
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
  vertrag: validateVertragSearch,
} satisfies Record<string, (raw: Record<string, unknown>) => object>;

export type { AuslastungSearch, BewertungSearch, ModellSearch, HandlungsfeldSearch, KapazitaetSearch, PhasenmodellSearch, PortfoliosSearch, ProjekteSearch, SitzungSearch, VertragSearch, ZielSearch, ZielerreichungSearch, ZielzyklusSearch };
