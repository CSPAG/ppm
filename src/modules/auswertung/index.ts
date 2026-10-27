/**
 * Modul Auswertung (docs/fachmodell.md 1.1): Dashboard der Periode (AP-E1-3; BC PC.04.01, UC-014 Schritt 1). Risikolage
 * und Portfoliobericht (AP-E2-3) sowie Ad-hoc-Auswertungen (AP-E7-6) kommen als eigene Dateien mit je einer Zeile hier.
 * Liest die Tabellen der unteren Module nur (Lesesicht der Person), schreibt nichts.
 */
import { defineModule, type Deps } from '@vollholz/platform';
import type { FastifyInstance } from 'fastify';
import { auswertungTools } from './mcp.ts';
import { registerRoutes, TAG } from './routes.ts';

export const auswertungModule = defineModule({
  name: 'auswertung',
  tags: [{ name: TAG, description: 'Dashboard der Periode: Projekte der sichtbaren Portfolios mit Status, Trend, Phase und Meldung, Funnel nach Phase.' }],
  register: (app: FastifyInstance, deps: Deps) => {
    registerRoutes(app, deps);
  },
  mcpTools: { ...auswertungTools },
});
