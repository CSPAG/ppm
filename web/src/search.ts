/**
 * Typisierte Suchparameter je Seite (TanStack Router `validateSearch`). Jede Seite beschreibt ihre Parameter in ihrem
 * Feature; hier werden sie den Routen zugeordnet.
 */
import { validateEingangSearch } from './features/eingang/index.ts';
import { validateHandlungsfeldSearch, type HandlungsfeldSearch } from './features/handlungsfeld/index.ts';
import { validateProjekteSearch, type ProjekteSearch } from './features/projekt/index.ts';
import { validateIdeeNeuSearch, validateIdeeSearch } from './features/idee/index.ts';
import { validatePhasenmodellSearch, type PhasenmodellSearch } from './features/phasenmodell/index.ts';
import { validatePortfoliosSearch, type PortfoliosSearch } from './features/portfolios/index.ts';
import { validateSitzungSearch, type SitzungSearch } from './features/sitzung/index.ts';
import { validateCodetabellenSearch, validateOrganisationSearch } from './features/stammdaten/index.ts';
import { validateKontoSearch } from './features/konto/index.ts';
import { validateZielSearch, validateZielzyklusSearch, type ZielSearch, type ZielzyklusSearch } from './features/ziele/index.ts';

export const searchOf = {
  eingang: validateEingangSearch,
  stellvertretung: validateKontoSearch,
  handlungsfelder: validateHandlungsfeldSearch,
  projekte: validateProjekteSearch,
  strategischeZiele: validateZielSearch,
  zielzyklus: validateZielzyklusSearch,
  ideeNeu: validateIdeeNeuSearch,
  idee: validateIdeeSearch,
  organisation: validateOrganisationSearch,
  codetabellen: validateCodetabellenSearch,
  phasenmodell: validatePhasenmodellSearch,
  portfolios: validatePortfoliosSearch,
} satisfies Record<string, (raw: Record<string, unknown>) => object>;

export type { HandlungsfeldSearch, PhasenmodellSearch, PortfoliosSearch, ZielSearch };
export type { HandlungsfeldSearch, PhasenmodellSearch, ProjekteSearch, ZielSearch };
  sitzung: validateSitzungSearch,

export type { HandlungsfeldSearch, PhasenmodellSearch, SitzungSearch, ZielSearch };
export type { HandlungsfeldSearch, PhasenmodellSearch, ZielSearch, ZielzyklusSearch };
