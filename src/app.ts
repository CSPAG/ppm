/**
 * Kompositionswurzel von PPM: Plattform und Module (Reihenfolge = Reihenfolge der Tags in der API-Doku; die
 * Oberfläche hängt das Paket zuletzt ein). Prozesse und Befehle über `src/cli.ts`, Tests und Skripte über `app`.
 *
 * Neues Modul: hier eintragen (Checkliste in docs/zielarchitektur.md). Eine Zeile je Eintrag (Module in der Reihenfolge
 * aus fachmodell.md 1.1, Rechte alphabetisch), damit parallele Pakete konfliktarm ergänzen (fachmodell.md 7.2).
 */
import { join } from 'node:path';
import { defineApp } from '@vollholz/platform';
import { auswertungModule } from './modules/auswertung/index.ts';
import { eingangIamHaken, eingangModule } from './modules/eingang/index.ts';
import { handlungsfeldModule } from './modules/handlungsfeld/index.ts';
import { ideeModule } from './modules/idee/index.ts';
import { phasenmodellModule } from './modules/phasenmodell/index.ts';
import { portfolioModule } from './modules/portfolio/index.ts';
import { finanzenModule } from './modules/finanzen/index.ts';
import { priorisierungModule } from './modules/priorisierung/index.ts';
import { projektModule } from './modules/projekt/index.ts';
import { projektdatenModule } from './modules/projektdaten/index.ts';
import { ressourceModule } from './modules/ressource/index.ts';
import { schnittstelleModule } from './modules/schnittstelle/index.ts';
import { sitzungModule } from './modules/sitzung/index.ts';
import { stammdatenModule } from './modules/stammdaten/index.ts';
import { statusberichtModule } from './modules/statusbericht/index.ts';
import { vertragModule } from './modules/vertrag/index.ts';
import { vorlageModule } from './modules/vorlage/index.ts';
import { webhooksModule } from './modules/webhooks/index.ts';
import { zielModule } from './modules/ziel/index.ts';
import { platform } from './platform.ts';

export const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'db', 'migrations');

export const app = defineApp({
  platform,
  modules: [
    eingangModule,
    stammdatenModule,
    handlungsfeldModule,
    phasenmodellModule,
    portfolioModule,
    projektModule,
    projektdatenModule,
    zielModule,
    sitzungModule,
    statusberichtModule,
    auswertungModule,
    vorlageModule,
    vertragModule,
    ideeModule,
    ressourceModule,
    priorisierungModule,
    webhooksModule,
    schnittstelleModule,
    finanzenModule,
  ],
  // Haken am Baukasten (API, Worker, Abgleich): Neubesetzung beim Entfernen, Mitteilung bei Rollenänderungen (UC-016)
  iamEvents: eingangIamHaken,
  // Personenverzeichnis auch mit `stammdaten:read` (alle Rollen): jede Person wählt ihre Stellvertretung (UC-016 Schritt 4);
  // mit `projekt:read` auch für Clients mit Lese-Scope (Namen der Projektorganisation, PP.04.04)
  people: {
    permissions: [
      'handlungsfeld:read',
      'projekt:read',
      'stammdaten:read',
    ],
  },
  // Warteschlange, Idempotenz und Outbox: platform_001_core.sql des Pakets, vor den Migrationen der App
  migrations: { dir: MIGRATIONS_DIR },
});
