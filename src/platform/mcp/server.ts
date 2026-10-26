/**
 * MCP-Dienst (Profil mcp, Netz-Adapter): Streamable HTTP unter `/mcp`, zustandslos (nur POST), Protected Resource
 * Metadata (RFC 9728), Token-Prüfung mit Zielgruppe `ppm-mcp`, Token Exchange zu `ppm-api` mit DPoP-gebundenem Token
 * (alles `McpAuth` aus `@vollholz/iam`). Werkzeuge aus tools.ts; jeder Aufruf geht über die REST-API und wird
 * protokolliert. Kein Datenbank-Pool, Replay-Schutz im Speicher.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import Fastify, { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DpopSigner, McpAuth, OidcProvider, registerMcpAuth, TokenExchanger, TokenVerifier, MemoryReplayStore, type McpOrg } from '@vollholz/iam';
import { model } from '../authz/model.ts';
import type { PlatformConfig } from '../config/env.ts';
import { REDACT_PATHS } from '../core/redact.ts';
import { availableTools, missingTools } from './tools.ts';

export interface McpOptions { fetch?: typeof fetch; logger?: boolean }

function buildServer(orgs: McpOrg[], log: FastifyInstance['log'], subject: string): McpServer {
  const server = new McpServer({ name: 'ppm', version: '1.0.0' }, { capabilities: { tools: { listChanged: false } } });
  const tools = availableTools(orgs);
  const aliases = orgs.map(o => o.me.tenant.alias);
  for (const t of tools) {
    const multi = t.orgs.length > 1;
    const input = multi ? { ...t.impl.input, organisation: z.enum(t.orgs.map(o => o.me.tenant.alias) as [string, ...string[]]).describe('Alias der Organisation') } : t.impl.input;
    server.registerTool(t.name, { title: t.def.title, description: t.impl.description, inputSchema: input, annotations: { readOnlyHint: t.def.readOnly } }, async (args: Record<string, unknown>) => {
      const org = multi ? t.orgs.find(o => o.me.tenant.alias === args.organisation) : t.orgs[0];
      log.info({ audit: 'mcp.tool', tool: t.name, org: org?.me.tenant.alias ?? null, subject, orgs: aliases }, 'MCP-Werkzeug');
      if (!org) return { content: [{ type: 'text' as const, text: 'Organisation fehlt oder ist nicht erlaubt.' }], isError: true };
      return t.impl.run(org, args);
    });
  }
  // Ohne Werkzeug trotzdem tools/list beantworten (sonst «Method not found»)
  if (!tools.length) server.server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [] }));
  return server;
}

export async function createMcpApp(cfg: PlatformConfig, o: McpOptions = {}): Promise<FastifyInstance> {
  const missing = missingTools();
  if (missing.length) throw new Error(`MCP-Werkzeuge ohne Umsetzung: ${missing.join(', ')}`);
  const provider = new OidcProvider(cfg.iam.oidc.issuer, o.fetch);
  const verifier = new TokenVerifier(provider, cfg.iam, new MemoryReplayStore());
  const exchanger = new TokenExchanger(cfg.iam, provider, { dpop: await DpopSigner.create(cfg.iam.mcp.dpopKey ?? undefined), model, fetch: o.fetch });
  const auth = new McpAuth({ cfg: cfg.iam, model, verifier, exchanger, fetch: o.fetch });
  const app = Fastify({
    logger: o.logger === false ? false : { level: cfg.log.level, redact: { paths: REDACT_PATHS, censor: '[entfernt]' } },
    trustProxy: cfg.http.trustProxy as boolean, bodyLimit: cfg.http.bodyLimit,
  });
  registerMcpAuth(app, auth);
  app.get('/healthz', async () => ({ status: 'ok' }));
  app.route({
    method: ['GET', 'POST', 'DELETE'], url: '/mcp',
    handler: async (req, reply) => {
      const { orgs, token } = await auth.authorize({ method: req.method, url: req.url, headers: req.headers, id: req.id });
      const server = buildServer(orgs, req.log, String(token.claims.sub ?? ''));
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      reply.hijack();
      reply.raw.on('close', () => { void transport.close(); void server.close(); });
      await server.connect(transport);
      await transport.handleRequest(req.raw, reply.raw, req.body);
    },
  });
  return app;
}

/** Bereitschaft: REST-API erreichbar (`MCP_API_URL`/healthz). */
export async function apiReachable(cfg: PlatformConfig, f: typeof fetch = fetch): Promise<void> {
  const r = await f(`${cfg.iam.mcp.apiUrl}/healthz`, { signal: AbortSignal.timeout(2000) });
  if (!r.ok) throw new Error(`REST-API: ${r.status}`);
}
