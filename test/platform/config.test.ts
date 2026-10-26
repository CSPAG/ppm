/**
 * Konfiguration (Leitentscheidung L8): Exit 78 mit allen Fehlern, Produktionsverbote, `<NAME>_FILE`, Dienstzuordnung
 * der Geheimnisse, Doku aktuell.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { ConfigError, EXIT_CONFIG, loadPlatformConfig, VARS } from '../../src/platform/config/env.ts';

const root = join(import.meta.dirname, '..', '..');
const BASE = { NODE_ENV: 'development', OIDC_ISSUER_URL: 'http://localhost:8180/realms/ppm', DATABASE_URL: 'postgres://ppm_runtime:x@localhost:5433/ppm' };
const PROD = {
  NODE_ENV: 'production', PUBLIC_BASE_URL: 'https://ppm.project-suite.ch', OIDC_ISSUER_URL: 'https://id.project-suite.ch/realms/ppm',
  DATABASE_URL: 'postgres://ppm_runtime:x@db/ppm', DATABASE_SSL: 'verify-full', OIDC_BFF_PRIVATE_KEY: 'pem', SESSION_SECRET: 'x'.repeat(40),
  ENCRYPTION_KEYS: `k1:${Buffer.alloc(32, 1).toString('base64')}`,
};
const errorsOf = (env: Record<string, string>, service: 'api' | 'worker' | 'mcp' | null = 'api') => {
  try { loadPlatformConfig(env, service); return []; } catch (e) {
    assert.ok(e instanceof ConfigError);
    return e.message.split('\n').slice(1).map(l => l.replace(/^\s*- /, ''));
  }
};

describe('Konfiguration', () => {
  test('gültige Entwicklungskonfiguration mit Standardwerten', () => {
    const c = loadPlatformConfig(BASE, 'api');
    assert.deepEqual([c.http.port, c.ops.port, c.mcp.port, c.iam.oidc.apiAudience, c.iam.oidc.bffClientId], [8080, 9090, 8081, 'ppm-api', 'ppm-platform']);
    assert.equal(c.ops.shutdownDelayMs, 5000);
  });

  test('alle Fehler auf einmal', () => {
    const e = errorsOf({ NODE_ENV: 'development', HTTP_PORT: 'achtzig', SHUTDOWN_TIMEOUT: 'bald' });
    assert.ok(e.some(x => x.startsWith('DATABASE_URL fehlt')));
    assert.ok(e.some(x => x.startsWith('OIDC_ISSUER_URL fehlt')));
    assert.ok(e.some(x => x.startsWith('HTTP_PORT:')));
    assert.ok(e.some(x => x.startsWith('SHUTDOWN_TIMEOUT:')));
  });

  test('Produktion: HTTPS, Geheimnisse, verify-full, DPoP, kein Auto-Provisioning, kein SSRF-Schalter', () => {
    assert.deepEqual(errorsOf(PROD), []);
    const e = errorsOf({ ...PROD, PUBLIC_BASE_URL: 'http://ppm.example', DATABASE_SSL: 'require', DPOP_MODE: 'off', TENANT_AUTO_PROVISION: 'true', WEBHOOK_ALLOW_PRIVATE: 'true', SESSION_SECRET: '', ENCRYPTION_KEYS: '' });
    for (const k of ['PUBLIC_BASE_URL muss', 'DATABASE_SSL muss', 'DPOP_MODE=off', 'TENANT_AUTO_PROVISION=true', 'WEBHOOK_ALLOW_PRIVATE=true', 'SESSION_SECRET fehlt', 'ENCRYPTION_KEYS fehlt']) {
      assert.ok(e.some(x => x.startsWith(k)), `${k} in ${JSON.stringify(e)}`);
    }
  });

  test('Geheimnisse je Dienst: der MCP-Dienst braucht keinen Datenbank-Login, der Worker keine Sitzung', () => {
    const mcp = { NODE_ENV: 'production', OIDC_ISSUER_URL: PROD.OIDC_ISSUER_URL, PUBLIC_BASE_URL: PROD.PUBLIC_BASE_URL, MCP_PUBLIC_URL: 'https://ppm.project-suite.ch/mcp' };
    assert.deepEqual(errorsOf(mcp, 'mcp'), []);
    const worker = { NODE_ENV: 'production', OIDC_ISSUER_URL: PROD.OIDC_ISSUER_URL, PUBLIC_BASE_URL: PROD.PUBLIC_BASE_URL, DATABASE_WORKER_URL: 'postgres://ppm_worker:x@db/ppm', DATABASE_SSL: 'verify-full', ENCRYPTION_KEYS: PROD.ENCRYPTION_KEYS };
    assert.deepEqual(errorsOf(worker, 'worker'), []);
    const secrets = VARS.filter(v => v.secret);
    for (const v of secrets) assert.ok(v.services, `${v.name}: Geheimnis ohne Dienstzuordnung`);
    assert.deepEqual(VARS.filter(v => v.secret && v.services?.includes('mcp')).map(v => v.name).sort(), ['MCP_CLIENT_SECRET', 'MCP_DPOP_KEY', 'MCP_PRIVATE_KEY']);
  });

  test('<NAME>_FILE für Geheimnisse', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ppm-cfg-'));
    writeFileSync(join(dir, 'db'), 'postgres://ppm_runtime:aus-datei@localhost/ppm\n');
    const c = loadPlatformConfig({ ...BASE, DATABASE_URL: '', DATABASE_URL_FILE: join(dir, 'db') }, 'api');
    assert.equal(c.iam.db.url, 'postgres://ppm_runtime:aus-datei@localhost/ppm');
    assert.ok(errorsOf({ ...BASE, DATABASE_URL: '', DATABASE_URL_FILE: join(dir, 'fehlt') }).some(x => x.includes('nicht lesbar')));
  });

  test('Einstiegspunkte enden ohne Konfiguration mit Exit 78 und nennen alle Fehler', () => {
    for (const s of ['api', 'worker', 'mcp']) {
      const r = spawnSync(process.execPath, [join(root, 'src/platform/main', `${s}.ts`)], { env: { PATH: process.env.PATH ?? '' }, encoding: 'utf8', timeout: 20_000 });
      assert.equal(r.status, EXIT_CONFIG, `${s}: ${r.stderr}`);
      assert.match(r.stderr, /OIDC_ISSUER_URL fehlt/);
    }
  });

  test('.env.example und docs/konfiguration.md sind aktuell', () => {
    const r = spawnSync(process.execPath, [join(root, 'scripts/env-docs.ts'), '--check'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  });
});
