/**
 * Routen für Zugang entziehen und Neubesetzung (AM.01.01, AM.01.02; UC-016 A1, Fachmodell 5): Vorschau mit Rollen und
 * offenen Aufgaben der Person, Entziehen (Rollen festhalten, dann Mitglied im Baukasten entfernen) und die
 * Neubesetzungen der Administration. Recht `members:admin` wie die Verwaltung der Mitglieder im Baukasten.
 *
 * Schmale Erweiterung des Baukastens: Er entfernt Mitgliedschaft und Tupel (`admin.removeMember`), kennt aber keine
 * Rollen an Orten, die neu zu besetzen sind, und keinen Haken vor dem Entfernen (Folgearbeit fürs Paket, README.md).
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { actorOf, decodeCursor, encodeCursor, forbidden, HttpError, IdempotencyHeaders, IdParams, notFound, type Deps } from '@vollholz/platform';
import { record } from '../../platform.ts';
import * as nb from './neubesetzung.ts';
import {
  Neubesetzung, NeubesetzungDetail, NeubesetzungList, NeubesetzungQuery, ZugangEntzogen, ZugangVorschau,
  type NeubesetzungOut, type OffeneAufgabeOut, type ZugangVorschauOut,
} from './neubesetzung-schemas.ts';

export const TAG_NEUBESETZUNG = 'Neubesetzung';

const PersonParams = Type.Object({ person: Type.String({ format: 'uuid', description: 'Person (Principal) der Organisation.' }) }, { additionalProperties: false });

/** Person mit `members:admin`; Maschinen-Clients verwalten keine Mitglieder (wie im Baukasten). */
async function admin(req: FastifyRequest) {
  const p = req.requirePrincipal();
  await req.need(nb.RECHT);
  if (p.kind !== 'user') throw forbidden('Zugänge entziehen nur Personen.');
  return p;
}

const name = (n: string | null) => n ?? 'Unbekannt';

const aufgabeOut = (a: nb.AufgabeRow): OffeneAufgabeOut =>
  ({ id: a.id, art: a.art, titel: a.titel, kontext: a.kontext, link: a.link, frist: a.frist, fristArt: a.frist_art });

const nbOut = (r: nb.Row): NeubesetzungOut => ({
  id: r.id, person: { id: r.person, name: name(r.person_name) }, entzogenAt: r.entzogen_at!,
  entzogenVon: r.created_by ? { id: r.created_by, name: name(r.created_by_name) } : null,
  rollen: r.rollen, offeneRollen: r.offen, erledigt: r.erledigt,
});

export function registerNeubesetzung(app: FastifyInstance, deps: Deps): void {
  for (const s of [ZugangVorschau, ZugangEntzogen, Neubesetzung, NeubesetzungList, NeubesetzungDetail]) app.addSchema(s);

  app.get('/v1/zugaenge/:person', {
    schema: {
      tags: [TAG_NEUBESETZUNG], summary: 'Zugang: Vorschau vor dem Entziehen', params: PersonParams, response: { 200: Type.Ref('ZugangVorschau') },
      description: 'Was mit dem Zugang entfällt (UC-016 A1): Rollen an der Organisation, Rollen an Projekten, Portfolios und anderen Orten, die neu zu besetzen sind, und offene Aufgaben an die Person. Ändert nichts.',
    },
  }, async (req): Promise<ZugangVorschauOut> => {
    const p = await admin(req);
    const { person: id } = req.params as { person: string };
    return req.tx(async tx => {
      const pers = await nb.person(tx, id);
      if (!pers || pers.entfernt) throw notFound('Person');
      const [org, rollen, aufgaben] = [await nb.orgRollen(tx, id), await nb.rollen(tx, id), await nb.offeneAufgaben(tx, id)];
      return {
        person: { id, name: name(pers.name) },
        orgRollen: org.map(r => ({ rolle: r, rolleName: nb.rolleName(r) })),
        rollen: rollen.map(r => ({ ort: { typ: r.ortTyp, id: r.ortId }, rolle: r.rolle, rolleName: nb.rolleName(r.rolle) })),
        aufgaben: aufgaben.map(aufgabeOut),
        can: { entziehen: id !== p.principalId },
      };
    });
  });

  app.post('/v1/zugaenge/:person/entziehen', {
    schema: {
      tags: [TAG_NEUBESETZUNG], summary: 'Zugang entziehen', headers: IdempotencyHeaders, params: PersonParams, response: { 201: Type.Ref('ZugangEntzogen') },
      description: 'Hält die Rollen der Person an Orten ausser der Organisation fest, entfernt sie dann im Baukasten als Mitglied (Mitgliedschaft und alle Freigaben; Regeln des Baukastens: nicht sich selbst, nicht die letzte Administration) und legt der Administration die Aufgabe «Rollen von ‹Person› neu besetzen» in den Eingang, sofern Rollen oder offene Aufgaben bleiben. Ein abgebrochener Versuch wird beim nächsten Aufruf fortgesetzt.',
    },
  }, async (req, reply) => {
    const p = await admin(req);
    const { person: id } = req.params as { person: string };
    if (id === p.principalId) throw forbidden('Sie können sich den Zugang nicht selbst entziehen.');
    const who = actorOf(req);
    // 1. Rollen festhalten (vor dem Entfernen; danach gibt es keine Tupel mehr)
    const vor = await req.tx(async tx => {
      const pers = await nb.person(tx, id);
      if (!pers) throw notFound('Person');
      const wieder = await nb.laeuft(tx, id);
      if (pers.entfernt && !wieder) throw notFound('Person');
      const svc = deps.iam.admin;
      if (!svc) throw new HttpError(503, 'Verwaltung nicht eingerichtet', 'Die Verwaltung der Mitglieder ist nicht eingerichtet.');
      return { pers, wieder, svc, nb: await nb.vorbereiten(tx, id, pers.entfernt ? [] : await nb.rollen(tx, id)) };
    });
    // 2. Zugang sperren im Baukasten; eigene Transaktion des Pakets mit Sperre, Audit je Tupel und Abgleich mit Keycloak
    try {
      await vor.svc.removeMember({ alias: p.tenantAlias, actor: p, platform: false, source: req.source, correlationId: req.id }, vor.pers.subject);
    } catch (e) {
      // Wiederaufnahme: Beim abgebrochenen Versuch hat der Baukasten die Person schon entfernt
      if (!(vor.wieder && e instanceof HttpError && e.status === 404)) throw e;
    }
    // 3. Neubesetzung abschliessen und Aufgabe der Administration
    const r = await req.tx(async tx => {
      const n = await nb.abschliessen(tx, vor.nb, { id, name: vor.pers.name });
      await record(tx, who, {
        action: 'neubesetzung.created', resourceType: 'neubesetzung', resourceId: vor.nb,
        data: { person: id, ...n }, event: { id: vor.nb, person: id, ...n },
      });
      return n;
    });
    return reply.code(201).header('location', `/v1/neubesetzungen/${vor.nb}`).send({ neubesetzung: vor.nb, ...r });
  });

  app.get('/v1/neubesetzungen', {
    schema: {
      tags: [TAG_NEUBESETZUNG], summary: 'Neubesetzungen', querystring: NeubesetzungQuery, response: { 200: Type.Ref('NeubesetzungList') },
      description: 'Entzogene Zugänge mit der Zahl der festgehaltenen und noch nicht wieder besetzten Rollen, neueste zuerst.',
    },
  }, async req => {
    await admin(req);
    const q = req.query as { offen?: boolean; cursor?: string; limit?: number };
    const limit = q.limit ?? 50;
    const flag = q.offen ? 'offen' : 'alle';
    const nach = decodeCursor<{ c: string; i: string; q: string }>(q.cursor, v => typeof v.c === 'string' && typeof v.i === 'string' && v.q === flag);
    const rows = await req.tx(tx => nb.list(tx, { offen: q.offen, nach: nach ? { t: nach.c, id: nach.i } : null, limit }));
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return { items: page.map(nbOut), nextCursor: rows.length > limit && last ? encodeCursor({ c: last.created_key, i: last.id, q: flag }) : null };
  });

  app.get('/v1/neubesetzungen/:id', {
    schema: {
      tags: [TAG_NEUBESETZUNG], summary: 'Neubesetzung', params: IdParams, response: { 200: Type.Ref('NeubesetzungDetail') },
      description: 'Festgehaltene Rollen mit Stand (wieder besetzt, sobald jemand die Rolle am Ort hat) und offene Aufgaben, die noch an die Person gehen. Neu besetzt wird dort, wo die Rolle vergeben wird (z. B. Projektorganisation); erledigt wird die Aufgabe im Eingang.',
    },
  }, async req => {
    await admin(req);
    const { id } = req.params as { id: string };
    return req.tx(async tx => {
      const r = await nb.get(tx, id);
      if (!r) throw notFound('Neubesetzung');
      return {
        neubesetzung: nbOut(r),
        rollen: (await nb.rollenVon(tx, id)).map(x => ({ ort: { typ: x.ort_typ, id: x.ort_id }, rolle: x.rolle, rolleName: nb.rolleName(x.rolle), besetzt: x.besetzt })),
        aufgaben: (await nb.offeneAufgaben(tx, r.person)).map(aufgabeOut),
      };
    });
  });
}
