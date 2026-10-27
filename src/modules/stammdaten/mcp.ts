/**
 * Werkzeuge des MCP-Dienstes für Stammdaten: nur lesend über die REST-API (docs/fachmodell.md 3.3, mcpTools). Name,
 * Titel, Recht und `readOnly` stehen im Modell (`mcpTools`); hier Beschreibung, Eingaben und Aufruf.
 */
import { organisationArg, type ToolDef } from '@vollholz/platform';
import { z } from 'zod';

export const stammdatenTools: Record<string, ToolDef> = {
  list_org_einheiten: {
    description: 'Organisationseinheiten der Organisation auflisten (Kürzel, Name, Art Direktion/Bereich, übergeordnete Einheit, aktiv), nach Kürzel, mit Suche und Seiten.',
    input: {
      q: z.string().max(200).optional().describe('Suche in Kürzel und Name'),
      art: z.enum(['direktion', 'bereich']).optional().describe('Nur Direktionen bzw. Bereiche'),
      cursor: z.string().max(512).optional().describe('nextCursor der vorherigen Seite'),
      limit: z.number().int().min(1).max(200).optional(),
      organisation: organisationArg,
    },
    call: async (org, a) => (await org.api.call('GET', '/v1/org-einheiten', { query: { q: a.q, art: a.art, cursor: a.cursor, limit: a.limit } })).body,
  },
};
