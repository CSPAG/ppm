/**
 * Modul «vorgaenge»: Zustand langer Läufe (Jobs, die eine Route mit 202 und `Location: /v1/vorgaenge/{id}` gestartet
 * hat). Sichtbar nur für die Person bzw. den Client, die den Vorgang ausgelöst haben.
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { notFound } from '../../core/errors.ts';
import type { Module } from '../../http/app.ts';
import { DateTime, IdParams, Nullable, Uuid } from '../../http/route-kit.ts';

const Vorgang = Type.Object({
  id: Uuid,
  kind: Type.String(),
  status: Type.Union([Type.Literal('queued'), Type.Literal('running'), Type.Literal('done'), Type.Literal('failed')]),
  attempts: Type.Integer(),
  result: Nullable(Type.Object({}, { additionalProperties: true })),
  error: Nullable(Type.String()),
  createdAt: DateTime,
  finishedAt: Nullable(DateTime),
}, { $id: 'Vorgang', additionalProperties: false });

function register(app: FastifyInstance): void {
  app.addSchema(Vorgang);
  app.get('/v1/vorgaenge/:id', {
    schema: { tags: ['Vorgänge'], summary: 'Vorgang abfragen', params: IdParams, response: { 200: Type.Ref('Vorgang') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const p = req.requirePrincipal();
    const r = await req.tx(tx => tx.query<{ id: string; kind: string; status: 'queued' | 'running' | 'done' | 'failed'; attempts: number; result: Record<string, unknown> | null; last_error: string | null; created_at: Date; finished_at: Date | null }>(
      'SELECT id, kind, status, attempts, result, last_error, created_at, finished_at FROM ppm.job WHERE id = $1 AND created_by = $2', [id, p.principalId]));
    const j = r.rows[0];
    if (!j) throw notFound('Vorgang');
    if (j.status === 'queued' || j.status === 'running') reply.header('retry-after', '2');
    return {
      id: j.id, kind: j.kind, status: j.status, attempts: j.attempts, result: j.result,
      error: j.status === 'failed' ? 'Der Vorgang ist gescheitert.' : null,
      createdAt: j.created_at.toISOString(), finishedAt: j.finished_at?.toISOString() ?? null,
    };
  });
}

export const vorgaengeModule: Module = { name: 'vorgaenge', register };
