/**
 * Modul Sitzungen (BC PP.04.01, PP.04.02, PP.04.05, PS.02.02, PS.02.03; UC-006; Kernablauf K3): öffentliche
 * Schnittstelle. Obere Module registrieren ihre Traktandenart (`registriereTraktandenart`, fachmodell.md 2.9) und
 * schlagen Geschäfte über `traktandum.vorschlagen` vor, in ihrer Transaktion (README.md).
 *
 * Erweiterung durch AP-E2-2 (fachmodell.md 7.2): je Routendatei eine Zeile in `ROUTEN`, je Werkzeugdatei eine in
 * `mcpTools`; `routes.ts`, `store.ts`, `schemas.ts` bleiben unberührt.
 */
import { defineModule, type Deps } from '@vollholz/platform';
import type { FastifyInstance } from 'fastify';
import { vorschlagen, vorschlagZuruecknehmen } from './aktionen.ts';
import { registerEntscheidRoutes } from './entscheid-routes.ts';
import { entscheidTools } from './entscheid-mcp.ts';
import { fristenTask } from './fristen.ts';
import { sitzungTools } from './mcp.ts';
import { registerProtokollRoutes } from './protokoll-routes.ts';
import { registerRoutes, TAG } from './routes.ts';

const ROUTEN: ((app: FastifyInstance, deps: Deps) => void)[] = [
  registerRoutes,
  registerEntscheidRoutes,
  registerProtokollRoutes,
];

export const sitzungModule = defineModule({
  name: 'sitzung',
  tags: [{ name: TAG, description: 'Sitzungen der Gremien: Traktandenliste aus Vorschlägen, Unterlagen, Einladungen und Versand 5 Arbeitstage vorher (UC-006).' }],
  register: (app, deps) => { for (const r of ROUTEN) r(app, deps); },
  tasks: [fristenTask],
  mcpTools: {
    ...sitzungTools,
    ...entscheidTools,
  },
});

/** Geschäfte vorschlagen und zurücknehmen (für obere Module, in ihrer Transaktion; Rechte prüft der Aufrufer). */
export const traktandum = { vorschlagen, zuruecknehmen: vorschlagZuruecknehmen };
export { ARTEN, registriereTraktandenart, type Art, type Bezug, type EntscheidFolge, type Ergebnis, type Traktandenart, type Unterlage } from './arten.ts';
export type { Vorschlag } from './aktionen.ts';
