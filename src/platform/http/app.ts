/**
 * HTTP-Anwendung der API (Querschnitt ohne Fachbezug): Fastify mit TypeBox, JSON-Logs mit Redaction, Request-ID,
 * Helmet, CSP je Antwortart, Rate-Limit, OpenAPI 3.1 unter `/v1/openapi.json` und `/v1/docs`, Anmeldung und Rechte aus
 * `@vollholz/iam` (Plugin mit BFF, Konto, Zugriff, Verwaltung …), Fehler als problem+json (RFC 9457), Idempotenz,
 * Metriken je Route. Fachliches hängen die Module ein (`Module.register`).
 */
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { trace } from '@opentelemetry/api';
import Fastify, { type FastifyInstance } from 'fastify';
import { IAM_API_TAGS, iamPlugin, optionalBodies, pgRateLimitStore, readinessChecks, type Iam } from '@vollholz/iam';
import { SCHEMA, type PlatformConfig } from '../config/env.ts';
import { REDACT_PATHS } from '../core/redact.ts';
import type { Db } from '../db/pool.ts';
import { httpDuration } from '../ops/metrics.ts';
import { readiness, type ReadyCheck } from '../ops/server.ts';
import { registerIdempotency } from './idempotency.ts';

/**
 * Tags der App für die OpenAPI. Jede Route nennt genau einen Tag (Test in problems.test.ts). Ein neues Modul trägt
 * seinen Tag hier ein (Checkliste «Neues Modul anlegen»).
 */
export const API_TAGS: { name: string; description: string }[] = [
  { name: 'Projekte', description: 'Projekte der Organisation: auflisten, lesen, anlegen, ändern, löschen, Verlauf.' },
  { name: 'Vorgänge', description: 'Zustand langer Läufe (Antwort 202 mit `Location`).' },
  { name: 'Webhooks', description: 'Ausgehende Webhooks (Standard Webhooks) für Ereignisse der Organisation.' },
  { name: 'Betrieb', description: 'Zustand des Dienstes.' },
];

/** CSP aller Antworten ohne eigene Richtlinie (JSON der API, Fehler). */
export const API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

export interface Deps<P extends string = string> {
  cfg: PlatformConfig;
  /** Pool der Laufzeit (ppm_runtime). */
  db: Db;
  iam: Iam<P, any>;
  /** Bereit für Verkehr (false im Beenden). */
  ready: () => boolean;
}

export interface Module {
  name: string;
  register(app: FastifyInstance, deps: Deps): void | Promise<void>;
}

const REQUEST_ID = /^[\w.:-]{1,128}$/;

export async function buildApp(deps: Deps, modules: readonly Module[], o: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const { cfg } = deps;
  const prod = cfg.mode === 'production';
  const app = Fastify({
    logger: o.logger === false ? false : { level: cfg.log.level, redact: { paths: REDACT_PATHS, censor: '[entfernt]' } },
    // Zahl der Proxys ist erlaubt (proxy-addr), die Typen von Fastify kennen sie nicht
    trustProxy: cfg.http.trustProxy as boolean,
    bodyLimit: cfg.http.bodyLimit,
    requestIdHeader: 'x-request-id',
    genReqId: req => {
      const h = req.headers['x-request-id'];
      return typeof h === 'string' && REQUEST_ID.test(h) ? h : crypto.randomUUID();
    },
    // Unbekannte Felder ergeben 422 statt still zu verschwinden (Vorgabe von @vollholz/iam)
    ajv: { customOptions: { removeAdditional: false, coerceTypes: 'array', useDefaults: true } },
  }).withTypeProvider<TypeBoxTypeProvider>();

  app.addHook('onRequest', async (req, reply) => {
    reply.header('x-request-id', req.id);
    const span = trace.getActiveSpan();
    if (span) span.setAttribute('ppm.request_id', req.id);
  });
  app.addHook('onSend', async (_req, reply, payload) => {
    if (!reply.hasHeader('content-security-policy')) reply.header('content-security-policy', API_CSP);
    return payload;
  });
  app.addHook('onResponse', async (req, reply) => {
    const route = req.routeOptions.url ?? 'unbekannt';
    httpDuration.record(reply.elapsedTime / 1000, { 'http.route': route, 'http.request.method': req.method, 'http.response.status_code': reply.statusCode });
    trace.getActiveSpan()?.setAttribute('http.route', route);
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
    hsts: prod ? { maxAge: 31_536_000, includeSubDomains: true } : false,
    crossOriginEmbedderPolicy: false,
  });

  // Rate-Limit: je Principal in der Organisation, ohne Anmeldung je IP; die Oberfläche (Sitzung) ist nie begrenzt.
  // preHandler: der Principal ist dann aufgelöst. Routen des Pakets tragen eigene Limits (config.rateLimit).
  await app.register(rateLimit, {
    global: true, hook: 'preHandler', max: cfg.rateLimit.max, timeWindow: cfg.rateLimit.windowMs,
    allowList: req => req.source === 'ui' || !req.url.startsWith('/v1/'),
    keyGenerator: req => (req.principal ? `p:${req.principal.tenantId}:${req.principal.principalId}` : `ip:${req.ip}`),
    ...(cfg.iam.ops.sharedState === 'postgres' ? { store: pgRateLimitStore(deps.db, SCHEMA), skipOnError: true } : {}),
  });

  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: { title: 'PPM API', version: '1.0.0', description: 'REST-API von PPM. Fehler als `application/problem+json` (RFC 9457). Schreibende Aufrufe mit `Idempotency-Key`, Änderungen mit `If-Match`.' },
      servers: [{ url: cfg.iam.publicBaseUrl }],
      tags: [...IAM_API_TAGS, ...API_TAGS],
      components: {
        securitySchemes: {
          bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Access Token aus Keycloak (Zielgruppe `ppm-api`); Maschinen-Clients mit DPoP.' },
          oidc: { type: 'openIdConnect', openIdConnectUrl: `${cfg.iam.oidc.issuer}/.well-known/openid-configuration` },
        },
      },
      security: [{ bearer: [] }],
    },
    refResolver: { buildLocalReference: (json, _b, _f, i) => (typeof json.$id === 'string' ? json.$id : `def-${i}`) },
    transformObject: optionalBodies as never,
  });

  await app.register(iamPlugin, {
    iam: deps.iam,
    publicPaths: ['/v1/openapi.json', '/v1/docs', '/v1/docs/*', '/v1/health'],
    people: { permissions: ['projekt:read'] },
  });

  registerIdempotency(app, deps.db, { ttlMs: cfg.http.idempotencyTtlMs });

  app.get('/v1/openapi.json', { schema: { hide: true } }, async () => app.swagger());
  await app.register(swaggerUi, {
    routePrefix: '/v1/docs',
    staticCSP: true,
    transformStaticCSP: h => `${h}; frame-ancestors 'none'`,
    // Ohne Schema oidc in der Oberfläche (Anmeldung dort nicht vorgesehen)
    transformSpecification: spec => {
      const s = structuredClone(spec) as { components?: { securitySchemes?: Record<string, unknown> } };
      delete s.components?.securitySchemes?.oidc;
      return s;
    },
    uiConfig: { deepLinking: false, tryItOutEnabled: false },
  });

  // Bereitschaft auch auf dem Dienst-Port (für Proxys ohne Zugang zum Betriebs-Endpunkt)
  const checks: ReadyCheck[] = readinessChecks(deps.iam);
  app.get('/healthz', { schema: { hide: true } }, async () => ({ status: 'ok' }));
  app.get('/readyz', { schema: { hide: true } }, async (_req, reply) => {
    const r = await readiness({ ready: deps.ready, checks });
    return reply.status(r.ok ? 200 : 503).send({ status: r.ok ? 'ok' : 'nicht bereit', checks: r.checks });
  });
  app.get('/v1/health', {
    schema: { tags: ['Betrieb'], summary: 'Zustand des Dienstes', security: [], response: { 200: { type: 'object', properties: { status: { type: 'string' } }, required: ['status'] } } },
  }, async () => ({ status: 'ok' }));

  for (const m of modules) await m.register(app, deps);
  return app;
}
