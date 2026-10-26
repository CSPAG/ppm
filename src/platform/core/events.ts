/**
 * Outbox (Profil outbox): `emit()` schreibt ein Ereignis in derselben Transaktion wie die Änderung nach
 * `ppm.outbox_event`; der Worker verteilt es an die Abnehmer der Module (`OutboxConsumer`). Ausgeliefert wird als
 * CloudEvent 1.0 (`toCloudEvent`), an Webhooks nach Standard Webhooks.
 */
import type { Tx } from '../db/pool.ts';
import type { Source } from './audit.ts';

export const EVENT_SOURCE = '/ppm';

export interface DomainEvent {
  /** z. B. `projekt.created` */
  type: string;
  /** Betroffene Ressource, z. B. `projekt/<id>` */
  subject: string | null;
  data: Record<string, unknown>;
  source?: Source;
}

export async function emit(tx: Tx, e: DomainEvent): Promise<string> {
  const r = await tx.query<{ id: string }>(
    'INSERT INTO ppm.outbox_event (tenant_id, type, subject, data, source) VALUES (app.tenant_id(), $1, $2, $3, $4) RETURNING id',
    [e.type, e.subject, JSON.stringify(e.data), e.source ?? 'system']);
  return r.rows[0]!.id;
}

export interface StoredEvent { tenantId: string; id: string; type: string; subject: string | null; data: Record<string, unknown>; source: string; occurredAt: Date }

export interface CloudEvent { specversion: '1.0'; id: string; source: string; type: string; subject?: string; time: string; datacontenttype: 'application/json'; data: Record<string, unknown>; tenant: string }

export function toCloudEvent(e: StoredEvent): CloudEvent {
  return {
    specversion: '1.0', id: e.id, source: `${EVENT_SOURCE}/${e.source}`, type: `ch.project-suite.ppm.${e.type}`,
    ...(e.subject ? { subject: e.subject } : {}), time: e.occurredAt.toISOString(), datacontenttype: 'application/json', data: e.data, tenant: e.tenantId,
  };
}

/** Abnehmer der Outbox eines Moduls (in modules/index.ts › OUTBOX_CONSUMERS). Läuft je Ereignis mit voller Sicht im Mandanten. */
export interface OutboxConsumer {
  name: string;
  /** Typen, die der Abnehmer will (`*` alle). */
  types: string[] | '*';
  handle(tx: Tx, e: StoredEvent): Promise<void>;
}
