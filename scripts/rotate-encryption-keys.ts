/**
 * Hauptschlüssel rotieren (Prozess `rotate-keys` im Image, lokal `npm run rotate-keys`): Neuen Schlüssel vorn in
 * `ENCRYPTION_KEYS` setzen (`neu:<base64>,alt:<base64>`), dann dieses Skript: Es versiegelt je Mandant alle Geheimnisse
 * mit dem ersten Schlüssel neu (Module über `ROTATIONS`, eigene Entra-Apps des Baukastens). Danach den alten Schlüssel
 * entfernen. Sitzungen laufen ab (SESSION_TTL) und brauchen keine Rotation.
 *
 *   node scripts/rotate-encryption-keys.ts [--dry-run]
 */
import { fullView, parseEncryptionKeys } from '@vollholz/iam';
import pg from 'pg';
import { model } from '../src/platform/authz/model.ts';
import { ROTATIONS } from '../src/platform/modules/index.ts';
import { rotateKeys } from '../src/platform/ops/rotation.ts';

const env = process.env;
const dryRun = process.argv.includes('--dry-run');
const raw = env.ENCRYPTION_KEYS || (env.ENCRYPTION_KEYS_FILE ? (await import('node:fs')).readFileSync(env.ENCRYPTION_KEYS_FILE, 'utf8').trim() : '');
if (!raw || !env.DATABASE_ADMIN_URL || !(env.DATABASE_WORKER_URL || env.DATABASE_URL)) {
  console.error('rotate-keys: ENCRYPTION_KEYS, DATABASE_ADMIN_URL und DATABASE_WORKER_URL (oder DATABASE_URL) nötig');
  process.exit(78);
}
const keys = parseEncryptionKeys(raw);
const admin = new pg.Pool({ connectionString: env.DATABASE_ADMIN_URL, max: 2 });
const runtime = new pg.Pool({ connectionString: env.DATABASE_WORKER_URL || env.DATABASE_URL, max: 2 });
try {
  const n = await rotateKeys(admin, runtime, keys, [...ROTATIONS], { dryRun, settings: fullView(model) });
  console.log(`${dryRun ? 'Probelauf' : 'Neu versiegelt'} mit Schlüssel ${keys[0]!.id}:`, n);
} finally { await admin.end(); await runtime.end(); }
