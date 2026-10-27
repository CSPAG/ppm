/**
 * API für Tests: Wegwerf-Datenbank, nachgebildeter Anmeldedienst (Test-Kit), vollständige Anwendung mit allen Modulen
 * (`app` aus src/app.ts). Personen und Rollen entstehen wie im Betrieb als Principal und Tupel.
 */
import { claimsFor, startMockIdp, type MockIdp } from '@vollholz/iam-testkit';
import type { Level } from '@vollholz/iam';
import type { App, PlatformConfig } from '@vollholz/platform';
import { app as ppm } from '../../src/app.ts';
import { createTestDb, full, tenant, type Harness } from './harness.ts';

export const claims = claimsFor({ personClientId: 'ppm-platform' });

export interface ApiParts { app: App; iam: Awaited<ReturnType<typeof ppm.createApi>>['iam'] }

export interface TestApi extends ApiParts { t: Harness; idp: MockIdp; cfg: PlatformConfig; close(): Promise<void> }

export const TEST_KEYS = `t1:${Buffer.alloc(32, 7).toString('base64')}`;

/**
 * @param o.idp gemeinsamer Anmeldedienst (z. B. mit Token Exchange für den MCP-Dienst); sonst ein eigener.
 * @param o.keycloakFetch Admin-API für die Verwaltung (z. B. `KeycloakFake.fetch`, mit `KEYCLOAK_MGMT_*` in `env`).
 */
export async function testApi(env: Record<string, string> = {}, o: { idp?: MockIdp; keycloakFetch?: typeof fetch } = {}): Promise<TestApi> {
  const t = await createTestDb();
  const idp = o.idp ?? await startMockIdp({ audience: 'ppm-api', realm: 'ppm' });
  const cfg = ppm.loadConfig({
    NODE_ENV: 'test', OIDC_ISSUER_URL: idp.issuer, DATABASE_URL: t.runtimeUrl, PUBLIC_BASE_URL: 'http://api.test',
    TENANT_AUTO_PROVISION: 'true', DPOP_MODE: 'optional', ENCRYPTION_KEYS: TEST_KEYS, WEBHOOK_ALLOW_PRIVATE: 'true',
    SESSION_SECRET: 's'.repeat(32), LOG_LEVEL: process.env.TEST_LOG ? 'error' : 'silent', WEB_DIST_DIR: 'test/app/fixtures/dist', ...env,
  }, 'api');
  const parts = await ppm.createApi(cfg, t.runtime, o.keycloakFetch ? { iam: { keycloakFetch: o.keycloakFetch } } : {});
  await parts.app.ready();
  return { ...parts, t, idp, cfg, close: async () => { await parts.app.close(); if (!o.idp) await idp.close(); await t.drop(); } };
}

/** Principal einer Person anlegen (wie der Abgleich) und seine ID liefern. */
export async function person(api: TestApi, tenantId: string, sub: string, clearance: Level = 0): Promise<string> {
  return full(api.t.runtime, tenantId, async tx => (await tx.query<{ id: string }>(
    `INSERT INTO ppm.principal AS p (tenant_id, kind, subject, display_name, email, clearance) VALUES ($1, 'user', $2, $2, null, $3)
     ON CONFLICT (tenant_id, kind, subject) DO UPDATE SET clearance = excluded.clearance RETURNING id`, [tenantId, sub, clearance])).rows[0]!.id);
}

/** Tupel `<subjekt> <rolle> <ort>` anlegen. */
export async function grant(api: TestApi, tenantId: string, subject: string, relation: string, place: { type: string; id?: string } = { type: 'org' }): Promise<void> {
  await full(api.t.runtime, tenantId, tx => tx.query(
    'INSERT INTO ppm.authz_tuple (tenant_id, subject, relation, object_type, object_id) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
    [tenantId, subject, relation, place.type, place.type === 'org' ? null : place.id]));
}

/** Person mit Rolle an org; liefert Header mit Bearer-Token. */
export async function login(api: TestApi, org: string, sub: string, role: string | null, o: { clearance?: Level; scope?: string } = {}): Promise<{ authorization: string; tenantId: string; principalId: string }> {
  const tenantId = await tenant(api.t.runtime, org);
  const principalId = await person(api, tenantId, sub, o.clearance ?? 0);
  if (role) await grant(api, tenantId, `user:${principalId}`, role);
  const token = await api.idp.token(claims.user({ sub, org, ...(o.scope ? { scope: o.scope } : {}) }), { aud: 'ppm-api' });
  return { authorization: `Bearer ${token}`, tenantId, principalId };
}

/** Maschinen-Client mit Rolle an org und Scopes (Rolle ∩ Scope). */
export async function machine(api: TestApi, org: string, clientId: string, role: string, scopes: string[]): Promise<{ authorization: string }> {
  const tenantId = await tenant(api.t.runtime, org);
  const id = await full(api.t.runtime, tenantId, async tx => (await tx.query<{ id: string }>(
    `INSERT INTO ppm.principal (tenant_id, kind, subject, client_id, display_name) VALUES ($1, 'client', $2, $2, $2)
     ON CONFLICT (tenant_id, kind, subject) DO UPDATE SET display_name = excluded.display_name RETURNING id`, [tenantId, clientId])).rows[0]!.id);
  await grant(api, tenantId, `client:${id}`, role);
  return { authorization: `Bearer ${await api.idp.token(claims.client({ clientId, org, scopes }), { aud: 'ppm-api' })}` };
}
