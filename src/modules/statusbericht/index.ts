/**
 * Modul Statusbericht (docs/fachmodell.md 1.1): öffentliche Schnittstelle. Etappe E1 (AP-E1-1): Periode und
 * Statusbericht erfassen, mit Vorbelegung aus der Vorperiode, Pflichtangaben und Einreichen mit Rückgängig (BC PS.01.01,
 * UC-004, Kernablauf K1). Prüfung und Monatsabschluss (AP-E1-2) sowie Eskalation (AP-E2-4) kommen als eigene Dateien
 * (`routes-<teil>.ts`, `mcp-<teil>.ts`) mit je einer Zeile hier und registrieren ihre Folgen über `folgen`.
 */
import { defineModule, type Deps } from '@vollholz/platform';
import type { FastifyInstance } from 'fastify';
import { statusberichtTools } from './mcp.ts';
import { registerRoutes } from './routes.ts';

export const statusberichtModule = defineModule({
  name: 'statusbericht',
  tags: [{ name: 'Statusberichte', description: 'Monatlicher Statusbericht je Projekt und Periode: Vorbelegung aus der Vorperiode, Entwurf, Einreichen mit Rückgängig.' }],
  register: (app: FastifyInstance, deps: Deps) => {
    registerRoutes(app, deps);
  },
  mcpTools: { ...statusberichtTools },
});

export { folgen, type Folge } from './folgen.ts';
export { PERIODE_MUSTER, type Stand } from './schemas.ts';
