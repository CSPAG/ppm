/**
 * Werkzeuge des MCP-Dienstes für Ressourcen: nur lesend und nur über die REST-API (keine zweite Fachlogik, keine
 * Datenbank). Name, Titel, Recht und `readOnly` stehen im Modell (`mcpTools`); hier Beschreibung, Eingaben und Aufruf.
 */
import { organisationArg, type ToolDef } from '@vollholz/platform';
import { z } from 'zod';

const monat = z.string().regex(/^[0-9]{4}-(0[1-9]|1[0-2])$/);

export const ressourceTools: Record<string, ToolDef> = {
  get_auslastung: {
    description: 'Auslastung je Rolle (Pool) und Monat: Kapazitätsangebot gegen den Ressourcenbedarf der Projekte in FTE, mit Engpässen je Quartal und den Beiträgen je Projekt (BC RK.02.04). Ohne Zeitraum der laufende Monat und die elf folgenden.',
    input: {
      von: monat.optional().describe('Erster Monat «JJJJ-MM»'),
      bis: monat.optional().describe('Letzter Monat «JJJJ-MM» (höchstens 60 Monate)'),
      szenario: z.string().uuid().optional().describe('ID eines Portfolioszenarios (Priorisierung)'),
      organisation: organisationArg,
    },
    call: async (org, a) => (await org.api.call('GET', '/v1/auslastung', { query: { von: a.von, bis: a.bis, szenario: a.szenario } })).body,
  },
};
