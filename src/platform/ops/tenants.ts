/**
 * Mandanten über alle Organisationen (Betrieb, `npm run tenant`): auflisten, anlegen, sperren, entsperren. Sperren
 * wirkt sofort: Anfragen erhalten 403, Jobs der Organisation werden nicht mehr abgeholt.
 *
 * Löschen entfernt die Fachdaten der App (alle Tabellen aus db/migrations mit `tenant_id`) und sperrt den Mandanten;
 * Konten, Tupel und Protokoll des Baukastens bleiben (Nachweis). Es braucht dafür den Superuser
 * (`DATABASE_SUPERUSER_URL`), weil RLS auch die Besitzer-Rolle bindet.
 */
import pg from 'pg';
import { createTenant, findTenant, listTenants, setTenantStatus, type TenantRow, type TenantsContext } from '@vollholz/iam';
import { audit } from '../core/audit.ts';
import { SCHEMA } from '../config/env.ts';
import type { Db } from '../db/pool.ts';

export type { TenantRow };

export const tenantsContext: TenantsContext = { schema: SCHEMA, audit };

/** Tabellen der App (nicht des Baukastens) mit Mandantendaten, Kinder vor Eltern. */
export const APP_TENANT_TABLES = ['webhook_delivery', 'webhook', 'projekt_version', 'projekt', 'outbox_event', 'idempotency_key', 'job'] as const;

export const tenants = {
  list: (admin: pg.ClientBase | Db) => listTenants(admin),
  find: (admin: pg.ClientBase | Db, alias: string) => findTenant(admin, alias),
  create: (admin: pg.ClientBase | Db, runtime: Db, alias: string, name?: string, kcOrgId?: string) => createTenant(tenantsContext, admin, runtime, alias, name, kcOrgId),
  suspend: (admin: pg.ClientBase | Db, runtime: Db, alias: string, reason = '') => setTenantStatus(tenantsContext, admin, runtime, alias, 'suspended', reason),
  resume: (admin: pg.ClientBase | Db, runtime: Db, alias: string) => setTenantStatus(tenantsContext, admin, runtime, alias, 'active'),
  /** Fachdaten löschen (Superuser); liefert die Zeilen je Tabelle. */
  async purgeAppData(superuser: pg.ClientBase, tenantId: string): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    await superuser.query('BEGIN');
    try {
      for (const t of APP_TENANT_TABLES) out[t] = (await superuser.query(`DELETE FROM ${SCHEMA}.${t} WHERE tenant_id = $1`, [tenantId])).rowCount ?? 0;
      await superuser.query('COMMIT');
    } catch (e) { await superuser.query('ROLLBACK'); throw e; }
    return out;
  },
};
