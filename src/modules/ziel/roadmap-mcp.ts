/** Werkzeug des MCP-Dienstes für die Roadmap (PP.04.03): nur lesend, über die REST-API. */
import { organisationArg, type ToolDef } from '@vollholz/platform';
import { z } from 'zod';

export const roadmapTools: Record<string, ToolDef> = {
  get_roadmap: {
    description: 'Publizierte Portfolio-Roadmap eines Jahres lesen: Handlungsfelder, strategische Ziele, Jahresziele mit Metrik und Zielwert, Hauptaktivitäten und beitragende Projekte. Ohne Jahr: Liste der publizierten Jahre.',
    input: {
      jahr: z.number().int().min(2000).max(2100).optional().describe('Jahr der Roadmap, z. B. 2027'),
      organisation: organisationArg,
    },
    call: async (org, a) => (await org.api.call('GET', a.jahr ? `/v1/roadmap/${a.jahr}` : '/v1/roadmap', {})).body,
  },
};
