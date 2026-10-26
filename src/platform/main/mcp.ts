/**
 * Prozess `mcp` (Profil mcp): MCP-Dienst auf MCP_PORT, Client der REST-API (MCP_API_URL). Ohne Datenbank. Dazu der
 * Betriebs-Endpunkt. Ungültige Konfiguration: Exit 78.
 */
import { loadOrExit } from '../config/env.ts';
import { apiReachable, createMcpApp } from '../mcp/server.ts';
import { Runtime } from '../ops/runtime.ts';
import { startOpsServer } from '../ops/server.ts';

const cfg = loadOrExit(process.env, 'mcp');
const app = await createMcpApp(cfg);
const runtime = new Runtime({ shutdownDelayMs: cfg.ops.shutdownDelayMs, shutdownTimeoutMs: cfg.ops.shutdownTimeoutMs, log: app.log }).install();
const ops = await startOpsServer({
  host: cfg.ops.host, port: cfg.ops.port, metrics: cfg.ops.metrics, ready: () => runtime.ready,
  checks: [{ name: 'api', failure: 'REST-API nicht erreichbar', run: () => apiReachable(cfg) }],
});
runtime.onShutdown('http', () => app.close()).onShutdown('ops', () => new Promise(r => ops.close(() => r(undefined))));
await app.listen({ host: cfg.mcp.host, port: cfg.mcp.port });
app.log.info({ port: cfg.mcp.port, ops: cfg.ops.port }, 'MCP-Dienst bereit');
