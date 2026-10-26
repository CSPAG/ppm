/**
 * Zusammenbau der API (Kompositionswurzel): Pool, IAM mit Modell, Ressourcen, Audit und Ereignissen (Outbox), HTTP mit
 * allen Modulen. Genutzt vom Prozess `api`, von den Tests (Mock-IdP, Wegwerf-Datenbank) und vom OpenAPI-Export.
 */
import type { FastifyInstance } from 'fastify';
import { createIam, iamWarnings, type Iam } from '@vollholz/iam';
import { model } from '../authz/model.ts';
import { resources } from '../authz/resources.ts';
import { audit } from '../core/audit.ts';
import { emit } from '../core/events.ts';
import { SCHEMA, type PlatformConfig } from '../config/env.ts';
import { createPool, type Db } from '../db/pool.ts';
import { buildApp, type Module } from '../http/app.ts';
import { MODULES } from '../modules/index.ts';

export interface Api { app: FastifyInstance; iam: Iam<string, null>; db: Db; close(): Promise<void> }

export interface ApiOptions {
  /** Bestehender Pool (Tests); sonst aus DATABASE_URL. */
  db?: Db;
  ready?: () => boolean;
  logger?: boolean;
  modules?: readonly Module[];
  /** Nach allen Routen, vor `ready` (Tests: Sonden). */
  after?: (app: FastifyInstance) => void;
  /** Abrufe des IAM (Tests: Keycloak- und Entra-Nachbildung). */
  fetch?: typeof fetch; keycloakFetch?: typeof fetch; entraFetch?: typeof fetch;
}

export async function createApi(cfg: PlatformConfig, o: ApiOptions = {}): Promise<Api> {
  const db = o.db ?? createPool(cfg.iam.db.url, cfg, 'ppm-api');
  const iam = createIam({
    cfg: cfg.iam, model, db, schema: SCHEMA, resources, audit,
    // Ereignisse des Baukastens (z. B. access.granted) ebenfalls in die Outbox
    events: (tx, type, subject, data) => emit(tx, { type, subject, data, source: 'api' }).then(() => undefined),
    ...(o.fetch ? { fetch: o.fetch } : {}), ...(o.keycloakFetch ? { keycloakFetch: o.keycloakFetch } : {}), ...(o.entraFetch ? { entraFetch: o.entraFetch } : {}),
  });
  const app = await buildApp({ cfg, db, iam, ready: o.ready ?? (() => true) }, o.modules ?? MODULES, { logger: o.logger });
  for (const w of iamWarnings(cfg.iam, 'api')) app.log.warn(w);
  o.after?.(app);
  await app.ready();
  return { app, iam, db, close: async () => { await app.close(); if (!o.db) await db.end(); } };
}
