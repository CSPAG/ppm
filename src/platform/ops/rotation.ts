/**
 * Rotation der Hauptschlüssel (`rotate-keys`): je Mandant alle Geheimnisse mit dem ersten Schlüssel aus
 * `ENCRYPTION_KEYS` neu versiegeln – die der Module (`ROTATIONS` aus modules/index.ts) und die eigenen Entra-Apps des
 * Baukastens. Danach kann der alte Schlüssel aus `ENCRYPTION_KEYS` entfernt werden.
 */
import { listTenants, rewrapEntraSecrets, type Keyring } from '@vollholz/iam';
import { SCHEMA } from '../config/env.ts';
import type { Db, Tx } from '../db/pool.ts';
import { withTenant } from '../db/pool.ts';

/** Rotation eines Moduls: versiegelt seine Geheimnisse im Mandanten neu und liefert die Anzahl. */
export interface Rotation { name: string; rewrap(tx: Tx, keys: Keyring, tenantId: string, dryRun: boolean): Promise<number> }

/**
 * Mandanten über die Besitzer-Rolle (`admin`), Arbeit je Mandant über die Laufzeit-Rolle (`runtime`) mit voller Sicht
 * (`settings`): RLS bindet auch die Besitzer-Rolle. Rückgabe: Anzahl je Rotation.
 */
export async function rotateKeys(admin: Db, runtime: Db, keys: Keyring, rotations: Rotation[], o: { dryRun: boolean; settings: Record<string, string> }): Promise<Record<string, number>> {
  const out: Record<string, number> = { entra: 0 };
  for (const r of rotations) out[r.name] = 0;
  for (const t of await listTenants(admin)) {
    await withTenant(runtime, { tenantId: t.id, principalKind: 'system', settings: o.settings }, async tx => {
      out.entra! += await rewrapEntraSecrets(tx, keys, { schema: SCHEMA, dryRun: o.dryRun });
      for (const r of rotations) out[r.name]! += await r.rewrap(tx, keys, t.id, o.dryRun);
    });
  }
  return out;
}
