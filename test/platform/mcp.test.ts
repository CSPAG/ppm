/**
 * Profil mcp: Mock-IdP mit Token Exchange, API auf echtem Port, MCP-Aufrufe `tools/list` und `tools/call` über
 * Streamable HTTP. Werkzeuge nur mit Recht, Challenge nach RFC 9728 ohne Token, nur POST, jedes Werkzeug umgesetzt.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { startMockIdp, type MockIdp } from '@vollholz/iam-testkit';
import type { FastifyInstance } from 'fastify';
import { createMcpApp } from '../../src/platform/mcp/server.ts';
import { missingTools } from '../../src/platform/mcp/tools.ts';
import { createApi, type Api } from '../../src/platform/main/compose.ts';
import { claims, json, member, testConfig } from './api.ts';
import { createTestDb, skipDb, type TestDatabase } from './harness.ts';

const skip = await skipDb();
const PORT = 18181;
const API = `http://127.0.0.1:${PORT}`;

describe('MCP-Dienst', { skip }, () => {
  let db: TestDatabase, idp: MockIdp, api: Api, mcp: FastifyInstance;

  before(async () => {
    db = await createTestDb();
    idp = await startMockIdp({ realm: 'ppm', audience: 'ppm-api', exchange: { clientId: 'ppm-mcp', clientSecret: 'mcp-geheim' } });
    const env = { PUBLIC_BASE_URL: API, MCP_API_URL: API, MCP_PUBLIC_URL: 'http://mcp.test/mcp', MCP_CLIENT_SECRET: 'mcp-geheim' };
    api = await createApi(testConfig(idp.issuer, env), { db: db.runtime, logger: false });
    await api.app.listen({ host: '127.0.0.1', port: PORT });
    mcp = await createMcpApp(testConfig(idp.issuer, env), { logger: false });
    await mcp.ready();
    await member(db.runtime, 'demo', 'vera', 'viewer');
    await member(db.runtime, 'demo', 'nina', null);
    const owner = await member(db.runtime, 'demo', 'otto', 'editor');
    void owner;
  });
  after(async () => { await mcp?.close(); await api?.close(); await idp?.close(); await db?.drop(); });

  const hostToken = (sub: string, scope = 'openid organization ppm:read') => idp.token({ ...claims.user({ org: 'demo', sub }), azp: 'ppm-mcp-cli', scope }, { aud: 'ppm-mcp' });
  const rpc = async (token: string | null, method: string, params: Record<string, unknown> = {}, http: 'POST' | 'GET' = 'POST') => mcp.inject({
    method: http, url: '/mcp',
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), accept: 'application/json, text/event-stream', 'content-type': 'application/json' },
    ...(http === 'POST' ? { payload: { jsonrpc: '2.0', id: 1, method, params } } : {}),
  });

  test('jedes Werkzeug des Modells ist umgesetzt', () => assert.deepEqual(missingTools(), []));

  test('ohne Token 401 mit Challenge (RFC 9728), Metadaten', async () => {
    const r = await rpc(null, 'tools/list');
    assert.equal(r.statusCode, 401);
    assert.match(String(r.headers['www-authenticate']), /resource_metadata=/);
    const m = await mcp.inject({ method: 'GET', url: '/.well-known/oauth-protected-resource/mcp' });
    assert.equal(m.statusCode, 200);
    assert.equal(json(m).resource, 'http://mcp.test/mcp');
  });

  test('tools/list: Werkzeuge nur mit Recht; ohne Recht leere Liste statt Fehler', async () => {
    const r = await rpc(await hostToken('vera'), 'tools/list');
    assert.equal(r.statusCode, 200, r.body);
    const tools = json(r).result.tools as { name: string; annotations?: { readOnlyHint?: boolean } }[];
    assert.deepEqual(tools.map(x => x.name).sort(), ['get_projekt', 'list_projekte']);
    assert.ok(tools.every(x => x.annotations?.readOnlyHint === true));
    const none = await rpc(await hostToken('nina'), 'tools/list');
    assert.equal(none.statusCode, 200, none.body);
    assert.deepEqual(json(none).result.tools, []);
  });

  test('tools/call über die REST-API (Token Exchange, DPoP)', async () => {
    const otto = await idp.token(claims.user({ org: 'demo', sub: 'otto' }));
    const created = await api.app.inject({ method: 'POST', url: '/v1/projekte', headers: { authorization: `Bearer ${otto}` }, payload: { label: 'Über MCP sichtbar' } });
    assert.equal(created.statusCode, 201, created.body);
    const id = json(created).id;
    const list = await rpc(await hostToken('vera'), 'tools/call', { name: 'list_projekte', arguments: { q: 'MCP' } });
    assert.equal(list.statusCode, 200, list.body);
    const res = json(list).result;
    assert.ok(!res.isError, JSON.stringify(res));
    assert.deepEqual(res.structuredContent.items.map((x: { id: string }) => x.id), [id]);
    const one = json(await rpc(await hostToken('vera'), 'tools/call', { name: 'get_projekt', arguments: { id } })).result;
    assert.equal(one.structuredContent.label, 'Über MCP sichtbar');
    const missing = json(await rpc(await hostToken('vera'), 'tools/call', { name: 'get_projekt', arguments: { id: crypto.randomUUID() } })).result;
    assert.equal(missing.isError, true);
    assert.match(missing.content[0].text, /^404/);
    const src = (await db.inspect.query("SELECT count(*)::int AS n FROM ppm.principal WHERE subject = 'vera'")).rows[0].n;
    assert.equal(src, 1);
  });

  test('nur POST (zustandslos)', async () => {
    const r = await rpc(await hostToken('vera'), 'tools/list', {}, 'GET');
    assert.equal(r.statusCode, 405);
  });
});
