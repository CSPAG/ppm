/**
 * Lokaler Realm für die Entwicklung (`npm run keycloak:setup`, Teil von `dev:setup`): legt im Keycloak aus
 * deploy/compose.dev.yaml den Realm `ppm` so an, wie ihn das Realm-Modul von identity-kit in Produktion anlegt
 * (Clients `ppm-api`, `ppm-platform`, `ppm-admin`, `ppm-sync`, `ppm-mcp`, `ppm-mcp-cli`, Scopes aus dem Modell,
 * Realm-Rolle `platform-admin`, Organisationen), dazu Testpersonen und ihre Rollen in der Datenbank der App.
 * Idempotent. Nur lokal: Anmeldung als Admin des Realms `master`; der Realm `master` selbst wird nie verändert.
 *
 * In Produktion nie: dort führt der Workflow «Keycloak» das Realm-Modul aus (infra/keycloak, verwaltet).
 *
 * Testpersonen (Passwort `E2E_PASSWORD`, Standard `Test1234!`):
 *   anna@demo.example     org-admin in «demo» (Freigabestufe 2)
 *   bruno@demo.example    viewer in «demo»
 *   max@muster.example    org-admin in «muster» (zweite Organisation)
 *   betrieb@ppm.example   platform-admin ohne Organisation
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { model } from '../src/platform/authz/model.ts';
import { seedPeople } from './lib/people.ts';

const root = join(import.meta.dirname, '..');
const env = process.env;
const issuer = new URL(env.OIDC_ISSUER_URL ?? 'http://localhost:8180/realms/ppm');
const base = issuer.origin;
const REALM = issuer.pathname.split('/').filter(Boolean).at(-1)!;
const UI = (env.PUBLIC_BASE_URL ?? 'http://localhost:8080').replace(/\/$/, '');
/** Zweite lokale Instanz für die E2E-Tests (eigene Datenbank ppm_e2e, scripts/e2e-db.ts). */
const E2E_UI = 'http://localhost:8090';
const PASSWORD = env.E2E_PASSWORD || 'Test1234!';
if (REALM === 'master') throw new Error('keycloak:setup: der Realm master wird nie verändert');
if (env.NODE_ENV === 'production') throw new Error('keycloak:setup: nur für die lokale Entwicklung');

const PEOPLE = [
  { email: 'anna@demo.example', first: 'Anna', last: 'Admin', org: 'demo', role: 'org-admin', clearance: 2 },
  { email: 'bruno@demo.example', first: 'Bruno', last: 'Leser', org: 'demo', role: 'viewer', clearance: 0 },
  { email: 'max@muster.example', first: 'Max', last: 'Muster', org: 'muster', role: 'org-admin', clearance: 2 },
  { email: 'betrieb@ppm.example', first: 'Bea', last: 'Betrieb', org: null, role: null, clearance: 0 },
] as const;
const ORGS = [{ alias: 'demo', name: 'Demo AG', domain: 'demo.example' }, { alias: 'muster', name: 'Muster GmbH', domain: 'muster.example' }];

let token = '';
async function kc<T = any>(method: string, path: string, body?: unknown, ok: number[] = []): Promise<{ status: number; body: T; location: string | null }> {
  const r = await fetch(`${base}/admin/realms${path}`, {
    method, headers: { authorization: `Bearer ${token}`, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok && !ok.includes(r.status)) throw new Error(`${method} ${path}: ${r.status} ${text.slice(0, 300)}`);
  return { status: r.status, body: (text ? JSON.parse(text) : null) as T, location: r.headers.get('location') };
}
const log = (m: string) => console.log(`keycloak:setup: ${m}`);
const jwks = (c: string) => readFileSync(join(root, '.local', 'keys', `ppm-${c}.json`), 'utf8');
const jwtAuth = (c: string) => ({ 'use.jwks.url': 'false', 'use.jwks.string': 'true', 'jwks.string': JSON.stringify(JSON.parse(jwks(c))), 'token.endpoint.auth.signing.alg': 'ES256' });

// ---------------------------------------------------------------- Anmeldung als Admin (master, nur lokal)
for (let i = 0; ; i++) {
  try {
    const r = await fetch(`${base}/realms/master/protocol/openid-connect/token`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: 'admin', password: env.KEYCLOAK_ADMIN_PASSWORD ?? '' }),
    });
    if (!r.ok) throw new Error(`Anmeldung als admin: ${r.status} ${await r.text()}`);
    token = ((await r.json()) as { access_token: string }).access_token;
    break;
  } catch (e) {
    if (i >= 30) throw e;
    await new Promise(r => setTimeout(r, 2000));
  }
}

// ---------------------------------------------------------------- Realm
if ((await kc('GET', `/${REALM}`, undefined, [404])).status === 404) {
  await kc('POST', '', { realm: REALM, enabled: true, displayName: 'PPM' });
  log(`Realm ${REALM} angelegt`);
}
await kc('PUT', `/${REALM}`, {
  realm: REALM, enabled: true, displayName: 'PPM', organizationsEnabled: true, loginWithEmailAllowed: true, duplicateEmailsAllowed: false,
  registrationAllowed: false, resetPasswordAllowed: true, rememberMe: true, internationalizationEnabled: true, supportedLocales: ['de', 'en'], defaultLocale: 'de',
  sslRequired: 'external', bruteForceProtected: true, accessTokenLifespan: 300,
});

// ---------------------------------------------------------------- Scopes aus dem Modell, Zielgruppe des MCP-Dienstes
const scopes = (await kc<{ id: string; name: string }[]>('GET', `/${REALM}/client-scopes`)).body;
async function scope(name: string, description: string, mappers: unknown[] = []): Promise<string> {
  let s = scopes.find(x => x.name === name);
  if (!s) {
    await kc('POST', `/${REALM}/client-scopes`, { name, description, protocol: 'openid-connect', attributes: { 'include.in.token.scope': 'true', 'display.on.consent.screen': 'false' }, protocolMappers: mappers });
    s = (await kc<{ id: string; name: string }[]>('GET', `/${REALM}/client-scopes`)).body.find(x => x.name === name)!;
    scopes.push(s);
  }
  return s.id;
}
const modelScopes = JSON.parse(model.platformJson()).scopes as string[];
for (const s of modelScopes) await scope(s, `PPM: ${s}`);
await scope('ppm-mcp', 'Zielgruppe des MCP-Dienstes', [{ name: 'aud-mcp', protocol: 'openid-connect', protocolMapper: 'oidc-audience-mapper', config: { 'included.client.audience': 'ppm-mcp', 'access.token.claim': 'true', 'id.token.claim': 'false' } }]);
if (!scopes.some(s => s.name === 'organization')) throw new Error('Scope «organization» fehlt (Organisationen im Realm aktiv?)');

// ---------------------------------------------------------------- Clients (wie modules/product-realm › clients.tf)
const audApi = { name: 'aud-api', protocol: 'openid-connect', protocolMapper: 'oidc-audience-mapper', config: { 'included.client.audience': 'ppm-api', 'access.token.claim': 'true', 'id.token.claim': 'false', 'introspection.token.claim': 'true' } };
const CLIENTS: Record<string, Record<string, unknown>> = {
  'ppm-api': { name: 'PPM API (Zielgruppe)', publicClient: false, clientAuthenticatorType: 'client-jwt', standardFlowEnabled: false, directAccessGrantsEnabled: false, serviceAccountsEnabled: false, attributes: { 'pkce.code.challenge.method': 'S256' } },
  'ppm-platform': {
    name: 'PPM Plattform', publicClient: false, clientAuthenticatorType: 'client-jwt', standardFlowEnabled: true, directAccessGrantsEnabled: false, serviceAccountsEnabled: false,
    rootUrl: UI, baseUrl: '/', redirectUris: [`${UI}/auth/callback`, `${UI}/auth/entra/*`, `${E2E_UI}/auth/callback`], webOrigins: [UI, E2E_UI], frontchannelLogout: false,
    attributes: { ...jwtAuth('platform'), 'pkce.code.challenge.method': 'S256', 'post.logout.redirect.uris': `${UI}/abgemeldet##${UI}/##${E2E_UI}/abgemeldet##${E2E_UI}/`, 'backchannel.logout.url': `${UI}/auth/backchannel-logout`, 'backchannel.logout.session.required': 'true', 'use.refresh.tokens': 'true' },
    protocolMappers: [audApi],
  },
  'ppm-admin': { name: 'PPM Verwaltung', publicClient: false, clientAuthenticatorType: 'client-jwt', standardFlowEnabled: false, directAccessGrantsEnabled: false, serviceAccountsEnabled: true, attributes: jwtAuth('admin') },
  'ppm-sync': { name: 'PPM Abgleich', publicClient: false, clientAuthenticatorType: 'client-jwt', standardFlowEnabled: false, directAccessGrantsEnabled: false, serviceAccountsEnabled: true, attributes: jwtAuth('sync') },
  'ppm-mcp': {
    name: 'PPM MCP-Dienst', publicClient: false, clientAuthenticatorType: 'client-jwt', standardFlowEnabled: false, directAccessGrantsEnabled: false, serviceAccountsEnabled: false,
    attributes: { ...jwtAuth('mcp'), 'standard.token.exchange.enabled': 'true', 'standard.token.exchange.enableRefreshRequestedTokenType': 'NO' }, protocolMappers: [audApi],
  },
  'ppm-mcp-cli': {
    name: 'PPM MCP für Desktop- und CLI-Hosts', publicClient: true, standardFlowEnabled: true, directAccessGrantsEnabled: false,
    redirectUris: ['http://127.0.0.1/*', 'http://localhost/*', 'http://localhost:8765/callback'], webOrigins: [], attributes: { 'pkce.code.challenge.method': 'S256' },
  },
};
const clientIds = new Map<string, string>();
for (const [clientId, rep] of Object.entries(CLIENTS)) {
  const found = (await kc<{ id: string }[]>('GET', `/${REALM}/clients?clientId=${encodeURIComponent(clientId)}`)).body[0];
  if (found) {
    const { protocolMappers: _m, ...rest } = rep;
    await kc('PUT', `/${REALM}/clients/${found.id}`, { clientId, ...rest, id: found.id });
    clientIds.set(clientId, found.id);
  } else {
    await kc('POST', `/${REALM}/clients`, { clientId, protocol: 'openid-connect', enabled: true, ...rep });
    clientIds.set(clientId, (await kc<{ id: string }[]>('GET', `/${REALM}/clients?clientId=${encodeURIComponent(clientId)}`)).body[0]!.id);
    log(`Client ${clientId} angelegt`);
  }
}
async function clientScope(client: string, name: string, kind: 'default' | 'optional') {
  const id = scopes.find(s => s.name === name)?.id;
  if (!id) throw new Error(`Scope ${name} fehlt`);
  await kc('PUT', `/${REALM}/clients/${clientIds.get(client)}/${kind}-client-scopes/${id}`, undefined, [204, 409]);
}
for (const c of ['ppm-platform', 'ppm-mcp-cli', 'ppm-mcp']) {
  await clientScope(c, 'organization', 'optional');
  for (const s of modelScopes) await clientScope(c, s, c === 'ppm-platform' ? 'default' : 'optional');
}
await clientScope('ppm-mcp-cli', 'ppm-mcp', 'default');

// Rechte der Service Accounts (realm-management)
const rm = clientIds.get('realm-management') ?? (await kc<{ id: string }[]>('GET', `/${REALM}/clients?clientId=realm-management`)).body[0]!.id;
const rmRoles = (await kc<{ id: string; name: string }[]>('GET', `/${REALM}/clients/${rm}/roles`)).body;
for (const [client, roles] of [
  ['ppm-admin', ['manage-realm', 'manage-users', 'view-users', 'query-users', 'view-realm', 'manage-identity-providers']],
  ['ppm-sync', ['manage-realm', 'view-users', 'query-users', 'view-realm']],
] as const) {
  const sa = (await kc<{ id: string }>('GET', `/${REALM}/clients/${clientIds.get(client)}/service-account-user`)).body;
  await kc('POST', `/${REALM}/users/${sa.id}/role-mappings/clients/${rm}`, rmRoles.filter(r => (roles as readonly string[]).includes(r.name)));
}

// ---------------------------------------------------------------- Realm-Rolle, Organisationen, Personen
if ((await kc('GET', `/${REALM}/roles/platform-admin`, undefined, [404])).status === 404) await kc('POST', `/${REALM}/roles`, { name: 'platform-admin', description: 'Plattform-Administration (ohne Organisation)' });
const orgIds = new Map<string, string>();
for (const o of ORGS) {
  let found = (await kc<{ id: string; alias: string }[]>('GET', `/${REALM}/organizations?first=0&max=1000`)).body.find(x => x.alias === o.alias);
  if (!found) {
    await kc('POST', `/${REALM}/organizations`, { name: o.name, alias: o.alias, enabled: true, domains: [{ name: o.domain, verified: true }] });
    found = (await kc<{ id: string; alias: string }[]>('GET', `/${REALM}/organizations?first=0&max=1000`)).body.find(x => x.alias === o.alias)!;
    log(`Organisation ${o.alias} angelegt`);
  }
  orgIds.set(o.alias, found.id);
}
const userIds = new Map<string, string>();
for (const p of PEOPLE) {
  let u = (await kc<{ id: string }[]>('GET', `/${REALM}/users?email=${encodeURIComponent(p.email)}&exact=true`)).body[0];
  if (!u) {
    await kc('POST', `/${REALM}/users`, { username: p.email, email: p.email, firstName: p.first, lastName: p.last, enabled: true, emailVerified: true });
    u = (await kc<{ id: string }[]>('GET', `/${REALM}/users?email=${encodeURIComponent(p.email)}&exact=true`)).body[0]!;
    log(`Person ${p.email} angelegt`);
  }
  await kc('PUT', `/${REALM}/users/${u.id}/reset-password`, { type: 'password', value: PASSWORD, temporary: false });
  userIds.set(p.email, u.id);
  if (p.org) await kc('POST', `/${REALM}/organizations/${orgIds.get(p.org)}/members`, u.id, [409]);
  if (!p.org) {
    const role = (await kc('GET', `/${REALM}/roles/platform-admin`)).body;
    await kc('POST', `/${REALM}/users/${u.id}/role-mappings/realm`, [role]);
  }
}

// ---------------------------------------------------------------- Datenbank der App: Mandant, Principal, Rolle (Tupel)
const people = { orgs: ORGS.map(o => ({ ...o, id: orgIds.get(o.alias)! })), people: PEOPLE.map(p => ({ ...p, id: userIds.get(p.email)! })) };
writeFileSync(join(root, '.local', 'people.json'), `${JSON.stringify(people, null, 2)}\n`);
await seedPeople(env.DATABASE_ADMIN_URL!, people);
log(`fertig – Issuer ${issuer.href}, Anmeldung z. B. als anna@demo.example`);
