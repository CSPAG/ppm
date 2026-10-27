/**
 * Modul Statusbericht (docs/fachmodell.md 1.1): öffentliche Schnittstelle. Etappe E1 (AP-E1-1): Periode und
 * Statusbericht erfassen, mit Vorbelegung aus der Vorperiode, Pflichtangaben und Einreichen mit Rückgängig (BC PS.01.01,
 * UC-004, Kernablauf K1). Prüfung und Monatsabschluss (AP-E1-2) sowie Eskalation (AP-E2-4) kommen als eigene Dateien
 * (`routes-<teil>.ts`, `mcp-<teil>.ts`) mit je einer Zeile hier und registrieren ihre Folgen über `folgen`.
 */
import { defineModule, type Deps } from '@vollholz/platform';
import type { FastifyInstance } from 'fastify';
import { beimEinreichen, beimZurueckziehen, berichtsaufgabenTask, oeffnenJob } from './aufgabe.ts';
import { folgen } from './folgen.ts';
import { periodeFaelligJob, registerAbschlussRoutes, registriereFolgen } from './abschluss.ts';
import * as abnahme from './abnahme.ts';
import * as eskalation from './eskalation.ts';
import { statusberichtTools } from './mcp.ts';
import { pruefungTools } from './pruefung-mcp.ts';
import { registerPruefungRoutes, TAG_MONATSABSCHLUSS } from './pruefung-routes.ts';
import { registerRoutes } from './routes.ts';

export const statusberichtModule = defineModule({
  name: 'statusbericht',
  tags: [{ name: 'Statusberichte', description: 'Monatlicher Statusbericht je Projekt und Periode: Vorbelegung aus der Vorperiode, Entwurf, Einreichen mit Rückgängig.' },
    { name: TAG_MONATSABSCHLUSS, description: 'Prüfung und Abschluss der Periode durch die Unternehmensentwicklung: Posteingang mit Auffälligkeiten, Bestätigen, Rückfrage, Einfordern, Terminabweichungen, «nicht gemeldet» (AP-E1-2).' }],
  register: (app: FastifyInstance, deps: Deps) => {
    registerRoutes(app, deps);
    registerPruefungRoutes(app, deps);
    registerAbschlussRoutes(app, deps);
  },
  jobs: [oeffnenJob, periodeFaelligJob],
  tasks: [berichtsaufgabenTask],
  mcpTools: { ...statusberichtTools, ...pruefungTools },
});

// Berichtsaufgabe und Mitteilung «kritisch» (AP-E1-1, fachmodell.md 4.2)
folgen.beimEinreichen(beimEinreichen);
folgen.beimZurueckziehen(beimZurueckziehen);
// Prüfung und Monatsabschluss (AP-E1-2): Folgen des Einreichens
registriereFolgen();
// Eskalation aus «kritisch» mit Entscheidbedarf (AP-E2-4): Folgen des Einreichens, Traktandenart `eskalation`
folgen.beimEinreichen(eskalation.beimEinreichen);
folgen.beimZurueckziehen(eskalation.beimZurueckziehen);
eskalation.registriereEskalation();
// Meilensteinabnahme durch das Gremium (AP-E2-4): Vorschlag beim Einreichen, Traktandenart `meilenstein`
folgen.beimEinreichen(abnahme.beimEinreichen);
abnahme.registriereAbnahme();

export { folgen, type Folge } from './folgen.ts';
export { PERIODE_MUSTER, type Stand } from './schemas.ts';
