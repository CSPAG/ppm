/**
 * Betriebs-Endpunkt (`/healthz`, `/readyz`, `/metrics`) und geordnetes Beenden: `/readyz` sofort 503, Wartezeit,
 * Schritte in Reihenfolge, Exit 0; Zeitlimit Exit 1. Dazu ein echter Prozess `api`, der auf SIGTERM sauber endet.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { Runtime } from '../../src/platform/ops/runtime.ts';
import { startOpsServer } from '../../src/platform/ops/server.ts';
import { skipDb, superuser, asRole } from './harness.ts';
import { startMockIdp } from '@vollholz/iam-testkit';

const log = { info: () => undefined, error: () => undefined };
const skip = await skipDb();
const root = join(import.meta.dirname, '..', '..');

describe('Betrieb', () => {
  test('/healthz, /readyz mit Prüfungen, /metrics nur wenn eingeschaltet', async () => {
    let ok = true, ready = true;
    const s = await startOpsServer({ host: '127.0.0.1', port: 0, metrics: false, ready: () => ready, checks: [{ name: 'datenbank', failure: 'Datenbank nicht erreichbar', run: async () => { if (!ok) throw new Error('x'); } }] });
    const base = `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
    try {
      assert.equal((await fetch(`${base}/healthz`)).status, 200);
      assert.equal((await fetch(`${base}/readyz`)).status, 200);
      ok = false;
      const r = await fetch(`${base}/readyz`);
      assert.deepEqual([r.status, ((await r.json()) as { checks: unknown }).checks], [503, { datenbank: 'Datenbank nicht erreichbar' }]);
      ok = true; ready = false;
      assert.equal((await fetch(`${base}/readyz`)).status, 503);
      assert.equal((await fetch(`${base}/metrics`)).status, 404);
    } finally { s.close(); }
  });

  test('Beenden: nicht bereit, Wartezeit, Schritte der Reihe nach, Exit 0', async () => {
    const order: string[] = [];
    let code = -1;
    const r = new Runtime({ shutdownDelayMs: 50, shutdownTimeoutMs: 2000, log, exit: c => { code = c; } });
    r.onShutdown('server', async () => { order.push(`server:${r.ready}`); }).onShutdown('pool', async () => { order.push('pool'); });
    const t0 = Date.now();
    const p = r.shutdown('SIGTERM');
    assert.equal(r.ready, false, 'sofort nicht bereit');
    await p;
    assert.ok(Date.now() - t0 >= 45);
    assert.deepEqual([order, code], [['server:false', 'pool'], 0]);
  });

  test('Beenden: Zeitlimit überschritten → Exit 1', async () => {
    const codes: number[] = [];
    const r = new Runtime({ shutdownDelayMs: 0, shutdownTimeoutMs: 50, log, exit: c => { codes.push(c); } });
    r.onShutdown('hängt', () => new Promise(res => setTimeout(res, 300)));
    await r.shutdown('SIGTERM');
    assert.equal(codes[0], 1);
  });

  test('Prozess api: SIGTERM → /readyz 503, danach Exit 0', { skip }, async () => {
    const idp = await startMockIdp({ realm: 'ppm', audience: 'ppm-api' });
    const env = {
      PATH: process.env.PATH ?? '', NODE_ENV: 'test', OIDC_ISSUER_URL: idp.issuer, DATABASE_URL: asRole(superuser!, 'ppm_runtime'),
      HTTP_PORT: '18080', OPS_PORT: '19090', HTTP_HOST: '127.0.0.1', OPS_HOST: '127.0.0.1', SHUTDOWN_DELAY: '300ms', SHUTDOWN_TIMEOUT: '5s', LOG_LEVEL: 'silent', SHARED_STATE: 'memory',
    };
    const p = spawn(process.execPath, ['--import', './src/platform/ops/preload.ts', 'src/platform/main/api.ts'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    p.stderr.on('data', d => { err += d; });
    try {
      let up = false;
      for (let i = 0; i < 100 && !up; i++) { up = await fetch('http://127.0.0.1:19090/healthz').then(r => r.ok, () => false); if (!up) await new Promise(r => setTimeout(r, 100)); }
      assert.ok(up, err);
      for (let i = 0; i < 50; i++) { if ((await fetch('http://127.0.0.1:18080/healthz').then(r => r.status, () => 0)) === 200) break; await new Promise(r => setTimeout(r, 100)); }
      const exited = new Promise<number | null>(r => p.on('exit', c => r(c)));
      p.kill('SIGTERM');
      await new Promise(r => setTimeout(r, 100));
      assert.equal((await fetch('http://127.0.0.1:19090/readyz')).status, 503);
      assert.equal(await exited, 0, err);
    } finally { p.kill('SIGKILL'); await idp.close(); }
  });
});
