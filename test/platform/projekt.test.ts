/**
 * Beispielmodul «projekt»: CRUD, ETag/If-Match (428/412), Idempotenz, Rechte inkl. Scope, Klassifizierung, Zeitraum
 * (422 mit Feldpfad, auch bei PATCH gegen den zusammengeführten Stand), Verlauf, Audit, Ereignisse, Vorgang (202).
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { createTestDb, skipDb, type TestDatabase } from './harness.ts';
import { client, grant, json, member, testApi, type TestApi } from './api.ts';

const skip = await skipDb();

describe('projekt', { skip }, () => {
  let db: TestDatabase, t: TestApi;
  let anna: string, bruno: string, carla: string, dora: string;
  let demo: string;

  before(async () => {
    db = await createTestDb();
    t = await testApi(db.runtime);
    demo = (await member(db.runtime, 'demo', 'anna', 'editor', 2)).tenantId;
    await member(db.runtime, 'demo', 'bruno', 'viewer');
    await member(db.runtime, 'demo', 'carla', null);
    await member(db.runtime, 'demo', 'dora', 'auditor');
    anna = await t.token({ sub: 'anna', org: 'demo' });
    bruno = await t.token({ sub: 'bruno', org: 'demo' });
    carla = await t.token({ sub: 'carla', org: 'demo' });
    dora = await t.token({ sub: 'dora', org: 'demo' });
  });
  after(async () => { await t?.close(); await db?.drop(); });

  const create = (token: string, body: Record<string, unknown>, headers: Record<string, string> = {}) =>
    t.req({ method: 'POST', url: '/v1/projekte', token, payload: body, headers });

  test('anlegen, lesen, ändern mit If-Match, löschen; Verlauf und Audit', async () => {
    const c = await create(anna, { label: 'Neubau Bettenhaus', beginn: '2027-01-01', ende: '2028-12-31' });
    assert.equal(c.statusCode, 201, c.body);
    const p = json(c);
    assert.equal(c.headers.etag, 'W/"1"');
    assert.equal(c.headers.location, `/v1/projekte/${p.id}`);
    assert.deepEqual([p.label, p.version, p.classification, p.can], ['Neubau Bettenhaus', 1, 0, { write: true, delete: true }]);

    const g = await t.req({ method: 'GET', url: `/v1/projekte/${p.id}`, token: bruno });
    assert.equal(g.statusCode, 200);
    assert.deepEqual(json(g).can, { write: false, delete: false });

    const noMatch = await t.req({ method: 'PATCH', url: `/v1/projekte/${p.id}`, token: anna, payload: { label: 'X' } });
    assert.equal(noMatch.statusCode, 428);
    const u = await t.req({ method: 'PATCH', url: `/v1/projekte/${p.id}`, token: anna, payload: { label: 'Neubau Bettenhaus Ost' }, headers: { 'if-match': 'W/"1"' } });
    assert.equal(u.statusCode, 200, u.body);
    assert.equal(u.headers.etag, 'W/"2"');
    const stale = await t.req({ method: 'PATCH', url: `/v1/projekte/${p.id}`, token: anna, payload: { label: 'Zu spät' }, headers: { 'if-match': 'W/"1"' } });
    assert.equal(stale.statusCode, 412);
    assert.equal(json(stale).currentVersion, 2);
    assert.match(stale.headers['content-type'] as string, /application\/problem\+json/);

    const h = json(await t.req({ method: 'GET', url: `/v1/projekte/${p.id}/history`, token: bruno }));
    assert.deepEqual(h.items.map((v: { version: number; action: string }) => `${v.version}:${v.action}`), ['2:updated', '1:created']);

    const d = await t.req({ method: 'DELETE', url: `/v1/projekte/${p.id}`, token: anna, headers: { 'if-match': 'W/"2"' } });
    assert.equal(d.statusCode, 204);
    assert.equal((await t.req({ method: 'GET', url: `/v1/projekte/${p.id}`, token: anna })).statusCode, 404);
    const after = await t.req({ method: 'GET', url: `/v1/projekte/${p.id}/history`, token: bruno });
    assert.equal(after.statusCode, 200, 'Verlauf bleibt nach dem Löschen lesbar');
    assert.deepEqual(json(after).items.map((v: { action: string }) => v.action), ['deleted', 'updated', 'created']);

    const audit = (await db.inspect.query<{ action: string }>("SELECT action FROM ppm.audit_log WHERE resource_type = 'projekt' AND resource_id = $1 ORDER BY id", [p.id])).rows.map(r => r.action);
    assert.deepEqual(audit, ['projekt.created', 'projekt.updated', 'projekt.deleted']);
    const events = (await db.inspect.query<{ type: string; source: string }>("SELECT type, source FROM ppm.outbox_event WHERE subject = $1 ORDER BY occurred_at", [`projekt/${p.id}`])).rows;
    assert.deepEqual(events.map(e => e.type), ['projekt.created', 'projekt.updated', 'projekt.deleted']);
    assert.equal(events[0]!.source, 'api');
  });

  test('Zeitraum: Beginn und Ende nur gemeinsam, Ende nicht vor Beginn (422 mit Pfad), auch bei PATCH', async () => {
    const a = await create(anna, { label: 'Nur Beginn', beginn: '2027-01-01' });
    assert.equal(a.statusCode, 422);
    assert.deepEqual(json(a).errors, [{ path: '/ende', message: 'Beginn und Ende gibt es nur gemeinsam.' }]);
    const b = await create(anna, { label: 'Rückwärts', beginn: '2027-02-01', ende: '2027-01-01' });
    assert.equal(json(b).errors[0].path, '/ende');
    const ok = json(await create(anna, { label: 'Mit Zeitraum', beginn: '2027-01-01', ende: '2027-06-30' }));
    const p = await t.req({ method: 'PATCH', url: `/v1/projekte/${ok.id}`, token: anna, payload: { ende: '2026-01-01' }, headers: { 'if-match': 'W/"1"' } });
    assert.equal(p.statusCode, 422);
    assert.equal(json(p).errors[0].path, '/ende');
    const unknown = await create(anna, { label: 'X', status: 'neu' });
    assert.equal(unknown.statusCode, 422, 'unbekannte Felder werden abgelehnt');
  });

  test('Idempotency-Key: gleiche Antwort; anderer Inhalt 409', async () => {
    const h = { 'idempotency-key': 'k-123' };
    const a = await create(anna, { label: 'Einmalig' }, h);
    const b = await create(anna, { label: 'Einmalig' }, h);
    assert.deepEqual([a.statusCode, b.statusCode], [201, 201]);
    assert.equal(json(a).id, json(b).id);
    assert.equal(b.headers['idempotency-replayed'], 'true');
    assert.equal(b.headers.etag, a.headers.etag);
    const c = await create(anna, { label: 'Anders' }, h);
    assert.equal(c.statusCode, 409);
    const n = (await db.inspect.query("SELECT count(*)::int AS n FROM ppm.projekt WHERE label = 'Einmalig'")).rows[0].n;
    assert.equal(n, 1);
  });

  test('Rechte: viewer liest, ändert nicht; ohne Rolle 403; auditor liest; Freigabe am Projekt', async () => {
    const p = json(await create(anna, { label: 'Rechte' }));
    assert.equal((await create(bruno, { label: 'Nein' })).statusCode, 403);
    assert.equal((await t.req({ method: 'PATCH', url: `/v1/projekte/${p.id}`, token: bruno, payload: { label: 'Nein' }, headers: { 'if-match': 'W/"1"' } })).statusCode, 403);
    assert.equal((await t.req({ method: 'GET', url: '/v1/projekte', token: carla })).statusCode, 403, 'ohne Recht irgendwo');
    assert.equal((await t.req({ method: 'GET', url: `/v1/projekte/${p.id}`, token: dora })).statusCode, 200);

    // Freigabe nur an diesem Projekt: carla sieht genau dieses
    const other = json(await create(anna, { label: 'Nicht freigegeben' }));
    const carlaId = (await db.inspect.query("SELECT id FROM ppm.principal WHERE subject = 'carla'")).rows[0].id;
    await grant(db.runtime, demo, `user:${carlaId}`, 'viewer', { type: 'projekt', id: p.id });
    const list = json(await t.req({ method: 'GET', url: '/v1/projekte', token: carla }));
    assert.deepEqual(list.items.map((x: { id: string }) => x.id), [p.id]);
    assert.equal((await t.req({ method: 'GET', url: `/v1/projekte/${other.id}`, token: carla })).statusCode, 403);
  });

  test('Klassifizierung: über der Freigabestufe 403 ohne Inhalt; Anlegen nur bis zur eigenen Stufe', async () => {
    const secret = json(await create(anna, { label: 'Streng vertraulich', classification: 2 }));
    const r = await t.req({ method: 'GET', url: `/v1/projekte/${secret.id}`, token: bruno });
    assert.equal(r.statusCode, 403);
    assert.ok(!r.body.includes('Streng vertraulich'));
    const list = json(await t.req({ method: 'GET', url: '/v1/projekte?q=Streng', token: bruno }));
    assert.deepEqual(list.items, []);
    await member(db.runtime, 'demo', 'emil', 'editor', 0);
    const emil = await t.token({ sub: 'emil', org: 'demo' });
    assert.equal((await create(emil, { label: 'Zu hoch', classification: 1 })).statusCode, 403);
    const p = json(await create(anna, { label: 'Umstufen' }));
    assert.equal((await t.req({ method: 'PATCH', url: `/v1/projekte/${p.id}`, token: anna, payload: { classification: 1 }, headers: { 'if-match': 'W/"1"' } })).statusCode, 200);
    const a = (await db.inspect.query("SELECT data FROM ppm.audit_log WHERE action = 'object.classified' AND resource_id = $1", [p.id])).rows[0];
    assert.deepEqual(a?.data, { from: 0, to: 1 });
  });

  test('Liste: Suche und Cursor; fremder Cursor 422', async () => {
    for (const n of ['Alpha', 'Beta', 'Gamma', 'Delta']) await create(anna, { label: `Liste ${n}` });
    const first = json(await t.req({ method: 'GET', url: '/v1/projekte?q=Liste&limit=3', token: bruno }));
    assert.deepEqual(first.items.map((x: { label: string }) => x.label), ['Liste Alpha', 'Liste Beta', 'Liste Delta']);
    assert.ok(first.next);
    const second = json(await t.req({ method: 'GET', url: `/v1/projekte?q=Liste&limit=3&cursor=${first.next}`, token: bruno }));
    assert.deepEqual([second.items.map((x: { label: string }) => x.label), second.next], [['Liste Gamma'], null]);
    assert.equal((await t.req({ method: 'GET', url: `/v1/projekte?q=Anders&cursor=${first.next}`, token: bruno })).statusCode, 422);
  });

  test('Maschinen-Client: Rolle ∩ Scope', async () => {
    await client(db.runtime, 'demo', 'ppm-import', 'editor');
    const read = await t.clientToken('ppm-import', 'demo', ['ppm:read']);
    const write = await t.clientToken('ppm-import', 'demo', ['ppm:read', 'projekt:write']);
    assert.equal((await t.req({ method: 'GET', url: '/v1/projekte', token: read })).statusCode, 200);
    assert.equal((await create(read, { label: 'Nur lesen' })).statusCode, 403, 'Scope fehlt');
    const c = await create(write, { label: 'Vom Client' });
    assert.equal(c.statusCode, 201, c.body);
    const src = (await db.inspect.query("SELECT source, client_id FROM ppm.audit_log WHERE action = 'projekt.created' AND resource_id = $1", [json(c).id])).rows[0];
    assert.deepEqual(src, { source: 'api', client_id: 'ppm-import' });
  });

  test('Vorgang: 202 mit Location, Abfrage nur durch den Auslöser', async () => {
    const r = await t.req({ method: 'POST', url: '/v1/projekte:zusammenfassen', token: bruno });
    assert.equal(r.statusCode, 202, r.body);
    const loc = r.headers.location as string;
    assert.match(loc, /^\/v1\/vorgaenge\/[0-9a-f-]{36}$/);
    const v = json(await t.req({ method: 'GET', url: loc, token: bruno }));
    assert.equal(v.status, 'queued');
    assert.equal((await t.req({ method: 'GET', url: loc, token: anna })).statusCode, 404, 'fremder Vorgang');
    assert.equal((await t.req({ method: 'POST', url: '/v1/projekte::zusammenfassen', token: bruno })).statusCode, 404, 'nur mit einem Doppelpunkt');
  });
});
