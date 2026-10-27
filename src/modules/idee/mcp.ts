/**
 * Werkzeuge des MCP-Dienstes für Ideen: nur lesend und nur über die REST-API (keine zweite Fachlogik, keine Datenbank).
 * Name, Titel, Recht und `readOnly` stehen im Modell (`mcpTools`); hier Beschreibung, Eingaben und Aufruf.
 */
import { organisationArg, type ToolDef } from '@vollholz/platform';
import { z } from 'zod';
import { STAENDE } from './schemas.ts';

export const ideeTools: Record<string, ToolDef> = {
  list_ideen: {
    description: 'Projektideen auflisten (Nummer, Titel, Stand, eingereicht am, offene Rückfragen), neueste zuerst, mit Filter nach Stand, nur eigene, Seiten.',
    input: {
      stand: z.array(z.enum(STAENDE)).max(STAENDE.length).optional().describe('Nur diese Stände'),
      eigene: z.boolean().optional().describe('Nur selbst erfasste Ideen'),
      cursor: z.string().max(512).optional().describe('nextCursor der vorherigen Seite'),
      limit: z.number().int().min(1).max(200).optional(),
      organisation: organisationArg,
    },
    call: async (org, a) => (await org.api.call('GET', '/v1/ideen', { query: { stand: a.stand, eigene: a.eigene, cursor: a.cursor, limit: a.limit } })).body,
  },
  get_idee: {
    description: 'Eine Projektidee lesen: Ausgangslage, Zielsetzung, Strategiebezug, betroffene Bereiche, erste Einschätzung, Herkunft, Stand und Rückfragen.',
    input: {
      id: z.string().uuid().describe('ID der Idee (list_ideen)'),
      organisation: organisationArg,
    },
    call: async (org, a) => (await org.api.call('GET', `/v1/ideen/${a.id}`)).body,
  },
};
