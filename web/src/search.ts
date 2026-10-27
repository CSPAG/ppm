/**
 * Typisierte Suchparameter je Seite (TanStack Router `validateSearch`). Jede Seite beschreibt ihre Parameter in ihrem
 * Feature; hier werden sie den Routen zugeordnet.
 */
import { validateEingangSearch } from './features/eingang/index.ts';
import { validateHandlungsfeldSearch, type HandlungsfeldSearch } from './features/handlungsfeld/index.ts';
import { validatePhasenmodellSearch, type PhasenmodellSearch } from './features/phasenmodell/index.ts';
import { validateCodetabellenSearch, validateOrganisationSearch } from './features/stammdaten/index.ts';
import { validateKontoSearch } from './features/konto/index.ts';
import { validateZielerreichungSearch, validateZielSearch, type ZielerreichungSearch, type ZielSearch } from './features/ziele/index.ts';

export const searchOf = {
  eingang: validateEingangSearch,
  stellvertretung: validateKontoSearch,
  handlungsfelder: validateHandlungsfeldSearch,
  strategischeZiele: validateZielSearch,
  zielerreichung: validateZielerreichungSearch,
  organisation: validateOrganisationSearch,
  codetabellen: validateCodetabellenSearch,
  phasenmodell: validatePhasenmodellSearch,
} satisfies Record<string, (raw: Record<string, unknown>) => object>;

export type { HandlungsfeldSearch, PhasenmodellSearch, ZielerreichungSearch, ZielSearch };
