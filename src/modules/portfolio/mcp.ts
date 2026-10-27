/**
 * Werkzeuge des MCP-Dienstes für Portfolios (nur lesend, fachmodell.md 3.3): nur über die REST-API. Name, Titel, Recht und
 * `readOnly` stehen im Modell (`mcpTools`); hier Beschreibung, Eingaben und Aufruf.
 */
import { organisationArg, type ToolDef } from '@vollholz/platform';
import { z } from 'zod';

type Api = Parameters<ToolDef['call']>[0]['api'];

/** Alle Seiten einer Liste (dem Cursor folgen): das Werkzeug liefert die ganze Übersicht ohne eigenen Cursor. */
async function alle<T>(api: Api, path: string, query: Record<string, string | number | undefined> = {}): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  do {
    const page = (await api.call('GET', path, { query: { ...query, cursor, limit: 200 } })).body as { items: T[]; nextCursor: string | null };
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return items;
}

export const portfolioTools: Record<string, ToolDef> = {
  list_portfolios: {
    description: 'Portfolios der Organisation (Kategorie A, B, C mit Pflichten) mit ihren Gremien und dem Gremienweg je Gate (zuständiges Gremium, «via SNS-VR»).',
    input: { organisation: organisationArg },
    call: async org => {
      const [portfolios, gremien] = await Promise.all([
        alle<{ id: string }>(org.api, '/v1/portfolios'),
        alle<{ portfolioId: string }>(org.api, '/v1/gremien'),
      ]);
      const items = [];
      for (const p of portfolios) {
        const weg = (await org.api.call('GET', `/v1/portfolios/${encodeURIComponent(p.id)}/gremienweg`)).body as { schritte: unknown[] };
        items.push({ ...p, gremien: gremien.filter(g => g.portfolioId === p.id), gremienweg: weg.schritte });
      }
      return { items };
    },
  },
};
