/**
 * Modul Portfolios und Gremien (BC AM.02.04; UC-017 Schritt 4, A1): öffentliche Schnittstelle. Andere Module nutzen den
 * Gremienweg je Gate (`sitzung`: Traktandum «via SNS-VR», `vertrag`: Gate-Antrag) und die Sitzungstermine.
 */
import { defineModule } from '@vollholz/platform';
import { portfolioTools } from './mcp.ts';
import { registerRoutes } from './routes.ts';

export { entscheidendesGremium, gremienwegFuerGate, gremienwegVon, sitzungstermine, type Gremienschritt, type GremiumKurz } from './gremienweg.ts';
export { GATES, pflichtenVon, type GateCode, type Kategorie } from './store.ts';

export const portfolioModule = defineModule({
  name: 'portfolio',
  tags: [{ name: 'Portfolios', description: 'Portfolios A, B, C mit ihren Pflichten, Gremien mit Sitzungsterminen und Gremienweg je Gate (inkl. SNS-VR).' }],
  register: registerRoutes,
  mcpTools: portfolioTools,
});
