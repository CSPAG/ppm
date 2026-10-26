/**
 * `Idempotency-Key` für alle schreibenden Aufrufe unter `/v1` (POST, PUT, PATCH, DELETE): Die erste Antwort (< 500)
 * wird gespeichert und bei Wiederholung mit gleichem Inhalt unverändert geliefert (`Idempotency-Replayed: true`);
 * anderer Inhalt mit demselben Schlüssel → 409, eine noch laufende erste Anfrage → 409. Schlüssel je Principal im
 * Mandanten, `IDEMPOTENCY_TTL` lang (Aufräumen im Worker).
 */
import { createHash } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { conflict } from '../core/errors.ts';
import { withTenant, type Db } from '../db/pool.ts';

declare module 'fastify' {
  interface FastifyRequest { idempotency?: { tenantId: string; principalId: string; key: string } }
}

const WRITE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function requestHash(req: FastifyRequest): string {
  return createHash('sha256').update(`${req.method} ${req.routeOptions.url ?? req.url}\n${JSON.stringify(req.params ?? {})}\n${JSON.stringify(req.body ?? null)}`).digest('hex');
}

export function registerIdempotency(app: FastifyInstance, db: Db, o: { ttlMs: number; prefix?: string }): void {
  const prefix = o.prefix ?? '/v1/';
  app.addHook('preHandler', async (req, reply) => {
    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string' || !WRITE.has(req.method) || !req.url.startsWith(prefix) || !req.principal) return;
    if (key.length < 1 || key.length > 255) return;
    const p = req.principal;
    const hash = requestHash(req);
    const ctx = { tenantId: p.tenantId, principalId: p.principalId, principalKind: p.kind };
    const hit = await withTenant(db, ctx, async tx => {
      await tx.query('DELETE FROM ppm.idempotency_key WHERE tenant_id = app.tenant_id() AND principal_id = $1 AND key = $2 AND expires_at < now()', [p.principalId, key]);
      const r = await tx.query<{ request_hash: string; status: number | null; headers: Record<string, string> | null; body: unknown }>(
        `INSERT INTO ppm.idempotency_key (tenant_id, principal_id, key, method, path, request_hash, expires_at)
         VALUES (app.tenant_id(), $1, $2, $3, $4, $5, now() + ($6 || ' milliseconds')::interval)
         ON CONFLICT (tenant_id, principal_id, key) DO UPDATE SET key = excluded.key
         RETURNING request_hash, status, headers, body, (xmax = 0) AS inserted`,
        [p.principalId, key, req.method, req.url.split('?')[0], hash, String(o.ttlMs)]);
      return r.rows[0] as typeof r.rows[0] & { inserted: boolean };
    });
    if (hit!.inserted) { req.idempotency = { tenantId: p.tenantId, principalId: p.principalId, key }; return; }
    if (hit!.request_hash !== hash) throw conflict('Dieser Idempotency-Key wurde schon für eine andere Anfrage verwendet.');
    if (hit!.status === null) throw conflict('Die erste Anfrage mit diesem Idempotency-Key läuft noch. Versuch es gleich nochmals.');
    reply.header('idempotency-replayed', 'true');
    for (const [k, v] of Object.entries(hit!.headers ?? {})) reply.header(k, v);
    return reply.status(hit!.status).send(hit!.body === null ? undefined : hit!.body);
  });

  app.addHook('onSend', async (req, reply, payload) => {
    const i = req.idempotency;
    if (!i) return payload;
    req.idempotency = undefined;
    const ctx = { tenantId: i.tenantId, principalId: i.principalId };
    if (reply.statusCode >= 500) {
      await withTenant(db, ctx, tx => tx.query('DELETE FROM ppm.idempotency_key WHERE tenant_id = app.tenant_id() AND principal_id = $1 AND key = $2', [i.principalId, i.key])).catch(() => undefined);
      return payload;
    }
    let body: unknown = null;
    if (typeof payload === 'string' && payload.length) { try { body = JSON.parse(payload); } catch { body = payload; } }
    const headers: Record<string, string> = {};
    for (const h of ['content-type', 'etag', 'location']) { const v = reply.getHeader(h); if (typeof v === 'string') headers[h] = v; }
    await withTenant(db, ctx, tx => tx.query('UPDATE ppm.idempotency_key SET status = $3, headers = $4, body = $5 WHERE tenant_id = app.tenant_id() AND principal_id = $1 AND key = $2',
      [i.principalId, i.key, reply.statusCode, JSON.stringify(headers), JSON.stringify(body)]));
    return payload;
  });
}
