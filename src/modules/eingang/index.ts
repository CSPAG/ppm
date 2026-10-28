/**
 * Modul Eingang (BC AM.01.03, UC-016 Schritt 4, UX-E3; Fachmodell 1.1, 4): Aufgaben («Zu tun»), Mitteilungen und
 * Stellvertretung; dazu Zugang entziehen mit Neubesetzung (AM.01.01, UC-016 A1). Basis für alle Fachmodule – kennt
 * selbst kein Fachmodul. Fachmodule öffnen und schliessen ihre Aufgaben über `aufgabe`, senden Mitteilungen über
 * `mitteilung` und fragen Vertretungen über `stellvertretung` ab, immer in ihrer Transaktion (README.md).
 */
import { defineModule } from '@vollholz/platform';
import { eingangTools } from './mcp.ts';
import { registerNeubesetzung, TAG_NEUBESETZUNG } from './neubesetzung-routes.ts';
import { registerRoutes, TAG_EINGANG, TAG_MITTEILUNGEN, TAG_STELLVERTRETUNGEN } from './routes.ts';
import { aktivierenJob } from './stellvertretung.ts';

export { aufgabe, mitteilung, type AufgabeAuswahl, type AufgabeOeffnen, type Bezug, type Empfaenger, type MitteilungSenden } from './aufgabe.ts';
export { stellvertretung } from './stellvertretung.ts';

export const eingangModule = defineModule({
  name: 'eingang',
  tags: [
    { name: TAG_EINGANG, description: 'Aufgaben der Person aus allen Rollen («Zu tun»), nach Frist, mit Direktaktion.' },
    { name: TAG_MITTEILUNGEN, description: 'Mitteilungen an die Person: Information ohne Handlung.' },
    { name: TAG_STELLVERTRETUNGEN, description: 'Stellvertretung mit Zeitraum: Aufgaben und befristete Rollen für die Vertretung.' },
    { name: TAG_NEUBESETZUNG, description: 'Zugang entziehen mit offenen Aufgaben und neu zu besetzenden Rollen (UC-016 A1).' },
  ],
  register: (app, deps) => { registerRoutes(app, deps); registerNeubesetzung(app, deps); },
  jobs: [aktivierenJob],
  mcpTools: eingangTools,
});
