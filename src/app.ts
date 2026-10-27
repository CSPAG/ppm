/**
 * Kompositionswurzel von PPM: Plattform und Module (Reihenfolge = Reihenfolge der Tags in der API-Doku; die
 * Oberfläche hängt das Paket zuletzt ein). Prozesse und Befehle über `src/cli.ts`, Tests und Skripte über `app`.
 *
 * Neues Modul: hier eintragen (Checkliste in docs/zielarchitektur.md).
 */
import { join } from 'node:path';
import { defineApp } from '@vollholz/platform';
import { eingangModule } from './modules/eingang/index.ts';
import { handlungsfeldModule } from './modules/handlungsfeld/index.ts';
import { portfolioModule } from './modules/portfolio/index.ts';
import { stammdatenModule } from './modules/stammdaten/index.ts';
import { webhooksModule } from './modules/webhooks/index.ts';
import { zielModule } from './modules/ziel/index.ts';
import { platform } from './platform.ts';

export const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'db', 'migrations');

export const app = defineApp({
  platform,
  modules: [eingangModule, stammdatenModule, handlungsfeldModule, portfolioModule, zielModule, webhooksModule],
  // Personenverzeichnis auch mit `stammdaten:read` (alle Rollen): jede Person wählt ihre Stellvertretung (UC-016 Schritt 4)
  people: { permissions: ['handlungsfeld:read', 'stammdaten:read'] },
  // Warteschlange, Idempotenz und Outbox: platform_001_core.sql des Pakets, vor den Migrationen der App
  migrations: { dir: MIGRATIONS_DIR },
});
