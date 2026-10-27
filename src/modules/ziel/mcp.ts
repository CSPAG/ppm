/**
 * Werkzeuge des MCP-Dienstes für Ziele: nur lesend und nur über die REST-API (keine zweite Fachlogik, keine Datenbank).
 * Name, Titel, Recht und `readOnly` stehen im Modell (`mcpTools`); hier Beschreibung, Eingaben und Aufruf.
 */
import { organisationArg, type ToolDef } from '@vollholz/platform';
import { z } from 'zod';

export const zielTools: Record<string, ToolDef> = {
  list_ziele: {
    description: 'Strategische Ziele der Organisation auflisten (Handlungsfeld, Nummer, Text, Horizont, Metrik, Zielwert), sortiert nach Nummer, mit Filter nach Handlungsfeld, Suche und Seiten.',
    input: {
      handlungsfeld: z.string().uuid().optional().describe('ID des Handlungsfelds (list_handlungsfelder)'),
      q: z.string().max(200).optional().describe('Suche in Nummer und Text'),
      cursor: z.string().max(512).optional().describe('nextCursor der vorherigen Seite'),
      limit: z.number().int().min(1).max(200).optional(),
      organisation: organisationArg,
    },
    call: async (org, a) => (await org.api.call('GET', '/v1/strategische-ziele', { query: { handlungsfeld: a.handlungsfeld, q: a.q, cursor: a.cursor, limit: a.limit } })).body,
  },
};
