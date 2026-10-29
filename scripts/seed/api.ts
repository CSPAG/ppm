/**
 * API für das Seed-Skript: die vollständige Anwendung im Prozess (`app.createApi`, Aufrufe über `inject`), angemeldet mit
 * Token eines eigenen Anmeldedienstes (anmeldung.ts) für die Personen der Organisation. So entstehen die Demo-Daten nur über
 * die öffentlichen Routen, mit allen Regeln und Rechten wie in der Oberfläche (keine Daten an der RLS vorbei).
 */
import type pg from 'pg';
import type { App } from '@vollholz/platform';
import { app as ppm } from '../../src/app.ts';
import { anmeldung } from './anmeldung.ts';

export interface Antwort<T> { status: number; body: T; etag: string }

export class ApiFehler extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, body: unknown, was: string) {
    super(`${was}: ${status} ${JSON.stringify(body)}`);
    this.status = status;
    this.body = body;
  }
}

/** Aufrufe als eine Person; `send` wirft bei Status ≥ 300, `try` liefert jede Antwort. */
export class Als {
  private readonly api: App;
  private readonly token: string;
  readonly name: string;
  readonly id: string;
  constructor(api: App, token: string, name: string, id: string) {
    this.api = api;
    this.token = token;
    this.name = name;
    this.id = id;
  }

  async try<T = any>(method: string, url: string, body?: unknown, headers: Record<string, string> = {}): Promise<Antwort<T>> {
    const r = await this.api.inject({
      method: method as 'GET', url,
      headers: { authorization: `Bearer ${this.token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
      ...(body === undefined ? {} : { payload: JSON.stringify(body) }),
    });
    const text = r.body;
    return { status: r.statusCode, body: (text ? JSON.parse(text) : null) as T, etag: String(r.headers['etag'] ?? '') };
  }

  async send<T = any>(method: string, url: string, body?: unknown, ifMatch?: string): Promise<Antwort<T>> {
    const r = await this.try<T>(method, url, body, ifMatch ? { 'if-match': ifMatch } : {});
    if (r.status >= 300) throw new ApiFehler(r.status, r.body, `${this.name}: ${method} ${url}`);
    return r;
  }

  get<T = any>(url: string) { return this.send<T>('GET', url); }
  post<T = any>(url: string, body?: unknown, ifMatch?: string) { return this.send<T>('POST', url, body, ifMatch); }
  put<T = any>(url: string, body?: unknown, ifMatch?: string) { return this.send<T>('PUT', url, body, ifMatch); }
  patch<T = any>(url: string, body?: unknown, ifMatch?: string) { return this.send<T>('PATCH', url, body, ifMatch); }
  /** GET und danach die Änderung mit dem ETag der gelesenen Ressource. */
  async mitEtag<T = any>(method: string, lesen: string, url: string, body?: unknown): Promise<Antwort<T>> {
    return this.send<T>(method, url, body, (await this.get(lesen)).etag);
  }
}

export interface Person { subject: string; id: string; name: string; email: string | null; first: string; last: string }

export interface SeedApi { api: App; als(p: Person): Als; close(): Promise<void> }

/**
 * Anwendung mit dem Anmeldedienst des Skripts (anmeldung.ts); Datenbank wie die API (`DATABASE_URL`, Laufzeit-Rolle).
 * Alles Übrige aus der Umgebung der API; im Prozess gelten Entwicklungsmodus und private Adressen (Schnittstellen der
 * Demo gegen einen Server dieses Prozesses).
 */
export async function seedApi(db: pg.Pool, org: string, env: NodeJS.ProcessEnv): Promise<SeedApi> {
  const idp = await anmeldung();
  const cfg = ppm.loadConfig({
    ...env, NODE_ENV: 'development', OIDC_ISSUER_URL: idp.issuer, PUBLIC_BASE_URL: 'http://seed.invalid', DPOP_MODE: 'optional',
    WEBHOOK_ALLOW_PRIVATE: 'true', API_RATE_LIMIT: '1000000', LOG_LEVEL: env.LOG_LEVEL ?? 'warn',
    SESSION_SECRET: env.SESSION_SECRET || 's'.repeat(32),
  }, 'api');
  const { app } = await ppm.createApi(cfg, db);
  await app.ready();
  const o = { org, aud: env.OIDC_API_AUDIENCE || 'ppm-api', azp: env.OIDC_BFF_CLIENT_ID || 'ppm-platform' };
  return {
    api: app,
    als: p => new Als(app, idp.token(p, o), p.name, p.id),
    close: async () => { await app.close(); await idp.close(); },
  };
}

/**
 * Verwaltung der Mitglieder mit der unveränderten Konfiguration der API (echter Issuer, `KEYCLOAK_MGMT_*`): lädt wie die
 * Oberfläche ein (Konto ohne Passwort in Keycloak, Principal und Rollen sofort). null ohne Verwaltung (lokal).
 */
export async function verwaltung(db: pg.Pool, env: NodeJS.ProcessEnv): Promise<{ admin: NonNullable<Awaited<ReturnType<typeof ppm.createApi>>['iam']['admin']>; close(): Promise<void> } | null> {
  if (!env.KEYCLOAK_MGMT_CLIENT_ID) return null;
  const { app, iam } = await ppm.createApi(ppm.loadConfig(env, 'api'), db);
  if (!iam.admin) { await app.close(); return null; }
  return { admin: iam.admin, close: () => app.close() };
}
