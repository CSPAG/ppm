/**
 * Modul Projekte (BC PP.04.04, PP.02.04 Zuordnung; UC-002 Schritt 2, UC-014 A1, UC-016 Schritt 2): öffentliche
 * Schnittstelle. Obere Module (idee, vertrag, abschluss, statusbericht) legen Projekte über `projekt.anlegen` an und
 * führen Phase und Lebenszyklus über `projekt.phaseSetzen` und `projekt.lebenszyklusWechseln` nach; die Korrektur eines
 * Entscheids in der Sitzung nimmt einen Endzustand über `projekt.endzustandZuruecknehmen` zurück (A-30).
 */
import { defineModule } from '@vollholz/platform';
import { anlegen, endzustandZuruecknehmen, lebenszyklusWechseln, nachAbschluss, organisationFestlegen, phaseSetzen, pruefeAenderbar, UEBERGAENGE, zugriffVorschlagen } from './aktionen.ts';
import { projektTools } from './mcp.ts';
import { registerRoutes } from './routes.ts';
import { registriere } from './uebernahme.ts';
import { registerUebernahmeRoutes } from './uebernahme-routes.ts';
import { registerVerlaufRoutes } from './verlauf.ts';

export const projektModule = defineModule({
  name: 'projekt',
  tags: [{ name: 'Projekte', description: 'Projekte mit Nummer, Portfolio, Phase und Lebenszyklus, Projektorganisation mit Projektauftraggeber:in, Projektleitung und weiteren Funktionen.' }],
  register: (app, deps) => {
    registerRoutes(app, deps);
    registerUebernahmeRoutes(app, deps);
    registerVerlaufRoutes(app, deps);
  },
  mcpTools: projektTools,
});

/** Fachaktionen für obere Module (in deren Transaktion; Rechte prüft der Aufrufer). */
export const projekt = { anlegen, endzustandZuruecknehmen, lebenszyklusWechseln, nachAbschluss, organisationFestlegen, phaseSetzen, pruefeAenderbar, UEBERGAENGE, zugriffVorschlagen };

/** Übernahme aus dem Excel-Dashboard (AP-E0-7): obere Module registrieren ihren Beitrag je Zeile. */
export const uebernahme = { registriere };
export type { UebernahmeTeil, UebernahmeZeile } from './uebernahme.ts';
export type { Funktion, Lebenszyklus, Phase } from './schemas.ts';
