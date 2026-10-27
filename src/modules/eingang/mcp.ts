/**
 * Werkzeuge des MCP-Dienstes für den Eingang: nur über die REST-API (keine zweite Fachlogik). Name, Titel, Recht und
 * `readOnly` stehen im Modell (`mcpTools`); hier Beschreibung, Eingaben und Aufruf.
 */
import { organisationArg, type ToolDef } from '@vollholz/platform';
import { z } from 'zod';

export const eingangTools: Record<string, ToolDef> = {
  list_aufgaben: {
    description: 'Offene Aufgaben der angemeldeten Person («Zu tun») aus allen Rollen auflisten, nach Frist, mit Link zur Aktion; auch Aufgaben von Personen, die sie heute vertritt.',
    input: {
      filter: z.enum(['frist']).optional().describe('frist: nur Aufgaben mit Frist'),
      cursor: z.string().max(512).optional().describe('nextCursor der vorherigen Seite'),
      limit: z.number().int().min(1).max(200).optional(),
      organisation: organisationArg,
    },
    call: async (org, a) => (await org.api.call('GET', '/v1/eingang', { query: { filter: a.filter, cursor: a.cursor, limit: a.limit } })).body,
  },
};
