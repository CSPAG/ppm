/**
 * Fehler immer als `application/problem+json` (RFC 9457) mit `type` = `<PUBLIC_BASE_URL>/probleme/<status>`;
 * jede Route der OpenAPI nennt genau einen Tag; Schemas als benannte Komponenten.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { createTestDb, skipDb, type TestDatabase } from './harness.ts';
import { json, member, testApi, type TestApi } from './api.ts';

const skip = await skipDb();

describe('problem+json und OpenAPI', { skip }, () => {
  let db: TestDatabase, t: TestApi, anna: string, bruno: string;
  before(async () => {
    db = await createTestDb();
    t = await testApi(db.runtime, {}, { after: app => { app.get('/v1/test-fehler', { schema: { tags: ['Betrieb'], hide: true } }, async () => { throw new Error('geheimes Detail aus der Datenbank'); }); } });
    await member(db.runtime, 'demo', 'anna', 'editor');
    await member(db.runtime, 'demo', 'bruno', 'viewer');
    anna = await t.token({ sub: 'anna', org: 'demo' });
    bruno = await t.token({ sub: 'bruno', org: 'demo' });
  });
  after(async () => { await t?.close(); await db?.drop(); });

  const isProblem = (r: { statusCode: number; headers: Record<string, unknown>; body: string }, status: number) => {
    assert.equal(r.statusCode, status, r.body);
    assert.match(String(r.headers['content-type']), /^application\/problem\+json/);
    const b = json(r);
    assert.equal(b.status, status);
    assert.equal(b.type, `http://api.test/probleme/${status}`);
    assert.ok(typeof b.title === 'string' && b.title.length);
    return b;
  };

  test('401, 403, 404, 409, 412, 422, 428', async () => {
    isProblem(await t.req({ method: 'GET', url: '/v1/projekte' }), 401);
    isProblem(await t.req({ method: 'POST', url: '/v1/projekte', token: bruno, payload: { label: 'x' } }), 403);
    isProblem(await t.req({ method: 'GET', url: `/v1/projekte/${crypto.randomUUID()}`, token: anna }), 404);
    isProblem(await t.req({ method: 'GET', url: '/v1/gibt-es-nicht', token: anna }), 404);
    const p = json(await t.req({ method: 'POST', url: '/v1/projekte', token: anna, payload: { label: 'P' } }));
    isProblem(await t.req({ method: 'PATCH', url: `/v1/projekte/${p.id}`, token: anna, payload: { label: 'Q' } }), 428);
    assert.equal(isProblem(await t.req({ method: 'PATCH', url: `/v1/projekte/${p.id}`, token: anna, payload: { label: 'Q' }, headers: { 'if-match': 'W/"9"' } }), 412).currentVersion, 1);
    const v = isProblem(await t.req({ method: 'POST', url: '/v1/projekte', token: anna, payload: { label: '' } }), 422);
    assert.ok(v.errors.some((e: { path: string }) => e.path === '/label'));
    isProblem(await t.req({ method: 'GET', url: '/v1/projekte/keine-uuid', token: anna }), 422);
    const h = { 'idempotency-key': 'dup' };
    await t.req({ method: 'POST', url: '/v1/projekte', token: anna, payload: { label: 'A' }, headers: h });
    isProblem(await t.req({ method: 'POST', url: '/v1/projekte', token: anna, payload: { label: 'B' }, headers: h }), 409);
  });

  test('500 mit Referenz (Request-ID), ohne Interna', async () => {
    const r = await t.req({ method: 'GET', url: '/v1/test-fehler', token: anna, headers: { 'x-request-id': 'ref-123' } });
    const b = isProblem(r, 500);
    assert.equal(r.headers['x-request-id'], 'ref-123');
    assert.match(b.detail, /ref-123/);
    assert.ok(!r.body.includes('geheimes Detail'));
  });

  test('OpenAPI 3.1: jede Route genau ein Tag, Schemas der App als Komponenten', async () => {
    const r = await t.req({ method: 'GET', url: '/v1/openapi.json' });
    assert.equal(r.statusCode, 200);
    const doc = json(r);
    assert.equal(doc.openapi, '3.1.0');
    const bad: string[] = [];
    for (const [path, ops] of Object.entries<Record<string, { tags?: string[] }>>(doc.paths)) {
      for (const [m, op] of Object.entries(ops)) if (op.tags?.length !== 1) bad.push(`${m.toUpperCase()} ${path}: ${JSON.stringify(op.tags)}`);
    }
    assert.deepEqual(bad, []);
    for (const s of ['Projekt', 'ProjektList', 'ProjektCreate', 'ProjektPatch', 'Webhook', 'Vorgang', 'Problem', 'ValidationProblem', 'VersionConflict']) assert.ok(doc.components.schemas[s], s);
    const docs = await t.req({ method: 'GET', url: '/v1/docs/' });
    assert.equal(docs.statusCode, 200);
    assert.match(String(docs.headers['content-security-policy']), /script-src/);
    assert.doesNotMatch(String(docs.headers['content-security-policy']), /unsafe-inline'[^;]*script|script-src[^;]*unsafe-inline/);
  });
});
