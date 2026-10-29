/**
 * Anmeldedienst nur für den Prozess des Seed-Skripts (127.0.0.1, zufälliger Port): Discovery, JWKS und Tokens mit
 * einem Schlüssel, der nur im Speicher lebt. Die Anwendung im Prozess vertraut ihm, weil das Skript ihr diesen Issuer
 * gibt; die laufenden Dienste kennen ihn nicht. Nur `node:crypto` und `node:http` (läuft auch im Image ohne
 * Dev-Abhängigkeiten).
 */
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface Anmeldung {
  issuer: string;
  /** Token einer Person mit den Claims wie von Keycloak (Name und E-Mail gleicht die Anmeldung im Principal ab). */
  token(p: { subject: string; name: string; email: string | null; first: string; last: string }, o: { org: string; aud: string; azp: string }): string;
  close(): Promise<void>;
}

const b64 = (x: unknown) => Buffer.from(JSON.stringify(x)).toString('base64url');

export async function anmeldung(): Promise<Anmeldung> {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'seed', alg: 'RS256', use: 'sig' };
  let issuer = '';
  const realm = '/realms/seed';
  const server = createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.url === `${realm}/.well-known/openid-configuration`) {
      return res.end(JSON.stringify({ issuer, jwks_uri: `${issuer}/protocol/openid-connect/certs`, token_endpoint: `${issuer}/protocol/openid-connect/token`, authorization_endpoint: `${issuer}/protocol/openid-connect/auth` }));
    }
    if (req.url === `${realm}/protocol/openid-connect/certs`) return res.end(JSON.stringify({ keys: [jwk] }));
    res.statusCode = 404;
    res.end('{}');
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port}${realm}`;
  return {
    issuer,
    token: (p, o) => {
      const jetzt = Math.floor(Date.now() / 1000);
      const kopf = b64({ alg: 'RS256', kid: 'seed', typ: 'JWT' });
      const inhalt = b64({
        iss: issuer, aud: o.aud, sub: p.subject, iat: jetzt, exp: jetzt + 4 * 3600, jti: randomUUID(), azp: o.azp,
        name: p.name, email: p.email, given_name: p.first, family_name: p.last, preferred_username: p.email ?? p.subject,
        organization: [o.org], scope: 'openid profile email organization',
      });
      return `${kopf}.${inhalt}.${sign('RSA-SHA256', Buffer.from(`${kopf}.${inhalt}`), privateKey).toString('base64url')}`;
    },
    close: () => new Promise(r => { server.closeAllConnections(); server.close(() => r()); }),
  };
}
