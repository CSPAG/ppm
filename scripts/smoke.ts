/**
 * Rauchtest gegen eine laufende Instanz (lokal oder nach einem Deploy). Exit 0 ok, 1 Befund.
 *
 *   BASE_URL=https://ppm.project-suite.ch OPS_URL=… node scripts/smoke.ts
 *
 * - Betriebs-Endpunkt `OPS_URL` (Standard http://localhost:9090) `/healthz` und `/readyz`, falls erreichbar
 * - `/v1/openapi.json`, problem+json mit 401 auf `/v1/me` ohne Token
 * - mit `SMOKE_CLIENT_ID` und `SMOKE_CLIENT_KEY` (bzw. `_FILE`, PEM für private_key_jwt) und `OIDC_ISSUER_URL`: echtes
 *   Token über Client Credentials (mit DPoP), dann `GET /v1/handlungsfelder`
 */
import { createHash, createPrivateKey, randomUUID, sign, type KeyObject } from 'node:crypto';
import { readFileSync } from 'node:fs';

const env = (k: string) => process.env[k] || (process.env[`${k}_FILE`] ? readFileSync(process.env[`${k}_FILE`]!, 'utf8').trim() : '');
const BASE = (process.env.BASE_URL ?? 'http://localhost:8080').replace(/\/+$/, '');
const OPS = (process.env.OPS_URL ?? 'http://localhost:9090').replace(/\/+$/, '');
const problems: string[] = [];
const ok = (m: string) => console.log(`  ok  ${m}`);
const bad = (m: string) => { problems.push(m); console.log(`  !!  ${m}`); };

const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url');
/** JWT mit ES256 (JOSE-Signatur, nicht DER). */
function jwt(key: KeyObject, header: Record<string, unknown>, payload: Record<string, unknown>): string {
  const input = `${b64u(JSON.stringify({ alg: 'ES256', ...header }))}.${b64u(JSON.stringify(payload))}`;
  return `${input}.${b64u(sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' }))}`;
}

async function check(name: string, fn: () => Promise<void>) {
  try { await fn(); ok(name); } catch (e) { bad(`${name}: ${(e as Error).message}`); }
}

console.log(`Rauchtest ${BASE}`);
try {
  const h = await fetch(`${OPS}/healthz`, { signal: AbortSignal.timeout(3000) });
  if (h.status === 200) ok(`${OPS}/healthz`); else bad(`${OPS}/healthz: ${h.status}`);
  const r = await fetch(`${OPS}/readyz`, { signal: AbortSignal.timeout(5000) });
  if (r.status === 200) ok(`${OPS}/readyz`); else bad(`${OPS}/readyz: ${r.status}`);
} catch { console.log(`  --  Betriebs-Endpunkt ${OPS} nicht erreichbar (von aussen üblich), übersprungen`); }

await check('GET /v1/openapi.json', async () => {
  const r = await fetch(`${BASE}/v1/openapi.json`);
  if (r.status !== 200) throw new Error(`Status ${r.status}`);
  const doc = await r.json() as { openapi?: string; paths?: Record<string, unknown> };
  if (!doc.openapi?.startsWith('3.1') || !doc.paths?.['/v1/handlungsfelder']) throw new Error('OpenAPI 3.1 mit /v1/handlungsfelder erwartet');
});

await check('GET /v1/me ohne Token: 401 problem+json', async () => {
  const r = await fetch(`${BASE}/v1/me`);
  if (r.status !== 401) throw new Error(`Status ${r.status}`);
  if (!r.headers.get('content-type')?.includes('application/problem+json')) throw new Error(`content-type ${r.headers.get('content-type')}`);
});

const clientId = process.env.SMOKE_CLIENT_ID, keyPem = env('SMOKE_CLIENT_KEY'), issuer = process.env.OIDC_ISSUER_URL;
if (clientId && keyPem && issuer) {
  await check(`GET /v1/handlungsfelder als ${clientId}`, async () => {
    const key = createPrivateKey(keyPem);
    const jwk = { ...key.export({ format: 'jwk' }) } as Record<string, string>;
    const pub = { crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y };
    const disco = await (await fetch(`${issuer.replace(/\/+$/, '')}/.well-known/openid-configuration`)).json() as { token_endpoint: string };
    const now = Math.floor(Date.now() / 1000);
    const proof = (htm: string, htu: string, ath?: string) => jwt(key, { typ: 'dpop+jwt', jwk: pub }, { jti: randomUUID(), htm, htu, iat: now, ...(ath ? { ath } : {}) });
    const assertion = jwt(key, { typ: 'JWT' }, { iss: clientId, sub: clientId, aud: issuer, jti: randomUUID(), iat: now, exp: now + 60 });
    const t = await fetch(disco.token_endpoint, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', dpop: proof('POST', disco.token_endpoint) },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer', client_assertion: assertion }),
    });
    if (t.status !== 200) throw new Error(`Token: ${t.status} ${await t.text()}`);
    const token = (await t.json() as { access_token: string }).access_token;
    const url = `${BASE}/v1/handlungsfelder`;
    const r = await fetch(url, { headers: { authorization: `DPoP ${token}`, dpop: proof('GET', url, b64u(createHash('sha256').update(token).digest())) } });
    if (r.status !== 200) throw new Error(`Status ${r.status} ${await r.text()}`);
  });
} else console.log('  --  SMOKE_CLIENT_ID/SMOKE_CLIENT_KEY/OIDC_ISSUER_URL nicht gesetzt: Aufruf mit Token übersprungen');

if (problems.length) { console.error(`Rauchtest: ${problems.length} Befund(e)`); process.exit(1); }
console.log('Rauchtest: ok');
