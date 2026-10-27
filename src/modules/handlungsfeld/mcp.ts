/**
 * Werkzeuge des MCP-Dienstes für Handlungsfelder: nur über die REST-API (keine zweite Fachlogik, keine Datenbank). Name,
 * Titel, Recht und `readOnly` stehen im Modell (`mcpTools`); hier Beschreibung, Eingaben und Aufruf.
 */
import { organisationArg, type ToolDef } from '@vollholz/platform';
import { z } from 'zod';

export const handlungsfeldTools: Record<string, ToolDef> = {
  list_handlungsfelder: {
    description: 'Strategische Handlungsfelder der Organisation auflisten (Name, Leitsatz, Stossrichtungen), in ihrer Reihenfolge, mit Suche und Seiten.',
    input: {
      q: z.string().max(200).optional().describe('Suche im Namen'),
      cursor: z.string().max(512).optional().describe('nextCursor der vorherigen Seite'),
      limit: z.number().int().min(1).max(200).optional(),
      organisation: organisationArg,
    },
    call: async (org, a) => (await org.api.call('GET', '/v1/handlungsfelder', { query: { q: a.q, cursor: a.cursor, limit: a.limit } })).body,
  },
  get_handlungsfeld: {
    description: 'Ein Handlungsfeld mit allen Feldern lesen.',
    input: { id: z.string().uuid().describe('ID des Handlungsfelds'), organisation: organisationArg },
    call: async (org, a) => (await org.api.call('GET', `/v1/handlungsfelder/${encodeURIComponent(a.id)}`)).body,
  },
};
