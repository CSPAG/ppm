/**
 * Typisierte Suchparameter je Seite (TanStack Router `validateSearch`). Jede Seite beschreibt ihre Parameter in ihrem
 * Feature; hier werden sie den Routen zugeordnet.
 */
import { validateHandlungsfeldSearch, type HandlungsfeldSearch } from './features/handlungsfeld/index.ts';
import { validatePortfoliosSearch, type PortfoliosSearch } from './features/portfolios/index.ts';

export const searchOf = {
  handlungsfelder: validateHandlungsfeldSearch,
  portfolios: validatePortfoliosSearch,
} satisfies Record<string, (raw: Record<string, unknown>) => object>;

export type { HandlungsfeldSearch, PortfoliosSearch };
