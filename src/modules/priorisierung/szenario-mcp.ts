/**
 * Werkzeug des MCP-Dienstes für den Szenariovergleich: nur lesend und nur über die REST-API (keine zweite Fachlogik).
 * Name, Titel, Recht und `readOnly` stehen im Modell (`mcpTools`); hier Beschreibung, Eingaben und Aufruf.
 */
import { organisationArg, type ToolDef } from '@vollholz/platform';
import { z } from 'zod';

export const szenarioTools: Record<string, ToolDef> = {
  compare_szenarien: {
    description: 'Szenarien eines Portfolios vergleichen (BC PP.03.03, UC-008 Schritt 6): je Szenario Kosten, Nutzen, Risiko und Strategiebeitrag der Projekte über der Wasserlinie, Projekte darunter, Grund der Wasserlinie (Budget oder Kapazität) und Engpässe je Quartal und Rolle.',
    input: {
      szenarien: z.array(z.string().uuid()).min(1).max(3).describe('IDs von ein bis drei Szenarien desselben Portfolios'),
      organisation: organisationArg,
    },
    call: async (org, a) => (await org.api.call('GET', `/v1/szenarien/vergleich?ids=${encodeURIComponent((a.szenarien as string[]).join(','))}`)).body,
  },
};
