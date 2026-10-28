/**
 * Route der Dokumentausgabe des Abschlussberichts (UC-015 Schritt 5; Vorlagenart «Abschlussbericht», UC-018): Word mit
 * der aktiven eigenen Vorlage, sonst und für PDF das Layout des Grundbestands, über `vorlage.ausgeben`. Lesen mit
 * `projekt:read` am Projekt, Beträge nur mit `finanzen:read` (A-33). Der Export ist protokolliert (G12, I-Z3).
 */
import type { FastifyInstance } from 'fastify';
import { actorOf, IdParams, notFound, type Deps } from '@vollholz/platform';
import { Type } from '@sinclair/typebox';
import { fullTx, record } from '../../platform.ts';
import { MIME, vorlage, type Format } from '../vorlage/index.ts';
import { ABSCHLUSS_FELDER, abschlussDokument, dateiname } from './dokument.ts';
import { ausgabe, TAG } from './routes.ts';
import { DokumentQuery } from './schemas.ts';
import * as store from './store.ts';

const binaer = (beschreibung: string) => ({ schema: Type.String({ format: 'binary', description: beschreibung }) });

export function registerDokumentRoutes(app: FastifyInstance, deps: Deps): void {
  // Feldkatalog für eigene Word-Vorlagen des Abschlussberichts (AP-E7-7, UC-018 Schritt 2)
  vorlage.felderRegistrieren('abschlussbericht', ABSCHLUSS_FELDER);

  app.get('/v1/projekte/:id/abschluss/dokument', {
    schema: {
      tags: [TAG], summary: 'Bericht als Dokument herunterladen', params: IdParams, querystring: DokumentQuery,
      description: 'Offener bzw. letzter Bericht (Abschluss, Sistierung, Abbruch) im Layout der Vorlage «Abschlussbericht» mit Lessons Learned; Kopfzeile «Intern · '
        + 'enthält Personendaten» (G12). Beträge ohne `finanzen:read` als «nicht verfügbar» (A-33). Ohne Bericht 404.',
      response: { 200: { description: 'Dokument als Datei (Content-Disposition: attachment).', content: { [MIME.pdf]: binaer('PDF'), [MIME.docx]: binaer('Word') } } },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const format: Format = (req.query as { format?: Format }).format ?? 'pdf';
    const p = await req.tx(tx => store.projekt(tx, id));
    if (!p) throw notFound('Projekt');
    await req.need('projekt:read', { type: 'projekt', id: p.id });
    const who = actorOf(req);
    const a = await req.tx(async tx => {
      const out = await ausgabe(req, tx, p);
      if (!out.bericht) throw notFound('Abschlussbericht');
      await record(tx, who, { action: 'abschlussbericht.exported', resourceType: 'abschlussbericht', resourceId: out.bericht.id, data: { projekt: p.nummer, art: out.bericht.art, format } });
      return out;
    });
    // aktive Vorlage in voller Sicht (Konfiguration der Organisation)
    const { datei } = await fullTx(deps.db, req.requirePrincipal().tenantId, tx => vorlage.ausgeben(tx, { art: 'abschlussbericht', format, dokument: abschlussDokument(a) }));
    return reply
      .header('content-type', MIME[format])
      .header('content-disposition', `attachment; filename="${dateiname(a.bericht!.art, p.nummer, format)}"`)
      .header('cache-control', 'private, no-store')
      .send(datei);
  });
}
