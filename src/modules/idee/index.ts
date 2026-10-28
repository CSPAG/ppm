/**
 * Modul Ideen (docs/fachmodell.md 1.1, 2.11): öffentliche Schnittstelle. Etappe E4: Projektidee nach Vorlage mit
 * Assistent, eigene Ideen mit Stand und Rückfragen beantworten (AP-E4-1; BC DM.01.01, UC-001 Schritte 1–2, A2.2).
 * Ideenpool und Prüfung (AP-E4-2, Dateien `pruefung*`) und die Freigabe der Initialisierung (AP-E4-3, `freigabe*`)
 * hängen ihre Routen und Werkzeuge mit je einer Zeile in `register` bzw. `mcpTools` ein.
 */
import { defineModule, type Deps } from '@vollholz/platform';
import type { FastifyInstance } from 'fastify';
import { ideeTools } from './mcp.ts';
import { registerPruefungRoutes } from './pruefung-routes.ts';
import { registerRoutes, TAG } from './routes.ts';

export const ideeModule = defineModule({
  name: 'idee',
  tags: [{ name: TAG, description: 'Projektideen nach Vorlage: Assistent für Antragstellende, eigene Ideen mit Stand, Rückfragen beantworten; ab AP-E4-2 Ideenpool und Prüfung.' }],
  register: (app: FastifyInstance, deps: Deps) => {
    registerRoutes(app, deps);
    registerPruefungRoutes(app, deps);
  },
  mcpTools: { ...ideeTools },
});
