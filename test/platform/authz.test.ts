/**
 * Modell und Rechte: Katalog (`GET /v1/authz/catalog`) besteht die Prüfungen des Test-Kits (M1–M13), `platform.json`
 * entspricht dem Modell, und die Rollenmatrix des Startmodells gilt über die API (Rolle ∩ Scope).
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { checkModel } from '@vollholz/iam-testkit';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { model } from '../../src/platform/authz/model.ts';
import { createTestDb, skipDb, type TestDatabase } from './harness.ts';
import { json, member, testApi, type TestApi } from './api.ts';

const skip = await skipDb();
const root = join(import.meta.dirname, '..', '..');

describe('Modell und Rechte', () => {
  test('Modell nach den Regeln des Test-Kits, platform.json aktuell', () => {
    assert.deepEqual(checkModel(model.toJSON(), { product: 'ppm', platformJson: model.platformJson() }), { errors: [], warnings: [] });
    assert.equal(readFileSync(join(root, 'infra/keycloak/platform.json'), 'utf8'), model.platformJson());
    assert.deepEqual(JSON.parse(model.platformJson()).scopes, ['ppm:read', 'projekt:write']);
  });

  describe('über die API', { skip }, () => {
    let db: TestDatabase, t: TestApi, id: string;
    const tok: Record<string, string> = {};
    before(async () => {
      db = await createTestDb();
      t = await testApi(db.runtime);
      for (const r of ['org-admin', 'editor', 'viewer', 'auditor']) { await member(db.runtime, 'demo', r, r); tok[r] = await t.token({ sub: r, org: 'demo' }); }
      id = json(await t.req({ method: 'POST', url: '/v1/projekte', token: tok.editor!, payload: { label: 'Matrix' } })).id;
    });
    after(async () => { await t?.close(); await db?.drop(); });

    test('Katalog der API besteht die Prüfungen', async () => {
      const r = await t.req({ method: 'GET', url: '/v1/authz/catalog', token: tok.viewer! });
      assert.equal(r.statusCode, 200);
      assert.deepEqual(checkModel(json(r), { product: 'ppm' }).errors, []);
    });

    test('Rollenmatrix: org-admin alles, editor schreibt, viewer und auditor lesen; Protokoll nur auditor und org-admin', async () => {
      const can = async (role: string) => json(await t.req({ method: 'GET', url: `/v1/projekte/${id}`, token: tok[role]! })).can;
      assert.deepEqual(await can('org-admin'), { write: true, delete: true });
      assert.deepEqual(await can('editor'), { write: true, delete: true });
      assert.deepEqual(await can('viewer'), { write: false, delete: false });
      assert.deepEqual(await can('auditor'), { write: false, delete: false });
      const me = async (role: string) => json(await t.req({ method: 'GET', url: '/v1/me', token: tok[role]! })).permissions as string[];
      assert.ok((await me('auditor')).includes('audit:read'));
      assert.ok(!(await me('editor')).includes('audit:read'));
      assert.ok((await me('org-admin')).includes('webhook:admin'));
      assert.ok(!(await me('editor')).includes('webhook:admin'));
    });
  });
});
