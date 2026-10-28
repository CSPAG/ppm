/**
 * Umfassende Demo-Daten für die Organisation `demo` (nach `npm run keycloak:setup` mit den Personen aus
 * scripts/seed/personen.ts): Stammdaten, Strategie und Zielzyklen, Phasenmodell, drei Portfolios mit Gremien, Ideen,
 * Projekte mit Projektvertrag und Registern, Statusberichte und Monatsabschlüsse der letzten Monate, Gremiumssitzungen
 * mit Entscheiden und Protokoll, Eskalationen, Priorisierung, Ressourcen, Finanzen, Abschluss und Lessons Learned.
 *
 * Alles entsteht über die öffentlichen Routen (Anwendung im Prozess, scripts/seed/api.ts), mit Daten relativ zu heute:
 * vergangene Sitzungen und Perioden sind abgeschlossen, die laufende Periode und die kommenden Sitzungen offen. Läuft
 * nur auf einer Organisation ohne Portfolios (sonst Abbruch); neu aufsetzen: Organisation löschen und neu einrichten.
 *
 *   node --env-file=.env scripts/seed-demo.ts [--org demo]
 */
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import pg from 'pg';
import { fullTx } from '../src/platform.ts';
import { ablauf, kommendeSitzungen } from './seed/ablauf.ts';
import { seedApi } from './seed/api.ts';
import { phasenmodell, portfolios, stammdaten, strategie } from './seed/grundlagen.ts';
import type { Kontext, PersonKey } from './seed/kontext.ts';
import { DEMO_PERSONEN } from './seed/personen.ts';
import { finanzen, lessonsUndStellvertretung, register, ressourcen, ziele } from './seed/weitere.ts';

const env = (k: string) => process.env[k] || (process.env[`${k}_FILE`] ? readFileSync(process.env[`${k}_FILE`]!, 'utf8').trim() : '');
const { values: a } = parseArgs({ options: { org: { type: 'string', default: 'demo' } } });
const url = env('DATABASE_URL');
if (!url) { console.error('seed-demo: DATABASE_URL (bzw. _FILE) fehlt'); process.exit(78); }
const fail = (msg: string): never => { console.error(`seed-demo: ${msg}`); process.exit(1); };

const db = new pg.Pool({ connectionString: url, max: 4 });
const s = await seedApi(db, a.org, { ...process.env, ENCRYPTION_KEYS: env('ENCRYPTION_KEYS') || process.env.ENCRYPTION_KEYS, SESSION_SECRET: env('SESSION_SECRET') });
try {
  const tenant = (await db.query<{ id: string }>('SELECT id FROM app.platform_tenants() WHERE alias = $1', [a.org])).rows[0]
    ?? fail(`Organisation «${a.org}» fehlt (zuerst npm run keycloak:setup)`);
  // Personen aus dem Abgleich bzw. keycloak:setup (Subjekt = Keycloak-ID)
  const principals = await fullTx(db, tenant.id, async tx => (await tx.query<{ id: string; subject: string; email: string }>(
    "SELECT id, subject, lower(email) AS email FROM ppm.principal WHERE kind = 'user' AND removed_at IS NULL AND email IS NOT NULL")).rows);
  if (await fullTx(db, tenant.id, async tx => (await tx.query('SELECT 1 FROM ppm.portfolio LIMIT 1')).rowCount)) {
    fail(`«${a.org}» hat schon Portfolios; die Demo-Daten laufen nur auf einer neuen Organisation`);
  }
  const k = { org: a.org, tenantId: tenant.id, p: {}, personen: {}, orgEinheiten: {}, handlungsfelder: {}, ziele: { strategisch: {}, jahr: {} },
    portfolios: {}, projekte: {}, log: (t: string) => console.log(`seed-demo: ${t}`) } as Kontext;
  for (const p of DEMO_PERSONEN) {
    const pr = principals.find(x => x.email === p.email) ?? fail(`Person ${p.email} fehlt in «${a.org}» (npm run keycloak:setup)`);
    k.personen[p.key as PersonKey] = { ...p, id: pr.id };
    k.p[p.key as PersonKey] = await s.als({ ...p, subject: pr.subject, id: pr.id });
  }

  await stammdaten(k);
  await strategie(k);
  await phasenmodell(k);
  await portfolios(k);
  await ablauf(k);
  await register(k);
  await ressourcen(k);
  await finanzen(k);
  await ziele(k);
  await lessonsUndStellvertretung(k);
  await kommendeSitzungen(k);
  k.log('fertig');
} finally { await s.close(); await db.end(); }
