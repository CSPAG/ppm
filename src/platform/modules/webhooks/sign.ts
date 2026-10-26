/**
 * Signatur nach Standard Webhooks (https://www.standardwebhooks.com): Header `webhook-id`, `webhook-timestamp`,
 * `webhook-signature: v1,<base64(HMAC-SHA256(secret, "<id>.<timestamp>.<body>"))>`; Geheimnis `whsec_<base64>`.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const newSecret = () => `whsec_${randomBytes(32).toString('base64')}`;

function key(secret: string): Buffer {
  return Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64');
}

export function sign(secret: string, id: string, timestamp: number, body: string): string {
  return `v1,${createHmac('sha256', key(secret)).update(`${id}.${timestamp}.${body}`).digest('base64')}`;
}

export function signedHeaders(secret: string, id: string, body: string, now = Date.now()): Record<string, string> {
  const ts = Math.floor(now / 1000);
  return { 'content-type': 'application/json', 'webhook-id': id, 'webhook-timestamp': String(ts), 'webhook-signature': sign(secret, id, ts, body) };
}

/** Prüfung beim Empfänger (für Tests und als Vorlage), Toleranz 5 Minuten. */
export function verify(secret: string, headers: Record<string, string | undefined>, body: string, now = Date.now()): boolean {
  const id = headers['webhook-id'], ts = Number(headers['webhook-timestamp']), sigs = headers['webhook-signature'];
  if (!id || !Number.isFinite(ts) || !sigs || Math.abs(now / 1000 - ts) > 300) return false;
  const want = Buffer.from(sign(secret, id, ts, body));
  return sigs.split(' ').some(s => { const b = Buffer.from(s); return b.length === want.length && timingSafeEqual(b, want); });
}
