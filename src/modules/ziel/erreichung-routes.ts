/**
 * Routen der Zielerreichung je Quartal (BC ZM.03.01; UC-012 Schritte 1–2; Kernablauf K6 Schritt 10) nach dem Muster der
 * Handlungsfelder: Rechte über `req.need`, Lesesicht über `req.tx`, Fähigkeiten `can`, ETag/If-Match (412),
 * Idempotenz (Querschnitt), Audit und Ereignis in derselben Transaktion.
 *
 * Je Ziel (strategisches Ziel oder Jahresziel des Jahres) und Quartal ein Stand mit Kommentar; GL und UE erfassen
 * gemeinsam (`zielerreichung:write`), jeder Stand mit Datum und Person. Das Quartalsreporting (AP-E6-4) liest daraus.
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { actorOf, conflict, etag, IdempotencyHeaders, IfMatchHeaders, invalid, notFound, preconditionFailed, requireIfMatch, type Deps } from '@vollholz/platform';
import { record } from '../../platform.ts';
import {
  EintragParams, QuartalParams, ZielerreichungCreate, ZielerreichungEintrag, ZielerreichungPatch, ZielerreichungQuartal, ZielerreichungZiel,
  type ZielerreichungEintragOut,
} from './erreichung-schemas.ts';
import { nachfuehren } from './erreichung-aufgabe.ts';
import * as store from './erreichung-store.ts';

const TAG = 'Ziele';

const eintragOut = (r: store.EintragRow): ZielerreichungEintragOut => ({
  id: r.id, zielTyp: r.ziel_typ, zielId: r.ziel_id, quartal: r.quartal, stand: r.stand, beurteilung: r.beurteilung,
  erfasstAt: r.erfasst_at, erfasstVon: r.erfasst_by ? { id: r.erfasst_by, name: r.erfasst_name } : null, version: r.version,
});
const snapshot = (r: store.EintragRow) => ({
  id: r.id, zielTyp: r.ziel_typ, zielId: r.ziel_id, quartal: r.quartal, stand: r.stand, beurteilung: r.beurteilung, version: r.version,
});

const jahrVon = (quartal: string) => Number(quartal.slice(0, 4));

export function registerErreichungRoutes(app: FastifyInstance, _deps: Deps): void {
  for (const s of [ZielerreichungEintrag, ZielerreichungZiel, ZielerreichungQuartal, ZielerreichungCreate, ZielerreichungPatch]) app.addSchema(s);

  app.get('/v1/zielerreichung/:quartal', {
    schema: {
      tags: [TAG], summary: 'Zielerreichung eines Quartals', params: QuartalParams, response: { 200: Type.Ref('ZielerreichungQuartal') },
      description: 'Strategische Ziele und die Jahresziele des Jahres mit Metrik, Zielwert, Stand des Quartals und letztem Stand davor; Fortschritt «nachgeführt von gesamt» (UC-012 Schritte 1–2, K6 Schritt 10).',
    },
  }, async req => {
    const { quartal } = req.params as { quartal: string };
    await req.need('ziel:read');
    const jahr = jahrVon(quartal);
    const d = await req.tx(async tx => ({
      ziele: await store.ziele(tx, jahr),
      jetzt: await store.eintraege(tx, quartal),
      vorher: await store.letzteEintraege(tx, quartal),
    }));
    const key = (typ: string, id: string) => `${typ}:${id}`;
    const jetzt = new Map(d.jetzt.map(e => [key(e.ziel_typ, e.ziel_id), e]));
    const vorher = new Map(d.vorher.map(e => [key(e.ziel_typ, e.ziel_id), e]));
    const ziele = d.ziele.map(z => {
      const e = jetzt.get(key(z.typ, z.id));
      const l = vorher.get(key(z.typ, z.id));
      return {
        typ: z.typ, id: z.id, strategischesZielId: z.strategisches_ziel_id, nummer: z.nummer, text: z.text, metrik: z.metrik, zielwert: z.zielwert,
        eintrag: e ? eintragOut(e) : null, letzter: l ? eintragOut(l) : null,
      };
    });
    return {
      quartal, jahr, ziele,
      fortschritt: { nachgefuehrt: ziele.filter(z => z.eintrag).length, gesamt: ziele.length },
      can: { write: await req.can('zielerreichung:write') },
    };
  });

  app.post('/v1/zielerreichung/:quartal', {
    schema: {
      tags: [TAG], summary: 'Stand erfassen', params: QuartalParams, headers: IdempotencyHeaders, body: Type.Ref('ZielerreichungCreate'), response: { 201: Type.Ref('ZielerreichungEintrag') },
      description: 'Stand eines Ziels im Quartal mit Kommentar. Unbekanntes Ziel: 404; Jahresziel eines anderen Jahres: 422; schon erfasst: 409 (dann ändern).',
    },
  }, async (req, reply) => {
    const { quartal } = req.params as { quartal: string };
    await req.need('zielerreichung:write');
    const body = req.body as typeof ZielerreichungCreate.static;
    const who = actorOf(req);
    const row = await req.tx(async tx => {
      const z = await store.ziel(tx, body.zielTyp, body.zielId);
      if (!z) throw notFound(body.zielTyp === 'strategisch' ? 'Strategisches Ziel' : 'Jahresziel');
      if (z.jahr !== null && z.jahr !== jahrVon(quartal)) {
        throw invalid(`Das Jahresziel gehört zum Jahr ${z.jahr}, nicht zu ${quartal}.`, [{ path: '/zielId', message: 'Jahresziel eines anderen Jahres.' }]);
      }
      if (await store.findEintrag(tx, quartal, body.zielTyp, body.zielId)) {
        throw conflict(`Für dieses Ziel ist der Stand ${quartal} schon erfasst.`, { reason: 'erfasst' });
      }
      const r = (await store.getEintrag(tx, quartal, await store.createEintrag(tx, quartal, body)))!;
      await record(tx, who, { action: 'zielerreichung.created', resourceType: 'zielerreichung', resourceId: r.id, data: snapshot(r), event: snapshot(r) });
      // Aufgabe «Zielerreichung erfassen»: Fortschritt nachführen, erledigt mit dem letzten Ziel (fachmodell.md 4.2)
      await nachfuehren(tx, quartal);
      return r;
    });
    return reply.code(201).header('location', `/v1/zielerreichung/${quartal}/${row.id}`).header('etag', etag(row.version)).send(eintragOut(row));
  });

  app.patch('/v1/zielerreichung/:quartal/:id', {
    schema: {
      tags: [TAG], summary: 'Stand ändern', params: EintragParams, headers: IfMatchHeaders, body: Type.Ref('ZielerreichungPatch'), response: { 200: Type.Ref('ZielerreichungEintrag') },
      description: 'Stand oder Kommentar; Datum und Person werden neu gesetzt. Nur mit `If-Match` (412).',
    },
  }, async (req, reply) => {
    const { quartal, id } = req.params as { quartal: string; id: string };
    const version = requireIfMatch(req);
    await req.need('zielerreichung:write');
    const who = actorOf(req);
    const row = await req.tx(async tx => {
      const before = await store.getEintrag(tx, quartal, id);
      if (!before) throw notFound('Stand');
      if (before.version !== version || !(await store.updateEintrag(tx, id, version, req.body as typeof ZielerreichungPatch.static))) {
        throw preconditionFailed(before.version);
      }
      const r = (await store.getEintrag(tx, quartal, id))!;
      await record(tx, who, { action: 'zielerreichung.updated', resourceType: 'zielerreichung', resourceId: id, data: { before: snapshot(before), after: snapshot(r) }, event: snapshot(r) });
      return r;
    });
    reply.header('etag', etag(row.version));
    return eintragOut(row);
  });

  app.delete('/v1/zielerreichung/:quartal/:id', {
    schema: {
      tags: [TAG], summary: 'Stand entfernen', params: EintragParams, headers: IfMatchHeaders, response: { 204: Type.Null({ description: 'Entfernt' }) },
      description: 'Das Ziel gilt im Quartal wieder als nicht nachgeführt. Nur mit `If-Match`.',
    },
  }, async (req, reply) => {
    const { quartal, id } = req.params as { quartal: string; id: string };
    const version = requireIfMatch(req);
    await req.need('zielerreichung:write');
    const who = actorOf(req);
    await req.tx(async tx => {
      const before = await store.getEintrag(tx, quartal, id);
      if (!before) throw notFound('Stand');
      if (before.version !== version || !(await store.removeEintrag(tx, id, version))) throw preconditionFailed(before.version);
      await record(tx, who, { action: 'zielerreichung.deleted', resourceType: 'zielerreichung', resourceId: id, data: snapshot(before), event: { id } });
      await nachfuehren(tx, quartal);
    });
    return reply.code(204).send();
  });
}
