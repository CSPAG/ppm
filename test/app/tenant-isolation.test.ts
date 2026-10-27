/**
 * Mandantentrennung über die API (Spezifikation 7): Organisation B liest, ändert und löscht nichts von A – fremde IDs
 * ergeben dieselbe Antwort wie IDs, die es nirgends gibt (404, nie 403 mit Inhalt), Listen zeigen nur B.
 * Vollständig: Jede Route der App-Module steht hier; die Routen von @vollholz/iam prüft das Paket selbst.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import { skipDb } from './harness.ts';
import { login, testApi, type TestApi } from './api.ts';
import { apiTags } from '@vollholz/platform';
import { app as ppm } from '../../src/app.ts';

const API_TAGS = apiTags(ppm.modules);

const skip = await skipDb();
const MARK = 'GEHEIM-A';

/** Routen der App-Module mit ihrem Prüffall (fremde ID bzw. Liste). */
const CASES: Record<string, (ids: { a: string; webhook: string; phasenmodell: string }) => { method: string; url: string; body?: unknown; headers?: Record<string, string>; kind: 'foreign' | 'list' | 'create' }> = {
  'GET /v1/handlungsfelder': () => ({ method: 'GET', url: '/v1/handlungsfelder', kind: 'list' }),
  'POST /v1/handlungsfelder': () => ({ method: 'POST', url: '/v1/handlungsfelder', body: { label: MARK }, kind: 'create' }),
  'GET /v1/handlungsfelder/:id': i => ({ method: 'GET', url: `/v1/handlungsfelder/${i.a}`, kind: 'foreign' }),
  'PATCH /v1/handlungsfelder/:id': i => ({ method: 'PATCH', url: `/v1/handlungsfelder/${i.a}`, body: { label: 'gehackt' }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
  'DELETE /v1/handlungsfelder/:id': i => ({ method: 'DELETE', url: `/v1/handlungsfelder/${i.a}`, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
  'GET /v1/handlungsfelder/:id/history': i => ({ method: 'GET', url: `/v1/handlungsfelder/${i.a}/history`, kind: 'foreign' }),
  'GET /v1/phasenmodelle': () => ({ method: 'GET', url: '/v1/phasenmodelle', kind: 'list' }),
  'POST /v1/phasenmodelle': () => ({ method: 'POST', url: '/v1/phasenmodelle', body: { beschreibung: 'B' }, kind: 'create' }),
  'GET /v1/phasenmodelle/aktuell': () => ({ method: 'GET', url: '/v1/phasenmodelle/aktuell', kind: 'foreign' }),
  'GET /v1/phasenmodelle/:id': i => ({ method: 'GET', url: `/v1/phasenmodelle/${i.phasenmodell}`, kind: 'foreign' }),
  'PATCH /v1/phasenmodelle/:id': i => ({ method: 'PATCH', url: `/v1/phasenmodelle/${i.phasenmodell}`, body: { beschreibung: 'gehackt' }, headers: { 'if-match': 'W/"2"' }, kind: 'foreign' }),
  'DELETE /v1/phasenmodelle/:id': i => ({ method: 'DELETE', url: `/v1/phasenmodelle/${i.phasenmodell}`, headers: { 'if-match': 'W/"2"' }, kind: 'foreign' }),
  'POST /v1/phasenmodelle/:id/in-kraft-setzen': i => ({ method: 'POST', url: `/v1/phasenmodelle/${i.phasenmodell}/in-kraft-setzen`, headers: { 'if-match': 'W/"2"' }, kind: 'foreign' }),
  'GET /v1/webhooks': () => ({ method: 'GET', url: '/v1/webhooks', kind: 'list' }),
  'POST /v1/webhooks': () => ({ method: 'POST', url: '/v1/webhooks', body: { url: 'http://127.0.0.1:9/b', eventTypes: ['*'] }, kind: 'create' }),
  'DELETE /v1/webhooks/:id': i => ({ method: 'DELETE', url: `/v1/webhooks/${i.webhook}`, kind: 'foreign' }),
};
const APP_TAGS = new Set(['Handlungsfelder', 'Phasenmodell', 'Webhooks']);

describe('Mandantentrennung über die API', { skip }, () => {
  let api: TestApi;
  let A: Record<string, string>, B: Record<string, string>;
  const ids = { a: '', webhook: '', phasenmodell: '' };
  const routes: string[] = [];

  before(async () => {
    api = await testApi();
    A = { authorization: (await login(api, 'acme', 'u-a', 'org-admin', { clearance: 2 })).authorization };
    B = { authorization: (await login(api, 'globex', 'u-b', 'org-admin', { clearance: 2 })).authorization };
    const s = await api.app.inject({ method: 'POST', url: '/v1/handlungsfelder', headers: A, payload: { label: MARK } });
    assert.equal(s.statusCode, 201, s.body);
    ids.a = s.json().id;
    const w = await api.app.inject({ method: 'POST', url: '/v1/webhooks', headers: A, payload: { url: 'http://127.0.0.1:9/geheim-a', description: MARK, eventTypes: ['*'] } });
    assert.equal(w.statusCode, 201, w.body);
    ids.webhook = w.json().subscription.id;
    // Phasenmodell von A in Kraft (Version 2 nach dem In-Kraft-Setzen)
    const p = await api.app.inject({ method: 'POST', url: '/v1/phasenmodelle', headers: A, payload: { beschreibung: MARK } });
    assert.equal(p.statusCode, 201, p.body);
    ids.phasenmodell = p.json().id;
    const k = await api.app.inject({ method: 'POST', url: `/v1/phasenmodelle/${ids.phasenmodell}/in-kraft-setzen`, headers: { ...A, 'if-match': p.headers.etag as string } });
    assert.equal(k.statusCode, 200, k.body);
    for (const r of api.app.printRoutes({ commonPrefix: false }).split('\n')) void r;
    const doc = api.app.swagger() as { paths: Record<string, Record<string, { tags?: string[] }>> };
    for (const [path, ops] of Object.entries(doc.paths)) for (const [m, op] of Object.entries(ops)) {
      if (op.tags?.some(t => APP_TAGS.has(t))) routes.push(`${m.toUpperCase()} ${path.replace(/\{(\w+)\}/g, ':$1')}`);
    }
  });
  after(async () => { await api?.close(); });

  test('Vollständigkeit: jede Route der App-Module ist abgedeckt', () => {
    assert.deepEqual(routes.filter(r => !CASES[r]).sort(), [], 'neue Route: Fall in CASES ergänzen');
    assert.deepEqual(Object.keys(CASES).filter(r => !routes.includes(r)).sort(), [], 'Fall ohne Route');
    for (const t of APP_TAGS) assert.ok(API_TAGS.some(x => x.name === t), t);
  });

  test('B erhält für fremde IDs dieselbe Antwort wie für unbekannte, ohne Daten von A', async () => {
    for (const [route, make] of Object.entries(CASES)) {
      const c = make(ids);
      if (c.kind !== 'foreign') continue;
      const req = (url: string) => api.app.inject({ method: c.method as 'GET', url, headers: { ...B, ...c.headers }, ...(c.body ? { payload: c.body } : {}) });
      const foreign = await req(c.url);
      const unknown = await req(c.url.replace(ids.a, randomUUID()).replace(ids.webhook, randomUUID()).replace(ids.phasenmodell, randomUUID()));
      assert.equal(foreign.statusCode, 404, `${route}: ${foreign.body}`);
      assert.equal(foreign.statusCode, unknown.statusCode, route);
      assert.ok(!foreign.body.toLowerCase().includes(MARK.toLowerCase()), route);
      assert.ok(!foreign.body.includes(ids.a) || foreign.body.includes('"instance"'), route);
    }
  });

  test('Listen und Anlegen von B zeigen nur B; A ist unverändert', async () => {
    for (const [route, make] of Object.entries(CASES)) {
      const c = make(ids);
      if (c.kind === 'foreign') continue;
      const r = await api.app.inject({ method: c.method as 'GET', url: c.url, headers: B, ...(c.body ? { payload: c.body } : {}) });
      assert.ok(r.statusCode < 300, `${route}: ${r.statusCode} ${r.body}`);
      if (c.kind === 'list') assert.ok(!r.body.includes(ids.a) && !r.body.includes(ids.webhook) && !r.body.includes(ids.phasenmodell) && !r.body.includes(MARK) && !r.body.includes('geheim-a'), route);
    }
    const mine = (await api.app.inject({ method: 'GET', url: '/v1/handlungsfelder', headers: A })).json().items;
    assert.deepEqual(mine.map((x: { label: string; version: number }) => [x.label, x.version]), [[MARK, 1]]);
    assert.equal((await api.app.inject({ method: 'GET', url: '/v1/webhooks', headers: A })).json().items.length, 1);
    const pm = (await api.app.inject({ method: 'GET', url: '/v1/phasenmodelle/aktuell', headers: A })).json();
    assert.deepEqual([pm.id, pm.beschreibung, pm.stand, pm.version], [ids.phasenmodell, MARK, 'in_kraft', 2]);
  });
});
