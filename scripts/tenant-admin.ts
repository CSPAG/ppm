/**
 * Mandanten verwalten (Betrieb; Prozess `tenant` im Image, lokal `npm run tenant -- <befehl>`):
 *
 *   list                                  alle Mandanten
 *   create <alias> [--name <name>] [--org <keycloak-org-id>]
 *   suspend <alias> [--reason <text>]     sperren (Anfragen 403, keine Jobs)
 *   resume <alias>                        entsperren
 *   delete <alias> --confirm <alias>      Fachdaten der App löschen und sperren (braucht DATABASE_SUPERUSER_URL)
 *
 * Verbindungen: DATABASE_ADMIN_URL (Besitzer, Mandanten auflisten), DATABASE_URL (Laufzeit, Audit im Mandanten),
 * DATABASE_SUPERUSER_URL (nur delete); jeweils auch als `<NAME>_FILE`.
 * Organisationen und ihre Admins legt `npm run identity:first-org` (iam-org-bootstrap) an.
 */
import { parseArgs } from 'node:util';
import pg from 'pg';
import { tenants } from '../src/platform/ops/tenants.ts';
import { secretEnv } from './lib/env.ts';

const { values: a, positionals: [cmd, alias] } = parseArgs({ allowPositionals: true, options: { name: { type: 'string' }, org: { type: 'string' }, reason: { type: 'string' }, confirm: { type: 'string' } } });
const adminUrl = secretEnv('DATABASE_ADMIN_URL'), runtimeUrl = secretEnv('DATABASE_URL'), superuserUrl = secretEnv('DATABASE_SUPERUSER_URL');
const fail = (m: string, code = 64): never => { console.error(`tenant: ${m}`); process.exit(code); };
if (!cmd || !['list', 'create', 'suspend', 'resume', 'delete'].includes(cmd)) fail('Befehl: list | create <alias> | suspend <alias> | resume <alias> | delete <alias> --confirm <alias>');
if (cmd !== 'list' && !alias) fail(`${cmd}: Alias fehlt`);
if (!adminUrl) fail('DATABASE_ADMIN_URL (bzw. _FILE) fehlt', 78);

const admin = new pg.Pool({ connectionString: adminUrl, max: 2 });
const runtime = new pg.Pool({ connectionString: runtimeUrl ?? adminUrl, max: 2 });
try {
  if (cmd === 'list') {
    console.table((await tenants.list(admin)).map(t => ({ alias: t.alias, name: t.name, status: t.status, keycloak: t.kc_org_id ?? '–', seit: t.created_at.toISOString().slice(0, 10) })));
  } else if (cmd === 'create') {
    const t = await tenants.create(admin, runtime, alias!, a.name, a.org);
    console.log(`angelegt: ${t.alias} (${t.id})`);
  } else if (cmd === 'suspend') {
    console.log(`gesperrt: ${(await tenants.suspend(admin, runtime, alias!, a.reason ?? '')).alias}`);
  } else if (cmd === 'resume') {
    console.log(`entsperrt: ${(await tenants.resume(admin, runtime, alias!)).alias}`);
  } else {
    if (a.confirm !== alias) fail('delete: --confirm <alias> muss dem Alias entsprechen');
    if (!superuserUrl) fail('delete: DATABASE_SUPERUSER_URL fehlt (RLS bindet auch die Besitzer-Rolle)', 78);
    const t = await tenants.find(admin, alias!) ?? fail(`Mandant «${alias}» nicht gefunden`, 1);
    await tenants.suspend(admin, runtime, alias!, 'gelöscht');
    const su = new pg.Client({ connectionString: superuserUrl });
    await su.connect();
    try { console.log('gelöscht (Zeilen je Tabelle):', await tenants.purgeAppData(su, t.id)); } finally { await su.end(); }
  }
} catch (e) {
  fail((e as Error).message, 1);
} finally { await admin.end(); await runtime.end(); }
