/**
 * Beispielmodul Handlungsfelder (BC ZM.01.01): CRUD, Reihenfolge, Cursor, ETag/If-Match (412, 428), Idempotenz, Rechte
 * inklusive Scope (Rolle ∩ Scope), Audit, Ereignis in der Outbox und Verlauf.
 */
import assert from 'node:assert/strict';
import { dbTests, postgresSkip } from '@vollholz/iam-testkit';
import { full } from './harness.ts';
import { login, machine, testApi, type TestApi } from './api.ts';

const { after, before, describe, test } = dbTests(await postgresSkip());

describe('Handlungsfelder', () => {
  let api: TestApi;
  let editor: Record<string, string>, viewer: Record<string, string>, nobody: Record<string, string>;
  let tenantId: string;

  before(async () => {
    api = await testApi();
    const e = await login(api, 'demo', 'u-editor', 'gl');
    tenantId = e.tenantId;
    editor = { authorization: e.authorization };
    viewer = { authorization: (await login(api, 'demo', 'u-viewer', 'leser')).authorization };
    nobody = { authorization: (await login(api, 'demo', 'u-nobody', null)).authorization };
  });
  after(async () => { await api?.close(); });

  const call = (method: string, url: string, headers: Record<string, string>, payload?: unknown) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...headers, ...(payload !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}) });

  test('anlegen, lesen, ändern, löschen mit ETag', async () => {
    const c = await call('POST', '/v1/handlungsfelder', editor, {
      label: '  Patientenorientierung ', leitsatz: ' Wir stellen die Patientinnen und Patienten ins Zentrum. ', stossrichtungen: [' Zugang verbessern ', 'Abläufe vereinfachen'],
    });
    assert.equal(c.statusCode, 201, c.body);
    const s = c.json();
    assert.equal(s.label, 'Patientenorientierung');
    assert.equal(s.leitsatz, 'Wir stellen die Patientinnen und Patienten ins Zentrum.');
    assert.deepEqual([s.stossrichtungen, s.position, s.version], [['Zugang verbessern', 'Abläufe vereinfachen'], 0, 1]);
    assert.deepEqual(s.can, { write: true, delete: true });
    assert.equal(c.headers.location, `/v1/handlungsfelder/${s.id}`);
    assert.equal(c.headers.etag, 'W/"1"');

    const g = await call('GET', `/v1/handlungsfelder/${s.id}`, viewer);
    assert.equal(g.statusCode, 200);
    assert.deepEqual(g.json().can, { write: false, delete: false });

    const noIfMatch = await call('PATCH', `/v1/handlungsfelder/${s.id}`, editor, { position: 2 });
    assert.equal(noIfMatch.statusCode, 428);
    assert.match(noIfMatch.headers['content-type'] as string, /application\/problem\+json/);

    const p = await call('PATCH', `/v1/handlungsfelder/${s.id}`, { ...editor, 'if-match': 'W/"1"' }, { position: 2, stossrichtungen: [] });
    assert.equal(p.statusCode, 200, p.body);
    assert.deepEqual([p.json().version, p.json().position, p.json().stossrichtungen, p.json().label], [2, 2, [], 'Patientenorientierung']);
    assert.equal(p.headers.etag, 'W/"2"');

    const stale = await call('PATCH', `/v1/handlungsfelder/${s.id}`, { ...editor, 'if-match': 'W/"1"' }, { label: 'Alt' });
    assert.equal(stale.statusCode, 412);
    assert.equal(stale.json().currentVersion, 2);

    const unknown = await call('PATCH', `/v1/handlungsfelder/${s.id}`, { ...editor, 'if-match': 'W/"2"' }, { farbe: 'rot' });
    assert.equal(unknown.statusCode, 422, 'unbekannte Felder');

    assert.equal((await call('DELETE', `/v1/handlungsfelder/${s.id}`, { ...editor, 'if-match': 'W/"1"' })).statusCode, 412);
    assert.equal((await call('DELETE', `/v1/handlungsfelder/${s.id}`, { ...editor, 'if-match': 'W/"2"' })).statusCode, 204);
    assert.equal((await call('GET', `/v1/handlungsfelder/${s.id}`, editor)).statusCode, 404);

    const h = await call('GET', `/v1/handlungsfelder/${s.id}/history`, viewer);
    assert.equal(h.statusCode, 200);
    assert.deepEqual(h.json().items.map((v: { version: number; action: string }) => `${v.version}:${v.action}`), ['3:deleted', '2:updated', '1:created']);
  });

  test('Liste: Reihenfolge, Suche und Cursor', async () => {
    for (const [label, position] of [['Feld C', 1], ['Feld A', 3], ['Feld B', 1], ['Anderes', 0]] as const) {
      assert.equal((await call('POST', '/v1/handlungsfelder', editor, { label, position })).statusCode, 201);
    }
    const first = (await call('GET', '/v1/handlungsfelder?q=feld&limit=2', viewer)).json();
    assert.deepEqual(first.items.map((x: { label: string }) => x.label), ['Feld B', 'Feld C']);
    assert.ok(first.nextCursor);
    const second = (await call('GET', `/v1/handlungsfelder?q=feld&limit=2&cursor=${first.nextCursor}`, viewer)).json();
    assert.deepEqual(second.items.map((x: { label: string }) => x.label), ['Feld A']);
    assert.equal(second.nextCursor, null);
    // Cursor einer anderen Suche
    assert.equal((await call('GET', `/v1/handlungsfelder?q=x&cursor=${first.nextCursor}`, viewer)).statusCode, 422);
    // Name eindeutig ohne Gross/klein
    assert.equal((await call('POST', '/v1/handlungsfelder', editor, { label: 'ANDERES' })).statusCode, 409);
  });

  test('Rechte: Leser:in ändert nicht, ohne Rolle nichts sichtbar', async () => {
    assert.equal((await call('POST', '/v1/handlungsfelder', viewer, { label: 'Verboten' })).statusCode, 403);
    assert.equal((await call('GET', '/v1/handlungsfelder', nobody)).statusCode, 403);
    assert.equal((await call('GET', '/v1/handlungsfelder', {})).statusCode, 401);
  });

  test('Scope: Rolle ∩ Scope bei Maschinen-Clients', async () => {
    const reader = await machine(api, 'demo', 'lesesystem', 'gl', ['ppm:read']);
    const writer = await machine(api, 'demo', 'schreibsystem', 'gl', ['ppm:read', 'handlungsfeld:write']);
    assert.equal((await call('GET', '/v1/handlungsfelder', reader)).statusCode, 200);
    assert.equal((await call('POST', '/v1/handlungsfelder', reader, { label: 'Vom Lesesystem' })).statusCode, 403, 'Rolle gl, aber Scope nur lesen');
    const w = await call('POST', '/v1/handlungsfelder', writer, { label: 'Vom Schreibsystem' });
    assert.equal(w.statusCode, 201, w.body);
  });

  test('Idempotency-Key: Wiederholung liefert dieselbe Antwort, andere Anfrage 409', async () => {
    const h = { ...editor, 'idempotency-key': 'k-1' };
    const a = await call('POST', '/v1/handlungsfelder', h, { label: 'Wirtschaftlichkeit' });
    const b = await call('POST', '/v1/handlungsfelder', h, { label: 'Wirtschaftlichkeit' });
    assert.equal(a.statusCode, 201);
    assert.equal(b.statusCode, 201);
    assert.equal(b.headers['idempotent-replayed'], 'true');
    assert.equal(b.json().id, a.json().id);
    assert.equal(b.headers.location, a.headers.location);
    assert.equal((await call('POST', '/v1/handlungsfelder', h, { label: 'Anders' })).statusCode, 409);
  });

  test('Audit und Ereignis in derselben Transaktion', async () => {
    const c = await call('POST', '/v1/handlungsfelder', { ...editor, 'x-request-id': 'req-feld' }, { label: 'Medizin der Zukunft' });
    assert.equal(c.statusCode, 201);
    const id = c.json().id;
    const rows = await full(api.t.runtime, tenantId, async tx => ({
      audit: (await tx.query('SELECT action, source, correlation_id, actor_kind FROM ppm.audit_log WHERE resource_id = $1', [id])).rows,
      events: (await tx.query('SELECT type, subject FROM ppm.outbox_event WHERE subject = $1', [`handlungsfeld/${id}`])).rows,
    }));
    assert.deepEqual(rows.audit, [{ action: 'handlungsfeld.created', source: 'api', correlation_id: 'req-feld', actor_kind: 'user' }]);
    assert.deepEqual(rows.events, [{ type: 'handlungsfeld.created', subject: `handlungsfeld/${id}` }]);
  });
});
