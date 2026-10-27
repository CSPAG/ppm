/**
 * Werkzeuge des MCP-Dienstes für Statusberichte: nur lesend und nur über die REST-API (keine zweite Fachlogik, keine
 * Datenbank). Name, Titel, Recht und `readOnly` stehen im Modell (`mcpTools`); hier Beschreibung, Eingaben und Aufruf.
 */
import { organisationArg, type ToolDef } from '@vollholz/platform';
import { z } from 'zod';

export const statusberichtTools: Record<string, ToolDef> = {
  list_statusberichte: {
    description: 'Statusberichte eines Projekts auflisten (Periode, Bearbeitungsstand, Status, Trend, Phase), neueste Periode zuerst; mit Periode den ganzen Bericht der Periode lesen.',
    input: {
      projekt: z.string().uuid().describe('ID des Projekts'),
      periode: z.string().regex(/^[0-9]{4}-(0[1-9]|1[0-2])$/).optional().describe('Periode «YYYY-MM»: ganzer Bericht statt Liste'),
      organisation: organisationArg,
    },
    call: async (org, a) => (await org.api.call('GET', a.periode ? `/v1/projekte/${a.projekt}/berichte/${a.periode}` : `/v1/projekte/${a.projekt}/berichte`)).body,
  },
};
