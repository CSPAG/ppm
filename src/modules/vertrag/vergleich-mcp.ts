/**
 * Werkzeug des MCP-Dienstes für den Versionsvergleich (AP-E3-4, PS.03.04): nur lesend über die REST-API. Name, Titel,
 * Recht und `readOnly` stehen im Modell (`mcpTools`); hier Beschreibung, Eingaben und Aufruf.
 */
import { organisationArg, type ToolDef } from '@vollholz/platform';
import { z } from 'zod';

export const vergleichTools: Record<string, ToolDef> = {
  compare_vertrag: {
    description: 'Zwei Versionen eines Projektvertrags vergleichen: Unterschiede je Kapitel (neu, entfernt, geändert, Zahlen mit Differenz) '
      + 'und die Hauptänderungen in den Rubriken Scope, Zeitplan, Ressourcen/Budget, Annahmen, Key-Risiken. Ohne Angabe der Entwurf gegen die Baseline. '
      + 'Beträge nur mit Recht auf Beträge.',
    input: {
      id: z.string().uuid().describe('ID des Projekts (list_projekte)'),
      version: z.string().uuid().optional().describe('ID der Version (Standard: Entwurf, sonst Baseline)'),
      mit: z.string().uuid().optional().describe('ID der Version zum Vergleich (Standard: Basisversion)'),
      organisation: organisationArg,
    },
    call: async (org, a) => {
      const vertrag = await org.api.get<{ entwurf: string | null; baseline: string | null }>(`/v1/projekte/${encodeURIComponent(a.id)}/vertrag`);
      const versionId = (a.version as string | undefined) ?? vertrag.entwurf ?? vertrag.baseline;
      if (!versionId) return { vergleich: null, hauptaenderungen: null, hinweis: 'Das Projekt hat noch keinen Projektvertrag.' };
      const v = encodeURIComponent(versionId);
      const mit = a.mit ? `?mit=${encodeURIComponent(a.mit as string)}` : '';
      return {
        vergleich: await org.api.get(`/v1/vertragsversionen/${v}/vergleich${mit}`),
        hauptaenderungen: await org.api.get(`/v1/vertragsversionen/${v}/hauptaenderungen`),
      };
    },
  },
};
