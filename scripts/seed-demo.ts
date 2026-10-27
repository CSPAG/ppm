/**
 * Demo-Daten für die Organisation `demo` (nach npm run keycloak:setup, Testpersonen anna@ und bruno@demo.example): die
 * fünf Handlungsfelder der Strategie 2035 (Q9, öffentlich; docs/PPM-Master.md Abschnitt 4), ohne Leitsatz. Idempotent über
 * die Bezeichnung. Läuft als Laufzeit-Rolle mit voller Sicht im Mandanten (die Besitzer-Rolle hat auf Fachtabellen keine Policy).
 *
 *   node --env-file=.env scripts/seed-demo.ts [--org demo]
 */
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import pg from 'pg';
import { fullTx } from '../src/platform.ts';

const env = (k: string) => process.env[k] || (process.env[`${k}_FILE`] ? readFileSync(process.env[`${k}_FILE`]!, 'utf8').trim() : '');
const { values: a } = parseArgs({ options: { org: { type: 'string', default: 'demo' } } });
const url = env('DATABASE_URL');
if (!url) { console.error('seed-demo: DATABASE_URL (bzw. _FILE) fehlt'); process.exit(78); }

const HANDLUNGSFELDER = [
  'Mitarbeitende und Unternehmenskultur',
  'Patientenorientierung',
  'Medizin der Zukunft',
  'Marktpositionierung und Vernetzung',
  'Wirtschaftlichkeit',
];

const db = new pg.Pool({ connectionString: url, max: 2 });
try {
  const tenant = (await db.query<{ id: string }>('SELECT id FROM app.platform_tenants() WHERE alias = $1', [a.org])).rows[0];
  if (!tenant) throw new Error(`Organisation «${a.org}» fehlt (zuerst npm run keycloak:setup)`);
  const added = await fullTx(db, tenant.id, async tx => {
    let n = 0;
    for (const [i, label] of HANDLUNGSFELDER.entries()) {
      n += (await tx.query(`INSERT INTO ppm.handlungsfeld (tenant_id, label, position)
        VALUES ($1, $2, $3) ON CONFLICT (tenant_id, lower(label)) DO NOTHING`, [tenant.id, label, i + 1])).rowCount ?? 0;
    }
    return n;
  });
  console.log(`seed-demo: ${added} Handlungsfelder in «${a.org}» angelegt (${HANDLUNGSFELDER.length - added} vorhanden)`);
} finally { await db.end(); }
