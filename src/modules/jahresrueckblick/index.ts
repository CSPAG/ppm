/**
 * Modul Jahresrückblick (docs/fachmodell.md 1.1; BC ZM.03.03, PS.04.03; UC-013; AP-E7-5): Jahresauswertung aus
 * Zielerreichung und Vorhaben des Jahres, Traktandierung im PRAT (Art `jahresrueckblick`), Erkenntnisse und Massnahmen
 * für den nächsten Zielzyklus. Nutzt `ziel` und `sitzung` nur über deren `index.ts`.
 */
import { defineModule, type Deps } from '@vollholz/platform';
import type { FastifyInstance } from 'fastify';
import { registriereJahresrueckblick } from './rueckblick.ts';
import { registerRoutes, TAG } from './routes.ts';

export const jahresrueckblickModule = defineModule({
  name: 'jahresrueckblick',
  tags: [{ name: TAG, description: 'Jahresrückblick: Jahresauswertung aus Zielerreichung und Vorhaben, Traktandierung im PRAT, Erkenntnisse und Massnahmen für den nächsten Zielzyklus.' }],
  register: (app: FastifyInstance, deps: Deps) => {
    registerRoutes(app, deps);
  },
});

// Art `jahresrueckblick` in der Registry der Sitzung (fachmodell.md 2.9; AP-E7-5)
registriereJahresrueckblick();
