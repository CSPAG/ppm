/**
 * Typisierte Suchparameter je Seite (TanStack Router `validateSearch`). Jede Seite beschreibt ihre Parameter in ihrem
 * Feature; hier werden sie den Routen zugeordnet.
 */
import { validateHandlungsfeldSearch, type HandlungsfeldSearch } from './features/handlungsfeld/index.ts';
import { validateCodetabellenSearch, validateOrganisationSearch } from './features/stammdaten/index.ts';
import { validateZielerreichungSearch, validateZielSearch, type ZielerreichungSearch, type ZielSearch } from './features/ziele/index.ts';

export const searchOf = {
  handlungsfelder: validateHandlungsfeldSearch,
  strategischeZiele: validateZielSearch,
  zielerreichung: validateZielerreichungSearch,
  organisation: validateOrganisationSearch,
  codetabellen: validateCodetabellenSearch,
} satisfies Record<string, (raw: Record<string, unknown>) => object>;

export type { HandlungsfeldSearch, ZielerreichungSearch, ZielSearch };
