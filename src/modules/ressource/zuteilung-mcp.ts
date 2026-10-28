/**
 * Werkzeug des MCP-Dienstes für die Bedarfsliste (AP-E7-2): nur lesend über die REST-API (keine zweite Fachlogik, keine
 * Datenbank). Name, Titel, Recht und `readOnly` stehen im Modell (`mcpTools`); hier Beschreibung, Eingaben und Aufruf.
 */
import { organisationArg, type ToolDef } from '@vollholz/platform';
import { z } from 'zod';

const monat = z.string().regex(/^[0-9]{4}-(0[1-9]|1[0-2])$/);

export const zuteilungTools: Record<string, ToolDef> = {
  list_bedarfe: {
    description: 'Ressourcenbedarf der Projekte in FTE × Monate mit Deckung durch Zuteilungen, Stand (offen, teilweise, gedeckt, ungedeckt) und Priorität (BC RK.02.02, UC-009), nach Priorität und Beginn.',
    input: {
      stand: z.array(z.enum(['offen', 'teilweise', 'gedeckt', 'ungedeckt'])).optional().describe('Nur diese Stände'),
      rolle: z.string().max(40).optional().describe('Rolle (Pool), Schlüssel der Codetabelle ressourcenrolle'),
      von: monat.optional().describe('Bedarfe, die den Zeitraum ab diesem Monat berühren'),
      bis: monat.optional().describe('… bis zu diesem Monat'),
      cursor: z.string().max(512).optional().describe('nextCursor der vorherigen Seite'),
      limit: z.number().int().min(1).max(200).optional(),
      organisation: organisationArg,
    },
    call: async (org, a) => (await org.api.call('GET', '/v1/bedarfe', { query: { stand: a.stand, rolle: a.rolle, von: a.von, bis: a.bis, cursor: a.cursor, limit: a.limit } })).body,
  },
};
