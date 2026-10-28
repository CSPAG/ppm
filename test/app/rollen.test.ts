/**
 * Rollen zur Laufzeit (UC-016 A2, AM.01.02; Modul `roles` des Baukastens ab iam 5.0): Mandantentrennung der Routen
 * `/v1/admin/roles…` und `/v1/platform/organizations/:alias/roles…` (Isolations-Durchlauf, docs/ausrollen.md «Umstieg auf
 * iam 5.0»), `roles:admin` nur für org-admin, Rollen des Modells nie mit `c-`.
 */
import assert from 'node:assert/strict';
import { dbTests, postgresSkip } from '@vollholz/iam-testkit';
import { platform } from '../../src/platform.ts';
import { login, testApi, type TestApi } from './api.ts';

const { after, before, describe, test } = dbTests(await postgresSkip());

describe('Rollen zur Laufzeit', () => {
  let api: TestApi;
  let A: Record<string, string>, B: Record<string, string>, leser: Record<string, string>;

  before(async () => {
    api = await testApi();
    A = { authorization: (await login(api, 'acme', 'u-rollen-a', 'org-admin')).authorization };
    B = { authorization: (await login(api, 'globex', 'u-rollen-b', 'org-admin')).authorization };
    leser = { authorization: (await login(api, 'acme', 'u-rollen-leser', 'leser')).authorization };
  });
  after(async () => { await api?.close(); });

  const call = (method: string, url: string, headers: Record<string, string>, payload?: unknown) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...headers, ...(payload !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}) });
  const rolle = (label: string) => ({ key: 'c-probe', label, permissions: ['projekt:read'], places: ['projekt'] });
  /** Ändern ohne Schlüssel (er steht in der Adresse). */
  const aenderung = (label: string) => ({ label, permissions: ['projekt:read'], places: ['projekt'] });

  test('Rollen des Modells beginnen nie mit c- (eigene Rollen); roles:admin hat nur org-admin', () => {
    assert.deepEqual([...platform.model.roles.keys()].filter(k => k.startsWith('c-')), []);
    const mit = [...platform.model.roles.entries()].filter(([, r]) => [...((r as { permissions?: Iterable<string> }).permissions ?? [])].includes('roles:admin')).map(([k]) => k);
    assert.deepEqual(mit, ['org-admin']);
  });

  test('nur mit «Rollen zusammenstellen»', async () => {
    assert.equal((await call('GET', '/v1/admin/roles', leser)).statusCode, 403);
    assert.equal((await call('POST', '/v1/admin/roles', leser, rolle('Probe'))).statusCode, 403);
  });

  test('B sieht, ändert und löscht keine Rolle von A; derselbe Schlüssel in B ist eine eigene Rolle', async () => {
    const a = await call('POST', '/v1/admin/roles', A, rolle('Probe A'));
    assert.equal(a.statusCode, 201, a.body);

    const liste = await call('GET', '/v1/admin/roles', B);
    assert.equal(liste.statusCode, 200, liste.body);
    assert.ok(!liste.body.includes('Probe A'), liste.body);

    // Fremder Schlüssel: dieselbe Antwort wie für einen unbekannten
    for (const [method, payload] of [['PUT', aenderung('Von B')], ['DELETE', undefined]] as const) {
      const fremd = await call(method, '/v1/admin/roles/c-probe', B, payload);
      const unbekannt = await call(method, '/v1/admin/roles/c-unbekannt', B, payload);
      assert.equal(fremd.statusCode, 404, `${method}: ${fremd.body}`);
      assert.equal(fremd.statusCode, unbekannt.statusCode, method);
      assert.ok(!fremd.body.includes('Probe A'), method);
    }

    const b = await call('POST', '/v1/admin/roles', B, rolle('Probe B'));
    assert.equal(b.statusCode, 201, b.body);
    const vonA = (await call('GET', '/v1/admin/roles', A)).json();
    const items = (vonA.items ?? vonA) as { key: string; label: string }[];
    assert.deepEqual(items.filter(r => r.key === 'c-probe').map(r => r.label), ['Probe A']);
  });

  test('Plattform-Routen nur für die Plattform-Administration, gleich für eigene und fremde Organisation', async () => {
    for (const [method, suffix, payload] of [['GET', '', undefined], ['POST', '', rolle('X')], ['PUT', '/c-probe', aenderung('X')], ['DELETE', '/c-probe', undefined]] as const) {
      const eigen = await call(method, `/v1/platform/organizations/globex/roles${suffix}`, B, payload);
      const fremd = await call(method, `/v1/platform/organizations/acme/roles${suffix}`, B, payload);
      assert.equal(fremd.statusCode, 403, `${method} ${suffix}: ${fremd.body}`);
      assert.equal(eigen.statusCode, fremd.statusCode, `${method} ${suffix}`);
      assert.ok(!fremd.body.includes('Probe A'));
    }
  });
});
