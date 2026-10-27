/**
 * Werkzeug des MCP-Dienstes für den Monatsabschluss (AP-E1-2): nur lesend und nur über die REST-API. Name, Titel, Recht
 * und `readOnly` stehen im Modell (`mcpTools`); hier Beschreibung, Eingaben und Aufruf.
 */
import { organisationArg, type ToolDef } from '@vollholz/platform';
import { z } from 'zod';

export const pruefungTools: Record<string, ToolDef> = {
  get_periode: {
    description: 'Monatsabschluss einer Periode lesen: Stand je Projekt (eingereicht, zurückgegeben, geprüft, ausstehend, nicht gemeldet), Status und Trend mit Vorperiode, Auffälligkeiten (Status geändert, Termin verschoben, Prognose über Budget) und Kopf mit Anzahlen und Fristen; optional die Terminabweichungen.',
    input: {
      periode: z.string().regex(/^[0-9]{4}-(0[1-9]|1[0-2])$/).describe('Periode «YYYY-MM»'),
      terminabweichungen: z.boolean().optional().describe('Statt der Berichte die Terminabweichungen (Baseline und aufdatiert je Phase)'),
      organisation: organisationArg,
    },
    call: async (org, a) => (await org.api.call('GET', `/v1/perioden/${a.periode}${a.terminabweichungen ? '/terminabweichungen' : ''}`)).body,
  },
};
