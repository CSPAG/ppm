/**
 * Routen des Eingangs (Fachmodell 5): «Zu tun», Zähler, Mitteilungen und Stellvertretungen der angemeldeten Person.
 * Alle Personen der Organisation haben einen Eingang (UX-E3, IA: Eingang für jede Rolle ●); geprüft wird `tenant:read`,
 * das jede Rolle enthält (Fachmodell 3.3). Was sichtbar ist, entscheidet die Lesesicht.
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  actorOf, conflict, decodeCursor, encodeCursor, forbidden, IdempotencyHeaders, IdParams, invalid, notFound, type Deps,
} from '@vollholz/platform';
import { enqueue, record } from '../../platform.ts';
import {
  Aufgabe, AufgabeAnzahl, AufgabeList, AufgabeQuery, Mitteilung, MitteilungList, MitteilungQuery, Stellvertretung, StellvertretungCreate,
  StellvertretungList, type AufgabeOut, type MitteilungOut, type StellvertretungCreateIn, type StellvertretungOut,
} from './schemas.ts';
import { mitteilung } from './aufgabe.ts';
import * as stv from './stellvertretung.ts';
import * as store from './store.ts';

export const TAG_EINGANG = 'Eingang';
export const TAG_MITTEILUNGEN = 'Mitteilungen';
export const TAG_STELLVERTRETUNGEN = 'Stellvertretungen';

/**
 * Recht, das jede Rolle enthält (Fachmodell 3.3): Eingang, Mitteilungen und Stellvertretung hat jede Person mit einer
 * Rolle irgendwo – auch, wer nur eine Projektrolle hat (UC-016 Schritt 4).
 */
const JEDE_PERSON = 'tenant:read';

type Person = (req: FastifyRequest) => Promise<string>;

/** Angemeldete Person mit einer Rolle in der Organisation; Maschinen-Clients haben keinen Eingang. */
const personOf = (deps: Deps): Person => async req => {
  const p = req.requirePrincipal();
  if (!(await deps.iam.access.canSomewhere(p, JEDE_PERSON))) throw forbidden('Für den Eingang fehlt eine Rolle in dieser Organisation.');
  if (p.kind !== 'user') throw forbidden('Der Eingang gehört einer Person; Maschinen-Clients haben keinen.');
  return p.principalId;
};

function aufgabeOut(r: store.AufgabeRow): AufgabeOut {
  return {
    id: r.id, art: r.art, titel: r.titel, kontext: r.kontext, link: r.link, frist: r.frist, fristArt: r.frist_art,
    bezug: { typ: r.bezug_typ, id: r.bezug_id },
    empfaenger: r.empfaenger_person ? 'person' : 'recht',
    vertretung: r.vertretung_person ? { person: { id: r.vertretung_person, name: r.vertretung_name ?? 'Unbekannt' }, bis: r.vertretung_bis! } : null,
    createdAt: r.created_at,
    can: { erledigen: r.manuell },
  };
}

const mitteilungOut = (r: store.MitteilungRow): MitteilungOut => ({
  id: r.id, text: r.text, link: r.link, bezug: { typ: r.bezug_typ, id: r.bezug_id }, gelesenAt: r.gelesen_at, createdAt: r.created_at,
});

function stvOut(r: stv.Row, me: string): StellvertretungOut {
  const eigene = r.vertretene_person === me;
  return {
    id: r.id,
    vertretene: { id: r.vertretene_person, name: r.vertretene_name ?? 'Unbekannt' },
    vertreter: { id: r.vertreter_person, name: r.vertreter_name ?? 'Unbekannt' },
    von: r.von, bis: r.bis, unterschriften: r.unterschriften, aktiv: r.aktiv,
    richtung: eigene ? 'eigene' : 'fuer_andere',
    createdAt: r.created_at,
    can: { beenden: eigene },
  };
}

const stvSnapshot = (r: { id: string; vertretene_person: string; vertreter_person: string; von: string; bis: string; unterschriften: boolean }) =>
  ({ id: r.id, vertretenePerson: r.vertretene_person, vertreterPerson: r.vertreter_person, von: r.von, bis: r.bis, unterschriften: r.unterschriften });

/** Datum für Texte (de-CH, «3.11.2026»). */
const datum = (iso: string) => { const [y, m, d] = iso.split('-'); return `${Number(d)}.${Number(m)}.${y}`; };

/** Kalendertag in Europe/Zurich (YYYY-MM-DD). */
const heute = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(new Date());

export function registerRoutes(app: FastifyInstance, deps: Deps): void {
  const person = personOf(deps);
  for (const s of [Aufgabe, AufgabeList, AufgabeAnzahl, Mitteilung, MitteilungList, Stellvertretung, StellvertretungList, StellvertretungCreate]) app.addSchema(s);

  // ---- Aufgaben («Zu tun», BC AM.01.03, UX-E3)

  app.get('/v1/eingang', {
    schema: {
      tags: [TAG_EINGANG], summary: 'Offene Aufgaben («Zu tun»)', querystring: AufgabeQuery, response: { 200: Type.Ref('AufgabeList') },
      description: 'Alle offenen Aufgaben der Person aus allen Rollen, nach Frist (ohne Frist zuletzt), dann nach Eingang; auch Aufgaben von Personen, die sie heute vertritt (mit `vertretung`). Cursor-Paginierung.',
    },
  }, async req => {
    const me = await person(req);
    const q = req.query as { filter?: 'frist'; cursor?: string; limit?: number };
    const limit = q.limit ?? 50;
    const filter = q.filter ?? '';
    const after = decodeCursor<{ f: string; c: string; i: string; q: string }>(q.cursor,
      v => typeof v.f === 'string' && typeof v.c === 'string' && typeof v.i === 'string' && v.q === filter);
    const rows = await req.tx(tx => store.aufgaben(tx, me, { nurFrist: filter === 'frist', after, limit }));
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return { items: page.map(aufgabeOut), nextCursor: rows.length > limit && last ? encodeCursor({ ...store.aufgabeKey(last), q: filter }) : null };
  });

  app.get('/v1/eingang/anzahl', {
    schema: { tags: [TAG_EINGANG], summary: 'Anzahl offener Aufgaben', description: 'Für den Zähler an «Eingang» (I-N3) und den Kopf des Eingangs.', response: { 200: Type.Ref('AufgabeAnzahl') } },
  }, async req => {
    await person(req);
    const r = await req.tx(tx => store.anzahl(tx));
    return { offen: r.offen, ueberfaellig: r.ueberfaellig, naechsteFrist: r.naechste_frist };
  });

  app.post('/v1/eingang/aufgaben/:id/erledigen', {
    schema: {
      tags: [TAG_EINGANG], summary: 'Aufgabe von Hand erledigen', params: IdParams, headers: IdempotencyHeaders, response: { 200: Type.Ref('Aufgabe') },
      description: 'Nur Aufgaben ohne fachlichen Übergang (`can.erledigen`); alle anderen schliesst die Handlung selbst (z. B. Einreichen). Sonst 409.',
    },
  }, async req => {
    const { id } = req.params as { id: string };
    const me = await person(req);
    const who = actorOf(req);
    return req.tx(async tx => {
      const r = await store.aufgabe(tx, me, id);
      if (!r) throw notFound('Aufgabe');
      if (!r.manuell) throw conflict('Diese Aufgabe schliesst die Handlung selbst. Öffne sie über den Link.');
      await store.erledigen(tx, id);
      await record(tx, who, { action: 'aufgabe.completed', resourceType: 'aufgabe', resourceId: id, data: { art: r.art, bezug: { typ: r.bezug_typ, id: r.bezug_id } }, event: { id, art: r.art } });
      return { ...aufgabeOut(r), can: { erledigen: false } };
    });
  });

  // ---- Mitteilungen

  app.get('/v1/mitteilungen', {
    schema: { tags: [TAG_MITTEILUNGEN], summary: 'Mitteilungen', description: 'Mitteilungen an die Person, neueste zuerst, mit Anzahl ungelesener.', querystring: MitteilungQuery, response: { 200: Type.Ref('MitteilungList') } },
  }, async req => {
    await person(req);
    const q = req.query as { ungelesen?: boolean; cursor?: string; limit?: number };
    const limit = q.limit ?? 50;
    const flag = q.ungelesen ? 'u' : '';
    const after = decodeCursor<{ c: string; i: string; q: string }>(q.cursor, v => typeof v.c === 'string' && typeof v.i === 'string' && v.q === flag);
    const { rows, n } = await req.tx(async tx => ({ rows: await store.mitteilungen(tx, { ungelesen: !!q.ungelesen, after, limit }), n: await store.ungelesen(tx) }));
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      items: page.map(mitteilungOut),
      nextCursor: rows.length > limit && last ? encodeCursor({ c: last.created_key, i: last.id, q: flag }) : null,
      ungelesen: n,
    };
  });

  app.post('/v1/mitteilungen/:id/gelesen', {
    schema: { tags: [TAG_MITTEILUNGEN], summary: 'Mitteilung als gelesen markieren', description: 'Idempotent.', params: IdParams, headers: IdempotencyHeaders, response: { 204: Type.Null({ description: 'Gelesen' }) } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await person(req);
    if (!(await req.tx(tx => store.gelesen(tx, id)))) throw notFound('Mitteilung');
    return reply.code(204).send();
  });

  // ---- Stellvertretungen (UC-016 Schritt 4, Fachmodell 4.3)

  app.get('/v1/stellvertretungen', {
    schema: { tags: [TAG_STELLVERTRETUNGEN], summary: 'Stellvertretungen', description: 'Laufende und künftige Stellvertretungen: wer dich vertritt und wen du vertrittst.', response: { 200: Type.Ref('StellvertretungList') } },
  }, async req => {
    const me = await person(req);
    const rows = await req.tx(tx => stv.list(tx, me));
    return { items: rows.map(r => stvOut(r, me)) };
  });

  app.post('/v1/stellvertretungen', {
    schema: {
      tags: [TAG_STELLVERTRETUNGEN], summary: 'Stellvertretung erfassen', headers: IdempotencyHeaders, body: Type.Ref('StellvertretungCreate'), response: { 201: Type.Ref('Stellvertretung') },
      description: 'Für die angemeldete Person. Im Zeitraum sieht die Vertretung deren Aufgaben und erhält befristet deren Rollen an Portfolios und Projekten; Unterschriften nur, wenn ausdrücklich erteilt (A-31). Die Vertretung erhält eine Mitteilung.',
    },
  }, async (req, reply) => {
    const me = await person(req);
    const body = req.body as StellvertretungCreateIn;
    const who = actorOf(req);
    if (body.vertreter === me) throw invalid('Du kannst dich nicht selbst vertreten.', [{ path: '/vertreter', message: 'Wähle eine andere Person.' }]);
    if (body.bis < body.von) throw invalid('Der Zeitraum endet vor seinem Beginn.', [{ path: '/bis', message: 'Bis muss am oder nach Von liegen.' }]);
    if (body.bis < heute()) throw invalid('Der Zeitraum liegt in der Vergangenheit.', [{ path: '/bis', message: 'Bis muss heute oder später sein.' }]);
    const row = await req.tx(async tx => {
      if (!(await stv.personBekannt(tx, body.vertreter))) throw invalid('Diese Person ist in der Organisation nicht bekannt.', [{ path: '/vertreter', message: 'Person aus dem Verzeichnis wählen.' }]);
      const { id, sofort } = await stv.create(tx, { vertretene: me, vertreter: body.vertreter, von: body.von, bis: body.bis, unterschriften: body.unterschriften ?? false });
      if (sofort) await stv.aktivieren(tx, id, who);
      else await enqueue(tx, stv.AKTIVIEREN, { id }, { runAt: await stv.beginn(tx, body.von), dedupeKey: `stellvertretung:${id}` });
      const r = (await stv.get(tx, id))!;
      await mitteilung.senden(tx, {
        an: body.vertreter, bezug: { typ: 'stellvertretung', id },
        text: `${r.vertretene_name ?? 'Eine Person'} hat dich als Stellvertretung erfasst: ${datum(r.von)} bis ${datum(r.bis)}${r.unterschriften ? ', mit Unterschriften' : ''}.`,
        link: '/konto/stellvertretung',
      });
      await record(tx, who, { action: 'stellvertretung.created', resourceType: 'stellvertretung', resourceId: id, data: { ...stvSnapshot(r), tupel: r.tupel.length }, event: stvSnapshot(r) });
      return r;
    });
    return reply.code(201).header('location', '/v1/stellvertretungen').send(stvOut(row, me));
  });

  app.delete('/v1/stellvertretungen/:id', {
    schema: { tags: [TAG_STELLVERTRETUNGEN], summary: 'Stellvertretung beenden', description: 'Nur die vertretene Person; die befristeten Rollen der Vertretung entfallen sofort.', params: IdParams, response: { 204: Type.Null({ description: 'Beendet' }) } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const me = await person(req);
    const who = actorOf(req);
    await req.tx(async tx => {
      const r = await stv.get(tx, id);
      if (!r || r.vertretene_person !== me) throw notFound('Stellvertretung');
      await stv.remove(tx, r, who);
      await record(tx, who, { action: 'stellvertretung.deleted', resourceType: 'stellvertretung', resourceId: id, data: stvSnapshot(r), event: { id } });
    });
    return reply.code(204).send();
  });
}
