/**
 * Werkzeug des MCP-Dienstes für den Projektvertrag: nur lesend über die REST-API (keine zweite Fachlogik, keine
 * Datenbank). Name, Titel, Recht und `readOnly` stehen im Modell (`mcpTools`); hier Beschreibung, Eingaben und Aufruf.
 */
import { organisationArg, type ToolDef } from '@vollholz/platform';
import { z } from 'zod';

export const vertragTools: Record<string, ToolDef> = {
  get_vertrag: {
    description: 'Projektvertrag eines Projekts lesen: alle Versionen mit Stand und Baseline, dazu die Kapitel 1–13 einer Version '
      + '(Entwurf, Baseline oder ID) mit den fehlenden Pflichtangaben. Beträge nur mit Recht auf Beträge, sonst null.',
    input: {
      id: z.string().uuid().describe('ID des Projekts (list_projekte)'),
      version: z.string().max(40).optional().describe('«entwurf», «baseline» (Standard: Entwurf, sonst Baseline) oder ID einer Version'),
      organisation: organisationArg,
    },
    call: async (org, a) => {
      const vertrag = await org.api.get<{ versionen: { id: string }[]; entwurf: string | null; baseline: string | null }>(`/v1/projekte/${encodeURIComponent(a.id)}/vertrag`);
      const wahl = (a.version as string | undefined) ?? (vertrag.entwurf ? 'entwurf' : 'baseline');
      const versionId = wahl === 'entwurf' ? vertrag.entwurf : wahl === 'baseline' ? vertrag.baseline : wahl;
      if (!versionId) return { ...vertrag, kapitel: [], pflichtangaben: null };
      const v = encodeURIComponent(versionId);
      const kapitel = [];
      for (let nr = 1; nr <= 13; nr++) kapitel.push(await org.api.get(`/v1/vertragsversionen/${v}/kapitel/${nr}`));
      return { ...vertrag, kapitel, pflichtangaben: await org.api.get(`/v1/vertragsversionen/${v}/pflichtangaben`) };
    },
  },
};
