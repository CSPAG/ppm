/**
 * Typisierte Suchparameter je Seite (TanStack Router `validateSearch`). Jede Seite beschreibt ihre Parameter in ihrem
 * Feature; hier werden sie den Routen zugeordnet.
 */
import { validateHandlungsfeldSearch, type HandlungsfeldSearch } from './features/handlungsfeld/index.ts';
import { validatePhasenmodellSearch, type PhasenmodellSearch } from './features/phasenmodell/index.ts';
import { validateEntscheideSearch, validateSitzungSearch, type EntscheideSearch, type SitzungSearch } from './features/sitzung/index.ts';
import { validateZielSearch, type ZielSearch } from './features/ziele/index.ts';

export const searchOf = {
  handlungsfelder: validateHandlungsfeldSearch,
  strategischeZiele: validateZielSearch,
  phasenmodell: validatePhasenmodellSearch,
  sitzung: validateSitzungSearch,
  entscheide: validateEntscheideSearch,
} satisfies Record<string, (raw: Record<string, unknown>) => object>;

export type { EntscheideSearch, HandlungsfeldSearch, PhasenmodellSearch, SitzungSearch, ZielSearch };
