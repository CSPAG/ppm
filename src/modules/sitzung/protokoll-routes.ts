/**
 * Routen des Protokolls (BC PP.04.02; UC-006 Schritte 8–9; K3 Schritt 10; AP-E2-2): lesen, bereinigen, Vorschau der
 * Empfänger und versenden. Entwurf nur mit sitzung:write, Mitglieder ab Versand (Lesesicht); vertrauliche Traktanden
 * nur mit projekt:vertraulich (A-34).
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { actorOf, conflict, etag, IdParams, IfMatchHeaders, invalid, notFound, preconditionFailed, requireIfMatch, type Deps, type Tx } from '@vollholz/platform';
import { record } from '../../platform.ts';
import { Protokoll, Protokollfrist, ProtokollPut, Protokollversand, type ProtokollOut, type ProtokollPutIn } from './entscheid-schemas.ts';
import * as es from './entscheid-store.ts';
import { bereinigen, beteiligte, fuerLeser, protokollfrist, versenden, type ProtokollInhalt } from './protokoll.ts';
import { TAG } from './routes.ts';
import * as store from './store.ts';

const ort = (portfolioId: string) => ({ type: 'portfolio', id: portfolioId });

async function lesen(tx: Tx, id: string): Promise<{ s: store.SitzungRow; p: es.ProtokollRow }> {
  const s = await store.getSitzung(tx, id);
  const p = s ? await es.protokollVon(tx, s.id) : null;
  if (!s || !p) throw notFound('Protokoll');
  return { s, p };
}

async function protokollOut(req: FastifyRequest, tx: Tx, s: store.SitzungRow, p: es.ProtokollRow): Promise<ProtokollOut> {
  const vertraulich = await req.can('projekt:vertraulich', ort(s.portfolio_id));
  const versendetAm = p.versendet_at ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(p.versendet_at) : null;
  return {
    sitzungId: s.id, stand: p.stand, inhalt: fuerLeser(p.inhalt as ProtokollInhalt, vertraulich),
    frist: await protokollfrist(tx, s, versendetAm), versendetAt: p.versendet_at, version: p.version, updatedAt: p.updated_at,
    can: { write: p.stand === 'entwurf' && await req.can('sitzung:write', ort(s.portfolio_id)) },
  };
}

export function registerProtokollRoutes(app: FastifyInstance, _deps: Deps): void {
  for (const s of [Protokollfrist, Protokoll, ProtokollPut, Protokollversand]) app.addSchema(s);

  app.get('/v1/sitzungen/:id/protokoll', {
    schema: {
      tags: [TAG], summary: 'Protokoll lesen',
      description: 'Protokoll mit Traktanden, Entscheiden, Begründungen und Auflagen (UC-006 Schritt 8) und Frist (3 Arbeitstage, Q8 Kap. 8.1). Entwurf nur mit sitzung:write, Mitglieder ab Versand; 404, solange die Sitzung nicht geschlossen ist.',
      params: IdParams, response: { 200: Type.Ref('Protokoll') },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const out = await req.tx(async tx => { const { s, p } = await lesen(tx, id); return protokollOut(req, tx, s, p); });
    reply.header('etag', etag(out.version));
    return out;
  });

  app.put('/v1/sitzungen/:id/protokoll', {
    schema: {
      tags: [TAG], summary: 'Protokoll bereinigen',
      description: 'K3 Schritt 10: Anwesende, Notizen je Traktandum und Bemerkungen (automatisches Speichern); Entscheide bleiben unverändert (A-30). Nur im Entwurf und mit `If-Match`.',
      params: IdParams, headers: IfMatchHeaders, body: Type.Ref('ProtokollPut'), response: { 200: Type.Ref('Protokoll') },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    const body = req.body as ProtokollPutIn;
    const who = actorOf(req);
    const out = await req.tx(async tx => {
      const { s, p } = await lesen(tx, id);
      await req.need('sitzung:write', ort(s.portfolio_id));
      if (p.version !== version) throw preconditionFailed(p.version);
      if (p.stand !== 'entwurf') throw conflict('Das Protokoll ist versendet.');
      const r = bereinigen(p.inhalt as ProtokollInhalt, body);
      if (r.unbekannt.length) throw invalid('Nicht jedes Traktandum steht im Protokoll.', r.unbekannt.map(i => ({ path: `/notizen/${i}/traktandumId`, message: 'nicht im Protokoll' })));
      if (!(await es.protokollSpeichern(tx, s.id, version, r.inhalt))) throw preconditionFailed(p.version);
      const n = (await es.protokollVon(tx, s.id))!;
      await record(tx, who, { action: 'protokoll.updated', resourceType: 'protokoll', resourceId: n.id, data: { sitzungId: s.id, felder: Object.keys(body) }, event: { id: n.id, sitzungId: s.id, version: n.version } });
      return protokollOut(req, tx, s, n);
    });
    reply.header('etag', etag(out.version));
    return out;
  });

  app.get('/v1/sitzungen/:id/protokoll/versand', {
    schema: {
      tags: [TAG], summary: 'Vorschau des Protokollversands',
      description: 'Empfänger (K3 Schritt 10) und Frist: Beteiligte erhalten eine Mitteilung, Mitglieder sehen das Protokoll ab Versand.',
      params: IdParams, response: { 200: Type.Ref('Protokollversand') },
    },
  }, async req => {
    const { id } = req.params as { id: string };
    return req.tx(async tx => {
      const { s } = await lesen(tx, id);
      await req.need('sitzung:write', ort(s.portfolio_id));
      return { frist: await protokollfrist(tx, s, null), beteiligte: await beteiligte(tx, s) };
    });
  });

  app.post('/v1/sitzungen/:id/protokoll/versenden', {
    schema: {
      tags: [TAG], summary: 'Protokoll versenden',
      description: 'UC-006 Schritt 9: Mitglieder sehen das Protokoll, Beteiligte erhalten eine Mitteilung, «Protokoll versenden» ist erledigt; protokolliert mit Arbeitstagen nach der Sitzung (K3-4). Nur mit `If-Match` (Version des Protokolls).',
      params: IdParams, headers: IfMatchHeaders, response: { 200: Type.Ref('Protokoll') },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    const who = actorOf(req);
    const out = await req.tx(async tx => {
      const { s, p } = await lesen(tx, id);
      await req.need('sitzung:write', ort(s.portfolio_id));
      if (p.version !== version) throw preconditionFailed(p.version);
      const r = await versenden(tx, s, version);
      const n = (await es.protokollVon(tx, s.id))!;
      const data = { id: n.id, sitzungId: s.id, gremiumId: s.gremium_id, portfolioId: s.portfolio_id, datum: s.datum, versendetAt: n.versendet_at,
        nachSitzung: r.frist.nachSitzung, fristEingehalten: r.frist.eingehalten, empfaenger: r.empfaenger };
      await record(tx, who, { action: 'protokoll.dispatched', resourceType: 'protokoll', resourceId: n.id, data, event: data });
      return protokollOut(req, tx, (await store.getSitzung(tx, s.id))!, n);
    });
    reply.header('etag', etag(out.version));
    return out;
  });
}
