/**
 * Werkzeug des MCP-Dienstes für Entscheide (fachmodell.md 5, nur lesend über die REST-API; AP-E2-2). Name, Titel, Recht
 * und `readOnly` stehen im Modell (`mcpTools`); hier Beschreibung, Eingaben und Aufruf.
 */
import { organisationArg, type ToolDef } from '@vollholz/platform';
import { z } from 'zod';

export const entscheidTools: Record<string, ToolDef> = {
  list_entscheide: {
    description: 'Entscheide der Gremien mit Ergebnis, Begründung und Auflagen, neueste Sitzung zuerst; Filter Projekt, Gremium (z. B. prat), Weiterleitung an den VR und offene Auflagen.',
    input: {
      projektId: z.string().uuid().optional().describe('ID des Projekts'),
      gremium: z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/).optional().describe('Kürzel des Gremiums, z. B. prat'),
      anVr: z.boolean().optional().describe('nur an den VR weitergeleitete (true) bzw. nicht weitergeleitete (false)'),
      auflagenOffen: z.boolean().optional().describe('nur Entscheide mit offenen Auflagen'),
      cursor: z.string().max(512).optional().describe('nextCursor der vorherigen Seite'),
      limit: z.number().int().min(1).max(200).optional(),
      organisation: organisationArg,
    },
    call: async (org, a) => (await org.api.call('GET', '/v1/entscheide', {
      query: { projektId: a.projektId, gremium: a.gremium, anVr: a.anVr, auflagen: a.auflagenOffen ? 'offen' : undefined, cursor: a.cursor, limit: a.limit },
    })).body,
  },
};
