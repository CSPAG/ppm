/**
 * Typisierte Suchparameter je Seite (TanStack Router `validateSearch`). Jede Seite beschreibt ihre Parameter in ihrem
 * Feature; hier werden sie den Routen zugeordnet.
 */
import { validateHandlungsfeldSearch, type HandlungsfeldSearch } from './features/handlungsfeld/index.ts';
import { validatePhasenmodellSearch, type PhasenmodellSearch } from './features/phasenmodell/index.ts';
import { validateCodetabellenSearch, validateOrganisationSearch } from './features/stammdaten/index.ts';
import { validateProjekteSearch, type ProjekteSearch } from './features/projekt/index.ts';
import { validateVertragSearch, type VertragSearch } from './features/vertrag/index.ts';
import { validateZielSearch, type ZielSearch } from './features/ziele/index.ts';

export const searchOf = {
  handlungsfelder: validateHandlungsfeldSearch,
  projekte: validateProjekteSearch,
  strategischeZiele: validateZielSearch,
  phasenmodell: validatePhasenmodellSearch,
  organisation: validateOrganisationSearch,
  codetabellen: validateCodetabellenSearch,
  vertrag: validateVertragSearch,
} satisfies Record<string, (raw: Record<string, unknown>) => object>;

export type { HandlungsfeldSearch, PhasenmodellSearch, ProjekteSearch, VertragSearch, ZielSearch };
