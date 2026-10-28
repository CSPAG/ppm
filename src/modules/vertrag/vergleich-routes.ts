/**
 * Routen für Versionsvergleich und Hauptänderungen (AP-E3-4; PS.03.04, UC-007 Schritt 2, UC-003 Schritt 5; K2 Schritt 5,
 * UI-10). Lesen mit `projekt:read` am Projekt, Beträge nur mit `finanzen:read` (A-33); Umformulieren der Hauptänderungen
 * mit `vertrag:write` im Entwurf «in Arbeit», `If-Match` auf die Version.
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  actorOf, conflict, etag, forbidden, IdParams, IfMatchHeaders, invalid, notFound, preconditionFailed, requireIfMatch, type Deps, type Tx,
} from '@vollholz/platform';
import { record } from '../../platform.ts';
import { STAND_TEXT } from './entwurf.ts';
import { TAG } from './routes.ts';
import * as store from './store.ts';
import { hauptaenderungen, RUBRIKEN, speichern, vergleichen, type Gespeichert } from './vergleich.ts';
import {
  Hauptaenderungen, HauptaenderungenPut, Unterschied, Vergleich, VergleichQuery, type HauptaenderungenOut, type HauptaenderungenPutIn,
} from './vergleich-schemas.ts';

const projektOrt = (id: string) => ({ type: 'projekt', id });
const aenderbar = (v: store.VersionRow, p: store.ProjektKopf) => v.stand === 'in_arbeit' && (p.lebenszyklus === 'aktiv' || p.lebenszyklus === 'sistiert');

/** Version und Projekt unter der Lesesicht, sonst 404 (fremde und unbekannte IDs gleich). */
async function sichtbar(tx: Tx, id: string): Promise<{ v: store.VersionRow; p: store.ProjektKopf }> {
  const v = await store.version(tx, id);
  const p = v && await store.projekt(tx, v.projekt_id);
  if (!v || !p) throw notFound('Vertragsversion');
  return { v, p };
}

export function registerVergleichRoutes(app: FastifyInstance, _deps: Deps): void {
  for (const s of [Unterschied, Vergleich, Hauptaenderungen, HauptaenderungenPut]) app.addSchema(s);

  async function ausgabe(req: FastifyRequest, tx: Tx, v: store.VersionRow, p: store.ProjektKopf): Promise<HauptaenderungenOut> {
    const betraege = await req.can('finanzen:read', projektOrt(p.id));
    const h = await hauptaenderungen(tx, v, betraege);
    return { ...h, version: v.version, can: { write: aenderbar(v, p) && await req.can('vertrag:write', projektOrt(p.id)) } };
  }

  app.get('/v1/vertragsversionen/:id/vergleich', {
    schema: {
      tags: [TAG], summary: 'Versionen vergleichen', params: IdParams, querystring: VergleichQuery, response: { 200: Type.Ref('VertragVergleich') },
      description: 'Unterschiede je Kapitel zwischen dieser Version und `mit` (Standard: Basisversion; PS.03.04, UI-10): Texte alt und neu, Listeneinträge «neu» / «entfernt» / «geändert», '
        + 'Zahlen mit Differenz. Beträge (Kap. 9) nur mit `finanzen:read`, sonst ohne Beträge verglichen (A-33).',
    },
  }, async req => {
    const { id } = req.params as { id: string };
    const { mit } = req.query as { mit?: string };
    const { v, p } = await req.tx(tx => sichtbar(tx, id));
    await req.need('projekt:read', projektOrt(p.id));
    const mitId = mit ?? v.basis_version_id;
    if (!mitId) throw conflict(`Version ${v.nummer} hat keine Basisversion. Wählen Sie eine Version zum Vergleich.`, { reason: 'basis' });
    const betraege = await req.can('finanzen:read', projektOrt(p.id));
    return req.tx(async tx => {
      const andere = await store.version(tx, mitId);
      if (!andere || andere.projekt_id !== p.id) throw invalid('Die Version zum Vergleich gehört nicht zu diesem Projekt.', [{ path: '/mit', message: 'Version desselben Projekts wählen.' }]);
      return { versionId: v.id, nummer: v.nummer, mitVersionId: andere.id, mitNummer: andere.nummer, betraege, kapitel: await vergleichen(tx, andere.id, v.id, betraege) };
    });
  });

  app.get('/v1/vertragsversionen/:id/hauptaenderungen', {
    schema: {
      tags: [TAG], summary: 'Hauptänderungen', params: IdParams, response: { 200: Type.Ref('VertragHauptaenderungen') },
      description: 'Hauptänderungen gegenüber der Basisversion in den Rubriken Scope, Zeitplan, Ressourcen/Budget, Annahmen, Key-Risiken (UC-007 Schritt 2, UC-003 Schritt 5): '
        + 'vom System erzeugte Sätze und die Umformulierung der Projektleitung, dazu «Andere». In Ressourcen/Budget das Budget je Phase alt und neu (nur mit `finanzen:read`). `ETag` der Version.',
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { v, p } = await req.tx(tx => sichtbar(tx, id));
    await req.need('projekt:read', projektOrt(p.id));
    const out = await req.tx(tx => ausgabe(req, tx, v, p));
    reply.header('etag', etag(v.version));
    return out;
  });

  app.put('/v1/vertragsversionen/:id/hauptaenderungen', {
    schema: {
      tags: [TAG], summary: 'Hauptänderungen umformulieren', params: IdParams, headers: IfMatchHeaders, body: Type.Ref('VertragHauptaenderungenPut'),
      response: { 200: Type.Ref('VertragHauptaenderungen') },
      description: 'Umformulierung je Rubrik und «Andere» im Entwurf «in Arbeit» (K2 Schritt 5); null oder leer stellt die erzeugten Sätze wieder her. '
        + 'Ressourcen/Budget nur mit `finanzen:read` (die Rubrik nennt Beträge, A-33). `If-Match` auf die Version.',
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const erwartet = requireIfMatch(req);
    const { v, p } = await req.tx(tx => sichtbar(tx, id));
    await req.need('vertrag:write', projektOrt(p.id));
    const body = req.body as HauptaenderungenPutIn;
    const betraege = await req.can('finanzen:read', projektOrt(p.id));
    if (!betraege && body.rubriken.ressourcen_budget !== undefined) throw forbidden('Die Rubrik Ressourcen/Budget nennt Beträge; ohne Recht auf Beträge können Sie sie nicht umformulieren.');
    const who = actorOf(req);
    const out = await req.tx(async tx => {
      if (!aenderbar(v, p)) throw conflict(`Version ${v.nummer} ist ${STAND_TEXT[v.stand]}; die Hauptänderungen können nicht mehr geändert werden.`, { reason: 'stand', stand: v.stand });
      if (v.version !== erwartet) throw preconditionFailed(v.version);
      const vorher = v.hauptaenderungen as Gespeichert['rubriken'];
      const rubriken: Gespeichert['rubriken'] = {};
      for (const r of RUBRIKEN) {
        const t = r in body.rubriken ? body.rubriken[r]?.trim() : vorher[r];
        if (t) rubriken[r] = t;
      }
      if (!(await speichern(tx, id, erwartet, { rubriken, andere: body.andere }))) throw preconditionFailed(v.version + 1);
      const r = (await store.version(tx, id))!;
      const daten = { versionId: id, projektId: p.id, nummer: r.nummer, rubriken: Object.keys(rubriken), andere: r.andere.length > 0, version: r.version };
      await record(tx, who, { action: 'vertrag.main_changes_updated', resourceType: 'vertrag_version', resourceId: id, data: { ...daten, projekt: p.nummer }, event: daten });
      return ausgabe(req, tx, r, p);
    });
    reply.header('etag', etag(out.version));
    return out;
  });
}
