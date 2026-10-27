/**
 * Werkzeug des MCP-Dienstes für das Dashboard: nur lesend und nur über die REST-API. Name, Titel, Recht und `readOnly`
 * stehen im Modell (`mcpTools`); hier Beschreibung, Eingaben und Aufruf.
 */
import { organisationArg, type ToolDef } from '@vollholz/platform';
import { z } from 'zod';

export const auswertungTools: Record<string, ToolDef> = {
  get_dashboard: {
    description: 'Dashboard der Periode lesen: je Projekt Status, Vorperiode, Trend, Phase, nächster Meilenstein, Projektleitung, Meldung (gemeldet, ausstehend, nicht gemeldet) und Eskalation, dazu der Funnel nach Phase.',
    input: {
      portfolio: z.string().regex(/^[a-z0-9_-]{1,40}$/).optional().describe('Schlüssel des Portfolios, z. B. «transformation»'),
      periode: z.string().regex(/^[0-9]{4}-(0[1-9]|1[0-2])$/).optional().describe('Periode «YYYY-MM»; ohne Angabe die letzte abgeschlossene'),
      organisation: organisationArg,
    },
    call: async (org, a) => {
      const q = new URLSearchParams();
      if (a.portfolio) q.set('portfolio', String(a.portfolio));
      if (a.periode) q.set('periode', String(a.periode));
      return (await org.api.call('GET', `/v1/dashboard${q.size ? `?${q}` : ''}`)).body;
    },
  },
};
