/**
 * Strategische Ziele je Handlungsfeld (BC ZM.01.02, UC-011 Schritt 2, AP-E0-9): anlegen, ändern, löschen mit ETag,
 * Verlauf nachvollziehbar, Sortierung nach Nummer, Filter, Cursor, Rechte, Handlungsfeld als Bezug, Audit und Ereignis.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { dbTests, postgresSkip } from '@vollholz/iam-testkit';
import { full } from './harness.ts';
import { login, testApi, type TestApi } from './api.ts';

const { after, before, describe, test } = dbTests(await postgresSkip());

describe('Strategische Ziele', () => {
  let api: TestApi;
  let editor: Record<string, string>, viewer: Record<string, string>, nobody: Record<string, string>;
  let tenantId: string;
  let feld1 = '', feld2 = '';

  before(async () => {
    api = await testApi();
    const e = await login(api, 'demo', 'u-editor', 'alle-fuehren');
    tenantId = e.tenantId;
    editor = { authorization: e.authorization };
    viewer = { authorization: (await login(api, 'demo', 'u-viewer', 'mitglied')).authorization };
    nobody = { authorization: (await login(api, 'demo', 'u-nobody', null)).authorization };
    feld1 = (await call('POST', '/v1/handlungsfelder', editor, { label: 'Patientenorientierung', position: 1 })).json().id;
    feld2 = (await call('POST', '/v1/handlungsfelder', editor, { label: 'Wirtschaftlichkeit', position: 2 })).json().id;
  });
  after(async () => { await api?.close(); });

  const call = (method: string, url: string, headers: Record<string, string>, payload?: unknown) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...headers, ...(payload !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}) });

  test('anlegen, lesen, ändern, löschen mit ETag; Verlauf mit jeder Fassung', async () => {
    const c = await call('POST', '/v1/strategische-ziele', editor, { handlungsfeldId: feld1, nummer: '1.1', text: '  Zugang zur Versorgung verbessern ', metrik: ' Wartezeit ' });
    assert.equal(c.statusCode, 201, c.body);
    const s = c.json();
    assert.deepEqual([s.handlungsfeldId, s.nummer, s.text, s.horizont, s.metrik, s.zielwert, s.version], [feld1, '1.1', 'Zugang zur Versorgung verbessern', 2030, 'Wartezeit', '', 1]);
    assert.deepEqual(s.can, { write: true });
    assert.equal(c.headers.location, `/v1/strategische-ziele/${s.id}`);
    assert.equal(c.headers.etag, 'W/"1"');

    const g = await call('GET', `/v1/strategische-ziele/${s.id}`, viewer);
    assert.equal(g.statusCode, 200);
    assert.deepEqual(g.json().can, { write: false });

    assert.equal((await call('PATCH', `/v1/strategische-ziele/${s.id}`, editor, { zielwert: '< 14 Tage' })).statusCode, 428);
    const p = await call('PATCH', `/v1/strategische-ziele/${s.id}`, { ...editor, 'if-match': 'W/"1"' }, { zielwert: ' < 14 Tage ', handlungsfeldId: feld2 });
    assert.equal(p.statusCode, 200, p.body);
    assert.deepEqual([p.json().version, p.json().zielwert, p.json().handlungsfeldId, p.json().text], [2, '< 14 Tage', feld2, 'Zugang zur Versorgung verbessern']);
    assert.equal(p.headers.etag, 'W/"2"');

    const stale = await call('PATCH', `/v1/strategische-ziele/${s.id}`, { ...editor, 'if-match': 'W/"1"' }, { text: 'Alt' });
    assert.equal(stale.statusCode, 412);
    assert.equal(stale.json().currentVersion, 2);
    assert.equal((await call('PATCH', `/v1/strategische-ziele/${s.id}`, { ...editor, 'if-match': 'W/"2"' }, { farbe: 'rot' })).statusCode, 422, 'unbekannte Felder');

    assert.equal((await call('DELETE', `/v1/strategische-ziele/${s.id}`, { ...editor, 'if-match': 'W/"1"' })).statusCode, 412);
    assert.equal((await call('DELETE', `/v1/strategische-ziele/${s.id}`, { ...editor, 'if-match': 'W/"2"' })).statusCode, 204);
    assert.equal((await call('GET', `/v1/strategische-ziele/${s.id}`, editor)).statusCode, 404);

    const h = await call('GET', `/v1/strategische-ziele/${s.id}/history`, viewer);
    assert.equal(h.statusCode, 200);
    const items = h.json().items as { version: number; action: string; zielwert: string; handlungsfeldId: string; changedBy: string | null }[];
    assert.deepEqual(items.map(v => `${v.version}:${v.action}:${v.zielwert}`), ['3:deleted:< 14 Tage', '2:updated:< 14 Tage', '1:created:']);
    assert.deepEqual(items.map(v => v.handlungsfeldId), [feld2, feld2, feld1], 'früherer Stand mit altem Handlungsfeld');
    assert.ok(items.every(v => v.changedBy), 'jede Fassung mit Person');
  });

  test('Liste: Sortierung nach Nummer (2.9 vor 2.10), Filter nach Handlungsfeld, Suche und Cursor', async () => {
    for (const [nummer, feld] of [['2.10', feld2], ['2.9', feld2], ['2.1', feld2], ['1.2', feld1]] as const) {
      assert.equal((await call('POST', '/v1/strategische-ziele', editor, { handlungsfeldId: feld, nummer, text: `Ziel ${nummer}` })).statusCode, 201);
    }
    const all = (await call('GET', '/v1/strategische-ziele', viewer)).json();
    assert.deepEqual(all.items.map((x: { nummer: string }) => x.nummer), ['1.2', '2.1', '2.9', '2.10']);
    const first = (await call('GET', `/v1/strategische-ziele?handlungsfeld=${feld2}&limit=2`, viewer)).json();
    assert.deepEqual(first.items.map((x: { nummer: string }) => x.nummer), ['2.1', '2.9']);
    assert.ok(first.nextCursor);
    const second = (await call('GET', `/v1/strategische-ziele?handlungsfeld=${feld2}&limit=2&cursor=${first.nextCursor}`, viewer)).json();
    assert.deepEqual(second.items.map((x: { nummer: string }) => x.nummer), ['2.10']);
    assert.equal(second.nextCursor, null);
    assert.equal((await call('GET', `/v1/strategische-ziele?cursor=${first.nextCursor}`, viewer)).statusCode, 422, 'Cursor eines anderen Filters');
    assert.deepEqual((await call('GET', '/v1/strategische-ziele?q=ziel%201', viewer)).json().items.map((x: { nummer: string }) => x.nummer), ['1.2']);
    assert.deepEqual((await call('GET', '/v1/strategische-ziele?nummer=2.1', viewer)).json().items.map((x: { nummer: string }) => x.nummer), ['2.1'], 'genau diese Nummer');
    // Nummer eindeutig, Format geprüft
    assert.equal((await call('POST', '/v1/strategische-ziele', editor, { handlungsfeldId: feld1, nummer: '2.9', text: 'Doppelt' })).statusCode, 409);
    assert.equal((await call('POST', '/v1/strategische-ziele', editor, { handlungsfeldId: feld1, nummer: 'A1', text: 'Format' })).statusCode, 422);
  });

  test('Handlungsfeld: unbekanntes ergibt 404; Handlungsfeld mit Zielen nicht löschbar', async () => {
    const r = await call('POST', '/v1/strategische-ziele', editor, { handlungsfeldId: randomUUID(), nummer: '9.1', text: 'Ohne Feld' });
    assert.equal(r.statusCode, 404, r.body);
    assert.match(r.headers['content-type'] as string, /application\/problem\+json/);
    const z = (await call('GET', `/v1/strategische-ziele?handlungsfeld=${feld1}`, viewer)).json().items[0];
    assert.equal((await call('PATCH', `/v1/strategische-ziele/${z.id}`, { ...editor, 'if-match': `W/"${z.version}"` }, { handlungsfeldId: randomUUID() })).statusCode, 404);
    const hf = (await call('GET', `/v1/handlungsfelder/${feld1}`, editor)).json();
    assert.equal((await call('DELETE', `/v1/handlungsfelder/${feld1}`, { ...editor, 'if-match': `W/"${hf.version}"` })).statusCode, 409);
  });

  test('Rechte: Leser:in ändert nicht, ohne Rolle nichts sichtbar', async () => {
    assert.equal((await call('POST', '/v1/strategische-ziele', viewer, { handlungsfeldId: feld1, nummer: '7.1', text: 'Verboten' })).statusCode, 403);
    assert.equal((await call('GET', '/v1/strategische-ziele', nobody)).statusCode, 403);
    assert.equal((await call('GET', '/v1/strategische-ziele', {})).statusCode, 401);
  });

  test('Audit und Ereignis in derselben Transaktion', async () => {
    const c = await call('POST', '/v1/strategische-ziele', { ...editor, 'x-request-id': 'req-ziel' }, { handlungsfeldId: feld1, nummer: '1.5', text: 'Qualität messen' });
    assert.equal(c.statusCode, 201);
    const id = c.json().id;
    const rows = await full(api.t.runtime, tenantId, async tx => ({
      audit: (await tx.query('SELECT action, source, correlation_id FROM ppm.audit_log WHERE resource_id = $1', [id])).rows,
      events: (await tx.query('SELECT type, subject FROM ppm.outbox_event WHERE subject = $1', [`strategisches_ziel/${id}`])).rows,
    }));
    assert.deepEqual(rows.audit, [{ action: 'strategisches_ziel.created', source: 'api', correlation_id: 'req-ziel' }]);
    assert.deepEqual(rows.events, [{ type: 'strategisches_ziel.created', subject: `strategisches_ziel/${id}` }]);
  });
});
