/**
 * Routen des Dashboards (BC PC.04.01, UC-014 Schritt 1; AP-E1-3) nach dem Muster der Handlungsfelder: Recht
 * `auswertung:read` an der Organisation oder am Portfolio (Gremium, Direktion sehen nur ihre Portfolios, UC-014
 * Vorbedingung), Lesesicht über `req.tx`. Abgeschlossene Perioden zeigen den Stand bei Abschluss, offene den aktuellen.
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { forbidden, invalid, notFound, type Deps } from '@vollholz/platform';
import { alsCsv, funnel, PASST, zeilen } from './dashboard.ts';
import { Dashboard, DashboardQuery, DashboardZeile, FunnelStufe, type DashboardOut, type DashboardQueryIn, type DashboardZeileOut } from './schemas.ts';
import * as store from './store.ts';

export const TAG = 'Dashboard';
const RECHT = 'auswertung:read';

export function registerRoutes(app: FastifyInstance, deps: Deps): void {
  for (const s of [DashboardZeile, FunnelStufe, Dashboard]) app.addSchema(s);

  app.get('/v1/dashboard', {
    schema: {
      tags: [TAG], summary: 'Dashboard der Periode',
      description: 'Portfolio-Dashboard (UC-014 Schritt 1, PC.04.01): je Projekt der sichtbaren Portfolios Status, Status der Vorperiode, Trend, Phase mit «Abschluss per», nächster Meilenstein und Projektleitung; Meldung «gemeldet», «ausstehend» bzw. nach dem Abschluss «nicht gemeldet» (A-11); Badge «Eskalation». Dazu der Funnel nach Phase. Ohne `periode` die letzte abgeschlossene Periode (ab dem 1. für die Gremien, UC-005), sonst die laufende. Mit `format=csv` als Export der Projekte (optional nach `phase` und `auswahl`, wie die Liste der Oberfläche). Recht `auswertung:read` an der Organisation oder am Portfolio.',
      querystring: DashboardQuery, response: { 200: Type.Ref('Dashboard') },
    },
  }, async (req, reply) => {
    const q = req.query as DashboardQueryIn;
    const p = req.requirePrincipal();
    if (!(await deps.iam.access.canSomewhere(p, RECHT))) throw forbidden('Das Dashboard sehen Gremien, Direktionen und die Unternehmensentwicklung.');
    const orgweit = await req.can(RECHT);
    if ((q.phase || q.auswahl) && q.format !== 'csv') throw invalid('`phase` und `auswahl` gelten nur für den Export.', [{ path: q.phase ? '/phase' : '/auswahl', message: 'nur mit format=csv' }]);
    const out = await req.tx(async (tx): Promise<DashboardOut> => {
      const alle = await store.portfolios(tx);
      const sichtbar: store.PortfolioRow[] = [];
      for (const pf of alle) if (orgweit || (await req.can(RECHT, { type: 'portfolio', id: pf.id }))) sichtbar.push(pf);
      const gewaehlt = q.portfolio ? sichtbar.find(x => x.schluessel === q.portfolio) : undefined;
      if (q.portfolio && !gewaehlt) throw notFound('Portfolio');
      const ids = (gewaehlt ? [gewaehlt] : sichtbar).map(x => x.id);

      const perioden = await store.perioden(tx);
      const laufend = await store.laufendePeriode(tx);
      const periode = q.periode ?? perioden.find(x => x.stand === 'abgeschlossen')?.periode ?? laufend;
      const stand = perioden.find(x => x.periode === periode);
      const abgeschlossen = stand?.stand === 'abgeschlossen';
      const rows = abgeschlossen ? await store.zeilenAbgeschlossen(tx, periode, ids) : await store.zeilenOffen(tx, periode, ids);
      const namen = new Map(sichtbar.map(x => [x.id, x.name]));
      const items = await zeilen(tx, rows, r => namen.get(r.portfolio_id) ?? '');

      const liste = perioden.map(x => ({ periode: x.periode, stand: x.stand }));
      if (!liste.some(x => x.periode === laufend)) liste.unshift({ periode: laufend, stand: 'offen' });
      return {
        periode, periodeStand: abgeschlossen ? 'abgeschlossen' : 'offen', abgeschlossenAt: stand?.abgeschlossen_at ?? null,
        perioden: liste.sort((a, b) => b.periode.localeCompare(a.periode)),
        portfolios: sichtbar.map(x => ({ id: x.id, schluessel: x.schluessel, name: x.name, kategorie: x.kategorie })),
        portfolio: gewaehlt?.schluessel ?? null,
        items, funnel: funnel(items),
      };
    });
    if (q.format !== 'csv') return out;
    // Export (Seitentyp Bericht): die Projekte wie in der Liste, nach Phase und Auswahl
    const items = (out.items as DashboardZeileOut[]).filter(z => (!q.phase || z.phase === q.phase) && (!q.auswahl || PASST[q.auswahl](z)));
    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="dashboard-${out.periode}${out.portfolio ? `-${out.portfolio}` : ''}.csv"`)
      .send(alsCsv(items));
  });
}
