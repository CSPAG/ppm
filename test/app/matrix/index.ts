/** Matrix aller Module: eine Zeile je Modul, Reihenfolge wie `src/app.ts` (Tabellen werden in dieser Folge befüllt). */
import { sammle } from './typ.ts';

export const MATRIX = sammle([
  (await import('./plattform.ts')).matrix,
  (await import('./eingang.ts')).matrix,
  (await import('./stammdaten.ts')).matrix,
  (await import('./handlungsfeld.ts')).matrix,
  (await import('./portfolio.ts')).matrix,
  (await import('./projekt.ts')).matrix,
  (await import('./ziel.ts')).matrix,
  (await import('./ziel-zyklus.ts')).matrix,
  (await import('./ziel-erreichung.ts')).matrix,
  (await import('./webhooks.ts')).matrix,
]);
