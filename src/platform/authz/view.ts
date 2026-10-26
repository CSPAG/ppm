/**
 * Volle Sicht ohne Person (Hintergrundarbeit: Worker, Outbox, Skripte): alle Rechte an `org`, Freigabestufe 2, im
 * Mandanten. Inhalte gehen nie an eine Person zurück; Anfragen nutzen immer `req.tx` mit ihrer Lesesicht.
 */
import { fullView } from '@vollholz/iam';
import { withTenant, type Db, type Tx } from '../db/pool.ts';
import { model } from './model.ts';

const settings = fullView(model);

export function fullTx<T>(db: Db, tenantId: string, fn: (tx: Tx) => Promise<T>, principalKind: 'worker' | 'system' = 'worker'): Promise<T> {
  return withTenant(db, { tenantId, principalKind, settings }, fn);
}
