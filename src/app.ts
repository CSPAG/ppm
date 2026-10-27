/**
 * Kompositionswurzel von PPM: Plattform und Module (Reihenfolge = Reihenfolge der Tags in der API-Doku; die
 * Oberfläche hängt das Paket zuletzt ein). Prozesse und Befehle über `src/cli.ts`, Tests und Skripte über `app`.
 *
 * Neues Modul: hier eintragen (Checkliste in docs/zielarchitektur.md). Eine Zeile je Eintrag (Module in der Reihenfolge
 * aus fachmodell.md 1.1, Rechte alphabetisch), damit parallele Pakete konfliktarm ergänzen (fachmodell.md 7.2).
 */
import { join } from 'node:path';
import { defineApp } from '@vollholz/platform';
import { eingangModule } from './modules/eingang/index.ts';
import { handlungsfeldModule } from './modules/handlungsfeld/index.ts';
import { ideeModule } from './modules/idee/index.ts';
import { stammdatenModule } from './modules/stammdaten/index.ts';
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
    zielModule,
    ideeModule,
    webhooksModule,
  ],
  // Personenverzeichnis auch mit `stammdaten:read` (alle Rollen): jede Person wählt ihre Stellvertretung (UC-016 Schritt 4)
  people: {
    permissions: [
      'handlungsfeld:read',
      'stammdaten:read',
    ],
  },
  // Warteschlange, Idempotenz und Outbox: platform_001_core.sql des Pakets, vor den Migrationen der App
  migrations: { dir: MIGRATIONS_DIR },
});
