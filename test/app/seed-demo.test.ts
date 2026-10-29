/**
 * Demo-Daten im Betrieb (scripts/seed-demo.ts, Runbook in docs/betrieb.md): Personen der Demo über die Verwaltung
 * einladen (Konto ohne Passwort, Principal, Rolle und Freigabestufe sofort) und danach mit dem Anmeldedienst des
 * Skripts als diese Personen handeln, ohne dass Name und E-Mail im Principal überschrieben werden.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { dbTests, KeycloakFake, postgresSkip } from '@vollholz/iam-testkit';
import { seedApi } from '../../scripts/seed/api.ts';
import { einladen } from '../../scripts/seed/einladen.ts';
import { DEMO_PERSONEN } from '../../scripts/seed/personen.ts';
import { full } from './harness.ts';
import { login, TEST_KEYS, testApi, type TestApi } from './api.ts';

const { after, before, describe, test } = dbTests(await postgresSkip());

describe('Demo-Daten: Personen einladen und als sie handeln', () => {
  let api: TestApi;
  let kc: KeycloakFake;

  before(async () => {
    kc = new KeycloakFake();
    kc.org('demo');
    api = await testApi({
      KEYCLOAK_MGMT_CLIENT_ID: 'ppm-admin', KEYCLOAK_MGMT_CLIENT_SECRET: 'geheim', KEYCLOAK_MGMT_URL: 'http://keycloak.test/admin/realms/test',
      KEYCLOAK_MGMT_INVITE_MIN_TIME: '0',
    }, { keycloakFetch: kc.fetch });
  });
  after(async () => { await api?.close(); });

  test('Einladen legt Konto, Principal, Rolle und Freigabestufe an; Token des Skripts trifft den Principal', async () => {
    const sub = randomUUID();
    const adm = await login(api, 'demo', sub, 'org-admin', { clearance: 2 });
    const personen = DEMO_PERSONEN.filter(p => ['ursula', 'sandra', 'reto'].includes(p.key));
    const von = { id: adm.principalId, subject: sub, name: 'Admin', email: 'admin@demo.test', clearance: 2 };
    assert.deepEqual(await einladen(api.iam.admin!, { tenantId: adm.tenantId, alias: 'demo' }, von, personen), personen.map(p => p.email));

    const rows = await full(api.t.runtime, adm.tenantId, async tx => (await tx.query<{ id: string; subject: string; email: string; clearance: number; display_name: string; rollen: string[] }>(
      `SELECT p.id, p.subject, p.email, p.clearance, p.display_name,
              array(SELECT t.relation FROM ppm.authz_tuple t WHERE t.subject = 'user:' || p.id AND t.object_type = 'org') AS rollen
         FROM ppm.principal p WHERE p.email = ANY($1)`, [personen.map(p => p.email)])).rows);
    for (const p of personen) {
      const r = rows.find(x => x.email === p.email);
      assert.ok(r, `${p.email} eingeladen`);
      assert.deepEqual([r.rollen, r.clearance], [[p.role], p.clearance]);
    }

    // Als eingeladene Person handeln (Subjekt = Keycloak-ID): gleicher Principal, Name und E-Mail bleiben
    const ursula = rows.find(x => x.email === 'ursula.egli@demo.example')!;
    const s = await seedApi(api.t.runtime, 'demo', { DATABASE_URL: api.t.runtimeUrl, ENCRYPTION_KEYS: TEST_KEYS, WEB_DIST_DIR: 'test/app/fixtures/dist', LOG_LEVEL: 'silent' });
    try {
      const als = s.als({ subject: ursula.subject, id: ursula.id, name: 'Ursula Egli', email: ursula.email, first: 'Ursula', last: 'Egli' });
      const me = await als.get<{ principal: { id: string; name: string; email: string } }>('/v1/me');
      assert.deepEqual([me.body.principal.id, me.body.principal.name, me.body.principal.email], [ursula.id, 'Ursula Egli', 'ursula.egli@demo.example']);
      assert.equal((await als.get<{ permissions: string[] }>('/v1/me')).body.permissions.includes('sitzung:write'), true, 'Rolle ue wirkt');
    } finally { await s.close(); }
  });
});
