/**
 * Betriebs-Endpunkt jedes Prozesses auf `OPS_PORT` (Netz-Adapter): `/healthz` (lebt), `/readyz` (bereit: nicht im
 * Beenden und alle Prüfungen ok, sonst 503), `/metrics` (Prometheus, nur mit `METRICS_ENABLED=true`).
 */
import { createServer, type Server } from 'node:http';
import { prometheusExporter } from './telemetry.ts';

export interface ReadyCheck { name: string; failure: string; run: () => Promise<unknown> }

export interface OpsServerOptions {
  host: string; port: number; metrics: boolean;
  ready: () => boolean;
  checks: ReadyCheck[];
  /** Höchstdauer je Prüfung. */
  checkTimeoutMs?: number;
}

export async function readiness(o: Pick<OpsServerOptions, 'ready' | 'checks' | 'checkTimeoutMs'>): Promise<{ ok: boolean; checks: Record<string, string> }> {
  if (!o.ready()) return { ok: false, checks: { prozess: 'beendet sich' } };
  const out: Record<string, string> = {};
  let ok = true;
  await Promise.all(o.checks.map(async c => {
    try {
      await Promise.race([c.run(), new Promise((_, rej) => setTimeout(() => rej(new Error('Zeitlimit')), o.checkTimeoutMs ?? 2000).unref())]);
      out[c.name] = 'ok';
    } catch { ok = false; out[c.name] = c.failure; }
  }));
  return { ok, checks: out };
}

export function startOpsServer(o: OpsServerOptions): Promise<Server> {
  const json = (res: import('node:http').ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(body));
  };
  const server = createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0];
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { status: 'method not allowed' });
    if (path === '/healthz') return json(res, 200, { status: 'ok' });
    if (path === '/readyz') {
      void readiness(o).then(r => json(res, r.ok ? 200 : 503, { status: r.ok ? 'ok' : 'nicht bereit', checks: r.checks }));
      return;
    }
    const prom = prometheusExporter();
    if (path === '/metrics' && o.metrics && prom) return prom.getMetricsRequestHandler(req, res);
    return json(res, 404, { status: 'not found' });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(o.port, o.host, () => resolve(server));
  });
}
