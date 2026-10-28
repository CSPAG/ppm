/**
 * Werkzeug des MCP-Dienstes für die Portfolio-Matrix: nur lesend und nur über die REST-API (keine zweite Fachlogik).
 * Name, Titel, Recht und `readOnly` stehen im Modell (`mcpTools`); hier Beschreibung, Eingaben und Aufruf.
 */
import { organisationArg, type ToolDef } from '@vollholz/platform';
import { z } from 'zod';

export const matrixTools: Record<string, ToolDef> = {
  get_matrix: {
    description: 'Portfolio-Matrix (BC PP.03.04): aktive Projekte eines Portfolios mit Nutzen und Risiko aus der Bewertung je Kriterium (Durchschnitt der zugeordneten Kriterien, ohne Score), Feld (priorisieren, rasch umsetzen, opportunistisch umsetzen, hinterfragen), Ressourcenbedarf, Rang und Abhängigkeiten.',
    input: {
      portfolio: z.string().uuid().describe('ID des Portfolios (list_portfolios)'),
      organisation: organisationArg,
    },
    call: async (org, a) => (await org.api.call('GET', `/v1/portfolios/${encodeURIComponent(a.portfolio as string)}/matrix`)).body,
  },
};
