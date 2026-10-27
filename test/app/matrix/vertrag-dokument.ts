/** Modul vertrag, Dokumentausgabe (AP-E3-5, DM.02.07): keine eigenen Tabellen; Route mit der Version aus matrix/vertrag.ts. */
import type { Matrix } from './typ.ts';

export const matrix: Matrix = {
  cases: {
    'GET /v1/vertragsversionen/:id/dokument': i => ({ method: 'GET', url: `/v1/vertragsversionen/${i.vertragVersion}/dokument?format=pdf`, kind: 'foreign' }),
  },
};
