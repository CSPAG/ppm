/** Modul auswertung, Ad-hoc-Auswertungen (AP-E7-6; BC PC.04.03): nur lesend (keine eigenen Tabellen). */
import type { Matrix } from './typ.ts';

export const matrix: Matrix = {
  tags: ['Auswertungen'],
  // Projekte von A (Seeds der Module projekt und statusbericht) erscheinen B weder im Ergebnis noch im Export
  cases: {
    'GET /v1/auswertungen': () => ({ method: 'GET', url: '/v1/auswertungen?gruppierung=keine&kennzahlen=projekte,kritisch,budget&lebenszyklus=aktiv,sistiert,abgebrochen,abgeschlossen,zurueckgezogen', kind: 'list' }),
  },
};
