/** Modul auswertung (AP-E1-3; BC PC.04.01): Dashboard der Periode, nur lesend (keine eigenen Tabellen). */
import type { Matrix } from './typ.ts';

export const matrix: Matrix = {
  tags: ['Dashboard'],
  // Projekte von A (Seeds der Module projekt und statusbericht) erscheinen B nie
  cases: {
    'GET /v1/dashboard': () => ({ method: 'GET', url: '/v1/dashboard', kind: 'list' }),
  },
};
