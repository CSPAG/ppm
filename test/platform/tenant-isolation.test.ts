/**
 * Mandantentrennung über die API (Spezifikation Kap. 14): Eine zweite Organisation (B, «muster») liest, ändert und
 * löscht nichts von A («demo») – fremde IDs ergeben dieselbe Antwort wie eine ID, die es nirgends gibt (404, nie 403
 * mit Inhalt), Listen zeigen nur Daten von B. Vollständigkeit: jede Route der App-Tags aus der OpenAPI ist geprüft oder
 * begründet ausgenommen. Die Routen des Baukastens prüft identity-kit selbst (eigener Isolations-Durchlauf).
 *
 * Neues Modul: seine Routen unten in FOREIGN bzw. LISTS eintragen (Checkliste «Neues Modul anlegen»).
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { coverageProblems, idSource, installProbes, leaks, normalize, routesOf, unreached, type ProbeResponse } from '@vollholz/iam-testkit';
import { API_TAGS } from '../../src/platform/http/app.ts';
import { json, member, testApi, type TestApi } from './api.ts';
import { createTestDb, skipDb, type TestDatabase } from './harness.ts';

const skip = await skipDb();
const MARKERS = ['GEHEIM-A', 'geheim-a.example'];
interface Call { method: string; url: string; body?: unknown; headers?: Record<string, string> }
type Ids = Record<string, string>;

const FOREIGN: { route: string; label: string; call: (i: Ids) => Call }[] = [
  { route: 'GET /v1/projekte/{id}', label: 'Projekt von A lesen', call: i => ({ method: 'GET', url: `/v1/projekte/${i.projekt}` }) },
  { route: 'GET /v1/projekte/{id}/history', label: 'Verlauf von A', call: i => ({ method: 'GET', url: `/v1/projekte/${i.projekt}/history` }) },
  { route: 'PATCH /v1/projekte/{id}', label: 'Projekt von A ändern', call: i => ({ method: 'PATCH', url: `/v1/projekte/${i.projekt}`, body: { label: 'Übernommen' }, headers: { 'if-match': 'W/"1"' } }) },
  { route: 'GET /v1/vorgaenge/{id}', label: 'Vorgang von A', call: i => ({ method: 'GET', url: `/v1/vorgaenge/${i.vorgang}` }) },
  { route: 'GET /v1/webhooks/{id}', label: 'Webhook von A lesen', call: i => ({ method: 'GET', url: `/v1/webhooks/${i.webhook}` }) },
  { route: 'GET /v1/webhooks/{id}/deliveries', label: 'Zustellungen von A', call: i => ({ method: 'GET', url: `/v1/webhooks/${i.webhook}/deliveries` }) },
  { route: 'PATCH /v1/webhooks/{id}', label: 'Webhook von A ändern', call: i => ({ method: 'PATCH', url: `/v1/webhooks/${i.webhook}`, body: { active: false }, headers: { 'if-match': 'W/"1"' } }) },
  { route: 'DELETE /v1/webhooks/{id}', label: 'Webhook von A löschen', call: i => ({ method: 'DELETE', url: `/v1/webhooks/${i.webhook}`, headers: { 'if-match': 'W/"1"' } }) },
  { route: 'DELETE /v1/projekte/{id}', label: 'Projekt von A löschen', call: i => ({ method: 'DELETE', url: `/v1/projekte/${i.projekt}`, headers: { 'if-match': 'W/"1"' } }) },
];

const LISTS: { route: string; url: string }[] = [
  { route: 'GET /v1/projekte', url: '/v1/projekte' },
  { route: 'GET /v1/projekte', url: '/v1/projekte?q=GEHEIM' },
  { route: 'GET /v1/webhooks', url: '/v1/webhooks' },
];

/** Schreibende Routen ohne fremde ID: legen nur in B an (geprüft: nichts in A). */
const CREATE: { route: string; call: Call }[] = [
  { route: 'POST /v1/projekte', call: { method: 'POST', url: '/v1/projekte', body: { label: 'Von B' } } },
  { route: 'POST /v1/projekte:zusammenfassen', call: { method: 'POST', url: '/v1/projekte:zusammenfassen' } },
  { route: 'POST /v1/webhooks', call: { method: 'POST', url: '/v1/webhooks', body: { url: 'https://b.example/hook', events: ['*'] } } },
];

const EXEMPT: Record<string, string> = {
  '/v1/health': 'Öffentlich, ohne Mandant und ohne Daten',
};

describe('Mandantentrennung über die Routen der App', { skip }, () => {
  let db: TestDatabase, t: TestApi;
  const a: Ids = {};
  const tok: Record<string, string> = {};
  const covered = new Map<string, string>();

  const as = async (who: string, c: Call): Promise<ProbeResponse> => {
    const r = await t.app.inject({ method: c.method as 'GET', url: c.url, headers: { authorization: `Bearer ${tok[who]}`, ...c.headers }, ...(c.body !== undefined ? { payload: c.body as object } : {}) });
    return { status: r.statusCode, text: r.body, headers: r.headers };
  };

  before(async () => {
    db = await createTestDb();
    t = await testApi(db.runtime, {}, { after: app => installProbes(app) });
    await member(db.runtime, 'demo', 'alice', 'org-admin', 2);
    await member(db.runtime, 'muster', 'max', 'org-admin', 2);
    tok.alice = await t.token({ sub: 'alice', org: 'demo' });
    tok.max = await t.token({ sub: 'max', org: 'muster' });
    const p = await as('alice', { method: 'POST', url: '/v1/projekte', body: { label: 'GEHEIM-A Projekt', beschreibung: 'GEHEIM-A' } });
    assert.equal(p.status, 201, p.text);
    a.projekt = JSON.parse(p.text).id;
    const v = await as('alice', { method: 'POST', url: '/v1/projekte:zusammenfassen' });
    a.vorgang = JSON.parse(v.text).id;
    const w = await as('alice', { method: 'POST', url: '/v1/webhooks', body: { url: 'https://geheim-a.example/hook', events: ['projekt.created'], description: 'GEHEIM-A' } });
    assert.equal(w.status, 201, w.text);
    a.webhook = JSON.parse(w.text).webhook.id;
  });
  after(async () => { await t?.close(); await db?.drop(); });

  test('1. fremde IDs: gleiche Antwort wie eine unbekannte ID, ohne Daten von A', async () => {
    const problems: string[] = [];
    for (const f of FOREIGN) {
      const foreign = idSource(a), unknown = idSource(null);
      const cf = f.call(foreign.ids), cu = f.call(unknown.ids);
      const rf = await as('max', cf), ru = await as('max', cu);
      for (const [r, c] of [[rf, cf], [ru, cu]] as const) { const u = unreached(r, c.method, f.route); if (u) problems.push(`${f.label}: ${u}`); }
      if (rf.status !== 404) problems.push(`${f.label}: ${rf.status} statt 404`);
      problems.push(...leaks(rf.text, { markers: MARKERS, ids: Object.values(a).filter(v => !cf.url.includes(v)) }).map(x => `${f.label}: ${x}`));
      const same = (r: ProbeResponse, used: Map<string, string>) => ({ status: r.status, body: normalize(r.text, used) });
      if (JSON.stringify(same(rf, foreign.used)) !== JSON.stringify(same(ru, unknown.used))) problems.push(`${f.label}: Antwort verrät die Existenz`);
      covered.set(f.route, 'fremde IDs');
    }
    assert.deepEqual(problems, []);
    const row = (await db.inspect.query('SELECT label, version FROM ppm.projekt WHERE id = $1', [a.projekt])).rows[0];
    assert.deepEqual(row, { label: 'GEHEIM-A Projekt', version: 1 }, 'Projekt von A unverändert');
    assert.equal((await db.inspect.query('SELECT active FROM ppm.webhook WHERE id = $1', [a.webhook])).rows[0]?.active, true, 'Webhook von A unverändert');
  });

  test('2. Listen: nur Daten von B', async () => {
    const problems: string[] = [];
    for (const l of LISTS) {
      const r = await as('max', { method: 'GET', url: l.url });
      const u = unreached(r, 'GET', l.route);
      if (u) problems.push(`${l.url}: ${u}`);
      if (r.status !== 200) problems.push(`${l.url}: ${r.status}`);
      problems.push(...leaks(r.text, { markers: MARKERS, ids: Object.values(a), allowed: [l.url] }).map(x => `${l.url}: ${x}`));
      covered.set(l.route, 'Liste');
    }
    assert.deepEqual(problems, []);
  });

  test('3. Anlegen in B berührt A nicht', async () => {
    const before = (await db.inspect.query("SELECT count(*)::int AS n FROM ppm.projekt p JOIN ppm.tenant x ON x.id = p.tenant_id WHERE x.alias = 'demo'")).rows[0].n;
    for (const c of CREATE) {
      const r = await as('max', c.call);
      assert.equal(unreached(r, c.call.method, c.route), null);
      assert.ok(r.status < 300, `${c.route}: ${r.status} ${r.text}`);
      assert.deepEqual(leaks(r.text, { markers: MARKERS, ids: Object.values(a) }), []);
      covered.set(c.route, 'Anlegen in B');
    }
    assert.equal((await db.inspect.query("SELECT count(*)::int AS n FROM ppm.projekt p JOIN ppm.tenant x ON x.id = p.tenant_id WHERE x.alias = 'demo'")).rows[0].n, before);
    assert.equal(json({ body: (await as('alice', { method: 'GET', url: '/v1/projekte' })).text }).items.length, 1, 'A sieht nur das eigene Projekt');
  });

  test('4. Vollständigkeit: jede Route der App-Tags geprüft oder begründet ausgenommen', () => {
    const tags = new Set(API_TAGS.map(x => x.name));
    const doc = t.app.swagger() as { paths: Record<string, Record<string, { tags?: string[] }>> };
    const all = routesOf(doc).filter(r => { const [m, p] = r.split(' '); return doc.paths[p!]![m!.toLowerCase()]!.tags!.some(x => tags.has(x)); });
    assert.ok(all.length >= 10);
    assert.deepEqual(coverageProblems({ all, covered, exempt: EXEMPT }), { missing: [], stale: [] });
  });
});
