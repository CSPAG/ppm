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
import { MATRIX } from './matrix/index.ts';

const API_TAGS = apiTags(ppm.modules);

const skip = await skipDb();
const MARK = 'GEHEIM-A';

/** Routen der App-Module mit ihrem Prüffall (fremde ID bzw. Liste), je Modul in test/app/matrix/<modul>.ts. */
const CASES = MATRIX.cases;
const APP_TAGS = new Set(MATRIX.tags);

describe('Mandantentrennung über die API', { skip }, () => {
  let api: TestApi;
  let A: Record<string, string>, B: Record<string, string>;
  const ids: Record<string, string> = {};
  const routes: string[] = [];

  before(async () => {
    api = await testApi();
    A = { authorization: (await login(api, 'acme', 'u-a', 'org-admin', { clearance: 2 })).authorization };
    B = { authorization: (await login(api, 'globex', 'u-b', 'org-admin', { clearance: 2 })).authorization };
    for (const seed of MATRIX.seeds) Object.assign(ids, await seed(api, A, MARK));
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
      const unknown = await req(Object.values(ids).reduce((url, id) => url.replace(id, randomUUID()), c.url));
      assert.equal(foreign.statusCode, 404, `${route}: ${foreign.body}`);
      assert.equal(foreign.statusCode, unknown.statusCode, route);
      assert.ok(!foreign.body.toLowerCase().includes(MARK.toLowerCase()), route);
      assert.ok(Object.values(ids).every(id => !foreign.body.includes(id)) || foreign.body.includes('"instance"'), route);
    }
  });

  test('Listen und Anlegen von B zeigen nur B; A ist unverändert', async () => {
    for (const [route, make] of Object.entries(CASES)) {
      const c = make(ids);
      if (c.kind === 'foreign') continue;
      const r = await api.app.inject({ method: c.method as 'GET', url: c.url, headers: B, ...(c.body ? { payload: c.body } : {}) });
      assert.ok(r.statusCode < 300, `${route}: ${r.statusCode} ${r.body}`);
      if (c.kind === 'list') assert.ok(Object.values(ids).every(id => !r.body.includes(id)) && !r.body.includes('geheim-a'), route);
    }
    for (const check of MATRIX.unchanged) await check(api, A, MARK);
  });
});
