/**
 * Migrationen ausführen (Prozess `migrate` im Image, lokal `npm run db:migrate`): zuerst die von `@vollholz/iam`,
 * dann `db/migrations/NNN_*.sql`, als Besitzer-Rolle (`DATABASE_ADMIN_URL`). Endet danach.
 */
import { model } from '../src/platform/authz/model.ts';
import { runMigrations } from '../src/platform/db/migrate.ts';
import { secretEnv } from './lib/env.ts';

const url = secretEnv('DATABASE_ADMIN_URL');
if (!url) {
  console.error(JSON.stringify({ level: 'fatal', msg: 'DATABASE_ADMIN_URL (bzw. _FILE) fehlt – Verbindung der Besitzer-Rolle ppm_owner' }));
  process.exit(78);
}
try {
  const r = await runMigrations(url, model, m => console.log(JSON.stringify({ level: 'info', msg: m })));
  console.log(JSON.stringify({ level: 'info', msg: 'Migrationen fertig', applied: r.applied.length, skipped: r.skipped }));
} catch (e) {
  console.error(JSON.stringify({ level: 'fatal', msg: (e as Error).message }));
  process.exit(1);
}
