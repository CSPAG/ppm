/**
 * Auslieferung der Webapp und CSP je Antwortart: SPA-Fallback, `/assets/*` unveränderlich, `index.html` ohne Cache,
 * Pfadschutz gegen das Verlassen von `dist`, CSP ohne `unsafe-inline`, API mit `default-src 'none'`, Hinweisseite ohne
 * Build; Abgleich OpenAPI ↔ Client der Webapp (`web/openapi.json` aktuell).
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { API_CSP } from '../../src/platform/http/app.ts';
import { resolveAsset } from '../../src/platform/modules/auth/index.ts';
import { createTestDb, skipDb, type TestDatabase } from './harness.ts';
import { testApi, type TestApi } from './api.ts';

const skip = await skipDb();
const DIST = join(import.meta.dirname, 'fixtures', 'dist');
const root = join(import.meta.dirname, '..', '..');

describe('Webapp und CSP', { skip }, () => {
  let db: TestDatabase, t: TestApi, none: TestApi;
  before(async () => {
    db = await createTestDb();
    t = await testApi(db.runtime, { WEB_DIST_DIR: DIST });
    none = await testApi(db.runtime, { WEB_DIST_DIR: join(DIST, 'fehlt') });
  });
  after(async () => { await t?.close(); await none?.close(); await db?.drop(); });

  test('SPA-Fallback und Caching', async () => {
    for (const url of ['/', '/projekte', '/projekte?o=123', '/verwalten/mitglieder']) {
      const r = await t.req({ method: 'GET', url });
      assert.equal(r.statusCode, 200, url);
      assert.match(String(r.headers['content-type']), /text\/html/);
      assert.equal(r.headers['cache-control'], 'no-cache');
      assert.match(r.body, /<div id="root">/);
    }
    const a = await t.req({ method: 'GET', url: '/assets/app-abc123.js' });
    assert.equal(a.statusCode, 200);
    assert.match(String(a.headers['cache-control']), /immutable/);
    assert.match(String(a.headers['content-type']), /javascript/);
    assert.equal((await t.req({ method: 'GET', url: '/assets/fehlt.js' })).statusCode, 404);
  });

  test('CSP: Oberfläche ohne unsafe-inline, connect-src self, form-action mit Keycloak; API default-src none', async () => {
    const csp = String((await t.req({ method: 'GET', url: '/' })).headers['content-security-policy']);
    assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
    assert.match(csp, /connect-src 'self'/);
    assert.match(csp, new RegExp(`form-action 'self' ${new URL(t.idp.issuer).origin}`));
    assert.match(csp, /frame-ancestors 'none'/);
    assert.equal((await t.req({ method: 'GET', url: '/v1/health' })).headers['content-security-policy'], API_CSP);
    assert.equal((await t.req({ method: 'GET', url: '/v1/projekte' })).headers['content-security-policy'], API_CSP, 'auch Fehler');
    assert.equal((await t.req({ method: 'GET', url: '/healthz' })).headers['content-security-policy'], API_CSP);
  });

  test('Pfadschutz: nichts ausserhalb von dist', async () => {
    for (const url of ['/../package.json', '/%2e%2e/package.json', '/..%2fpackage.json', '/assets/..%2f..%2f..%2fpackage.json', '/%00']) {
      const r = await t.req({ method: 'GET', url });
      assert.ok(!r.body.includes('"dependencies"'), url);
    }
    assert.equal(resolveAsset(DIST, '/../../harness.ts'), null);
    assert.equal(resolveAsset(DIST, '/assets/%2e%2e/%2e%2e/api.ts'), null);
    assert.ok(resolveAsset(DIST, '/theme.js'));
  });

  test('API-Pfade gehen nie an die Webapp', async () => {
    for (const url of ['/v1/unbekannt', '/auth/unbekannt']) {
      const r = await t.req({ method: 'GET', url });
      // ohne Anmeldung 401 (unter /v1) bzw. 404 – nie index.html
      assert.ok([401, 404].includes(r.statusCode), `${url}: ${r.statusCode}`);
      assert.match(String(r.headers['content-type']), /problem\+json/);
    }
  });

  test('ohne Build: Hinweisseite (ausserhalb der Produktion)', async () => {
    const r = await none.req({ method: 'GET', url: '/' });
    assert.equal(r.statusCode, 200);
    assert.match(r.body, /Webapp nicht gebaut/);
  });

  test('web/openapi.json entspricht der API (sonst npm run api:types)', () => {
    const r = spawnSync(process.execPath, [join(root, 'scripts/openapi-export.ts'), '--check'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  });
});
