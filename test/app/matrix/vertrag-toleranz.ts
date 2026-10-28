/** Modul vertrag: gültige Toleranzen des Projekts (A-10); keine eigene Tabelle (Kap. 7 in `vertrag_kapitel`). */
import type { Matrix } from './typ.ts';

export const matrix: Matrix = {
  cases: {
    'GET /v1/projekte/:id/toleranzen': i => ({ method: 'GET', url: `/v1/projekte/${i.vertragProjekt}/toleranzen`, kind: 'foreign' }),
  },
};
