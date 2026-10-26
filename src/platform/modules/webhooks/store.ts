/** Datenzugriff des Moduls «webhooks» (nur mit webhook:admin bzw. voller Sicht im Worker). */
import type { Keyring } from '@vollholz/iam';
import { open, rewrap, seal } from '../../core/crypto.ts';
import type { Tx } from '../../db/pool.ts';

export interface Webhook { id: string; url: string; description: string; events: string[]; active: boolean; version: number; createdAt: string; updatedAt: string }
interface Row { id: string; url: string; description: string; events: string[]; active: boolean; version: number; created_at: Date; updated_at: Date; secret_enc?: Buffer }

const COLS = 'id, url, description, events, active, version, created_at, updated_at';
const aad = (id: string) => `webhook:${id}`;
const toWebhook = (r: Row): Webhook => ({ id: r.id, url: r.url, description: r.description, events: r.events, active: r.active, version: r.version, createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString() });

export const webhooks = {
  async list(tx: Tx): Promise<Webhook[]> {
    return (await tx.query<Row>(`SELECT ${COLS} FROM ppm.webhook ORDER BY created_at, id`)).rows.map(toWebhook);
  },
  async get(tx: Tx, id: string, lock = false): Promise<Webhook | null> {
    const r = (await tx.query<Row>(`SELECT ${COLS} FROM ppm.webhook WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [id])).rows[0];
    return r ? toWebhook(r) : null;
  },
  async create(tx: Tx, keys: Keyring, tenantId: string, i: { url: string; description?: string; events: string[] }, secret: string, by: string): Promise<Webhook> {
    const id = (await tx.query<{ id: string }>('SELECT gen_random_uuid() AS id')).rows[0]!.id;
    const r = await tx.query<Row>(
      `INSERT INTO ppm.webhook (tenant_id, id, url, description, events, secret_enc, created_by) VALUES (app.tenant_id(), $1, $2, $3, $4, $5, $6) RETURNING ${COLS}`,
      [id, i.url, i.description ?? '', i.events, seal(keys, tenantId, secret, aad(id)), by]);
    return toWebhook(r.rows[0]!);
  },
  async update(tx: Tx, id: string, version: number, p: { url?: string; description?: string; events?: string[]; active?: boolean }): Promise<Webhook | null> {
    const r = await tx.query<Row>(
      `UPDATE ppm.webhook SET url = coalesce($3, url), description = coalesce($4, description), events = coalesce($5, events), active = coalesce($6, active),
         version = version + 1, updated_at = now() WHERE id = $1 AND version = $2 RETURNING ${COLS}`,
      [id, version, p.url ?? null, p.description ?? null, p.events ?? null, p.active ?? null]);
    return r.rows[0] ? toWebhook(r.rows[0]) : null;
  },
  async remove(tx: Tx, id: string, version: number): Promise<boolean> {
    return ((await tx.query('DELETE FROM ppm.webhook WHERE id = $1 AND version = $2', [id, version])).rowCount ?? 0) > 0;
  },
  async secret(tx: Tx, keys: Keyring, tenantId: string, id: string): Promise<string | null> {
    const r = (await tx.query<{ secret_enc: Buffer }>('SELECT secret_enc FROM ppm.webhook WHERE id = $1', [id])).rows[0];
    return r ? open(keys, tenantId, r.secret_enc, aad(id)) : null;
  },
  /** Aktive Webhooks, die einen Ereignistyp abonnieren (`*` = alle). */
  async subscribers(tx: Tx, type: string): Promise<{ id: string }[]> {
    return (await tx.query<{ id: string }>("SELECT id FROM ppm.webhook WHERE active AND ($1 = ANY (events) OR '*' = ANY (events))", [type])).rows;
  },
  async deliveries(tx: Tx, webhookId: string, limit = 50) {
    const r = await tx.query<{ id: string; event_id: string; event_type: string; status: string; attempts: number; response_status: number | null; last_error: string | null; created_at: Date; delivered_at: Date | null }>(
      'SELECT id, event_id, event_type, status, attempts, response_status, last_error, created_at, delivered_at FROM ppm.webhook_delivery WHERE webhook_id = $1 ORDER BY created_at DESC LIMIT $2', [webhookId, limit]);
    return r.rows.map(d => ({ id: d.id, eventId: d.event_id, eventType: d.event_type, status: d.status, attempts: d.attempts, responseStatus: d.response_status, error: d.last_error, createdAt: d.created_at.toISOString(), deliveredAt: d.delivered_at?.toISOString() ?? null }));
  },
  /** Rotation: Geheimnisse des Mandanten mit dem ersten Hauptschlüssel neu versiegeln. */
  async rewrapAll(tx: Tx, keys: Keyring, tenantId: string, dryRun: boolean): Promise<number> {
    let n = 0;
    for (const r of (await tx.query<{ id: string; secret_enc: Buffer }>('SELECT id, secret_enc FROM ppm.webhook FOR UPDATE')).rows) {
      const next = rewrap(keys, tenantId, r.secret_enc, aad(r.id));
      if (!next) continue;
      n++;
      if (!dryRun) await tx.query('UPDATE ppm.webhook SET secret_enc = $2 WHERE id = $1', [r.id, next]);
    }
    return n;
  },
};
