/**
 * Lokaler Realm `ppm` im Dev-Keycloak (deploy/compose.dev.yaml) über die Admin-REST-API, idempotent. In
 * Betrieb und Staging führt das Realm-Modul `product-realm` von identity-kit den Realm (infra/keycloak, Workflow
 * «Keycloak»); dieses Skript bildet es lokal nach, ohne OpenTofu und ohne IaC-Client.
 *
 *   node --env-file=.env scripts/keycloak-setup.ts
 *
 * Legt an bzw. gleicht ab: Realm mit Organisationen, Clients ppm-platform (BFF), -api (Zielgruppe), -admin
 * (Verwaltung), -sync (Abgleich), -mcp und -mcp-cli, die Scopes aus infra/keycloak/platform.json, Realm-Rolle
 * platform-admin, Organisationen `demo` und `muster` mit Testpersonen (Passwort `ppm`, nur lokal):
 *
 *   anna@demo.example       demo, org-admin
 *   bruno@demo.example      demo, viewer
 *   …@demo.example          demo, Personen der Demo-Daten (scripts/seed/personen.ts, npm run seed:demo)
 *   max@muster.example      muster, org-admin
 *   betrieb@ppm.example   platform-admin, ohne Organisation
 *
 * Danach in der Datenbank (DATABASE_ADMIN_URL, DATABASE_URL): Mandant je Organisation, Principal und Rolle als Tupel.
 */
import { createHash, createPrivateKey, createPublicKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { createTenant, findTenant, pgAudit, withTenant } from '@vollholz/iam';
import { SCHEMA } from '../src/product.ts';
import { ROOT } from './lib.ts';
import { DEMO_PERSONEN } from './seed/personen.ts';

const P = 'ppm';
const REALM = P;
const PASSWORD = 'ppm-demo';
const env = (k: string) => process.env[k] || (process.env[`${k}_FILE`] ? readFileSync(process.env[`${k}_FILE`]!, 'utf8').trim() : '');
const fail = (msg: string): never => { console.error(`keycloak:setup: ${msg}`); process.exit(1); };

if ((REALM as string) === 'master') fail('der Realm master wird nie eingerichtet');
const KC = `http://localhost:${process.env.KEYCLOAK_PORT ?? '8180'}`;
const UI = (process.env.PUBLIC_BASE_URL ?? 'http://localhost:8080').replace(/\/+$/, '');
const adminPassword = env('KEYCLOAK_ADMIN_PASSWORD') || fail('KEYCLOAK_ADMIN_PASSWORD fehlt (npm run dev:env)');

const ORGS = [{ alias: 'demo', name: 'Demo AG', domain: 'demo.example' }, { alias: 'muster', name: 'Muster GmbH', domain: 'muster.example' }];
const PEOPLE: readonly { email: string; first: string; last: string; org: string | null; role: string; clearance: number }[] = [
  ...DEMO_PERSONEN.map(p => ({ email: p.email, first: p.first, last: p.last, org: 'demo', role: p.role, clearance: p.clearance })),
  { email: 'max@muster.example', first: 'Max', last: 'Muster', org: 'muster', role: 'org-admin', clearance: 2 },
  { email: 'betrieb@ppm.example', first: 'Bea', last: 'Betrieb', org: null, role: 'platform-admin', clearance: 0 },
];

// ---------- Admin-API (Anmeldung als admin am Realm master, nur lokal)
let token = '';
async function login() {
  let r: Response;
  try {
    r = await fetch(`${KC}/realms/master/protocol/openid-connect/token`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: 'admin', password: adminPassword }),
    });
  } catch { return fail(`Keycloak unter ${KC} nicht erreichbar (npm run dev:up)`); }
  if (r.status !== 200) fail(`Anmeldung am Realm master gescheitert (${r.status}); KEYCLOAK_ADMIN_PASSWORD passt nicht zum Volume? (npm run dev:down -- -v)`);
  token = (await r.json() as { access_token: string }).access_token;
}

async function kc<T = unknown>(method: string, path: string, body?: unknown, ok: number[] = []): Promise<{ status: number; data: T; location: string | null }> {
  const r = await fetch(`${KC}/admin/realms${path}`, {
    method, headers: { authorization: `Bearer ${token}`, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await r.text();
  if (!r.ok && !ok.includes(r.status)) throw new Error(`${method} ${path}: ${r.status} ${text.slice(0, 300)}`);
  return { status: r.status, data: (text ? JSON.parse(text) : null) as T, location: r.headers.get('location') };
}
const R = (path = '') => `/${REALM}${path}`;
const idFrom = (location: string | null) => location?.split('/').pop() ?? fail('Keycloak lieferte keine ID');

// ---------- Schlüssel: öffentlicher Teil als JWKS (kid = JWK-Thumbprint nach RFC 7638, wie create-iam-app keys)
function jwks(pemVar: string): string {
  const pem = env(pemVar) || fail(`${pemVar} (bzw. _FILE) fehlt (npm run dev:env)`);
  const jwk = createPublicKey(createPrivateKey(pem)).export({ format: 'jwk' }) as { crv: string; kty: string; x: string; y: string };
  const kid = createHash('sha256').update(JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y })).digest('base64url');
  return JSON.stringify({ keys: [{ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, kid, use: 'sig', alg: 'ES256' }] });
}
const jwtAuth = (pemVar: string) => ({ 'use.jwks.url': 'false', 'use.jwks.string': 'true', 'jwks.string': jwks(pemVar), 'token.endpoint.auth.signing.alg': 'ES256' });

interface Client { id: string; clientId: string; [k: string]: unknown }
async function ensureClient(rep: Record<string, unknown> & { clientId: string }): Promise<Client> {
  const found = (await kc<Client[]>('GET', R(`/clients?clientId=${encodeURIComponent(rep.clientId)}`))).data[0];
  if (found) {
    await kc('PUT', R(`/clients/${found.id}`), { ...found, ...rep, attributes: { ...(found.attributes as object), ...(rep.attributes as object) } });
    console.log(`  Client ${rep.clientId}: abgeglichen`);
    return { ...found, ...rep } as Client;
  }
  const id = idFrom((await kc('POST', R('/clients'), { protocol: 'openid-connect', enabled: true, ...rep })).location);
  console.log(`  Client ${rep.clientId}: angelegt`);
  return { id, ...rep } as Client;
}

async function ensureMapper(clientId: string, rep: { name: string; protocolMapper: string; config: Record<string, string> }) {
  const have = (await kc<{ id: string; name: string }[]>('GET', R(`/clients/${clientId}/protocol-mappers/models`))).data.find(m => m.name === rep.name);
  const body = { protocol: 'openid-connect', ...rep };
  if (have) await kc('PUT', R(`/clients/${clientId}/protocol-mappers/models/${have.id}`), { id: have.id, ...body });
  else await kc('POST', R(`/clients/${clientId}/protocol-mappers/models`), body);
}

interface Scope { id: string; name: string }
async function ensureScope(name: string, description: string): Promise<Scope> {
  const have = (await kc<Scope[]>('GET', R('/client-scopes'))).data.find(s => s.name === name);
  if (have) return have;
  const id = idFrom((await kc('POST', R('/client-scopes'), {
    name, description, protocol: 'openid-connect',
    attributes: { 'include.in.token.scope': 'true', 'display.on.consent.screen': 'false' },
  })).location);
  return { id, name };
}

async function serviceRoles(client: Client, roles: string[]) {
  const user = (await kc<{ id: string }>('GET', R(`/clients/${client.id}/service-account-user`))).data;
  const rm = (await kc<Client[]>('GET', R('/clients?clientId=realm-management'))).data[0] ?? fail('realm-management fehlt');
  const all = (await kc<{ id: string; name: string }[]>('GET', R(`/clients/${rm.id}/roles`))).data;
  const want = all.filter(r => roles.includes(r.name));
  if (want.length !== roles.length) fail(`Rollen von realm-management fehlen: ${roles.filter(r => !want.some(w => w.name === r)).join(', ')}`);
  await kc('POST', R(`/users/${user.id}/role-mappings/clients/${rm.id}`), want);
}

// ---------- Ablauf
await login();
console.log(`Keycloak ${KC}, Realm ${REALM}`);

if ((await kc('GET', R(), undefined, [404])).status === 404) {
  await kc('POST', '', { realm: REALM, displayName: 'PPM', enabled: true });
  console.log('  Realm angelegt');
}
await kc('PUT', R(), {
  realm: REALM, displayName: 'PPM', enabled: true, organizationsEnabled: true, registrationAllowed: false,
  loginWithEmailAllowed: true, registrationEmailAsUsername: true, duplicateEmailsAllowed: false, resetPasswordAllowed: true,
  sslRequired: 'external', internationalizationEnabled: true, supportedLocales: ['de', 'en'], defaultLocale: 'de',
  accessTokenLifespan: 300, ssoSessionIdleTimeout: 3600, ssoSessionMaxLifespan: 28800,
});

// Scopes der Rechte (platform.json) und Scope des MCP-Dienstes
const platform = JSON.parse(readFileSync(join(ROOT, 'infra', 'keycloak', 'platform.json'), 'utf8')) as { scopes: string[] };
const permScopes = await Promise.all(platform.scopes.map(s => ensureScope(s, `Rechte-Scope ${s}`)));
const mcpScope = await ensureScope(`${P}-mcp`, 'Zielgruppe des MCP-Dienstes');
const orgScope = (await kc<Scope[]>('GET', R('/client-scopes'))).data.find(s => s.name === 'organization') ?? fail('Scope «organization» fehlt (Organisationen aktiv?)');
// Mapper «organization» mit ID der Organisation (wie product-realm, scripts/org-mapper.ts)
{
  const mappers = (await kc<{ id: string; protocolMapper: string; config: Record<string, string> }[]>('GET', R(`/client-scopes/${orgScope.id}/protocol-mappers/models`))).data;
  const m = mappers.find(x => x.protocolMapper === 'oidc-organization-membership-mapper');
  if (m) await kc('PUT', R(`/client-scopes/${orgScope.id}/protocol-mappers/models/${m.id}`), { ...m, config: { ...m.config, multivalued: 'true', addOrganizationId: 'true', 'jsonType.label': 'JSON', 'access.token.claim': 'true', 'id.token.claim': 'true' } });
}
{
  const mappers = (await kc<{ name: string }[]>('GET', R(`/client-scopes/${mcpScope.id}/protocol-mappers/models`))).data;
  if (!mappers.some(x => x.name === 'audience')) await kc('POST', R(`/client-scopes/${mcpScope.id}/protocol-mappers/models`), {
    name: 'audience', protocol: 'openid-connect', protocolMapper: 'oidc-audience-mapper',
    config: { 'included.client.audience': `${P}-mcp`, 'access.token.claim': 'true', 'id.token.claim': 'false' },
  });
}

const confidential = { publicClient: false, clientAuthenticatorType: 'client-jwt', implicitFlowEnabled: false, directAccessGrantsEnabled: false, frontchannelLogout: false };
await ensureClient({ clientId: `${P}-api`, name: 'PPM API (Zielgruppe)', ...confidential, standardFlowEnabled: false, serviceAccountsEnabled: false, bearerOnly: false });
const bff = await ensureClient({
  clientId: `${P}-platform`, name: 'PPM Plattform', ...confidential, standardFlowEnabled: true, serviceAccountsEnabled: false,
  rootUrl: UI, baseUrl: '/', redirectUris: [`${UI}/auth/callback`, `${UI}/auth/entra/*`], webOrigins: [UI],
  attributes: { ...jwtAuth('OIDC_BFF_PRIVATE_KEY'), 'pkce.code.challenge.method': 'S256', 'post.logout.redirect.uris': `${UI}/abgemeldet##${UI}/`, 'backchannel.logout.url': `${UI}/auth/backchannel-logout`, 'backchannel.logout.session.required': 'true', 'use.refresh.tokens': 'true' },
});
const service = { ...confidential, standardFlowEnabled: false, serviceAccountsEnabled: true, attributes: { 'access.token.lifespan': '120', 'use.refresh.tokens': 'false' } };
const admin = await ensureClient({ clientId: `${P}-admin`, name: 'PPM Verwaltung', ...service, attributes: { ...service.attributes, ...jwtAuth('KEYCLOAK_MGMT_PRIVATE_KEY') } });
const sync = await ensureClient({ clientId: `${P}-sync`, name: 'PPM Abgleich', ...service, attributes: { ...service.attributes, ...jwtAuth('KEYCLOAK_SYNC_PRIVATE_KEY') } });
const mcp = await ensureClient({
  clientId: `${P}-mcp`, name: 'PPM MCP-Dienst', ...confidential, standardFlowEnabled: false, serviceAccountsEnabled: false,
  attributes: { ...jwtAuth('MCP_PRIVATE_KEY'), 'standard.token.exchange.enabled': 'true', 'standard.token.exchange.enableRefreshRequestedTokenType': 'NO' },
});
const mcpCli = await ensureClient({
  clientId: `${P}-mcp-cli`, name: 'PPM MCP für Desktop- und CLI-Hosts', publicClient: true, standardFlowEnabled: true, implicitFlowEnabled: false,
  directAccessGrantsEnabled: false, redirectUris: ['http://127.0.0.1/*', 'http://localhost/*', 'http://localhost:8765/callback'], webOrigins: [],
  attributes: { 'pkce.code.challenge.method': 'S256' },
});

// Lokal vereinfacht: Rollen von realm-management statt feingranularer Admin-Rechte v2 (product-realm, admin.tf)
await serviceRoles(admin, ['manage-realm', 'manage-users', 'view-users', 'query-users', 'manage-identity-providers']);
await serviceRoles(sync, ['manage-realm', 'view-users', 'query-users']);

for (const c of [bff, mcp]) await ensureMapper(c.id, { name: 'aud-api', protocolMapper: 'oidc-audience-mapper', config: { 'included.client.audience': `${P}-api`, 'access.token.claim': 'true', 'id.token.claim': 'false' } });
for (const c of [bff, mcp, mcpCli]) await ensureMapper(c.id, { name: 'identity_provider', protocolMapper: 'oidc-usersessionmodel-note-mapper', config: { 'user.session.note': 'identity_provider', 'claim.name': 'identity_provider', 'jsonType.label': 'String', 'access.token.claim': 'true', 'id.token.claim': 'true' } });
for (const c of [bff, mcpCli]) await kc('PUT', R(`/clients/${c.id}/default-client-scopes/${orgScope.id}`));
for (const s of permScopes) for (const c of [bff, mcp, mcpCli]) await kc('PUT', R(`/clients/${c.id}/optional-client-scopes/${s.id}`));
await kc('PUT', R(`/clients/${mcpCli.id}/default-client-scopes/${mcpScope.id}`));

// Realm-Rolle des Betriebs
if ((await kc('GET', R('/roles/platform-admin'), undefined, [404])).status === 404) await kc('POST', R('/roles'), { name: 'platform-admin', description: 'Plattform-Administration über alle Organisationen, ohne Mitgliedschaft' });

// Organisationen und Testpersonen
interface Org { id: string; alias: string }
const orgIds = new Map<string, string>();
for (const o of ORGS) {
  let org = (await kc<Org[]>('GET', R(`/organizations?search=${encodeURIComponent(o.alias)}&exact=false`))).data.find(x => x.alias === o.alias);
  if (!org) {
    const id = idFrom((await kc('POST', R('/organizations'), { name: o.name, alias: o.alias, enabled: true, domains: [{ name: o.domain, verified: false }] })).location);
    org = { id, alias: o.alias };
    console.log(`  Organisation ${o.alias}: angelegt`);
  }
  orgIds.set(o.alias, org.id);
}
const userIds = new Map<string, string>();
for (const p of PEOPLE) {
  let id = (await kc<{ id: string }[]>('GET', R(`/users?email=${encodeURIComponent(p.email)}&exact=true`))).data[0]?.id;
  if (!id) {
    id = idFrom((await kc('POST', R('/users'), { username: p.email, email: p.email, emailVerified: true, firstName: p.first, lastName: p.last, enabled: true })).location);
    console.log(`  Person ${p.email}: angelegt`);
  }
  await kc('PUT', R(`/users/${id}/reset-password`), { type: 'password', value: PASSWORD, temporary: false });
  userIds.set(p.email, id);
  if (p.org) await kc('POST', R(`/organizations/${orgIds.get(p.org)}/members`), id, [409]);
  else {
    const role = (await kc<{ id: string; name: string }>('GET', R('/roles/platform-admin'))).data;
    await kc('POST', R(`/users/${id}/role-mappings/realm`), [role]);
  }
}

// ---------- Datenbank: Mandant, Principal, Rolle als Tupel an org
const adminUrl = env('DATABASE_ADMIN_URL'), runtimeUrl = env('DATABASE_URL');
if (!adminUrl || !runtimeUrl) {
  console.log('DATABASE_ADMIN_URL/DATABASE_URL fehlen: Datenbank nicht eingerichtet');
} else {
  const ownerDb = new pg.Pool({ connectionString: adminUrl, max: 2 });
  const runtimeDb = new pg.Pool({ connectionString: runtimeUrl, max: 2 });
  try {
    const ctx = { schema: SCHEMA, audit: pgAudit({ schema: SCHEMA }) };
    for (const o of ORGS) {
      const t = (await findTenant(ownerDb, o.alias)) ?? await createTenant(ctx, ownerDb, runtimeDb, o.alias, o.name, orgIds.get(o.alias));
      for (const p of PEOPLE.filter(x => x.org === o.alias)) {
        // Besitzer-Rolle im Kontext des Mandanten (Policies owner_tenant, wie iam-org-bootstrap)
        await withTenant(ownerDb, { tenantId: t.id }, async tx => {
          const pid = (await tx.query<{ id: string }>(
            `INSERT INTO ${SCHEMA}.principal AS x (tenant_id, kind, subject, display_name, email, clearance) VALUES ($1, 'user', $2, $3, $4, $5)
             ON CONFLICT (tenant_id, kind, subject) DO UPDATE SET display_name = excluded.display_name, email = excluded.email, clearance = excluded.clearance RETURNING id`,
            [t.id, userIds.get(p.email), `${p.first} ${p.last}`, p.email, p.clearance])).rows[0]!.id;
          await tx.query(`INSERT INTO ${SCHEMA}.authz_tuple (tenant_id, subject, relation, object_type) VALUES ($1, $2, $3, 'org') ON CONFLICT DO NOTHING`, [t.id, `user:${pid}`, p.role]);
        });
        console.log(`  ${o.alias}: ${p.email} → ${p.role}`);
      }
    }
  } finally { await Promise.all([ownerDb.end(), runtimeDb.end()]); }
}
console.log(`keycloak:setup: fertig. Anmeldung unter ${UI} z. B. als anna@demo.example / ${PASSWORD}`);
