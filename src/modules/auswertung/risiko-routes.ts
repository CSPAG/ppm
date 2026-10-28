/**
 * Route der Risikolage (BC PC.02.02, UC-014 Schritt 2; AP-E2-3) nach dem Muster des Dashboards: Recht `auswertung:read`
 * an der Organisation oder am Portfolio, Lesesicht über `req.tx`. Zeigt den aktuellen Stand der Register.
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { forbidden, notFound, type Deps, type Tx } from '@vollholz/platform';
import { lage } from './risiko.ts';
import { Risikolage, RisikolageQuery, RisikolageRisiko, type RisikolageOut, type RisikolageQueryIn } from './risiko-schemas.ts';
import * as risiko from './risiko-store.ts';
import * as store from './store.ts';

export const TAG_RISIKO = 'Risikolage';
const RECHT = 'auswertung:read';

/** Portfolios, die die Person auswerten darf (`auswertung:read` an der Organisation oder am Portfolio). */
export async function sichtbarePortfolios(req: FastifyRequest, tx: Tx): Promise<store.PortfolioRow[]> {
  const orgweit = await req.can(RECHT);
  const out: store.PortfolioRow[] = [];
  for (const pf of await store.portfolios(tx)) if (orgweit || (await req.can(RECHT, { type: 'portfolio', id: pf.id }))) out.push(pf);
  return out;
}

/** Risikolage der gewählten bzw. aller sichtbaren Portfolios zum jetzigen Stand. */
export async function risikolage(tx: Tx, portfolioIds: string[]) {
  return lage({
    risiken: await risiko.risiken(tx, portfolioIds),
    abhaengigkeiten: await risiko.abhaengigkeiten(tx, portfolioIds),
    eskalationen: await risiko.eskalationen(tx, portfolioIds),
  });
}

export function registerRisikoRoutes(app: FastifyInstance, deps: Deps): void {
  for (const s of [RisikolageRisiko, Risikolage]) app.addSchema(s);

  app.get('/v1/dashboard/risiken', {
    schema: {
      tags: [TAG_RISIKO], summary: 'Risikolage des Portfolios',
      description: 'Risikolage (UC-014 Schritt 2, PC.02.02): Projektrisiken der aktiven Projekte und Portfoliorisiken mit Wahrscheinlichkeit, Auswirkung und Massnahme, Verteilung über die 3 × 3-Matrix, Abhängigkeiten zwischen den Projekten und offene Eskalationen. Recht `auswertung:read` an der Organisation oder am Portfolio.',
      querystring: RisikolageQuery, response: { 200: Type.Ref('Risikolage') },
    },
  }, async (req): Promise<RisikolageOut> => {
    const q = req.query as RisikolageQueryIn;
    if (!(await deps.iam.access.canSomewhere(req.requirePrincipal(), RECHT))) throw forbidden('Die Risikolage sehen Gremien, Direktionen und die Unternehmensentwicklung.');
    return req.tx(async tx => {
      const sichtbar = await sichtbarePortfolios(req, tx);
      const gewaehlt = q.portfolio ? sichtbar.find(x => x.schluessel === q.portfolio) : undefined;
      if (q.portfolio && !gewaehlt) throw notFound('Portfolio');
      return {
        portfolios: sichtbar.map(x => ({ id: x.id, schluessel: x.schluessel, name: x.name, kategorie: x.kategorie })),
        portfolio: gewaehlt?.schluessel ?? null,
        stand: new Date().toISOString(),
        ...(await risikolage(tx, (gewaehlt ? [gewaehlt] : sichtbar).map(x => x.id))),
      };
    });
  });
}
