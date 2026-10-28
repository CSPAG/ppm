/**
 * Routen des Portfolioberichts (BC PC.04.02, UC-014 Schritt 3; K3 Schritt 4; AP-E2-3): erzeugen, Kommentar ergänzen und
 * bereitstellen mit `auswertung:write` (Organisation, UE); lesen mit `auswertung:write` oder, sobald bereitgestellt, mit
 * `auswertung:read` an der Organisation oder am Portfolio (Lesesicht). Dokument über die Ausgabe des Moduls `vorlage`.
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { actorOf, conflict, etag, forbidden, IdParams, IfMatchHeaders, notFound, preconditionFailed, requireIfMatch, type Deps } from '@vollholz/platform';
import { fullTx, record } from '../../platform.ts';
import { FORMATE, MIME, type Format } from '../vorlage/index.ts';
import { daten, erzeugen, kurz, lesenOder404, voll, vorschlagen } from './bericht.ts';
import { dateiname } from './bericht-dokument.ts';
import {
  Portfoliobericht, PortfolioberichtCreate, PortfolioberichtKurz, PortfolioberichtListe, PortfolioberichtPatch, PortfolioberichtQuery,
  type PortfolioberichtCreateIn, type PortfolioberichtOut, type PortfolioberichtPatchIn, type PortfolioberichtQueryIn,
} from './bericht-schemas.ts';
import * as store from './bericht-store.ts';
import { berichtAusgeben } from './bericht-vorlage.ts';
import { sichtbarePortfolios } from './risiko-routes.ts';

export const TAG_BERICHT = 'Portfoliobericht';
const LESEN = 'auswertung:read';
const SCHREIBEN = 'auswertung:write';

const DokumentQuery = Type.Object({
  format: Type.Optional(Type.Union(FORMATE.map(f => Type.Literal(f)), { description: 'Dateiformat: `pdf` (Standard) oder `docx` (Word).' })),
}, { additionalProperties: false });
const binaer = (beschreibung: string) => ({ schema: Type.String({ format: 'binary', description: beschreibung }) });

export function registerBerichtRoutes(app: FastifyInstance, deps: Deps): void {
  for (const s of [PortfolioberichtKurz, Portfoliobericht, PortfolioberichtListe, PortfolioberichtCreate, PortfolioberichtPatch]) app.addSchema(s);

  const darfLesen = async (req: FastifyRequest) => {
    if (!(await deps.iam.access.canSomewhere(req.requirePrincipal(), LESEN))) throw forbidden('Den Portfoliobericht sehen Gremien, Direktionen und die Unternehmensentwicklung.');
  };

  app.get('/v1/portfolioberichte', {
    schema: {
      tags: [TAG_BERICHT], summary: 'Portfolioberichte',
      description: 'Portfolioberichte, neueste Periode zuerst; die UE sieht auch Entwürfe, Gremien und Direktionen nur bereitgestellte Berichte ihres Portfolios.',
      querystring: PortfolioberichtQuery, response: { 200: Type.Ref('PortfolioberichtListe') },
    },
  }, async req => {
    const q = req.query as PortfolioberichtQueryIn;
    await darfLesen(req);
    return req.tx(async tx => {
      const sichtbar = await sichtbarePortfolios(req, tx);
      const pf = q.portfolio ? sichtbar.find(x => x.schluessel === q.portfolio) : undefined;
      if (q.portfolio && !pf) throw notFound('Portfolio');
      const ids = new Set(sichtbar.map(x => x.id));
      return { items: (await store.liste(tx, pf?.id ?? null)).filter(b => ids.has(b.portfolio_id)).map(kurz) };
    });
  });

  app.post('/v1/portfolioberichte', {
    schema: {
      tags: [TAG_BERICHT], summary: 'Portfoliobericht erzeugen',
      description: 'Erzeugt den Bericht des Portfolios aus dem abgeschlossenen Dashboard der Periode und der Risikolage (UC-014 Schritt 3, K3 Schritt 4; PPM-4). Besteht der Bericht als Entwurf, wird er neu erzeugt (der Kommentar bleibt, 200); bereitgestellt ist er fest (409). Offene Periode: 409. Recht `auswertung:write`.',
      body: Type.Ref('PortfolioberichtCreate'), response: { 200: Type.Ref('Portfoliobericht'), 201: Type.Ref('Portfoliobericht') },
    },
  }, async (req, reply): Promise<PortfolioberichtOut> => {
    const body = req.body as PortfolioberichtCreateIn;
    await req.need(SCHREIBEN);
    const who = actorOf(req);
    const { b, neu } = await req.tx(async tx => {
      const pf = (await sichtbarePortfolios(req, tx)).find(x => x.schluessel === body.portfolio);
      if (!pf) throw notFound('Portfolio');
      const r = await erzeugen(tx, pf, body.periode);
      const b = await lesenOder404(tx, r.id);
      await record(tx, who, {
        action: r.neu ? 'portfoliobericht.created' : 'portfoliobericht.regenerated', resourceType: 'portfoliobericht', resourceId: b.id,
        data: { portfolio: pf.schluessel, periode: b.periode },
      });
      return { b, neu: r.neu };
    });
    reply.code(neu ? 201 : 200).header('etag', etag(b.version));
    return voll(b, true);
  });

  app.get('/v1/portfolioberichte/:id', {
    schema: { tags: [TAG_BERICHT], summary: 'Portfoliobericht', description: 'Bericht mit Kommentar, Dashboard und Risikolage im Stand bei Erzeugung; ETag = Fassung.', params: IdParams, response: { 200: Type.Ref('Portfoliobericht') } },
  }, async (req, reply): Promise<PortfolioberichtOut> => {
    const { id } = req.params as { id: string };
    await darfLesen(req);
    const schreiben = await req.can(SCHREIBEN);
    const b = await req.tx(tx => lesenOder404(tx, id));
    reply.header('etag', etag(b.version));
    return voll(b, schreiben);
  });

  app.patch('/v1/portfolioberichte/:id', {
    schema: {
      tags: [TAG_BERICHT], summary: 'Kommentar ergänzen', description: 'Kommentar der UE («Bericht der Programmleitung») im Entwurf; nur mit `If-Match`.',
      params: IdParams, headers: IfMatchHeaders, body: Type.Ref('PortfolioberichtPatch'), response: { 200: Type.Ref('Portfoliobericht') },
    },
  }, async (req, reply): Promise<PortfolioberichtOut> => {
    const { id } = req.params as { id: string };
    const { kommentar } = req.body as PortfolioberichtPatchIn;
    await req.need(SCHREIBEN);
    const version = requireIfMatch(req);
    const who = actorOf(req);
    const b = await req.tx(async tx => {
      const vorher = await lesenOder404(tx, id);
      if (vorher.stand !== 'entwurf') throw conflict('Der Portfoliobericht ist bereitgestellt und nicht mehr änderbar.');
      if (vorher.version !== version || !(await store.kommentieren(tx, id, version, kommentar.trim()))) throw preconditionFailed(vorher.version);
      await record(tx, who, { action: 'portfoliobericht.commented', resourceType: 'portfoliobericht', resourceId: id, data: { periode: vorher.periode } });
      return lesenOder404(tx, id);
    });
    reply.header('etag', etag(b.version));
    return voll(b, true);
  });

  app.post('/v1/portfolioberichte/:id/bereitstellen', {
    schema: {
      tags: [TAG_BERICHT], summary: 'Portfoliobericht bereitstellen',
      description: 'Stellt den Bericht dem Gremium bereit (UC-014 Schritt 3): danach fest, sichtbar mit `auswertung:read` am Portfolio, und schlägt dem entscheidenden Gremium das Traktandum «Bericht der Programmleitung» mit dem Bericht als Unterlage vor (K3 Schritte 1 und 4); nur mit `If-Match`.',
      params: IdParams, headers: IfMatchHeaders, response: { 200: Type.Ref('Portfoliobericht') },
    },
  }, async (req, reply): Promise<PortfolioberichtOut> => {
    const { id } = req.params as { id: string };
    await req.need(SCHREIBEN);
    const version = requireIfMatch(req);
    const who = actorOf(req);
    const b = await req.tx(async tx => {
      const vorher = await lesenOder404(tx, id);
      if (vorher.stand !== 'entwurf') throw conflict('Der Portfoliobericht ist bereits bereitgestellt.');
      if (vorher.version !== version || !(await store.bereitstellen(tx, id, version))) throw preconditionFailed(vorher.version);
      const traktandumId = await vorschlagen(tx, vorher);
      const daten = { id, portfolioId: vorher.portfolio_id, periode: vorher.periode, traktandumId };
      await record(tx, who, { action: 'portfoliobericht.provided', resourceType: 'portfoliobericht', resourceId: id, data: daten, event: daten });
      return lesenOder404(tx, id);
    });
    reply.header('etag', etag(b.version));
    return voll(b, true);
  });

  app.get('/v1/portfolioberichte/:id/dokument', {
    schema: {
      tags: [TAG_BERICHT], summary: 'Portfoliobericht als Dokument', params: IdParams, querystring: DokumentQuery,
      description: 'Bericht als PDF oder Word über die Dokumentausgabe (Modul `vorlage`); Kopfzeile «Intern · enthält Personendaten» (G12). Der Export ist protokolliert.',
      response: { 200: { description: 'Dokument als Datei (Content-Disposition: attachment).', content: { [MIME.pdf]: binaer('PDF'), [MIME.docx]: binaer('Word') } } },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const format: Format = (req.query as { format?: Format }).format ?? 'pdf';
    await darfLesen(req);
    const who = actorOf(req);
    const b = await req.tx(async tx => {
      const b = await lesenOder404(tx, id);
      // Export eines personenbezogenen Dokuments im Audit (I-Z3); kein Ereignis
      await record(tx, who, { action: 'portfoliobericht.exported', resourceType: 'portfoliobericht', resourceId: id, data: { periode: b.periode, format } });
      return daten(b);
    });
    // Word mit der aktiven eigenen Vorlage, sonst und für PDF der Grundbestand (AP-E7-7); Vorlage in voller Sicht
    const datei = await fullTx(deps.db, req.requirePrincipal().tenantId, tx => berichtAusgeben(tx, b, format));
    return reply
      .header('content-type', MIME[format])
      .header('content-disposition', `attachment; filename="${dateiname(b, format)}"`)
      .header('cache-control', 'private, no-store')
      .send(datei);
  });
}
