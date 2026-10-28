/**
 * Modul Priorisierung (docs/fachmodell.md 1.1, 2.12): Bewertungsmodell mit Kriterien und Budgetrahmen (BC PP.01.02,
 * PP.01.03; UC-008 A1) und Bewertung je Projekt und Kriterium hoch/mittel/tief ohne Score (BC PP.02.01; UC-008 Schritte
 * 1–2; A-01, A-18); AP-E5-1. Matrix und Rangfolge (AP-E5-2, `matrix*`), Szenarien mit Wasserlinie (AP-E5-3,
 * `szenario*`) und Entscheid (AP-E5-5, `entscheid*`) folgen als eigene Dateien mit je einer Zeile hier.
 */
import { defineModule, type Deps } from '@vollholz/platform';
import type { FastifyInstance } from 'fastify';
import { registrierePriorisierung } from './entscheid.ts';
import { registerEntscheidRoutes } from './entscheid-routes.ts';
import { matrixTools } from './matrix-mcp.ts';
import { registerMatrixRoutes } from './matrix-routes.ts';
import { registerRoutes, TAG } from './routes.ts';
import { szenarioTools } from './szenario-mcp.ts';
import { registerSzenarioRoutes } from './szenario-routes.ts';

export const priorisierungModule = defineModule({
  name: 'priorisierung',
  tags: [{ name: TAG, description: 'Bewertungsmodell mit Kriterien und Budgetrahmen (Entwurf, in Kraft), Bewertung der Projekte je Kriterium; ab AP-E5-2 Matrix, Rangfolge und Szenarien.' }],
  register: (app: FastifyInstance, deps: Deps) => {
    registerRoutes(app, deps);
    registerMatrixRoutes(app, deps);
    registerSzenarioRoutes(app, deps);
    registerEntscheidRoutes(app, deps);
  },
  mcpTools: { ...matrixTools, ...szenarioTools },
});

// Priorisierungsentscheid (AP-E5-5): Traktandenart `priorisierung` in der Registry der Sitzung
registrierePriorisierung();
