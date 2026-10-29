/**
 * Umfassende Demo-Daten für die Organisation `demo` (nach `npm run keycloak:setup` mit den Personen aus
 * scripts/seed/personen.ts): Stammdaten, Strategie und Zielzyklen, Phasenmodell, drei Portfolios mit Gremien, Ideen,
 * Projekte mit Projektvertrag und Registern, Statusberichte und Monatsabschlüsse der letzten Monate, Gremiumssitzungen
 * mit Entscheiden und Protokoll, Eskalationen, Priorisierung, Ressourcen, Finanzen, Abschluss und Lessons Learned.
 *
 * Alles entsteht über die öffentlichen Routen (Anwendung im Prozess, scripts/seed/api.ts), mit Daten relativ zu heute:
 * vergangene Sitzungen und Perioden sind abgeschlossen, die laufende Periode und die kommenden Sitzungen offen. Läuft
 * nur auf einer Organisation ohne Portfolios (sonst Abbruch); neu aufsetzen: Organisation löschen und neu einrichten.
 * Die Administration der Organisation (`--admin`, Rolle org-admin) handelt für die Administration der Demo.
 *
 *   node --env-file=.env scripts/seed-demo.ts [--org demo] [--admin anna@demo.example]
 *
 * Im Betrieb (Runbook in docs/betrieb.md) mit `--einladen`: lädt die Personen der Demo über die Verwaltung ein (Konten
 * ohne Passwort, Adressen unter .example, niemand meldet sich als sie an).
 */
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import pg from 'pg';
import { fullTx } from '../src/platform.ts';
import { ablauf, kommendeSitzungen } from './seed/ablauf.ts';
import { einladen } from './seed/einladen.ts';
import { seedApi, verwaltung } from './seed/api.ts';
import { phasenmodell, portfolios, stammdaten, strategie } from './seed/grundlagen.ts';
import type { Kontext, PersonKey } from './seed/kontext.ts';
import { DEMO_PERSONEN } from './seed/personen.ts';
import { finanzen, lessonsUndStellvertretung, register, ressourcen, ziele } from './seed/weitere.ts';

const env = (k: string) => process.env[k] || (process.env[`${k}_FILE`] ? readFileSync(process.env[`${k}_FILE`]!, 'utf8').trim() : '');
const { values: a } = parseArgs({ options: {
  org: { type: 'string', default: 'demo' },
  admin: { type: 'string', default: 'anna@demo.example' },
  einladen: { type: 'boolean', default: false },
} });
const url = env('DATABASE_URL');
if (!url) { console.error('seed-demo: DATABASE_URL (bzw. _FILE) fehlt'); process.exit(78); }
const fail = (msg: string): never => { console.error(`seed-demo: ${msg}`); process.exit(1); };

const db = new pg.Pool({ connectionString: url, max: 4 });
const umgebung = { ...process.env, ENCRYPTION_KEYS: env('ENCRYPTION_KEYS') || process.env.ENCRYPTION_KEYS, SESSION_SECRET: env('SESSION_SECRET') };
const s = await seedApi(db, a.org, umgebung);
try {
  const tenant = (await db.query<{ id: string }>('SELECT id FROM app.platform_tenants() WHERE alias = $1', [a.org])).rows[0]
    ?? fail(`Organisation «${a.org}» fehlt`);
  if (await fullTx(db, tenant.id, async tx => (await tx.query('SELECT 1 FROM ppm.portfolio LIMIT 1')).rowCount)) {
    fail(`«${a.org}» hat schon Portfolios; die Demo-Daten laufen nur auf einer neuen Organisation`);
  }
  // Personen aus Abgleich, Einladung bzw. keycloak:setup (Subjekt = Keycloak-ID)
  type Row = { id: string; subject: string; email: string; name: string; clearance: number; admin: boolean };
  const lesen = () => fullTx(db, tenant.id, async tx => (await tx.query<Row>(
    `SELECT p.id, p.subject, lower(p.email) AS email, coalesce(p.display_name, p.email) AS name, p.clearance,
            EXISTS (SELECT 1 FROM ppm.authz_tuple t WHERE t.subject = 'user:' || p.id AND t.relation = 'org-admin' AND t.object_type = 'org') AS admin
       FROM ppm.principal p WHERE p.kind = 'user' AND p.removed_at IS NULL AND p.email IS NOT NULL`)).rows);
  let principals = await lesen();

  // Die Administration der Organisation handelt für «anna» (Stammdaten, Phasenmodell in Kraft, Rollen am Portfolio)
  const admin = principals.find(x => x.email === a.admin.toLowerCase()) ?? fail(`${a.admin} ist nicht Mitglied von «${a.org}»`);
  if (!admin.admin) fail(`${a.admin} hat in «${a.org}» nicht die Rolle org-admin`);
  const personen = DEMO_PERSONEN.filter(p => p.key !== 'anna');

  if (a.einladen) {
    // Betrieb: die Personen der Demo wie in der Oberfläche einladen (Konto ohne Passwort, Adressen unter .example)
    const v = await verwaltung(db, umgebung) ?? fail('--einladen braucht die Verwaltung (KEYCLOAK_MGMT_*)');
    try {
      const fehlen = personen.filter(x => !principals.some(y => y.email === x.email));
      for (const e of await einladen(v.admin, { tenantId: tenant.id, alias: a.org }, admin, fehlen)) console.log(`seed-demo: ${e} eingeladen`);
    } finally { await v.close(); }
    principals = await lesen();
  }

  const k = { org: a.org, tenantId: tenant.id, p: {}, personen: {}, orgEinheiten: {}, handlungsfelder: {}, ziele: { strategisch: {}, jahr: {} },
    portfolios: {}, projekte: {}, log: (t: string) => console.log(`seed-demo: ${t}`) } as Kontext;
  const [vorname = admin.name, ...rest] = admin.name.split(' ');
  k.personen.anna = { ...DEMO_PERSONEN.find(p => p.key === 'anna')!, email: admin.email, first: vorname, last: rest.join(' '), id: admin.id };
  k.p.anna = s.als({ subject: admin.subject, id: admin.id, name: admin.name, email: admin.email, first: vorname, last: rest.join(' ') });
  for (const p of personen) {
    const pr = principals.find(x => x.email === p.email)
      ?? fail(`Person ${p.email} fehlt in «${a.org}» (lokal npm run keycloak:setup, im Betrieb --einladen)`);
    k.personen[p.key as PersonKey] = { ...p, id: pr.id };
    k.p[p.key as PersonKey] = s.als({ subject: pr.subject, id: pr.id, name: `${p.first} ${p.last}`, email: p.email, first: p.first, last: p.last });
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
