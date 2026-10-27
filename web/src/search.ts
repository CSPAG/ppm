/**
 * Typisierte Suchparameter je Seite (TanStack Router `validateSearch`). Jede Seite beschreibt ihre Parameter in ihrem
 * Feature; hier werden sie den Routen zugeordnet.
 */
import { validateHandlungsfeldSearch, type HandlungsfeldSearch } from './features/handlungsfeld/index.ts';
import { validateProjekteSearch, type ProjekteSearch } from './features/projekt/index.ts';

export const searchOf = {
  handlungsfelder: validateHandlungsfeldSearch,
  projekte: validateProjekteSearch,
} satisfies Record<string, (raw: Record<string, unknown>) => object>;

export type { HandlungsfeldSearch, ProjekteSearch };
