/**
 * Werkzeuge des MCP-Dienstes aus dem Modell (`model.mcpTools`): Jedes ruft nur die REST-API auf. Angeboten wird ein
 * Werkzeug nur, wenn sein Recht in mindestens einer Organisation der Anfrage gilt; bei mehreren Organisationen trägt
 * jedes Werkzeug den Parameter `organisation`.
 */
import { z } from 'zod';
import type { McpOrg } from '@vollholz/iam';
import { model } from '../authz/model.ts';
import { getJson } from './api.ts';

export interface ToolResult { [k: string]: unknown; content: { type: 'text'; text: string }[]; isError?: boolean; structuredContent?: Record<string, unknown> }

export interface ToolImpl {
  description: string;
  input: Record<string, z.ZodType>;
  run(org: McpOrg, args: Record<string, unknown>): Promise<ToolResult>;
}

const text = (v: unknown): ToolResult => ({ content: [{ type: 'text', text: JSON.stringify(v, null, 2) }], structuredContent: v as Record<string, unknown> });
const fail = (m: string): ToolResult => ({ content: [{ type: 'text', text: m }], isError: true });

/** Umsetzung je Werkzeug des Modells. Ein Werkzeug im Modell ohne Umsetzung bricht den Start ab (Test mcp.test.ts). */
export const TOOLS: Record<string, ToolImpl> = {
  list_projekte: {
    description: 'Listet Projekte der Organisation, die du lesen darfst (Suche in der Bezeichnung, Cursor für weitere Seiten).',
    input: { q: z.string().max(200).optional(), limit: z.number().int().min(1).max(100).optional(), cursor: z.string().max(1000).optional() },
    async run(org, a) {
      const r = await getJson<{ items: unknown[]; next: string | null }>(org.api, '/v1/projekte', { q: a.q as string | undefined, limit: a.limit as number | undefined, cursor: a.cursor as string | undefined });
      return r.ok ? text(r.body) : fail(r.error);
    },
  },
  get_projekt: {
    description: 'Liest ein Projekt mit Bezeichnung, Beschreibung, Zeitraum und Klassifizierung.',
    input: { id: z.string().uuid() },
    async run(org, a) {
      const r = await getJson<Record<string, unknown>>(org.api, `/v1/projekte/${encodeURIComponent(String(a.id))}`);
      return r.ok ? text(r.body) : fail(r.error);
    },
  },
};

export function missingTools(): string[] {
  return Object.keys(model.mcpTools).filter(n => !TOOLS[n]);
}

/** Werkzeuge, die in mindestens einer Organisation erlaubt sind. */
export function availableTools(orgs: McpOrg[]) {
  return Object.entries(model.mcpTools).flatMap(([name, def]) => {
    const allowed = orgs.filter(o => o.me.permissions.includes(def.permission));
    const impl = TOOLS[name];
    return allowed.length && impl ? [{ name, def, impl, orgs: allowed }] : [];
  });
}
