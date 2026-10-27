/**
 * Signatur nach Standard Webhooks (https://www.standardwebhooks.com): Header `webhook-id`, `webhook-timestamp`,
 * `webhook-signature` = `v1,<base64(HMAC-SHA256(geheimnis, "<id>.<zeitstempel>.<body>"))>`; Geheimnis `whsec_<base64>`.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const newSecret = () => `whsec_${randomBytes(24).toString('base64')}`;

const keyOf = (secret: string) => Buffer.from(secret.replace(/^whsec_/, ''), 'base64');

export function sign(secret: string, id: string, timestamp: number, body: string): string {
  return `v1,${createHmac('sha256', keyOf(secret)).update(`${id}.${timestamp}.${body}`).digest('base64')}`;
}

/** Prüfung beim Empfänger (für Tests und als Beispiel): eine der Signaturen passt, Zeitstempel höchstens 5 Minuten alt. */
export function verify(secret: string, headers: Record<string, string>, body: string, now = Date.now()): boolean {
  const id = headers['webhook-id'], ts = Number(headers['webhook-timestamp']), sigs = headers['webhook-signature'];
  if (!id || !Number.isFinite(ts) || !sigs || Math.abs(now / 1000 - ts) > 300) return false;
  const want = Buffer.from(sign(secret, id, ts, body));
  return sigs.split(' ').some(s => { const b = Buffer.from(s); return b.length === want.length && timingSafeEqual(b, want); });
}
