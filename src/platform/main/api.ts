/**
 * Prozess `api`: REST-API unter /v1 (OpenAPI unter /v1/docs), BFF unter /auth/*, Auslieferung der Webapp. Dazu der
 * Betriebs-Endpunkt auf OPS_PORT. Ungültige Konfiguration: Exit 78.
 */
import { readinessChecks } from '@vollholz/iam';
import { loadOrExit } from '../config/env.ts';
import { Runtime } from '../ops/runtime.ts';
import { startOpsServer } from '../ops/server.ts';
import { createApi } from './compose.ts';

const cfg = loadOrExit(process.env, 'api');
let runtime: Runtime | null = null;
const api = await createApi(cfg, { ready: () => runtime?.ready ?? false });
const log = api.app.log;
runtime = new Runtime({ shutdownDelayMs: cfg.ops.shutdownDelayMs, shutdownTimeoutMs: cfg.ops.shutdownTimeoutMs, log }).install();
const ops = await startOpsServer({ host: cfg.ops.host, port: cfg.ops.port, metrics: cfg.ops.metrics, ready: () => runtime!.ready, checks: readinessChecks(api.iam) });
runtime
  .onShutdown('http', () => api.app.close())
  .onShutdown('ops', () => new Promise(r => ops.close(() => r(undefined))))
  .onShutdown('db', () => api.db.end());
await api.app.listen({ host: cfg.http.host, port: cfg.http.port });
log.info({ port: cfg.http.port, ops: cfg.ops.port }, 'API bereit');
