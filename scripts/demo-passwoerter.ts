/**
 * Passwort für die Personen der Demo in Keycloak setzen (Organisation `demo` im Betrieb; `seed-demo.ts --einladen` legt
 * die Konten ohne Passwort an). Nur Konten unter `@demo.example` aus scripts/seed/personen.ts. Setzt das Passwort
 * dauerhaft, bestätigt die E-Mail und entfernt offene Aktionen («Passwort setzen», «E-Mail bestätigen»), deren Mail
 * niemanden erreicht.
 *
 * Anmeldung als Service Account `<produkt>-iac` (realm-admin, private_key_jwt), Schlüssel aus SOPS (Git Bash):
 *
 *   KEYCLOAK_IAC_PRIVATE_KEY="$(sops -d --extract '["github"]["KEYCLOAK_IAC_PRIVATE_KEY"]' infra/hetzner/betrieb.sops.yaml)" \
 *     node scripts/demo-passwoerter.ts --passwort demo [--trocken]
 *
 * Keycloak und Realm aus identity.app.json (`keycloakUrl`, `product`; `KEYCLOAK_TF_URL` übersteuert die Adresse wie in
 * kc.sh); `--trocken` meldet nur, was sich ändern würde.
 */
import { createHash, createPrivateKey, createPublicKey, randomUUID, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { DEMO_PERSONEN } from './seed/personen.ts';

const { values: a } = parseArgs({ options: {
  passwort: { type: 'string' },
  trocken: { type: 'boolean', default: false },
} });
const fail = (msg: string): never => { console.error(`demo-passwoerter: ${msg}`); process.exit(1); };
const pem = process.env.KEYCLOAK_IAC_PRIVATE_KEY || fail('KEYCLOAK_IAC_PRIVATE_KEY fehlt (aus infra/hetzner/betrieb.sops.yaml)');
const passwort = a.passwort ?? (a.trocken ? '' : fail('--passwort fehlt'));

const app = JSON.parse(readFileSync(new URL('../identity.app.json', import.meta.url), 'utf8')) as { product: string; keycloakUrl: string };
const base = (process.env.KEYCLOAK_TF_URL || app.keycloakUrl).replace(/\/$/, '');
const issuer = `${base}/realms/${app.product}`;
const adminApi = `${base}/admin/realms/${encodeURIComponent(app.product)}`;
const clientId = process.env.KEYCLOAK_IAC_CLIENT_ID || `${app.product}-iac`;

// Client Assertion wie KeycloakAdmin des Baukastens: kid = JWK-Thumbprint (RFC 7638), Zielgruppe = Issuer des Realms
const key = createPrivateKey(pem);
const curve = key.asymmetricKeyDetails?.namedCurve;
const alg = key.asymmetricKeyType === 'rsa' ? 'RS256' : curve === 'prime256v1' ? 'ES256' : fail(`Schlüsseltyp ${key.asymmetricKeyType} ${curve ?? ''} nicht unterstützt (EC P-256 oder RSA)`);
const jwk = createPublicKey(key).export({ format: 'jwk' });
const kid = createHash('sha256').update(JSON.stringify(alg === 'RS256' ? { e: jwk.e, kty: jwk.kty, n: jwk.n } : { crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y })).digest('base64url');
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');

async function token(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const input = `${b64({ alg, kid, typ: 'JWT' })}.${b64({ iss: clientId, sub: clientId, aud: issuer, jti: randomUUID(), iat: now, exp: now + 60 })}`;
  const sig = sign('sha256', Buffer.from(input), alg === 'ES256' ? { key, dsaEncoding: 'ieee-p1363' } : key).toString('base64url');
  const r = await fetch(`${issuer}/protocol/openid-connect/token`, {
    method: 'POST', signal: AbortSignal.timeout(15_000),
    body: new URLSearchParams({
      grant_type: 'client_credentials', client_id: clientId,
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer', client_assertion: `${input}.${sig}`,
    }),
  });
  if (!r.ok) throw new Error(`Anmeldung als ${clientId} an ${issuer} gescheitert (${r.status}): ${await r.text()}`);
  return ((await r.json()) as { access_token: string }).access_token;
}

// Fehler nach dem ersten Aufruf werfen statt process.exit (offene Verbindungen von fetch, unter Windows Abbruch von libuv)
let bearer = '';
async function kc<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${adminApi}${path}`, {
    method, signal: AbortSignal.timeout(15_000),
    headers: { authorization: `Bearer ${bearer}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${await r.text()}`);
  return (r.status === 204 ? undefined : await r.json()) as T;
}

type KcUser = { id: string; email?: string; emailVerified?: boolean; requiredActions?: string[] };
// Nie ein Konto ausserhalb der Demo (RFC 2606, siehe scripts/seed/einladen.ts)
for (const p of DEMO_PERSONEN) if (!p.email.endsWith('@demo.example')) fail(`${p.email} liegt nicht unter @demo.example`);
console.log(`demo-passwoerter: ${a.trocken ? 'Trockenlauf, ' : ''}Realm ${app.product} auf ${base}`);
let gesetzt = 0;
try {
  bearer = await token();
  for (const p of DEMO_PERSONEN) {
    const u = (await kc<KcUser[]>('GET', `/users?email=${encodeURIComponent(p.email)}&exact=true`)).find(x => x.email?.toLowerCase() === p.email.toLowerCase());
    if (!u) { console.log(`demo-passwoerter: ${p.email} fehlt (nicht eingeladen)`); continue; }
    const offen = u.requiredActions ?? [];
    const was = ['Passwort', ...(u.emailVerified ? [] : ['E-Mail bestätigt']), ...(offen.length ? [`Aktionen ${offen.join(', ')} entfernt`] : [])].join(', ');
    if (a.trocken) { console.log(`demo-passwoerter: ${p.email}: würde setzen: ${was}`); continue; }
    // Zuerst das Passwort: scheitert es an der Passwort-Regel des Realms, bleibt das Konto unverändert
    await kc('PUT', `/users/${u.id}/reset-password`, { type: 'password', value: passwort, temporary: false });
    if (!u.emailVerified || offen.length) {
      const rep = await kc<KcUser>('GET', `/users/${u.id}`);
      await kc('PUT', `/users/${u.id}`, { ...rep, emailVerified: true, requiredActions: [] });
    }
    console.log(`demo-passwoerter: ${p.email}: ${was}`);
    gesetzt++;
  }
  console.log(`demo-passwoerter: fertig${a.trocken ? ' (Trockenlauf)' : `, ${gesetzt} Konten`}`);
} catch (e) {
  console.error(`demo-passwoerter: ${(e as Error).message}${gesetzt ? ` (davon schon gesetzt: ${gesetzt})` : ''}`);
  process.exitCode = 1;
}
