/**
 * Werkzeug des MCP-Dienstes für das Phasenmodell: nur über die REST-API. Name, Titel, Recht und `readOnly` stehen im
 * Modell (`mcpTools`); hier Beschreibung, Eingaben und Aufruf.
 */
import { organisationArg, type ToolDef } from '@vollholz/platform';
import { z } from 'zod';

export const phasenmodellTools: Record<string, ToolDef> = {
  get_phasenmodell: {
    description: 'Phasenmodell lesen: Phasen, Gates mit Leitfragen je Wertestrom, Standard-Lieferergebnisse und -Meilensteine, Pflichtangaben, Fristen und Toleranzen. Ohne ID die Version in Kraft.',
    input: { id: z.string().uuid().optional().describe('ID einer Version; ohne: Version in Kraft'), organisation: organisationArg },
    call: async (org, a) => (await org.api.call('GET', a.id ? `/v1/phasenmodelle/${encodeURIComponent(a.id)}` : '/v1/phasenmodelle/aktuell')).body,
  },
};
