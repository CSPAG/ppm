/**
 * Werkzeuge des MCP-Dienstes für Portfolios (nur lesend, fachmodell.md 3.3): nur über die REST-API. Name, Titel, Recht und
 * `readOnly` stehen im Modell (`mcpTools`); hier Beschreibung, Eingaben und Aufruf.
 */
import { organisationArg, type ToolDef } from '@vollholz/platform';
import { z } from 'zod';

export const portfolioTools: Record<string, ToolDef> = {
  list_portfolios: {
    description: 'Portfolios der Organisation (Kategorie A, B, C mit Pflichten) mit ihren Gremien und dem Gremienweg je Gate (zuständiges Gremium, «via SNS-VR»).',
    input: { organisation: organisationArg },
    call: async org => {
      const portfolios = (await org.api.call('GET', '/v1/portfolios', { query: { limit: 200 } })).body as { items: { id: string }[] };
      const items = [];
      for (const p of portfolios.items) {
        const id = encodeURIComponent(p.id);
        const gremien = (await org.api.call('GET', '/v1/gremien', { query: { portfolio: p.id, limit: 200 } })).body as { items: unknown[] };
        const weg = (await org.api.call('GET', `/v1/portfolios/${id}/gremienweg`)).body as { schritte: unknown[] };
        items.push({ ...p, gremien: gremien.items, gremienweg: weg.schritte });
      }
      return { items };
    },
  },
};
