/** Modul vorlage (AP-E3-5, AM.03.01 Grundfunktion): Grundbestand ohne Tabellen; die Liste ist je Organisation gleich. */
import type { Matrix } from './typ.ts';

export const matrix: Matrix = {
  tags: ['Vorlagen'],
  cases: {
    'GET /v1/vorlagen': () => ({ method: 'GET', url: '/v1/vorlagen', kind: 'list' }),
  },
};
