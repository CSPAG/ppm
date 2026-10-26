/**
 * Ausgehende Abrufe an Adressen aus Daten (Webhooks) mit SSRF-Schutz (Netz-Adapter, scripts/check-network.ts):
 *
 * - nur http(s), keine Zugangsdaten in der Adresse, Ports 80/443 und 1024–65535;
 * - DNS einmal auflösen, jede Adresse prüfen (keine privaten, lokalen, Link-Local-, Multicast- oder reservierten
 *   Netze) und die Verbindung an die geprüfte Adresse festhalten (kein zweites Auflösen, kein DNS-Rebinding);
 * - keine Weiterleitungen;
 * - **feste Gesamtfrist** über Verbindung, Senden und Antwort (das Zeitlimit von node:http gilt nur für Leerlauf; ein
 *   tröpfchenweise antwortendes Gegenüber hielte sonst die Aufgabe auf) und Abbruch bei der Grössengrenze.
 */
import { lookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { BlockList, isIP } from 'node:net';

export class SsrfError extends Error {}

const blocked = new BlockList();
for (const [net, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blocked.addSubnet(net, prefix, 'ipv4');
for (const [net, prefix] of [
  ['::', 128], ['::1', 128], ['100::', 64], ['2001::', 23], ['2001:db8::', 32],
  ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
] as const) blocked.addSubnet(net, prefix, 'ipv6');

/** IPv4 in einer IPv6-Adresse (`::ffff:a.b.c.d`, `::ffff:7f00:1`, NAT64 `64:ff9b::…`), sonst null. */
function embeddedV4(ip: string): string | null {
  const m = /^(?:::ffff:|64:ff9b::)(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/i.exec(ip);
  if (!m) return null;
  if (m[1]) return m[1];
  const hi = parseInt(m[2]!, 16), lo = parseInt(m[3]!, 16);
  return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
}

export function isBlockedAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 0) return true;
  if (family === 6) {
    // IPv4-gemappte und NAT64-Adressen wie die eingebettete IPv4 prüfen (die BlockList würde sonst alle IPv4 sperren)
    const v4 = embeddedV4(ip);
    if (v4) return isBlockedAddress(v4);
    return blocked.check(ip, 'ipv6');
  }
  return blocked.check(ip, 'ipv4');
}

/** Adresse prüfen (Form); wirft SsrfError mit Text in Du-Form. */
export function checkUrl(raw: string, o: { allowPrivate?: boolean } = {}): URL {
  let u: URL;
  try { u = new URL(raw); } catch { throw new SsrfError('Die Adresse ist ungültig.'); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new SsrfError('Nur http- und https-Adressen sind erlaubt.');
  if (u.username || u.password) throw new SsrfError('Die Adresse darf keine Zugangsdaten enthalten.');
  const port = Number(u.port || (u.protocol === 'https:' ? 443 : 80));
  if (!o.allowPrivate && port !== 80 && port !== 443 && port < 1024) throw new SsrfError('Dieser Port ist nicht erlaubt.');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (!o.allowPrivate && (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local'))) throw new SsrfError('Interne Adressen sind nicht erlaubt.');
  if (!o.allowPrivate && isIP(host) && isBlockedAddress(host)) throw new SsrfError('Private und interne Adressen sind nicht erlaubt.');
  return u;
}

export interface SafeRequest { method?: 'POST' | 'GET'; headers?: Record<string, string>; body?: string; timeoutMs: number; maxBytes: number; allowPrivate?: boolean }
export interface SafeResponse { status: number; body: string; truncated: boolean }

export async function safeFetch(raw: string, o: SafeRequest): Promise<SafeResponse> {
  const u = checkUrl(raw, o);
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const deadline = AbortSignal.timeout(o.timeoutMs);
  const addrs = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookup(host, { all: true, verbatim: true });
  if (!addrs.length) throw new SsrfError('Die Adresse lässt sich nicht auflösen.');
  if (!o.allowPrivate) for (const a of addrs) if (isBlockedAddress(a.address)) throw new SsrfError('Die Adresse zeigt auf ein privates oder internes Netz.');
  const pinned = addrs[0]!;
  const lib = u.protocol === 'https:' ? https : http;
  return new Promise<SafeResponse>((resolve, reject) => {
    const req = lib.request({
      protocol: u.protocol, hostname: host, port: u.port || undefined, path: `${u.pathname}${u.search}`, method: o.method ?? 'POST',
      headers: { 'user-agent': 'ppm-webhooks/1', ...o.headers, ...(o.body !== undefined ? { 'content-length': String(Buffer.byteLength(o.body)) } : {}) },
      // Verbindung an die geprüfte Adresse; TLS prüft weiter den Namen (servername)
      lookup: (_h, _opts, cb) => cb(null, pinned.address, pinned.family),
      ...(u.protocol === 'https:' ? { servername: isIP(host) ? undefined : host } : {}),
      signal: deadline, agent: false,
    }, res => {
      const chunks: Buffer[] = [];
      let size = 0, truncated = false;
      res.on('data', (c: Buffer) => {
        size += c.length;
        if (size > o.maxBytes) { truncated = true; chunks.push(c.subarray(0, Math.max(0, o.maxBytes - (size - c.length)))); res.destroy(); return; }
        chunks.push(c);
      });
      const done = () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8'), truncated });
      res.on('end', done);
      res.on('close', () => { if (truncated) done(); });
      res.on('error', e => (truncated ? done() : reject(deadline.aborted ? new SsrfError(`Keine vollständige Antwort innert ${o.timeoutMs} ms.`) : e)));
    });
    req.on('error', e => reject(deadline.aborted ? new SsrfError(`Keine Antwort innert ${o.timeoutMs} ms.`) : e));
    if (o.body !== undefined) req.write(o.body);
    req.end();
  });
}
