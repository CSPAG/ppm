/**
 * Modul Phasenmodell (BC AM.02.03, UC-017 Schritte 3 und 5): öffentliche Schnittstelle. Andere Module lesen die Version
 * in Kraft und rechnen Fristen (Arbeitstage über `stammdaten`) nur über diese Exporte (docs/fachmodell.md 1.1, 2.14).
 */
import { defineModule } from '@vollholz/platform';
import { phasenmodellTools } from './mcp.ts';
import { registerRoutes } from './routes.ts';

export const phasenmodellModule = defineModule({
  name: 'phasenmodell',
  tags: [{ name: 'Phasenmodell', description: 'Phasen, Gates mit Leitfragen je Wertestrom, Standard-Ergebnisse, Pflichtangaben, Fristen und Toleranzen – versioniert, nach dem PM-Handbuch.' }],
  register: registerRoutes,
  mcpTools: phasenmodellTools,
});

export { frist, fristDatum, type Datum, type Frist } from './fristen.ts';
export { aktuellesPhasenmodell, phasenmodellLesen } from './lesen.ts';
export { GATES, PHASEN, type Dokument, type FristSchluessel, type GateCode, type PhaseCode } from './schemas.ts';
