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
import { registerErreichungRoutes } from './erreichung-routes.ts';
import { zielerreichungTask } from './erreichung-aufgabe.ts';
import { registerFreigabeRoutes } from './freigabe-routes.ts';
import { roadmapTools } from './roadmap-mcp.ts';
import { registerRoadmapRoutes } from './roadmap-routes.ts';
import { registriereQuartalsreporting } from './quartal.ts';
import { quartalTask } from './quartal-lauf.ts';
import { registerQuartalRoutes, TAG_QUARTAL } from './quartal-routes.ts';

/** Zuordnung Projekt ↔ Ziel für obere Module (Vertrag Kap. 2 bei der Baseline, PP.02.05; AP-E6-1). */
export { projektZuordnen, type ZielAngabe } from './zyklus-zuordnung.ts';

export const zielModule = defineModule({
  name: 'ziel',
  tags: [
    { name: 'Ziele', description: 'Strategische Ziele je Handlungsfeld mit Metrik, Zielwert und Verlauf; ab Etappe E6 Zielzyklus, Jahresziele und Zielerreichung.' },
    { name: TAG_QUARTAL, description: 'Quartalsreporting an den VR aus Zielerreichung und Portfolioberichten, Weiterleitungen, Rückmeldungen und Aufträge des VR.' },
  ],
  register: (app: FastifyInstance, deps: Deps) => {
    registerRoutes(app, deps);
    registerZyklusRoutes(app, deps); // Zielzyklus, Jahresziele, Hauptaktivitäten, Zuordnung der Projekte (AP-E6-1)
    registerErreichungRoutes(app, deps); // Zielerreichung je Quartal (AP-E6-3)
    registerFreigabeRoutes(app, deps); // Vorlage an den VR und Freigabe der Jahresziele (AP-E6-2)
    registerRoadmapRoutes(app, deps); // Portfolio-Roadmap (AP-E6-2)
    registerQuartalRoutes(app, deps); // Quartalsreporting an den VR (AP-E6-4)
  },
  tasks: [
    zielerreichungTask, // Aufgabe «Zielerreichung erfassen» nach Quartalsende (AP-E6-3)
    quartalTask, // Aufgabe «Quartalsreporting erstellen» nach Quartalsende (AP-E6-4)
  ],
  mcpTools: { ...zielTools, ...roadmapTools },
});

// Art `quartalsreporting` in der Registry der Sitzung (fachmodell.md 2.9; AP-E6-4)
registriereQuartalsreporting();
