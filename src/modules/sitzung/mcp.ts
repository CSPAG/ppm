/**
 * Werkzeuge des MCP-Dienstes für Sitzungen: nur lesend über die REST-API (fachmodell.md 3.3). Name, Titel, Recht und
 * `readOnly` stehen im Modell (`mcpTools`); hier Beschreibung, Eingaben und Aufruf.
 */
import { organisationArg, type ToolDef } from '@vollholz/platform';
import { z } from 'zod';

const Datum = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const sitzungTools: Record<string, ToolDef> = {
  list_sitzungen: {
    description: 'Sitzungstermine und Sitzungen eines Gremiums (z. B. prat) mit Stand und Zahl der Traktanden, aufsteigend ab heute bzw. ab `von`.',
    input: {
      gremium: z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/).describe('Kürzel des Gremiums, z. B. prat'),
      von: Datum.optional(), bis: Datum.optional(),
      cursor: z.string().max(512).optional().describe('nextCursor der vorherigen Seite'),
      limit: z.number().int().min(1).max(200).optional(),
      organisation: organisationArg,
    },
    call: async (org, a) => (await org.api.call('GET', `/v1/gremien/${encodeURIComponent(a.gremium)}/sitzungen`, { query: { von: a.von, bis: a.bis, cursor: a.cursor, limit: a.limit } })).body,
  },
  get_sitzung: {
    description: 'Eine Sitzung mit Traktandenliste: Zeitbedarf, Antrag, «via SNS-VR», Stand der Unterlagen, Eingeladene und Versandfrist.',
    input: { id: z.string().uuid().describe('ID der Sitzung'), organisation: organisationArg },
    call: async (org, a) => (await org.api.call('GET', `/v1/sitzungen/${encodeURIComponent(a.id)}`)).body,
  },
};
