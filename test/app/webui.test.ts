/**
 * Oberfläche und Doku (Spezifikation 5.8, 7): CSP je Antwortart, SPA-Fallback, Pfadschutz, Cache, Hinweisseite ohne
 * Build; Abgleich der OpenAPI-Beschreibung mit dem Client der Webapp (web/openapi.json).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { safePath, uiCsp } from '@vollholz/platform';
import { app } from '../../src/app.ts';
import { skipDb } from './harness.ts';
import { testApi, type TestApi } from './api.ts';

const skip = await skipDb();

test('Pfadschutz: nichts ausserhalb von dist', () => {
  const root = '/srv/dist';
  assert.equal(safePath(root, '/assets/a.js'), '/srv/dist/assets/a.js');
  for (const p of ['/../etc/passwd', '/%2e%2e/etc/passwd', '/assets/..%2f..%2fetc', '/a\\b', '/%00', '/%zz']) assert.equal(safePath(root, p), null, p);
});

test('CSP der Oberfläche ohne unsafe-inline, Formulare nur an App und Anmeldedienst', () => {
  const csp = uiCsp('https://id.example.ch');
  assert.ok(!csp.includes('unsafe-inline') && !csp.includes('unsafe-eval'));
  assert.match(csp, /connect-src 'self'/);
  assert.match(csp, /form-action 'self' https:\/\/id\.example\.ch/);
});

test('OpenAPI ↔ Client: web/openapi.json ist aktuell (npm run openapi:export && npm run api:types)', async () => {
  const have = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'web', 'openapi.json'), 'utf8'));
  assert.deepEqual(have, JSON.parse(JSON.stringify(await app.openApi())));
});

describe('Auslieferung', { skip }, () => {
  let api: TestApi;
  before(async () => { api = await testApi(); });
  after(async () => { await api?.close(); });

  test('index.html: CSP der Oberfläche, kein Cache; SPA-Fallback für Seiten', async () => {
    for (const url of ['/', '/ziele/handlungsfelder', '/verwalten/mitglieder?o=1']) {
      const r = await api.app.inject({ method: 'GET', url });
      assert.equal(r.statusCode, 200, url);
      assert.match(String(r.headers['content-type']), /^text\/html/);
      assert.equal(r.headers['cache-control'], 'no-cache');
      assert.equal(r.headers['content-security-policy'], uiCsp(new URL(api.cfg.oidc.issuer).origin));
      assert.ok(r.body.includes('<div id="root">'));
    }
  });

  test('Assets unveränderlich; fehlende Dateien 404; API und Anmeldung nie als Seite', async () => {
    const a = await api.app.inject({ method: 'GET', url: '/assets/app.js' });
    assert.equal(a.statusCode, 200);
    assert.equal(a.headers['cache-control'], 'public, max-age=31536000, immutable');
    assert.match(String(a.headers['content-type']), /^text\/javascript/);
    assert.equal((await api.app.inject({ method: 'GET', url: '/assets/fehlt.js' })).statusCode, 404);
    // Je nach Normalisierung der Adresse 400 (Pfadschutz) oder 404 – nie die Datei ausserhalb von dist
    for (const url of ['/../../package.json', '/assets/%2e%2e/%2e%2e/package.json', '/assets/..%2f..%2fpackage.json']) {
      const r = await api.app.inject({ method: 'GET', url });
      assert.ok([400, 404].includes(r.statusCode), `${url}: ${r.statusCode}`);
      assert.ok(!r.body.includes('"dependencies"'), url);
    }
    const v = await api.app.inject({ method: 'GET', url: '/v1/unbekannt' });
    assert.equal(v.statusCode, 401, 'unter /v1 gilt die API (ohne Token 401)');
    assert.match(String(v.headers['content-type']), /problem\+json/);
  });

  test('Doku unter /v1/docs mit eigener CSP, öffentlich', async () => {
    const r = await api.app.inject({ method: 'GET', url: '/v1/docs/' });
    assert.equal(r.statusCode, 200);
    const csp = String(r.headers['content-security-policy']);
    assert.ok(!csp.includes('unsafe-inline'), csp);
    assert.equal((await api.app.inject({ method: 'GET', url: '/v1/openapi.json' })).statusCode, 200);
  });

  test('ohne Build: Hinweisseite ausserhalb der Produktion', async () => {
    const other = await testApi({ WEB_DIST_DIR: 'gibt/es/nicht' });
    try {
      const r = await other.app.inject({ method: 'GET', url: '/' });
      assert.equal(r.statusCode, 200);
      assert.match(r.body, /Oberfläche nicht gebaut/);
    } finally { await other.close(); }
  });

  test('healthz und readyz auf dem Dienst-Port', async () => {
    assert.equal((await api.app.inject({ method: 'GET', url: '/healthz' })).statusCode, 200);
  });
});
