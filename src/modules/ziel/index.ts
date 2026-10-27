/**
 * Modul Ziele (docs/fachmodell.md 1.1): öffentliche Schnittstelle. Etappe E0 (AP-E0-9): strategische Ziele je
 * Handlungsfeld als versionierte Stammdaten (BC ZM.01.02, UC-011 Schritt 2). Zielzyklus, Jahresziele, Zielerreichung,
 * Quartalsreporting und Roadmap folgen in Etappe E6 als eigene Dateien (`routes-<teil>.ts`) mit je einer Zeile hier.
 */
import { defineModule, type Deps } from '@vollholz/platform';
import type { FastifyInstance } from 'fastify';
import { zielTools } from './mcp.ts';
import { registerRoutes } from './routes.ts';
import { registerZyklusRoutes } from './zyklus-routes.ts';

export const zielModule = defineModule({
  name: 'ziel',
  tags: [{ name: 'Ziele', description: 'Strategische Ziele je Handlungsfeld mit Metrik, Zielwert und Verlauf; ab Etappe E6 Zielzyklus, Jahresziele und Zielerreichung.' }],
  register: (app: FastifyInstance, deps: Deps) => {
    registerRoutes(app, deps);
    registerZyklusRoutes(app, deps); // Zielzyklus, Jahresziele, Hauptaktivitäten, Zuordnung der Projekte (AP-E6-1)
  },
  mcpTools: { ...zielTools },
});
