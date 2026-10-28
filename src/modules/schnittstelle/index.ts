/**
 * Modul Schnittstellen (docs/fachmodell.md 1.1; BC AM.03.02, AM.03.03; UC-018 Schritte 3–5, A1; AP-E7-3): Schnittstellen
 * zu Umsystemen mit Laufprotokoll und Fehleraufgabe, Änderungsprotokoll über das Audit des Baukastens. Fachmodule
 * registrieren die Verarbeitung ihrer Daten (`verarbeitungSetzen`, z. B. Ist-Kosten mit AP-E7-4).
 */
import { defineModule, type Deps } from '@vollholz/platform';
import type { FastifyInstance } from 'fastify';
import { laufTask } from './lauf.ts';
import { registerRoutes, TAG, TAG_PROTOKOLL } from './routes.ts';

export const schnittstelleModule = defineModule({
  name: 'schnittstelle',
  tags: [
    { name: TAG, description: 'Schnittstellen zu Umsystemen (ERP, HR-System, Budgetprozess) mit Testlauf, Rhythmus und Laufprotokoll; Fehler als Aufgabe im Eingang.' },
    { name: TAG_PROTOKOLL, description: 'Wer wann was geändert hat: Einträge des Audits mit altem und neuem Wert, nach Objekt und Zeitraum.' },
  ],
  register: (app: FastifyInstance, deps: Deps) => registerRoutes(app, deps),
  tasks: [laufTask],
});

export { KATALOG as schnittstellenKatalog, verarbeitungSetzen, type Verarbeitung } from './katalog.ts';
