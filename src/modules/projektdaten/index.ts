/**
 * Modul Projektdaten (docs/fachmodell.md 1.1, 2.6; AP-E0-6): Register je Projekt – Meilensteine, Lieferergebnisse und
 * Kommunikationsmassnahmen (PS.02.04, PS.05.02, PS.05.03), Kosten je Phase (PC.01.01, PC.01.03), Risiken des Projekts
 * und des Portfolios (PC.02.04, PC.02.01, PC.02.03), KPIs mit Werten (PC.03.01, PC.03.03), Stakeholder (PS.05.01),
 * Abhängigkeiten (PP.02.03), Ressourcenbedarf (RK.02.01, RK.02.05) und Meldung des ICT- und Infrastrukturbedarfs
 * (RK.02.06); UC-002, UC-003, UC-004. Nur API und MCP; die Oberfläche zeigt die Register in der Projektübersicht.
 *
 * Obere Module (statusbericht, vertrag, priorisierung, ressource, finanzen, auswertung) lesen und führen die Register
 * über `projektdaten` nach, immer in ihrer Transaktion.
 */
import { defineModule, type Deps } from '@vollholz/platform';
import type { FastifyInstance } from 'fastify';
import { abhaengigkeiten, baselineSetzen, bedarfGedeckt, bedarfImZeitraum, istSetzen, lesen, meilensteinAbnehmen } from './aktionen.ts';
import { projektdatenTools } from './mcp.ts';
import { registerProjektdatenRoutes, TAG } from './routes.ts';

export const projektdatenModule = defineModule({
  name: 'projektdaten',
  tags: [{ name: TAG, description: 'Register je Projekt: Meilensteine und Kommunikation, Kosten, Risiken (auch des Portfolios), KPIs mit Werten, Stakeholder, Abhängigkeiten, Ressourcenbedarf, Meldungen an ICT und Infrastruktur.' }],
  register: (app: FastifyInstance, deps: Deps) => {
    registerProjektdatenRoutes(app, deps);
  },
  mcpTools: { ...projektdatenTools },
});

/** Lesen und Nachführen der Register für obere Module (in deren Transaktion; Rechte prüft der Aufrufer). */
export const projektdaten = { lesen, abhaengigkeiten, bedarfImZeitraum, baselineSetzen, meilensteinAbnehmen, istSetzen, bedarfGedeckt };
export type { Eintrag, RegisterName } from './store.ts';
