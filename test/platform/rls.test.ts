/**
 * Mandantentrennung in der Datenbank (Leitentscheidung L4, Spezifikation 5.3): Vollständigkeit der Policies und Rechte
 * (Prüfungen des Test-Kits), Testmatrix je Tabelle der App (fremder Mandant sieht, ändert und löscht nichts, ohne
 * Kontext nichts), Lesesicht und Klassifizierung, und eine absichtlich entfernte Policy fällt auf.
 *
 * Neue Tabelle: Eintrag in MATRIX (Testdaten) – sonst schlägt «jede Tabelle abgedeckt» fehl. Tabellen ohne
 * `tenant_id` nur mit Begründung in WITHOUT_TENANT.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { fullView } from '@vollholz/iam';
import { bypassRoleProblems, grantedTableProblems, publicExecuteProblems, publicSchemaProblems, readViewProblems, securityDefinerProblems, tenantTableProblems } from '@vollholz/iam-testkit';
import { model } from '../../src/platform/authz/model.ts';
import { withTenant } from '../../src/platform/db/pool.ts';
import { createTestDb, skipDb, type TestDatabase } from './harness.ts';
import { tenant } from './api.ts';
import { APP_TENANT_TABLES } from '../../src/platform/ops/tenants.ts';

const skip = await skipDb();

/** Tabellen des Baukastens (Migrationen von @vollholz/iam); geprüft von dessen Tests und hier über die Kit-Prüfungen. */
const KIT_TABLES = ['tenant', 'principal', 'authz_tuple', 'member_invitation', 'session', 'replay_guard', 'rate_limit', 'audit_log', 'audit_anchor',
  'entra_connection', 'entra_consent', 'entra_consent_link', 'account', 'platform_audit_log'];

const WITHOUT_TENANT: Record<string, string> = {
  'ppm.tenant': 'Mandantenzeile selbst: RLS mit tenant_self (nur der eigene Mandant)',
  'ppm.session': 'Sitzungen der Oberfläche (BFF): verschlüsselt, Zugriff nur über die zufällige Sitzungs-ID',
  'ppm.rate_limit': 'Zähler des Rate-Limits je Route und Schlüssel, keine Mandantendaten',
  'ppm.replay_guard': 'Replay-Schutz (DPoP-Proofs, Logout-Tokens), nur Schlüssel und Ablauf',
};

const SECURITY_DEFINER: Record<string, string> = {
  'app.resolve_tenant(p_alias text, p_kc_org_id text, p_name text, p_create boolean)': 'Baukasten: Mandant auflösen, bevor der Kontext gesetzt ist',
  'app.bump_acl_version()': 'Baukasten: Trigger der Zugriffsversion',
  'app.suspended_tenants()': 'Baukasten: Worker liest gesperrte Mandanten ohne Kontext',
  'app.platform_tenants()': 'Baukasten: Plattform-Administration',
  'app.set_tenant_status(p_id uuid, p_status text)': 'Baukasten: sperren und entsperren',
  'app.entra_login_alias(p_domain text)': 'Baukasten: Entra',
  'app.entra_free_slot(p_max integer)': 'Baukasten: Entra',
  'app.entra_domains_taken(p_domains text[])': 'Baukasten: Entra',
  'app.account_touch(p_subject text, p_email text, p_name text)': 'Baukasten: Konto',
  'app.account_reserve_org(p_account uuid, p_limit integer)': 'Baukasten: Konto',
  'app.account_release_org(p_account uuid)': 'Baukasten: Konto',
  'app.platform_audit(p_actor_kind text, p_actor_id uuid, p_actor_name text, p_source text, p_action text, p_resource_type text, p_resource_id uuid, p_org uuid, p_correlation text, p_data jsonb)': 'Baukasten: Protokoll der Plattform',
};

/**
 * Testmatrix je Tabelle der App: `insert` legt als Superuser eine Zeile im Mandanten $1 an (weitere Zeilen, die sie
 * braucht, zuerst). `sched`: Rolle ppm_sched sieht die Tabelle absichtlich über alle Mandanten (Scheduler).
 * `appendOnly`: die Laufzeit darf weder ändern noch löschen.
 */
const MATRIX: Record<string, { insert: string[]; sched?: boolean; appendOnly?: boolean }> = {
  job: { insert: ["INSERT INTO ppm.job (tenant_id, kind) VALUES ($1, 'test.matrix')"], sched: true },
  idempotency_key: { insert: ["INSERT INTO ppm.idempotency_key (tenant_id, principal_id, key, method, path, request_hash, expires_at) VALUES ($1, gen_random_uuid(), 'k', 'POST', '/v1/x', 'h', now() + interval '1 day')"] },
  outbox_event: { insert: ["INSERT INTO ppm.outbox_event (tenant_id, type, source) VALUES ($1, 'test.matrix', 'system')"], sched: true },
  projekt: { insert: ["INSERT INTO ppm.projekt (tenant_id, label) VALUES ($1, 'Matrix')"] },
  projekt_version: { insert: ["INSERT INTO ppm.projekt_version (tenant_id, projekt_id, version, action, data) VALUES ($1, gen_random_uuid(), 1, 'created', '{}')"], appendOnly: true },
  webhook: { insert: ["INSERT INTO ppm.webhook (tenant_id, id, url, events, secret_enc) VALUES ($1::uuid, md5($1::text)::uuid, 'https://x.example', '{*}', '\\x00')"] },
  webhook_delivery: {
    insert: [
      "INSERT INTO ppm.webhook (tenant_id, id, url, events, secret_enc) VALUES ($1::uuid, md5($1::text)::uuid, 'https://x.example', '{*}', '\\x00') ON CONFLICT DO NOTHING",
      "INSERT INTO ppm.webhook_delivery (tenant_id, webhook_id, event_id, event_type, payload) VALUES ($1::uuid, md5($1::text)::uuid, gen_random_uuid(), 'test.matrix', '{}')",
    ],
  },
};

const full = fullView(model);

describe('PostgreSQL RLS', { skip }, () => {
  let db: TestDatabase, A: string, B: string;

  before(async () => {
    db = await createTestDb();
    A = await tenant(db.runtime, 'demo');
    B = await tenant(db.runtime, 'muster');
  });
  after(async () => { await db?.drop(); });

  test('Prüfungen des Test-Kits: FORCE RLS, Rechte, Lesesicht, SECURITY DEFINER, PUBLIC, BYPASSRLS', async () => {
    assert.deepEqual(await tenantTableProblems(db.inspect, { appRole: 'ppm_app', minTables: 15 }), []);
    assert.deepEqual(await grantedTableProblems(db.inspect, { roles: ['ppm_app', 'ppm_sched'], minTables: 18, withoutTenant: WITHOUT_TENANT }), []);
    assert.deepEqual(await readViewProblems(db.inspect, { schema: 'ppm', appRole: 'ppm_app' }), []);
    assert.deepEqual(await securityDefinerProblems(db.inspect, { allowed: SECURITY_DEFINER }), []);
    assert.deepEqual(await publicSchemaProblems(db.inspect, { schemas: ['app', 'ppm'] }), []);
    assert.deepEqual(await publicExecuteProblems(db.inspect, { schemas: ['app', 'ppm'], strict: true }), []);
    assert.deepEqual(await bypassRoleProblems(db.inspect, { rolePrefix: 'ppm_' }), []);
  });

  test('jede Tabelle ist abgedeckt (Matrix, Baukasten oder begründet ohne tenant_id)', async () => {
    const rows = (await db.inspect.query<{ t: string; tenant: boolean }>(
      `SELECT t.tablename AS t, EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = 'ppm' AND c.table_name = t.tablename AND c.column_name = 'tenant_id') AS tenant
       FROM pg_tables t WHERE t.schemaname = 'ppm' ORDER BY 1`)).rows;
    const missing = rows.filter(r => !MATRIX[r.t] && !KIT_TABLES.includes(r.t)).map(r => r.t);
    assert.deepEqual(missing, [], 'Tabelle ohne Eintrag in MATRIX');
    const noTenant = rows.filter(r => !r.tenant && !KIT_TABLES.includes(r.t)).map(r => r.t);
    assert.deepEqual(noTenant, [], 'Tabelle der App ohne tenant_id');
    for (const t of Object.keys(MATRIX)) assert.ok(rows.some(r => r.t === t), `MATRIX nennt ${t}, die Tabelle fehlt`);
    // `tenant delete` (ops/tenants.ts) löscht genau die Tabellen der App
    assert.deepEqual([...APP_TENANT_TABLES].sort(), Object.keys(MATRIX).sort(), 'APP_TENANT_TABLES in ops/tenants.ts nachführen');
  });

  for (const [table, m] of Object.entries(MATRIX)) {
    test(`Matrix ${table}: fremder Mandant sieht, ändert und löscht nichts`, async () => {
      for (const sql of m.insert) await db.inspect.query(sql, [A]);
      const t = `ppm.${table}`;
      // Laufzeit (ppm_runtime) im Mandanten B mit voller Sicht: nichts von A
      await withTenant(db.runtime, { tenantId: B, settings: full }, async tx => {
        assert.equal((await tx.query(`SELECT count(*)::int AS n FROM ${t} WHERE tenant_id = $1`, [A])).rows[0].n, 0);
        if (!m.appendOnly) {
          assert.equal((await tx.query(`UPDATE ${t} SET tenant_id = tenant_id WHERE tenant_id = $1`, [A])).rowCount, 0);
          assert.equal((await tx.query(`DELETE FROM ${t} WHERE tenant_id = $1`, [A])).rowCount, 0);
        }
      });
      // Schreiben in fremden Mandanten: WITH CHECK
      await assert.rejects(withTenant(db.runtime, { tenantId: B, settings: full }, tx => tx.query(m.insert.at(-1)!.replace(' ON CONFLICT DO NOTHING', ''), [A])), (e: { code?: string }) => e.code === '42501' || e.code === '23503');
      // Ohne Kontext: nichts
      assert.equal((await db.runtime.query(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n, 0);
      // Im eigenen Mandanten: sichtbar
      await withTenant(db.runtime, { tenantId: A, settings: full }, async tx => {
        assert.ok((await tx.query(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n >= 1);
        if (m.appendOnly) await assert.rejects(tx.query(`DELETE FROM ${t}`), (e: { code?: string }) => e.code === '42501');
      });
      // Scheduler (ppm_worker ohne Kontext): nur Tabellen mit sched sichtbar
      const n = (await db.worker.query(`SELECT count(*)::int AS n FROM ${t}`).catch(() => ({ rows: [{ n: 0 }] }))).rows[0].n;
      assert.equal(n > 0, !!m.sched, m.sched ? 'Scheduler sieht über alle Mandanten' : 'Worker ohne Kontext sieht nichts');
    });
  }

  test('Lesesicht: Projekt nur mit Recht und bis zur Freigabestufe', async () => {
    await db.inspect.query("INSERT INTO ppm.projekt (tenant_id, label, classification) VALUES ($1, 'Offen', 0), ($1, 'Geheim', 2)", [B]);
    const labels = (settings: Record<string, string>) => withTenant(db.runtime, { tenantId: B, settings }, async tx =>
      (await tx.query<{ label: string }>('SELECT label FROM ppm.projekt ORDER BY label')).rows.map(r => r.label));
    assert.deepEqual(await labels(full), ['Geheim', 'Offen']);
    assert.deepEqual(await labels({ ...full, 'app.clearance': '0' }), ['Offen']);
    assert.deepEqual(await labels({ ...full, 'app.read_all': 'off' }), [], 'ohne Recht an org und ohne Tupel nichts');
    await assert.rejects(withTenant(db.runtime, { tenantId: B, settings: { ...full, 'app.write_all': 'off' } }, tx =>
      tx.query("INSERT INTO ppm.projekt (tenant_id, label) VALUES ($1, 'Ohne Recht')", [B])), (e: { code?: string }) => e.code === '42501');
  });

  test('absichtlich entfernte Policy fällt auf', async () => {
    await db.inspect.query('BEGIN');
    try {
      await db.inspect.query('DROP POLICY tenant_isolation ON ppm.projekt');
      const problems = await tenantTableProblems(db.inspect, { appRole: 'ppm_app' });
      assert.ok(problems.some(p => p.includes('projekt')), JSON.stringify(problems));
      await db.inspect.query('ALTER TABLE ppm.webhook NO FORCE ROW LEVEL SECURITY');
      assert.ok((await tenantTableProblems(db.inspect, { appRole: 'ppm_app' })).some(p => p.includes('webhook')));
    } finally { await db.inspect.query('ROLLBACK'); }
    assert.deepEqual(await tenantTableProblems(db.inspect, { appRole: 'ppm_app' }), []);
  });
});
