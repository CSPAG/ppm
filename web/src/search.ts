/**
 * Typisierte Suchparameter je Seite (TanStack Router `validateSearch`). Jede Seite beschreibt ihre Parameter in ihrem
 * Feature; hier werden sie den Routen zugeordnet.
 */
import { validateEingangSearch } from './features/eingang/index.ts';
import { validateHandlungsfeldSearch, type HandlungsfeldSearch } from './features/handlungsfeld/index.ts';
import { validateKontoSearch } from './features/konto/index.ts';
import { validateZielSearch, type ZielSearch } from './features/ziele/index.ts';

export const searchOf = {
  eingang: validateEingangSearch,
  stellvertretung: validateKontoSearch,
  handlungsfelder: validateHandlungsfeldSearch,
  strategischeZiele: validateZielSearch,
} satisfies Record<string, (raw: Record<string, unknown>) => object>;

export type { HandlungsfeldSearch, ZielSearch };
