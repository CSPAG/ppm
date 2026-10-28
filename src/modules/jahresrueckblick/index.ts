/**
 * Modul Jahresrückblick (docs/fachmodell.md 1.1; BC ZM.03.03, PS.04.03; UC-013; AP-E7-5): Jahresauswertung aus
 * Zielerreichung und Vorhaben des Jahres, Traktandierung im PRAT (Art `jahresrueckblick`), Erkenntnisse und Massnahmen
 * für den nächsten Zielzyklus. Lessons Learned des Jahres und
 * deren Anforderung bei den Projektleitungen (UC-013 A1). Nutzt `ziel`, `sitzung`, `abschluss` und `eingang` nur über
 * deren `index.ts`.
 */
import { defineModule, type Deps } from '@vollholz/platform';
import type { FastifyInstance } from 'fastify';
import { registriereLessonsHaken } from './lessons.ts';
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
// Erfasste Lessons Learned erledigen die Aufgabe «Lessons Learned erfassen» (UC-013 A1.2)
registriereLessonsHaken();
