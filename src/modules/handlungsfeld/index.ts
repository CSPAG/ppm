/** Modul Handlungsfelder (BC ZM.01.01, Beispielmodul des Gerüsts): öffentliche Schnittstelle. */
import { defineModule } from '@vollholz/platform';
import { handlungsfeldTools } from './mcp.ts';
import { registerRoutes } from './routes.ts';

export const handlungsfeldModule = defineModule({
  name: 'handlungsfeld',
  tags: [{ name: 'Handlungsfelder', description: 'Strategische Handlungsfelder mit Leitsatz und Stossrichtungen – oberste Ordnung für Ziele und Vorhaben.' }],
  register: registerRoutes,
  mcpTools: handlungsfeldTools,
});
