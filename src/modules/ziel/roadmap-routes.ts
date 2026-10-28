/**
 * Routen der Portfolio-Roadmap (BC PP.04.03; UC-011 Schritt 8; K6 Schritt 8; UI-31): Vorschau und Publizieren für die
 * UE (ziel:freigabe, nur mit Jahreszielen «in Kraft»), Lesen der publizierten Roadmap für alle angemeldeten Personen
 * (tenant:read, A-35, UX-OF-14). Gespeichert wird der Stand bei Publikation.
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { actorOf, conflict, etag, IdempotencyHeaders, notFound, type Deps } from '@vollholz/platform';
import { record } from '../../platform.ts';
import { Roadmap, RoadmapInhalt, RoadmapList, RoadmapVorschau } from './roadmap-schemas.ts';
import * as store from './roadmap-store.ts';
import { JahrParams } from './zyklus-schemas.ts';
import * as zyklus from './zyklus-store.ts';

const TAG = 'Ziele';

const out = (r: store.RoadmapRow, publizieren: boolean) => ({
  jahr: r.jahr, publiziertAt: r.publiziert_at, publiziertBy: r.publiziert_by, version: r.version, inhalt: r.inhalt, can: { publizieren },
});

export function registerRoadmapRoutes(app: FastifyInstance, _deps: Deps): void {
  for (const s of [RoadmapInhalt, Roadmap, RoadmapList, RoadmapVorschau]) app.addSchema(s);

  app.get('/v1/roadmap', {
    schema: { tags: [TAG], summary: 'Publizierte Roadmaps', description: 'Alle publizierten Jahre, neueste zuerst; lesbar für alle angemeldeten Personen (A-35).', response: { 200: Type.Ref('RoadmapList') } },
  }, async req => {
    await req.need('tenant:read');
    const rows = await req.tx(tx => store.list(tx));
    return { items: rows.map(r => ({ jahr: r.jahr, publiziertAt: r.publiziert_at, version: r.version })) };
  });

  app.get('/v1/roadmap/:jahr', {
    schema: { tags: [TAG], summary: 'Roadmap eines Jahres', description: 'Stand bei Publikation; nicht publiziert: 404.', params: JahrParams, response: { 200: Type.Ref('Roadmap') } },
  }, async (req, reply) => {
    const { jahr } = req.params as { jahr: number };
    await req.need('tenant:read');
    const d = await req.tx(async tx => ({ r: await store.get(tx, jahr), zj: await zyklus.getJahr(tx, jahr) }));
    if (!d.r) throw notFound(`Roadmap ${jahr}`);
    reply.header('etag', etag(d.r.version));
    return out(d.r, d.zj?.stand === 'in_kraft' && await req.can('ziel:freigabe'));
  });

  app.get('/v1/roadmap/:jahr/vorschau', {
    schema: { tags: [TAG], summary: 'Vorschau der Roadmap', description: 'Inhalt, wie er beim Publizieren gespeichert würde (K6 Schritt 8); nur mit ziel:freigabe.', params: JahrParams, response: { 200: Type.Ref('RoadmapVorschau') } },
  }, async req => {
    const { jahr } = req.params as { jahr: number };
    await req.need('ziel:freigabe');
    const d = await req.tx(async tx => ({ zj: await zyklus.getJahr(tx, jahr), r: await store.get(tx, jahr), inhalt: await store.inhalt(tx, jahr) }));
    return { jahr, stand: d.zj?.stand ?? null, publiziertAt: d.r?.publiziert_at ?? null, inhalt: d.inhalt, can: { publizieren: d.zj?.stand === 'in_kraft' } };
  });

  app.post('/v1/roadmap/:jahr', {
    schema: {
      tags: [TAG], summary: 'Roadmap publizieren', params: JahrParams, headers: IdempotencyHeaders, response: { 200: Type.Ref('Roadmap') },
      description: 'Erzeugt die Roadmap aus Zielen, Hauptaktivitäten und Vorhaben und stellt sie allen angemeldeten Personen lesend bereit (UC-011 Schritt 8, A-35). Erneutes Publizieren ersetzt den Stand. 409, solange die Jahresziele nicht in Kraft sind.',
    },
  }, async (req, reply) => {
    const { jahr } = req.params as { jahr: number };
    await req.need('ziel:freigabe');
    const who = actorOf(req);
    const r = await req.tx(async tx => {
      const zj = await zyklus.getJahr(tx, jahr);
      if (!zj) throw notFound(`Zielzyklus ${jahr}`);
      if (zj.stand !== 'in_kraft') throw conflict(`Die Jahresziele ${jahr} sind noch nicht in Kraft. Publizieren Sie die Roadmap nach der Freigabe durch den VR.`, { reason: 'stand', stand: zj.stand });
      const row = await store.publizieren(tx, jahr, await store.inhalt(tx, jahr));
      const snap = { id: row.id, jahr, version: row.version };
      await record(tx, who, { action: 'roadmap.published', resourceType: 'roadmap', resourceId: row.id, data: snap, event: snap });
      return row;
    });
    reply.header('etag', etag(r.version));
    return out(r, true);
  });
}
