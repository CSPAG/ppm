/**
 * Rauchtest gegen eine laufende Instanz mit echtem Keycloak (`npm run smoke`, lokal oder nach einem Deploy):
 * Betriebs-Endpunkt, OpenAPI, problem+json ohne Anmeldung, Anmeldung einer Testperson über den BFF (Code-Flow mit
 * PKCE gegen das Login-Formular von Keycloak), `/auth/me`, `/v1/me`, Projekt anlegen, lesen und löschen (mit CSRF),
 * Abmelden. Code 0 ok, 1 Befund.
 *
 * Umgebung: SMOKE_URL (Standard PUBLIC_BASE_URL), SMOKE_OPS_URL (Standard http://localhost:9090, leer = überspringen),
 * SMOKE_USER (anna@demo.example), SMOKE_PASSWORD (E2E_PASSWORD), SMOKE_WRITE=false für Umgebungen ohne Schreibtest.
 */
const env = process.env;
const BASE = (env.SMOKE_URL || env.PUBLIC_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const OPS = env.SMOKE_OPS_URL ?? 'http://localhost:9090';
const USER = env.SMOKE_USER || 'anna@demo.example';
const PASSWORD = env.SMOKE_PASSWORD || env.E2E_PASSWORD || 'Test1234!';
const WRITE = env.SMOKE_WRITE !== 'false';

const jar = new Map<string, string>();
const cookies = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
function remember(r: Response) {
  for (const c of r.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv!.indexOf('='); const k = kv!.slice(0, i), v = kv!.slice(i + 1); if (v) jar.set(k, v); else jar.delete(k); }
}
/** Abruf mit Cookies, ohne automatische Weiterleitung. */
async function go(url: string, init: RequestInit = {}): Promise<Response> {
  const r = await fetch(url, { ...init, redirect: 'manual', headers: { ...(init.headers as Record<string, string>), cookie: cookies() }, signal: AbortSignal.timeout(15_000) });
  remember(r);
  return r;
}
/** Weiterleitungen folgen (Cookies je Herkunft getrennt halten ist hier nicht nötig: Namen kollidieren nicht). */
async function follow(url: string, init: RequestInit = {}, max = 10): Promise<Response> {
  let r = await go(url, init);
  for (let i = 0; i < max && r.status >= 300 && r.status < 400; i++) r = await go(new URL(r.headers.get('location')!, url).href);
  return r;
}

const results: { name: string; ok: boolean; detail?: string }[] = [];
async function check(name: string, fn: () => Promise<string | void>) {
  try { const d = await fn(); results.push({ name, ok: true, ...(d ? { detail: d } : {}) }); } catch (e) { results.push({ name, ok: false, detail: (e as Error).message }); }
}
const expect = (cond: unknown, msg: string) => { if (!cond) throw new Error(msg); };

if (OPS) {
  await check('Betrieb: /healthz und /readyz', async () => {
    expect((await fetch(`${OPS}/healthz`)).ok, '/healthz nicht ok');
    const r = await fetch(`${OPS}/readyz`);
    expect(r.ok, `/readyz ${r.status} ${await r.text()}`);
  });
}
await check('OpenAPI', async () => { const r = await fetch(`${BASE}/v1/openapi.json`); expect(r.ok, `${r.status}`); return `${Object.keys(((await r.json()) as { paths: object }).paths).length} Pfade`; });
await check('ohne Anmeldung 401 als problem+json', async () => {
  const r = await fetch(`${BASE}/v1/me`);
  expect(r.status === 401 && /problem\+json/.test(r.headers.get('content-type') ?? ''), `${r.status} ${r.headers.get('content-type')}`);
});

let csrf = '';
await check(`Anmeldung als ${USER} über den BFF`, async () => {
  // Mit Organisationen fragt Keycloak zuerst nach der E-Mail (identity-first), dann nach dem Passwort
  let page = await follow(`${BASE}/auth/login?returnTo=/`);
  let post: Response | null = null, action = '';
  for (let step = 0; step < 3; step++) {
    const html = await page.text();
    const found = /<form[^>]+action="([^"]*login-actions[^"]*)"/.exec(html)?.[1];
    expect(found, `Login-Formular von Keycloak nicht gefunden (${page.status})`);
    action = found!.replaceAll('&amp;', '&');
    const fields = new URLSearchParams({ username: USER, credentialId: '' });
    if (/name="password"/.test(html)) fields.set('password', PASSWORD);
    post = await go(action, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: fields });
    if (post.status === 302) break;
    page = post;
  }
  if (post!.status !== 302) { const t = await post!.text(); throw new Error(`Keycloak: ${post!.status} – ${(/<span[^>]*(?:kc-feedback-text|input-error)[^>]*>([^<]+)/.exec(t)?.[1] ?? /<title>([^<]*)/.exec(t)?.[1] ?? '').trim()}`); }
  const back = await follow(new URL(post!.headers.get('location')!, action).href);
  expect(back.ok || back.status === 304, `Rückkehr in die App: ${back.status}`);
  const me = await go(`${BASE}/auth/me`, { headers: { accept: 'application/json' } });
  const text = await me.text();
  expect(me.ok, `/auth/me ${me.status} ${text}`);
  const b = JSON.parse(text) as { csrfToken: string; tenant: { alias: string } | null; roles: string[] };
  csrf = b.csrfToken;
  return `Organisation ${b.tenant?.alias ?? '–'}, Rollen ${b.roles.join(', ') || '–'}`;
});

await check('GET /v1/me mit Sitzung', async () => {
  const r = await go(`${BASE}/v1/me`, { headers: { accept: 'application/json' } });
  const text = await r.text();
  expect(r.ok, `${r.status} ${text}`);
  return `${(JSON.parse(text) as { permissions: string[] }).permissions.length} Rechte`;
});

if (WRITE) {
  await check('Projekt anlegen, lesen, löschen (CSRF, If-Match)', async () => {
    const h = { 'content-type': 'application/json', 'x-csrf-token': csrf, accept: 'application/json' };
    const c = await go(`${BASE}/v1/projekte`, { method: 'POST', headers: { ...h, 'idempotency-key': crypto.randomUUID() }, body: JSON.stringify({ label: `Rauchtest ${new Date().toISOString()}` }) });
    const created = await c.text();
    expect(c.status === 201, `anlegen ${c.status} ${created}`);
    const p = JSON.parse(created) as { id: string };
    const g = await go(`${BASE}/v1/projekte/${p.id}`, { headers: h });
    expect(g.ok, `lesen ${g.status}`);
    const noCsrf = await go(`${BASE}/v1/projekte/${p.id}`, { method: 'DELETE', headers: { 'if-match': g.headers.get('etag')! } });
    expect(noCsrf.status === 403, `ohne CSRF ${noCsrf.status} statt 403`);
    // Ohne Body auch ohne content-type (Fastify lehnt leeres JSON ab)
    const d = await go(`${BASE}/v1/projekte/${p.id}`, { method: 'DELETE', headers: { 'x-csrf-token': csrf, 'if-match': g.headers.get('etag')! } });
    expect(d.status === 204, `löschen ${d.status}`);
  });
}

await check('Abmelden', async () => {
  const r = await go(`${BASE}/auth/logout`, { method: 'POST', headers: { 'x-csrf-token': csrf, accept: 'application/json' } });
  expect(r.status < 400, `${r.status}`);
  const me = await go(`${BASE}/auth/me`, { headers: { accept: 'application/json' } });
  expect(me.status === 401, `nach dem Abmelden /auth/me ${me.status}`);
});

for (const r of results) console.log(`${r.ok ? 'OK  ' : 'FEHL'} ${r.name}${r.detail ? ` – ${r.detail}` : ''}`);
process.exit(results.every(r => r.ok) ? 0 : 1);
