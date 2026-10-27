/**
 * Modul Stammdaten (BC AM.02.01, AM.02.02; UC-017 Schritte 1–2): Organisationseinheiten mit Direktionen, Codetabellen,
 * Feiertage. Öffentliche Schnittstelle für andere Module: Codetabellen, Prüfung von Codewerten, Arbeitstage (A-43).
 */
import { defineModule } from '@vollholz/platform';
import { stammdatenTools } from './mcp.ts';
import { registerRoutes } from './routes.ts';

export const stammdatenModule = defineModule({
  name: 'stammdaten',
  tags: [{ name: 'Stammdaten', description: 'Organisationseinheiten mit Direktionen, Codetabellen mit ihren Auswahlwerten und Feiertage für Fristen in Arbeitstagen.' }],
  register: registerRoutes,
  mcpTools: stammdatenTools,
});

export { CODETABELLEN, CODETABELLE_KEYS, type CodetabelleKey } from './codetabellen.ts';
export { codewertAktiv } from './store.ts';
export { arbeitstageZwischen, istArbeitstag, plusArbeitstage, plusArbeitstageDb } from './arbeitstage.ts';
