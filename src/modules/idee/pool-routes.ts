/**
 * Eingereichte Ideen für alle Mitglieder (AP-E8-3; Master Entscheid 14, A-73): ähnliche Ideen schon beim Ausfüllen
 * (UC-001 Schritt 3, K4 Schritt 2), nach Handlungsfeld oder gemeinsamen betroffenen Bereichen. Sichtbar ist, was die
 * Lesesicht zeigt: eingereichte Ideen mit `idee:list`, nie Entwürfe anderer und nie die Prüfung (Rückfragen, Raster,
 * Leitfragen). Ersetzt für die Antragstellenden A-32 («nur die UE»).
 */
import { Type } from '@sinclair/typebox';
import { Uuid } from '@vollholz/platform';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import * as ps from './pruefung-store.ts';
import { TAG } from './routes.ts';

/** Lesen der eingereichten Ideen: mit `idee:list` an der Organisation, sonst `idee:read` irgendwo (Pool der UE). */
async function needAuflisten(req: FastifyRequest): Promise<void> {
  if (!(await req.can('idee:list'))) await req.needSomewhere('idee:read');
}

const AehnlichQuery = Type.Object({
  handlungsfeldId: Type.Optional(Uuid),
  bereich: Type.Optional(Type.Array(Uuid, { maxItems: 50, description: 'Betroffene Bereiche (Organisationseinheiten).' })),
  ausser: Type.Optional({ ...Uuid, description: 'Die eigene Idee, die nicht als ähnlich erscheinen soll.' }),
}, { additionalProperties: false });

// gleiche Gestalt wie `IdeeAehnliche` der Prüfung, damit die Webapp beide gleich darstellt
const zeile = (r: ps.PoolRow & { gleiches_feld: boolean; gemeinsam: number }) => ({
  idee: {
    id: r.id, nummer: r.nummer, titel: r.titel, stand: r.stand, standAt: r.stand_at, eingereichtAt: r.eingereicht_at, erfasstVon: r.erfasst_von,
    handlungsfeldId: r.handlungsfeld_id, bereiche: r.org_einheit_ids, herkunft: r.herkunft, kategorie: r.kategorie, rueckfragenOffen: r.rueckfragen_offen,
  },
  gleichesHandlungsfeld: r.gleiches_feld, gemeinsameBereiche: r.gemeinsam,
});

export function registerPoolRoutes(app: FastifyInstance): void {
  app.get('/v1/ideen/aehnlich', {
    schema: {
      tags: [TAG], summary: 'Ähnliche eingereichte Ideen beim Ausfüllen',
      description: 'Eingereichte Ideen mit gleichem Handlungsfeld oder gemeinsamen betroffenen Bereichen, offene zuerst, höchstens 20 (UC-001 Schritt 3; Master Entscheid 14). Mit `idee:list` (alle Mitglieder) oder `idee:read`; ohne Handlungsfeld und Bereiche leer.',
      querystring: AehnlichQuery, response: { 200: Type.Ref('IdeeAehnliche') },
    },
  }, async req => {
    await needAuflisten(req);
    const q = req.query as { handlungsfeldId?: string; bereich?: string[]; ausser?: string };
    if (!q.handlungsfeldId && !q.bereich?.length) return { items: [] };
    const rows = await req.tx(tx => ps.aehnliche(tx, {
      id: q.ausser ?? '00000000-0000-0000-0000-000000000000', handlungsfeld_id: q.handlungsfeldId ?? null, org_einheit_ids: q.bereich ?? [],
    }));
    return { items: rows.map(zeile) };
  });
}
