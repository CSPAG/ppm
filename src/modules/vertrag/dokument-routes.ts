/**
 * Route der Dokumentausgabe (DM.02.07; UC-002 Schritt 12; K2 Schritt 11; AP-E3-5): jede Version des Projektvertrags
 * als Dokument im Layout der Vorlage, Word oder PDF. Lesen mit `projekt:read` am Projekt (wie der Vertrag selbst),
 * Beträge nur mit `finanzen:read` (A-33). Der Export ist protokolliert (personenbezogenes Dokument, G12, I-Z3).
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { actorOf, IdParams, notFound, type Deps } from '@vollholz/platform';
import { fullTx, record } from '../../platform.ts';
import { FORMATE, MIME, vorlage, type Format } from '../vorlage/index.ts';
import { dateiname, vertragDokument, type VertragInhalt } from './dokument.ts';
import * as dok from './dokument-store.ts';
import { ohneBetraege } from './kapitel.ts';
import { TAG } from './routes.ts';
import * as store from './store.ts';

const DokumentQuery = Type.Object({
  format: Type.Optional(Type.Union(FORMATE.map(f => Type.Literal(f)), { description: 'Dateiformat: `pdf` (Standard) oder `docx` (Word).' })),
}, { additionalProperties: false });

const binaer = (beschreibung: string) => ({ schema: Type.String({ format: 'binary', description: beschreibung }) });

export function registerDokumentRoutes(app: FastifyInstance, deps: Deps): void {
  app.get('/v1/vertragsversionen/:id/dokument', {
    schema: {
      tags: [TAG], summary: 'Version als Dokument herunterladen', params: IdParams, querystring: DokumentQuery,
      description: 'Version des Projektvertrags im Layout der Vorlage (Grundbestand: Projektvertrag nach Q7) mit Versionsnummer, Stand und Freigabe; '
        + 'Kopfzeile «Intern · enthält Personendaten» (G12). Beträge ohne `finanzen:read` als «nicht verfügbar» (A-33).',
      response: {
        200: { description: 'Dokument als Datei (Content-Disposition: attachment).', content: { [MIME.pdf]: binaer('PDF'), [MIME.docx]: binaer('Word') } },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const format: Format = (req.query as { format?: Format }).format ?? 'pdf';
    const v = await req.tx(tx => store.version(tx, id));
    if (!v) throw notFound('Vertragsversion');
    const ort = { type: 'projekt', id: v.projekt_id };
    await req.need('projekt:read', ort);
    const betraege = await req.can('finanzen:read', ort);
    const who = actorOf(req);

    const daten = await req.tx(async tx => {
      const kopf = await dok.kopf(tx, v.projekt_id);
      if (!kopf) throw notFound('Vertragsversion');
      const kapitel = await store.kapitel(tx, v.id);
      const inhalt = Object.fromEntries(kapitel.map(k => [k.kapitel, betraege ? k.inhalt : ohneBetraege(k.kapitel, k.inhalt)])) as unknown as VertragInhalt;
      const personen = await dok.personen(tx, [...new Set(inhalt[8].mitglieder.map(m => m.personId))]);
      const projekte = await dok.projekte(tx, [...new Set(inhalt[6].abhaengigkeiten.map(a => a.zuProjektId))]);
      const versionen = await store.versionen(tx, v.projekt_id);
      // Export eines personenbezogenen Dokuments im Audit (I-Z3); kein Ereignis
      await record(tx, who, { action: 'vertrag.exported', resourceType: 'vertrag_version', resourceId: v.id, data: { projekt: kopf.nummer, nummer: v.nummer, format, betraege } });
      return { kopf, inhalt, personen, projekte, versionen };
    });
    // Bezeichnungen der Konfiguration in voller Sicht (gleiches Dokument für alle Lesenden)
    const k2 = daten.inhalt[2];
    const bez = await fullTx(deps.db, req.requirePrincipal().tenantId, tx => dok.bezeichnungen(tx, { portfolioId: daten.kopf.portfolio_id, handlungsfeldId: k2.handlungsfeldId, zielId: k2.strategischesZielId, jahreszielId: k2.jahreszielId }));

    const datei = vorlage.setzen(vertragDokument({ version: v, ...daten, bez, betraege }), format);
    const name = dateiname(daten.kopf.nummer, v.nummer, format);
    return reply
      .header('content-type', MIME[format])
      .header('content-disposition', `attachment; filename="${name}"`)
      .header('cache-control', 'private, no-store')
      .send(datei);
  });
}
