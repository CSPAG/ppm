/**
 * Routen der Portfolio-Matrix (BC PP.03.04, UC-008 Schritt 4) und der Rangfolge (BC PP.02.02, UC-008 Schritt 1) nach dem
 * Muster der Handlungsfelder: Rechte über `req.need` am Portfolio, Lesesicht über `req.tx`, Fähigkeiten `can`, If-Match
 * (412), Audit und Ereignis in derselben Transaktion. Abhängigkeiten und Portfoliorisiken (PP.02.03, PC.02.01, UC-008
 * Schritt 3) pflegt das Register `projektdaten`; die Matrix zeigt die Abhängigkeiten als Linien.
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { actorOf, etag, IdParams, IfMatchHeaders, invalid, notFound, preconditionFailed, requireIfMatch, type Deps } from '@vollholz/platform';
import { record } from '../../platform.ts';
import { projektdaten } from '../projektdaten/index.ts';
import { achse, feld, ressourcen, type Einschaetzung } from './matrix.ts';
import { Matrix, Rangfolge, RangfolgePut, type MatrixOut, type RangfolgeOut, type RangfolgePutIn } from './matrix-schemas.ts';
import * as rang from './matrix-store.ts';
import { TAG } from './routes.ts';
import * as store from './store.ts';

const portfolioOrt = (id: string) => ({ type: 'portfolio', id });

export function registerMatrixRoutes(app: FastifyInstance, _deps: Deps): void {
  for (const s of [Matrix, Rangfolge, RangfolgePut]) app.addSchema(s);

  app.get('/v1/portfolios/:id/matrix', {
    schema: {
      tags: [TAG], summary: 'Portfolio-Matrix',
      description: 'Aktive Projekte mit Nutzen und Risiko aus der Bewertung nach dem Modell in Kraft (Durchschnitt der Einschätzungen der zugeordneten Kriterien, A-39; ohne Score, A-01), Feld der Matrix (Q6 F9), Ressourcenbedarf, Kosten (nur mit finanzen:read), Rang und Abhängigkeiten.',
      params: IdParams, response: { 200: Type.Ref('Matrix') },
    },
  }, async (req): Promise<MatrixOut> => {
    const { id } = req.params as { id: string };
    await req.need('priorisierung:read', portfolioOrt(id));
    const kostenSichtbar = await req.can('finanzen:read', portfolioOrt(id));
    return req.tx(async tx => {
      const pf = await store.portfolio(tx, id);
      if (!pf) throw notFound('Portfolio');
      const m = await store.aktuell(tx);
      const kriterien = m ? await store.kriterien(tx, m.id) : [];
      const nutzenK = kriterien.filter(k => k.dimension === 'nutzen').map(k => k.schluessel);
      const risikoK = kriterien.filter(k => k.dimension === 'risiko').map(k => k.schluessel);
      const projekte = (await store.projekte(tx, id, null)).filter(p => p.lebenszyklus === 'aktiv');
      const ids = new Set(projekte.map(p => p.id));
      const bew = m ? await store.bewertungen(tx, m.id, projekte.map(p => p.id)) : [];
      const raenge = await rang.rangfolge(tx, id);
      const out: MatrixOut['projekte'] = [];
      for (const p of projekte) {
        const b = new Map(bew.filter(x => x.projekt_id === p.id).map(x => [x.kriterium, x.einschaetzung as Einschaetzung]));
        const nutzen = achse(nutzenK, b);
        const risiko = achse(risikoK, b);
        const kostenRows = kostenSichtbar ? await projektdaten.lesen(tx, 'kosten', { projektId: p.id }) : [];
        const kosten = kostenSichtbar
          ? Math.round(kostenRows.reduce((s, k) => s + Number(k.prognose ?? k.budgetBaseline ?? 0), 0) * 100) / 100
          : null;
        const abh = await projektdaten.abhaengigkeiten(tx, p.id);
        out.push({
          id: p.id, nummer: p.nummer, name: p.name, phase: p.phase, nutzen, risiko, feld: feld(nutzen, risiko),
          ressourcen: ressourcen(await projektdaten.lesen(tx, 'ressourcenbedarf', { projektId: p.id })),
          kosten,
          rang: raenge.find(r => r.projekt_id === p.id && r.stand === 'entschieden')?.rang ?? null,
          rangEntwurf: raenge.find(r => r.projekt_id === p.id && r.stand === 'entwurf')?.rang ?? null,
          abhaengigVon: [...new Set(abh.filter(a => a.richtung === 'ausgehend' && ids.has(a.anderesId)).map(a => a.anderesId))],
        });
      }
      return {
        portfolio: pf,
        modell: m ? { id: m.id, nummer: m.nummer, inKraftAt: m.in_kraft_at, kriterien: kriterien.map(k => ({ schluessel: k.schluessel, text: k.text, dimension: k.dimension })) } : null,
        kostenSichtbar,
        projekte: out,
      };
    });
  });

  app.get('/v1/portfolios/:id/rangfolge', {
    schema: {
      tags: [TAG], summary: 'Rangfolge des Portfolios',
      description: 'Entschiedene Rangfolge (bisherige, UC-008 Schritt 1) und Entwurf der UE mit Begründung je Projekt (PP.02.02); ETag = Fassung des Entwurfs.',
      params: IdParams, response: { 200: Type.Ref('Rangfolge') },
    },
  }, async (req, reply): Promise<RangfolgeOut> => {
    const { id } = req.params as { id: string };
    await req.need('priorisierung:read', portfolioOrt(id));
    const write = await req.can('priorisierung:write');
    const r = await req.tx(async tx => {
      if (!(await store.portfolio(tx, id))) throw notFound('Portfolio');
      return rang.rangfolge(tx, id);
    });
    const entwurf = r.filter(x => x.stand === 'entwurf');
    const version = entwurf.reduce((v, x) => Math.max(v, x.version), 0);
    reply.header('etag', etag(version));
    const eintrag = (x: rang.RangRow) => ({ projektId: x.projekt_id, rang: x.rang, begruendung: x.begruendung });
    return {
      entschieden: r.filter(x => x.stand === 'entschieden').map(eintrag),
      entwurf: entwurf.map(eintrag),
      version,
      geaendertAt: entwurf.length ? entwurf.reduce((a, x) => (x.updated_at > a ? x.updated_at : a), entwurf[0]!.updated_at) : null,
      can: { write },
    };
  });

  app.put('/v1/portfolios/:id/rangfolge', {
    schema: {
      tags: [TAG], summary: 'Rangfolge entwerfen',
      description: 'Ersetzt den Entwurf durch die Liste (Rang = Position, PP.02.02). `If-Match` mit der gelesenen Fassung (`W/"0"` ohne Entwurf, sonst 412). Nur aktive Projekte des Portfolios, jedes einmal (422). Entschieden wird die Rangfolge erst mit dem Entscheid des Gremiums (AP-E5-5).',
      params: IdParams, headers: IfMatchHeaders, body: Type.Ref('RangfolgePut'), response: { 200: Type.Ref('Rangfolge') },
    },
  }, async (req, reply): Promise<RangfolgeOut> => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('priorisierung:read', portfolioOrt(id));
    await req.need('priorisierung:write');
    const body = req.body as RangfolgePutIn;
    const who = actorOf(req);
    const r = await req.tx(async tx => {
      if (!(await store.portfolio(tx, id))) throw notFound('Portfolio');
      const aktiv = new Set((await store.projekte(tx, id, null)).filter(p => p.lebenszyklus === 'aktiv').map(p => p.id));
      const fehler: { path: string; message: string }[] = [];
      body.projekte.forEach((p, i) => {
        if (!aktiv.has(p.projektId)) fehler.push({ path: `/projekte/${i}/projektId`, message: 'kein aktives Projekt dieses Portfolios' });
        if (body.projekte.findIndex(x => x.projektId === p.projektId) !== i) fehler.push({ path: `/projekte/${i}/projektId`, message: 'Projekt mehrfach genannt' });
      });
      if (fehler.length) throw invalid('Die Rangfolge passt nicht zum Portfolio.', fehler);
      const aktuell = await rang.entwurfVersion(tx, id);
      if (aktuell !== version) throw preconditionFailed(aktuell);
      const neu = aktuell + 1;
      await rang.entwurfSetzen(tx, id, neu, body.projekte.map(p => ({ projektId: p.projektId, begruendung: p.begruendung ?? '' })));
      const daten = { portfolioId: id, version: neu, projekte: body.projekte.map((p, i) => ({ projektId: p.projektId, rang: i + 1 })) };
      await record(tx, who, { action: 'rangfolge.drafted', resourceType: 'rangfolge', resourceId: id, data: daten, event: daten });
      return rang.rangfolge(tx, id);
    });
    const entwurf = r.filter(x => x.stand === 'entwurf');
    const v = entwurf.reduce((a, x) => Math.max(a, x.version), 0);
    reply.header('etag', etag(v));
    const eintrag = (x: rang.RangRow) => ({ projektId: x.projekt_id, rang: x.rang, begruendung: x.begruendung });
    return {
      entschieden: r.filter(x => x.stand === 'entschieden').map(eintrag), entwurf: entwurf.map(eintrag), version: v,
      geaendertAt: entwurf.length ? entwurf[0]!.updated_at : null, can: { write: true },
    };
  });
}
