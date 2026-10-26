/**
 * Datenbankzugriff: jede fachliche Arbeit in einer Transaktion. `withTenant` setzt zu Beginn `app.tenant_id`,
 * `app.principal_id` und `app.principal_kind` mit `set_config(…, true)` (gilt nur bis COMMIT, PgBouncer im
 * Transaktionsmodus tauglich). Ohne Kontext liefert RLS keine Zeilen; einen Weg an Mandantentabellen ohne Kontext gibt
 * es nur für Warteschlange und Outbox im Scheduler (Rolle ppm_sched).
 *
 * Anfragen laufen über `req.tx` (Lesesicht des Baukastens), Hintergrundarbeit über `fullTx` (authz/view.ts).
 */
import { createPool as kitPool, withTenant as kitWithTenant, withTx, type Db, type Tx } from '@vollholz/iam';
import type { PlatformConfig } from '../config/env.ts';

export { withTx, type Db, type Tx };

/** Pool mit `statement_timeout`, `idle_in_transaction_session_timeout` und TLS nach `DATABASE_SSL`. */
export function createPool(url: string, cfg: PlatformConfig, applicationName: string): Db {
  return kitPool(url, cfg.iam, applicationName);
}

export interface TenantContext {
  tenantId: string;
  principalId?: string | null;
  principalKind?: 'user' | 'client' | 'worker' | 'system';
  /** Weitere Einstellungen `app.*` (z. B. die volle Lesesicht aus authz/view.ts). */
  settings?: Record<string, string>;
}

export function withTenant<T>(db: Db, ctx: TenantContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return kitWithTenant(db, {
    tenantId: ctx.tenantId, principalId: ctx.principalId ?? null,
    settings: { 'app.principal_kind': ctx.principalKind ?? 'system', ...ctx.settings },
  }, fn);
}
