/**
 * Mandantentrennung über die API (Spezifikation 7): Organisation B liest, ändert und löscht nichts von A – fremde IDs
 * ergeben dieselbe Antwort wie IDs, die es nirgends gibt (404, nie 403 mit Inhalt), Listen zeigen nur B.
 * Vollständig: Jede Route der App-Module steht hier; die Routen von @vollholz/iam prüft das Paket selbst.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import { full, skipDb } from './harness.ts';
import { login, testApi, type TestApi } from './api.ts';
import { apiTags } from '@vollholz/platform';
import { app as ppm } from '../../src/app.ts';
import { aufgabe, mitteilung } from '../../src/modules/eingang/index.ts';

const API_TAGS = apiTags(ppm.modules);

const skip = await skipDb();
const MARK = 'GEHEIM-A';

/** Routen der App-Module mit ihrem Prüffall (fremde ID bzw. Liste). */
type Ids = { a: string; webhook: string; aufgabe: string; mitteilung: string; stellvertretung: string; vertreterB: string };
const CASES: Record<string, (ids: Ids) => { method: string; url: string; body?: unknown; headers?: Record<string, string>; kind: 'foreign' | 'list' | 'create' }> = {
  'GET /v1/handlungsfelder': () => ({ method: 'GET', url: '/v1/handlungsfelder', kind: 'list' }),
  'POST /v1/handlungsfelder': () => ({ method: 'POST', url: '/v1/handlungsfelder', body: { label: MARK }, kind: 'create' }),
  'GET /v1/handlungsfelder/:id': i => ({ method: 'GET', url: `/v1/handlungsfelder/${i.a}`, kind: 'foreign' }),
  'PATCH /v1/handlungsfelder/:id': i => ({ method: 'PATCH', url: `/v1/handlungsfelder/${i.a}`, body: { label: 'gehackt' }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
  'DELETE /v1/handlungsfelder/:id': i => ({ method: 'DELETE', url: `/v1/handlungsfelder/${i.a}`, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
  'GET /v1/handlungsfelder/:id/history': i => ({ method: 'GET', url: `/v1/handlungsfelder/${i.a}/history`, kind: 'foreign' }),
  'GET /v1/eingang': () => ({ method: 'GET', url: '/v1/eingang', kind: 'list' }),
  'GET /v1/eingang/anzahl': () => ({ method: 'GET', url: '/v1/eingang/anzahl', kind: 'list' }),
  'POST /v1/eingang/aufgaben/:id/erledigen': i => ({ method: 'POST', url: `/v1/eingang/aufgaben/${i.aufgabe}/erledigen`, kind: 'foreign' }),
  'GET /v1/mitteilungen': () => ({ method: 'GET', url: '/v1/mitteilungen', kind: 'list' }),
  'POST /v1/mitteilungen/:id/gelesen': i => ({ method: 'POST', url: `/v1/mitteilungen/${i.mitteilung}/gelesen`, kind: 'foreign' }),
  'GET /v1/stellvertretungen': () => ({ method: 'GET', url: '/v1/stellvertretungen', kind: 'list' }),
  'POST /v1/stellvertretungen': i => ({ method: 'POST', url: '/v1/stellvertretungen', body: { vertreter: i.vertreterB, von: '2099-01-01', bis: '2099-01-31' }, kind: 'create' }),
  'DELETE /v1/stellvertretungen/:id': i => ({ method: 'DELETE', url: `/v1/stellvertretungen/${i.stellvertretung}`, kind: 'foreign' }),
  'GET /v1/webhooks': () => ({ method: 'GET', url: '/v1/webhooks', kind: 'list' }),
  'POST /v1/webhooks': () => ({ method: 'POST', url: '/v1/webhooks', body: { url: 'http://127.0.0.1:9/b', eventTypes: ['*'] }, kind: 'create' }),
  'DELETE /v1/webhooks/:id': i => ({ method: 'DELETE', url: `/v1/webhooks/${i.webhook}`, kind: 'foreign' }),
};
const APP_TAGS = new Set(['Eingang', 'Mitteilungen', 'Stellvertretungen', 'Handlungsfelder', 'Webhooks']);

describe('Mandantentrennung über die API', { skip }, () => {
  let api: TestApi;
  let A: Record<string, string>, B: Record<string, string>;
  const ids: Ids = { a: '', webhook: '', aufgabe: '', mitteilung: '', stellvertretung: '', vertreterB: '' };
  const routes: string[] = [];

  before(async () => {
    api = await testApi();
    const la = await login(api, 'acme', 'u-a', 'org-admin', { clearance: 2 });
    A = { authorization: la.authorization };
    B = { authorization: (await login(api, 'globex', 'u-b', 'org-admin', { clearance: 2 })).authorization };
    ids.vertreterB = (await login(api, 'globex', 'u-b2', 'leser')).principalId;
    const vertreterA = (await login(api, 'acme', 'u-a2', 'leser')).principalId;
    // Eingang von A: manuelle Aufgabe, Mitteilung, Stellvertretung
    await full(api.t.runtime, la.tenantId, async tx => {
      ids.aufgabe = await aufgabe.oeffnen(tx, { art: 'probe.lesen', bezug: { typ: 'probe', id: 'a' }, empfaenger: { person: la.principalId }, titel: MARK, link: '/eingang', manuell: true });
      ids.mitteilung = await mitteilung.senden(tx, { an: la.principalId, bezug: { typ: 'probe', id: 'a' }, text: MARK });
    });
    const st = await api.app.inject({ method: 'POST', url: '/v1/stellvertretungen', headers: A, payload: { vertreter: vertreterA, von: '2099-01-01', bis: '2099-01-31' } });
    assert.equal(st.statusCode, 201, st.body);
    ids.stellvertretung = st.json().id;
    const s = await api.app.inject({ method: 'POST', url: '/v1/handlungsfelder', headers: A, payload: { label: MARK } });
    assert.equal(s.statusCode, 201, s.body);
    ids.a = s.json().id;
    const w = await api.app.inject({ method: 'POST', url: '/v1/webhooks', headers: A, payload: { url: 'http://127.0.0.1:9/geheim-a', description: MARK, eventTypes: ['*'] } });
    assert.equal(w.statusCode, 201, w.body);
    ids.webhook = w.json().subscription.id;
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
      const unknown = await req([ids.a, ids.webhook, ids.aufgabe, ids.mitteilung, ids.stellvertretung].reduce((u, id) => u.replace(id, randomUUID()), c.url));
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
      if (c.kind === 'list') assert.ok(![ids.a, ids.webhook, ids.aufgabe, ids.mitteilung, ids.stellvertretung, 'geheim-a', MARK].some(x => r.body.includes(x)), route);
    }
    const mine = (await api.app.inject({ method: 'GET', url: '/v1/handlungsfelder', headers: A })).json().items;
    assert.deepEqual(mine.map((x: { label: string; version: number }) => [x.label, x.version]), [[MARK, 1]]);
    assert.equal((await api.app.inject({ method: 'GET', url: '/v1/webhooks', headers: A })).json().items.length, 1);
  });
});
