/**
 * Erzeugt `.env.example` und `docs/konfiguration.md` aus der Variablenliste (IAM, @vollholz/platform und App, `app.vars`).
 * CI prüft, dass beide aktuell sind.
 *
 *   node scripts/env-docs.ts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from '../src/app.ts';
import { ROOT } from './lib.ts';

const { env, md } = app.envDocs({ command: 'npm run env:docs' });
writeFileSync(join(ROOT, '.env.example'), `${env.replace(/\n/, '\n# Lokal: `npm run dev:env` schreibt eine .env mit Zufallsgeheimnissen.\n')}`);
writeFileSync(join(ROOT, 'docs', 'konfiguration.md'), md);
console.log(`env:docs: ${app.vars.length} Variablen → .env.example, docs/konfiguration.md`);
