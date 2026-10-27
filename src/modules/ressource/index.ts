/**
 * Modul Ressourcen (docs/fachmodell.md 1.1, 2.12; AP-E5-4): Kapazitätsangebot je Rolle und Monat (BC RK.01.01
 * Grundfunktion, UC-009 Schritte 1–2) und Auslastung aus dem Ressourcenbedarf der Projekte, auch je Szenario (BC RK.02.04,
 * UC-009 Schritt 5, UC-008 Schritt 5). Pool = Rolle, Bedarf in FTE × Monate je Rolle und Phase (A-20). Bedarfsliste,
 * Zuteilung einzelner Personen und Konflikte folgen mit AP-E7-2 als eigene Dateien mit je einer Zeile hier.
 */
import { defineModule, type Deps } from '@vollholz/platform';
import type { FastifyInstance } from 'fastify';
import { berechnen, szenarioQuelleSetzen } from './auslastung.ts';
import { ressourceTools } from './mcp.ts';
import { registerRoutes, TAG } from './routes.ts';

export const ressourceModule = defineModule({
  name: 'ressource',
  tags: [{ name: TAG, description: 'Kapazitätsangebot je Rolle (Pool) und Monat und Auslastung aus dem Ressourcenbedarf der Projekte, auch je Szenario.' }],
  register: (app: FastifyInstance, deps: Deps) => {
    registerRoutes(app, deps);
  },
  mcpTools: { ...ressourceTools },
});

/** Für die Priorisierung (AP-E5-3): Auslastung je Szenario rechnen und die eigenen Szenarien als Quelle anmelden. */
export const auslastung = { berechnen, szenarioQuelleSetzen };
export type { SzenarioAnsicht, SzenarioQuelle } from './auslastung.ts';
export { monate, quartal, type Engpass, type Ergebnis as AuslastungErgebnis, type SzenarioPosition } from './rechnung.ts';
