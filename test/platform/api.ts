/**
 * API für Tests: die echte App (`createApi`) mit Mock-IdP und Wegwerf-Datenbank, dazu Helfer für Mandanten,
 * Personen, Tupel und Tokens. Personen erhalten Rollen nur über Tupel (nie aus dem Token).
 */
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import type pg from 'pg';
import { claimsFor, startMockIdp, type MockIdp } from '@vollholz/iam-testkit';
import type { Level } from '@vollholz/iam';
import { fullTx } from '../../src/platform/authz/view.ts';
import { loadPlatformConfig, type PlatformConfig } from '../../src/platform/config/env.ts';
import { createApi, type Api } from '../../src/platform/main/compose.ts';

export const claims = claimsFor({ personClientId: 'ppm-platform' });

/** Konfiguration für Tests (ohne BFF, Verwaltung und Entra), Werte überschreibbar. */
export function testConfig(issuer: string, env: Record<string, string> = {}): PlatformConfig {
  return loadPlatformConfig({
    NODE_ENV: 'test', OIDC_ISSUER_URL: issuer, PUBLIC_BASE_URL: 'http://api.test', DATABASE_URL: 'postgres://x@localhost/x',
    TENANT_AUTO_PROVISION: 'true', DPOP_MODE: 'optional', LOG_LEVEL: 'silent', SHARED_STATE: 'postgres',
    ENCRYPTION_KEYS: `k1:${Buffer.alloc(32, 7).toString('base64')}`, WEBHOOK_ALLOW_PRIVATE: 'true', RATE_LIMIT_MAX: '100000',
    ...env,
  }, null);
}

export interface TestApi {
  app: FastifyInstance; api: Api; idp: MockIdp; cfg: PlatformConfig; db: pg.Pool;
  /** Token einer Person in einer Organisation (sub fest je Name). */
  token(who: { sub: string; org: string | string[]; name?: string }): Promise<string>;
  /** Token eines Maschinen-Clients (Scopes begrenzen die Rechte). */
  clientToken(clientId: string, org: string, scopes: string[]): Promise<string>;
  req(o: InjectOptions & { token?: string }): Promise<LightMyRequestResponse>;
  close(): Promise<void>;
}

export async function testApi(db: pg.Pool, env: Record<string, string> = {}, o: { after?: (app: FastifyInstance) => void } = {}): Promise<TestApi> {
  const idp = await startMockIdp({ realm: 'ppm', audience: 'ppm-api' });
  const cfg = testConfig(idp.issuer, env);
  const api = await createApi(cfg, { db, logger: false, ...(o.after ? { after: o.after } : {}) });
  return {
    app: api.app, api, idp, cfg, db,
    token: w => idp.token({ ...claims.user({ org: w.org, sub: w.sub, name: w.name ?? w.sub }), email: `${w.sub}@example.ch` }),
    clientToken: (clientId, org, scopes) => idp.token(claims.client({ clientId, org, scopes })),
    req: ({ token, headers, ...o }) => api.app.inject({ ...o, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers } } as InjectOptions) as Promise<LightMyRequestResponse>,
    close: async () => { await api.close(); await idp.close(); },
  };
}

/** Mandant anlegen (wie die erste Anmeldung) und ID liefern. */
export async function tenant(db: pg.Pool, alias: string): Promise<string> {
  return (await db.query<{ id: string }>('SELECT app.resolve_tenant($1, null, $1, true) AS id', [alias])).rows[0]!.id;
}

/** Principal einer Person anlegen (wie der Abgleich) und ID liefern. */
export async function person(db: pg.Pool, tenantId: string, subject: string, clearance: Level = 0): Promise<string> {
  return fullTx(db, tenantId, async tx => (await tx.query<{ id: string }>(
    `INSERT INTO ppm.principal AS p (tenant_id, kind, subject, display_name, email, clearance, last_seen_at) VALUES ($1, 'user', $2, $2, $2 || '@example.ch', $3, NULL)
     ON CONFLICT (tenant_id, kind, subject) DO UPDATE SET clearance = excluded.clearance RETURNING id`, [tenantId, subject, clearance])).rows[0]!.id);
}

/** Tupel `<subject> <relation> <ort>`. */
export async function grant(db: pg.Pool, tenantId: string, subject: string, relation: string, place: { type: string; id?: string } = { type: 'org' }): Promise<void> {
  await fullTx(db, tenantId, tx => tx.query(
    'INSERT INTO ppm.authz_tuple (tenant_id, subject, relation, object_type, object_id) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
    [tenantId, subject, relation, place.type, place.type === 'org' ? null : place.id]));
}

/** Person mit Rolle an der Organisation (Mandant bei Bedarf angelegt); liefert Mandant und Principal. */
export async function member(db: pg.Pool, alias: string, sub: string, role: string | null, clearance: Level = 0): Promise<{ tenantId: string; principalId: string }> {
  const tenantId = await tenant(db, alias);
  const principalId = await person(db, tenantId, sub, clearance);
  if (role) await grant(db, tenantId, `user:${principalId}`, role);
  return { tenantId, principalId };
}

/** Maschinen-Client freigeben (Principal und Tupel an org). */
export async function client(db: pg.Pool, alias: string, clientId: string, role = 'editor'): Promise<void> {
  const tenantId = await tenant(db, alias);
  const id = await fullTx(db, tenantId, async tx => (await tx.query<{ id: string }>(
    `INSERT INTO ppm.principal AS p (tenant_id, kind, subject, client_id, display_name, clearance, last_seen_at) VALUES ($1, 'client', $2, $2, $2, 0, NULL)
     ON CONFLICT (tenant_id, kind, subject) DO UPDATE SET clearance = p.clearance RETURNING id`, [tenantId, clientId])).rows[0]!.id);
  await grant(db, tenantId, `client:${id}`, role);
}

export const json = <T = any>(r: { body: string }): T => JSON.parse(r.body) as T;
