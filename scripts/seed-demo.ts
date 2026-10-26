/**
 * Demodaten für die lokale Entwicklung (`npm run seed:demo`): einige Projekte in den Organisationen «demo» und
 * «muster», mit Zeitraum und Klassifizierung. Idempotent über die Bezeichnung. Nie in Produktion.
 */
import { fullView } from '@vollholz/iam';
import pg from 'pg';
import { model } from '../src/platform/authz/model.ts';
import { withTenant } from '../src/platform/db/pool.ts';

if (process.env.NODE_ENV === 'production') throw new Error('seed:demo: nur lokal');
const DATA: Record<string, [string, string | null, string | null, number][]> = {
  demo: [
    ['Neubau Bettenhaus', '2027-01-01', '2029-06-30', 0], ['Digitale Patientenakte', '2026-11-01', '2027-12-31', 1],
    ['Strategie 2030: Medizin der Zukunft', null, null, 2], ['Energieeffizienz Rechenzentrum', '2027-03-01', '2027-09-30', 0],
  ],
  muster: [['Pilot Portfoliosteuerung', '2027-01-15', '2027-04-30', 0]],
};
const admin = new pg.Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
const runtime = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  for (const [alias, rows] of Object.entries(DATA)) {
    const t = (await admin.query<{ id: string }>('SELECT id FROM app.platform_tenants() WHERE alias = $1', [alias])).rows[0];
    if (!t) { console.warn(`seed:demo: Organisation ${alias} fehlt (npm run keycloak:setup)`); continue; }
    await withTenant(runtime, { tenantId: t.id, principalKind: 'system', settings: fullView(model) }, async tx => {
      for (const [label, beginn, ende, c] of rows) {
        await tx.query(`INSERT INTO ppm.projekt (tenant_id, label, beginn, ende, classification) SELECT $1, $2, $3, $4, $5
          WHERE NOT EXISTS (SELECT 1 FROM ppm.projekt WHERE label = $2)`, [t.id, label, beginn, ende, c]);
      }
    });
    console.log(`seed:demo: ${alias}: ${rows.length} Projekte`);
  }
} finally { await admin.end(); await runtime.end(); }
