/**
 * Modul Projekte (BC PP.04.04, PP.02.04 Zuordnung; UC-002 Schritt 2, UC-014 A1, UC-016 Schritt 2): öffentliche
 * Schnittstelle. Obere Module (idee, vertrag, abschluss, statusbericht) legen Projekte über `projekt.anlegen` an und
 * führen Phase und Lebenszyklus über `projekt.phaseSetzen` und `projekt.lebenszyklusWechseln` nach.
 */
import { defineModule } from '@vollholz/platform';
import { anlegen, lebenszyklusWechseln, phaseSetzen, UEBERGAENGE } from './aktionen.ts';
import { projektTools } from './mcp.ts';
import { registerRoutes } from './routes.ts';
import { registriere } from './uebernahme.ts';
import { registerUebernahmeRoutes } from './uebernahme-routes.ts';

export const projektModule = defineModule({
  name: 'projekt',
  tags: [{ name: 'Projekte', description: 'Projekte mit Nummer, Portfolio, Phase und Lebenszyklus, Projektorganisation mit Sponsor, Projektleitung, CTL und Kernteam.' }],
  register: (app, deps) => {
    registerRoutes(app, deps);
    registerUebernahmeRoutes(app, deps);
  },
  mcpTools: projektTools,
});

/** Fachaktionen für obere Module (in deren Transaktion; Rechte prüft der Aufrufer). */
export const projekt = { anlegen, lebenszyklusWechseln, phaseSetzen, UEBERGAENGE };

/** Übernahme aus dem Excel-Dashboard (AP-E0-7): obere Module registrieren ihren Beitrag je Zeile. */
export const uebernahme = { registriere };
export type { UebernahmeTeil, UebernahmeZeile } from './uebernahme.ts';
export type { Funktion, Lebenszyklus, Phase } from './schemas.ts';
