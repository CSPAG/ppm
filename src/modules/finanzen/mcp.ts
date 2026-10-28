/**
 * Werkzeug des MCP-Dienstes für die Finanzen: nur lesend und nur über die REST-API (keine zweite Fachlogik). Name,
 * Titel, Recht (`finanzen:read`, nicht im Scope `ppm:read`) und `readOnly` stehen im Modell (`mcpTools`).
 */
import { organisationArg, type ToolDef } from '@vollholz/platform';
import { z } from 'zod';

export const finanzenTools: Record<string, ToolDef> = {
  get_finanzen: {
    description: 'Finanzübersicht (BC PC.01.02, PC.01.04; UC-010): je aktivem Projekt Budget, Prognose (je Phase, CAPEX/OPEX), Ist-Kosten aus dem ERP, Abweichung mit Toleranz «wesentlich» und letzte Begründung; Summe. Ohne Portfolio alle Projekte mit sichtbaren Beträgen.',
    input: {
      portfolio: z.string().uuid().optional().describe('ID des Portfolios (list_portfolios); ohne: alle'),
      organisation: organisationArg,
    },
    call: async (org, a) => (await org.api.call('GET', `/v1/finanzen${a.portfolio ? `?portfolio=${encodeURIComponent(a.portfolio as string)}` : ''}`)).body,
  },
};
