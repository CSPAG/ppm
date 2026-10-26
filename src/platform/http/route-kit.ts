/**
 * Bausteine für die Routen aller Module (generisch, ohne Fachbezug): Schemas, Cursor, ETag/If-Match, Header für
 * Idempotenz, Handelnder, Audit mit Ereignis. Was `@vollholz/iam` schon hat (`etag`, `ifMatchVersion`, `encodeCursor`,
 * `decodeCursor`, `likePattern`), wird wiederverwendet.
 */
import { Type, type TSchema } from '@sinclair/typebox';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { decodeCursor, encodeCursor, etag, ifMatchVersion, likePattern, type AuditEntry } from '@vollholz/iam';
import { actorOf } from '../auth/principal.ts';
import { emit, type DomainEvent } from '../core/events.ts';
import { preconditionFailed, preconditionRequired } from '../core/errors.ts';
import type { Tx } from '../db/pool.ts';

export { actorOf, decodeCursor, encodeCursor, etag, likePattern };
export { fullTx } from '../authz/view.ts';

export const Uuid = Type.String({ format: 'uuid' });
export const DateTime = Type.String({ format: 'date-time' });
export const DateOnly = Type.String({ format: 'date' });
export const Nullable = <T extends TSchema>(s: T) => Type.Union([s, Type.Null()]);
export const IdParams = Type.Object({ id: Uuid }, { additionalProperties: false });
export const Limit = Type.Integer({ minimum: 1, maximum: 200, default: 50, description: 'Seitengrösse (höchstens 200).' });
export const Cursor = Type.String({ maxLength: 1000, description: 'Cursor aus `next` der vorigen Seite.' });
export const NextCursor = Nullable(Type.String({ description: 'Cursor der nächsten Seite; `null` am Ende.' }));
export const Classification = Type.Integer({ minimum: 0, maximum: 2, description: 'Klassifizierung: 0 intern, 1 vertraulich, 2 streng vertraulich.' });

export const IdempotencyHeaders = Type.Object({
  'idempotency-key': Type.Optional(Type.String({ minLength: 1, maxLength: 255, description: 'Gleicher Schlüssel und gleicher Inhalt ergeben dieselbe Antwort (24 h).' })),
});
export const IfMatchHeaders = Type.Object({
  'if-match': Type.Optional(Type.String({ description: 'ETag der gelesenen Fassung (`W/"<version>"`). Pflicht (sonst 428).' })),
});

/** Version aus If-Match; ohne Header 428, abweichend 412 mit `currentVersion`. */
export function requireIfMatch(req: FastifyRequest, current: number): void {
  const v = ifMatchVersion(req.headers['if-match']);
  if (v === undefined) throw preconditionRequired();
  if (v !== current) throw preconditionFailed(current);
}

export function sendWithEtag<T extends { version: number }>(reply: FastifyReply, body: T, status = 200): FastifyReply {
  return reply.status(status).header('etag', etag(body.version)).send(body);
}

/** Audit-Eintrag (immer) und Ereignis der Outbox (falls angegeben) in derselben Transaktion. */
export async function record(req: FastifyRequest, tx: Tx, e: AuditEntry, event?: Omit<DomainEvent, 'source'>): Promise<void> {
  await req.audit(tx, e);
  if (event) await emit(tx, { ...event, source: req.source });
}

/** Cursor mit Prüfung, dass er zur selben Abfrage gehört (`q` = Suchbegriff). */
export function pageCursor<T extends Record<string, unknown>>(c: string | undefined, q: string): T | null {
  return decodeCursor<T>(c, v => v.q === q);
}
