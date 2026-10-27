/**
 * Typisierte Suchparameter je Seite (TanStack Router `validateSearch`). Jede Seite beschreibt ihre Parameter in ihrem
 * Feature; hier werden sie den Routen zugeordnet.
 */
import { validateHandlungsfeldSearch, type HandlungsfeldSearch } from './features/handlungsfeld/index.ts';
import { validateAuslastungSearch, validateKapazitaetSearch, type AuslastungSearch, type KapazitaetSearch } from './features/ressourcen/index.ts';
import { validateZielSearch, type ZielSearch } from './features/ziele/index.ts';

export const searchOf = {
  handlungsfelder: validateHandlungsfeldSearch,
  strategischeZiele: validateZielSearch,
  auslastung: validateAuslastungSearch,
  kapazitaet: validateKapazitaetSearch,
} satisfies Record<string, (raw: Record<string, unknown>) => object>;

export type { AuslastungSearch, HandlungsfeldSearch, KapazitaetSearch, ZielSearch };
