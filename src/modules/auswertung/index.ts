/**
 * Modul Auswertung (docs/fachmodell.md 1.1): Dashboard der Periode (AP-E1-3; BC PC.04.01, UC-014 Schritt 1), Risikolage
 * und Portfoliobericht (AP-E2-3) sowie Ad-hoc-Auswertungen (AP-E7-6) kommen als eigene Dateien mit je einer Zeile hier.
 * Liest die Tabellen der unteren Module nur (Lesesicht der Person); eigene Tabelle nur `portfoliobericht` (150).
 */
import { defineModule, type Deps } from '@vollholz/platform';
import type { FastifyInstance } from 'fastify';
import { registerAdhocRoutes, TAG_ADHOC } from './adhoc-routes.ts';
import { registrierePortfoliobericht } from './bericht.ts';
import { registerBerichtRoutes, TAG_BERICHT } from './bericht-routes.ts';
import { registriereVorlage } from './bericht-vorlage.ts';
import { auswertungTools } from './mcp.ts';
import { registerRisikoRoutes, TAG_RISIKO } from './risiko-routes.ts';
import { registerRoutes, TAG } from './routes.ts';

// Art `portfoliobericht` in der Registry der Sitzung (fachmodell.md 2.9; AP-E2-3)
registrierePortfoliobericht();
// Feldkatalog für eigene Word-Vorlagen des Portfolioberichts (AM.03.01, UC-018 Schritt 2)
registriereVorlage();

export const auswertungModule = defineModule({
  name: 'auswertung',
  tags: [
    { name: TAG, description: 'Dashboard der Periode: Projekte der sichtbaren Portfolios mit Status, Trend, Phase und Meldung, Funnel nach Phase.' },
    { name: TAG_RISIKO, description: 'Risikolage: Projekt- und Portfoliorisiken mit Bewertung und Massnahmen, Abhängigkeiten und offene Eskalationen.' },
    { name: TAG_BERICHT, description: 'Portfoliobericht der Periode aus dem abgeschlossenen Dashboard und der Risikolage, mit Kommentar der UE, als PDF oder Word.' },
    { name: TAG_ADHOC, description: 'Ad-hoc-Auswertungen (AP-E7-6): Filter, Kennzahlen, Gruppierung, Einzelwerte und Export als CSV.' },
  ],
  register: (app: FastifyInstance, deps: Deps) => {
    registerRoutes(app, deps);
    registerRisikoRoutes(app, deps);
    registerBerichtRoutes(app, deps);
    registerAdhocRoutes(app, deps);
  },
  mcpTools: { ...auswertungTools },
});

/** Lese-Schnittstelle des Portfolioberichts für obere Module (Quartalsreporting, AP-E6-4). */
export { portfoliobericht, type PortfolioberichtDaten } from './bericht-schnittstelle.ts';
/** CSV (Semikolon, BOM, ohne Formeln) für den Export der Seiten vom Typ Bericht. */
export { csv } from './adhoc.ts';
