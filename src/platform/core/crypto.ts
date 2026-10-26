/**
 * Umschlagverschlüsselung für Geheimnisse in der Datenbank (z. B. Webhook-Geheimnisse): AES-256-GCM (`box`/`unbox` aus
 * `@vollholz/iam`) mit AAD, Datenschlüssel je Mandant (HKDF aus dem Hauptschlüssel und der ID des Mandanten),
 * Hauptschlüssel aus `ENCRYPTION_KEYS` (der erste verschlüsselt, alle entschlüsseln). Rotation: neuen Schlüssel vorn in
 * `ENCRYPTION_KEYS`, dann `rotate-keys` (scripts/rotate-encryption-keys.ts).
 *
 * Format: 0x01 · Länge der Schlüssel-ID · Schlüssel-ID (ASCII) · box(…)
 */
import { hkdfSync } from 'node:crypto';
import { box, keyById, primaryKey, unbox, type Keyring } from '@vollholz/iam';

export type { Keyring };

const VERSION = 1;

function dataKey(master: Buffer, tenantId: string): Buffer {
  return Buffer.from(hkdfSync('sha256', master, Buffer.from(tenantId, 'utf8'), Buffer.from('ppm:dek:v1', 'utf8'), 32));
}

export function seal(keys: Keyring, tenantId: string, plain: string, aad: string): Buffer {
  const k = primaryKey(keys);
  const id = Buffer.from(k.id, 'ascii');
  return Buffer.concat([Buffer.from([VERSION, id.length]), id, box(dataKey(k.key, tenantId), plain, `${tenantId}:${aad}`)]);
}

/** Schlüssel-ID eines versiegelten Werts (für die Rotation). */
export function sealedKeyId(sealed: Buffer): string {
  if (sealed[0] !== VERSION) throw new Error('Unbekanntes Format des Geheimnisses');
  return sealed.subarray(2, 2 + sealed[1]!).toString('ascii');
}

export function open(keys: Keyring, tenantId: string, sealed: Buffer, aad: string): string {
  const id = sealedKeyId(sealed);
  const k = keyById(keys, id);
  return unbox(dataKey(k.key, tenantId), sealed.subarray(2 + sealed[1]!), `${tenantId}:${aad}`).toString('utf8');
}

/** Neu versiegeln mit dem ersten Schlüssel; `null`, wenn der Wert schon mit ihm versiegelt ist. */
export function rewrap(keys: Keyring, tenantId: string, sealed: Buffer, aad: string): Buffer | null {
  if (sealedKeyId(sealed) === primaryKey(keys).id) return null;
  return seal(keys, tenantId, open(keys, tenantId, sealed, aad), aad);
}
