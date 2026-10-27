/**
 * Kompositionswurzel von PPM: Plattform und Module (Reihenfolge = Reihenfolge der Tags in der API-Doku; die
 * Oberfläche hängt das Paket zuletzt ein). Prozesse und Befehle über `src/cli.ts`, Tests und Skripte über `app`.
 *
 * Neues Modul: hier eintragen (Checkliste in docs/zielarchitektur.md).
 */
import { join } from 'node:path';
import { defineApp } from '@vollholz/platform';
import { handlungsfeldModule } from './modules/handlungsfeld/index.ts';
import { projektdatenModule } from './modules/projektdaten/index.ts';
import { stammdatenModule } from './modules/stammdaten/index.ts';
import { webhooksModule } from './modules/webhooks/index.ts';
import { zielModule } from './modules/ziel/index.ts';
import { platform } from './platform.ts';

export const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'db', 'migrations');

export const app = defineApp({
  platform,
  modules: [stammdatenModule, handlungsfeldModule, projektdatenModule, zielModule, webhooksModule],
  people: { permissions: ['handlungsfeld:read'] },
  // Warteschlange, Idempotenz und Outbox: platform_001_core.sql des Pakets, vor den Migrationen der App
  migrations: { dir: MIGRATIONS_DIR },
});
