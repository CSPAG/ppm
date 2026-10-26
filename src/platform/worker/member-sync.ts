/**
 * Abgleich der Mitglieder aus Keycloak (`MemberSync` des Baukastens, eigener Lese-Client `ppm-sync`): Personen und
 * Name der Organisation ins Verzeichnis, dazu Aufräumen abgelaufener Freigaben und Break-Glass. Alle
 * `MEMBER_SYNC_INTERVAL`, höchstens ein Lauf über alle Instanzen (eigene Sperre des Baukastens).
 */
import { MemberSync, type IamConfig } from '@vollholz/iam';
import { audit } from '../core/audit.ts';
import { SCHEMA } from '../config/env.ts';
import type { Db } from '../db/pool.ts';
import type { Log } from './queue.ts';

export function memberSync(cfg: IamConfig, db: Db, log: Log): MemberSync {
  return new MemberSync(cfg, db, { schema: SCHEMA, audit, log: (m, d) => log.info(d ?? {}, m) });
}
