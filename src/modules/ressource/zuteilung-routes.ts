/**
 * Routen der Bedarfsliste, Zuteilung und Konflikte (BC RK.02.02, RK.02.03; UC-009 Schritte 3–4, A1, A2; AP-E7-2) nach dem
 * Muster der Handlungsfelder: Rechte über `req.need` (lesen `ressource:read`, zuteilen `ressource:write`), Lesesicht
 * über `req.tx`, Fähigkeiten `can`, Cursor, ETag/If-Match (412), Idempotenz (Querschnitt), Audit und Ereignis in
 * derselben Transaktion. Zuteilungen einzelner Personen sehen nur RM, UE, die Person selbst und die Projektleitung des
 * Projekts (darstellung.md); das setzt die Lesesicht durch.
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  actorOf, conflict, decodeCursor, encodeCursor, etag, IdempotencyHeaders, IdParams, IfMatchHeaders, invalid, notFound, preconditionFailed,
  requireIfMatch, type Deps,
} from '@vollholz/platform';
import { record } from '../../platform.ts';
import { monate, plusMonate } from './rechnung.ts';
import { TAG } from './routes.ts';
import {
  Bedarf, BedarfDetail, BedarfList, BedarfQuery, Beteiligt, Konflikt, KonfliktList, Luecke, LueckeMelden, PersonBelegung, PersonenList,
  PersonenQuery, Zuteilung, ZuteilungCreate, ZuteilungErgebnis, ZuteilungList, ZuteilungPatch, ZuteilungQuery, type ZuteilungCreateIn,
} from './zuteilung-schemas.ts';
import * as zs from './zuteilung-store.ts';
import { bedarf, bedarfe, fmtFte, informieren, konflikte, konflikteFuer, nachfuehren, protokoll, snapshot, STELLE, type BedarfZeile, type Stand } from './zuteilung.ts';

const kann = async (req: FastifyRequest) => ({ write: await req.can('ressource:write') });

const bedarfOut = (b: BedarfZeile) => ({
  id: b.id, projektId: b.projektId, projekt: b.projekt, phase: b.phase, rolle: b.rolle, fte: b.fte, vonMonat: b.vonMonat, bisMonat: b.bisMonat,
  bemerkung: b.bemerkung, benoetigt: b.benoetigt, zugeteilt: b.zugeteilt, stand: b.stand, prioritaet: b.prioritaet,
  luecke: b.luecke && { text: b.luecke.text, gemeldetAt: b.luecke.gemeldet_at, gemeldetBy: b.luecke.gemeldet_by },
});
const zuteilungOut = (z: zs.ZuteilungRow, write: boolean) => ({
  id: z.id, bedarfId: z.ressourcenbedarf_id, projektId: z.projekt_id, personId: z.person_id, personName: z.person_name, monat: z.monat,
  fte: z.fte, version: z.version, updatedAt: z.updated_at, can: { write },
});

/** Bedarf eines Projekts, das nicht mehr aktiv ist: nur noch lesen und Zuteilungen entfernen (UC-015 Schritt 6, A1.2). */
function nurAktiv(b: BedarfZeile): void {
  if (!b.aktiv) {
    throw conflict('Das Projekt ist nicht mehr aktiv; sein Bedarf zählt nicht mehr. Du kannst bestehende Zuteilungen nur noch entfernen.', { reason: 'lebenszyklus' });
  }
}

/** Reihenfolge der Bedarfsliste: Priorität (ohne zuletzt), Beginn, Projektnummer, Rolle. */
const ordnung = (a: BedarfZeile, b: BedarfZeile) =>
  (a.prioritaet?.rang ?? Infinity) - (b.prioritaet?.rang ?? Infinity) || a.vonMonat.localeCompare(b.vonMonat)
  || (a.projekt?.nummer ?? '').localeCompare(b.projekt?.nummer ?? '') || a.rolle.localeCompare(b.rolle) || a.id.localeCompare(b.id);

/** Laufender Monat und die elf folgenden, wenn kein Zeitraum angegeben ist (wie die Auslastung). */
function zeitraum(q: { von?: string; bis?: string }): { von: string; bis: string } {
  const jetzt = new Date();
  const heute = `${jetzt.getFullYear()}-${String(jetzt.getMonth() + 1).padStart(2, '0')}`;
  const von = q.von ?? (q.bis ? plusMonate(q.bis, -11) : heute);
  const bis = q.bis ?? plusMonate(von, 11);
  if (bis < von) throw invalid('Der Zeitraum endet vor seinem Beginn.', [{ path: '/bis', message: 'nicht vor «von»' }]);
  return { von, bis };
}

export function registerZuteilungRoutes(app: FastifyInstance, _deps: Deps): void {
  for (const s of [Luecke, Bedarf, BedarfList, BedarfDetail, Zuteilung, ZuteilungCreate, ZuteilungPatch, Beteiligt, Konflikt, ZuteilungErgebnis, KonfliktList, ZuteilungList, LueckeMelden, PersonBelegung, PersonenList]) app.addSchema(s);

  app.get('/v1/bedarfe', {
    schema: {
      tags: [TAG], summary: 'Bedarfsliste',
      description: 'Ressourcenbedarf der sichtbaren Projekte in FTE × Monate mit Deckung, Stand, gemeldeter Lücke und Priorität (UC-009 Schritt 3), nach Priorität und Beginn. Bedarf nur als Grösse S/M/L lässt sich nicht zuteilen und fehlt (A-20), ebenso Bedarf von Projekten, die nicht mehr aktiv sind (UC-015 Schritt 6). `von`/`bis` zeigt Bedarfe, die den Zeitraum berühren.',
      querystring: BedarfQuery, response: { 200: Type.Ref('BedarfList') },
    },
  }, async req => {
    await req.need('ressource:read');
    const q = req.query as { stand?: Stand[]; rolle?: string; projekt?: string; von?: string; bis?: string; cursor?: string; limit?: number };
    const limit = q.limit ?? 50;
    const filter = JSON.stringify([q.stand, q.rolle, q.projekt, q.von, q.bis]);
    const offset = decodeCursor<{ o: number; f: string }>(q.cursor, v => typeof v.o === 'number' && Number.isInteger(v.o) && v.f === filter)?.o ?? 0;
    const alle = (await req.tx(tx => bedarfe(tx)))
      .filter(b => (!q.rolle || b.rolle === q.rolle) && (!q.projekt || b.projektId === q.projekt)
        && (!q.von || b.bisMonat >= q.von) && (!q.bis || b.vonMonat <= q.bis))
      .sort(ordnung);
    const anzahl = { offen: 0, teilweise: 0, gedeckt: 0, ungedeckt: 0 };
    for (const b of alle) anzahl[b.stand]++;
    const gefiltert = q.stand?.length ? alle.filter(b => q.stand!.includes(b.stand)) : alle;
    const page = gefiltert.slice(offset, offset + limit);
    return {
      items: page.map(bedarfOut), anzahl, can: await kann(req),
      nextCursor: gefiltert.length > offset + limit ? encodeCursor({ o: offset + limit, f: filter }) : null,
    };
  });

  app.get('/v1/bedarfe/:id', {
    schema: { tags: [TAG], summary: 'Bedarf mit Zuteilungen', description: 'Bedarf, Deckung je Monat und die Zuteilungen der Personen (UC-009 Schritt 3).', params: IdParams, response: { 200: Type.Ref('BedarfDetail') } },
  }, async req => {
    const { id } = req.params as { id: string };
    await req.need('ressource:read');
    const can = await kann(req);
    return req.tx(async tx => {
      const b = await bedarf(tx, id);
      if (!b) throw notFound('Bedarf');
      const zuteilungen = await zs.list(tx, { bedarfIds: [id] });
      const summe = new Map<string, number>();
      for (const z of zuteilungen) summe.set(z.monat, (summe.get(z.monat) ?? 0) + z.fte);
      return {
        bedarf: bedarfOut(b), can, zuteilungen: zuteilungen.map(z => zuteilungOut(z, can.write)),
        monate: monate(b.vonMonat, b.bisMonat).map(m => ({ monat: m, bedarf: b.fte, zugeteilt: Math.round((summe.get(m) ?? 0) * 100) / 100 })),
      };
    });
  });

  app.get('/v1/bedarfe/:id/personen', {
    schema: {
      tags: [TAG], summary: 'Personen mit freier Kapazität',
      description: 'Personen der Organisation mit ihrer Zuteilung und freien Kapazität je Monat des Bedarfs (UC-009 Schritt 3); frei = eine Stelle minus alle Zuteilungen (Beschäftigungsgrad aus dem HR-System offen, RK.01.02).',
      params: IdParams, querystring: PersonenQuery, response: { 200: Type.Ref('PersonBelegungList') },
    },
  }, async req => {
    const { id } = req.params as { id: string };
    await req.need('ressource:write');
    const q = req.query as { q?: string; limit?: number };
    return req.tx(async tx => {
      const b = await bedarf(tx, id);
      if (!b) throw notFound('Bedarf');
      const ms = monate(b.vonMonat, b.bisMonat);
      const personen = await zs.personen(tx, q.q?.trim() || undefined, undefined, q.limit ?? 20);
      const belegung = await zs.belegungJePerson(tx, b.vonMonat, b.bisMonat, personen.map(p => p.id));
      const je = new Map(belegung.map(x => [`${x.person_id}|${x.monat}`, x.fte]));
      return {
        items: personen.map(p => ({
          id: p.id, name: p.name,
          monate: ms.map(m => { const z = je.get(`${p.id}|${m}`) ?? 0; return { monat: m, zugeteilt: z, frei: Math.round((STELLE - z) * 100) / 100 }; }),
        })),
      };
    });
  });

  app.post('/v1/bedarfe/:id/zuteilungen', {
    schema: {
      tags: [TAG], summary: 'Person zuteilen',
      description: 'Teilt eine Person dem Bedarf zu, je Monat mit demselben Anteil (UC-009 Schritt 4); ohne Zeitraum der ganze Bedarf. Bucht die Kapazität, informiert Person und Projektleitung und meldet Überbuchungen als Warnung (UC-009 A1). Monate ausserhalb des Bedarfs: 422; schon zugeteilt oder Projekt nicht mehr aktiv: 409.',
      params: IdParams, headers: IdempotencyHeaders, body: Type.Ref('ZuteilungCreate'), response: { 201: Type.Ref('ZuteilungErgebnis') },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await req.need('ressource:write');
    const body = req.body as ZuteilungCreateIn;
    const who = actorOf(req);
    const ergebnis = await req.tx(async tx => {
      const b = await bedarf(tx, id);
      if (!b) throw notFound('Bedarf');
      nurAktiv(b);
      const von = body.vonMonat ?? b.vonMonat;
      const bis = body.bisMonat ?? b.bisMonat;
      if (von > bis || von < b.vonMonat || bis > b.bisMonat) {
        throw invalid(`Der Zeitraum liegt nicht im Bedarf (${b.vonMonat} bis ${b.bisMonat}).`, [{ path: '/vonMonat', message: `zwischen ${b.vonMonat} und ${b.bisMonat}, von ≤ bis` }]);
      }
      if (!(await zs.personen(tx, undefined, [body.personId], 1)).length) throw invalid('Diese Person gibt es in der Organisation nicht.', [{ path: '/personId', message: 'unbekannt' }]);
      const ms = monate(von, bis);
      try {
        await zs.anlegen(tx, b.id, b.projektId, body.personId, ms, body.fte);
      } catch (e) {
        if (e instanceof zs.Doppelt) throw conflict('Diese Person ist dem Bedarf in mindestens einem dieser Monate schon zugeteilt. Ändere dort den Anteil.', { reason: 'doppelt' });
        throw e;
      }
      const neu = (await zs.list(tx, { bedarfIds: [b.id], personId: body.personId })).filter(z => ms.includes(z.monat));
      for (const z of neu) await protokoll(tx, who, 'zuteilung.created', z.id, snapshot(z), snapshot(z));
      await informieren(tx, b, body.personId, `zugeteilt mit ${fmtFte(body.fte)}`, { von, bis });
      const nach = await nachfuehren(tx, who, b.id);
      return { bedarf: nach, zuteilungen: neu, konflikte: await konflikteFuer(tx, body.personId, b.rolle, ms) };
    });
    return reply.code(201).send({ bedarf: bedarfOut(ergebnis.bedarf), zuteilungen: ergebnis.zuteilungen.map(z => zuteilungOut(z, true)), konflikte: ergebnis.konflikte });
  });

  app.patch('/v1/zuteilungen/:id', {
    schema: {
      tags: [TAG], summary: 'Anteil ändern',
      description: 'Anteil einer Zuteilung ändern, z. B. um einen Konflikt nach Priorität aufzulösen (UC-009 A1.2); nur mit `If-Match`, bei abweichender Version 412; Projekt nicht mehr aktiv: 409. Informiert Person und Projektleitung.',
      params: IdParams, headers: IfMatchHeaders, body: Type.Ref('ZuteilungPatch'), response: { 200: Type.Ref('ZuteilungErgebnis') },
    },
  }, async req => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('ressource:write');
    const { fte } = req.body as { fte: number };
    const who = actorOf(req);
    const e = await req.tx(async tx => {
      const vorher = await zs.get(tx, id);
      if (!vorher) throw notFound('Zuteilung');
      nurAktiv((await bedarf(tx, vorher.ressourcenbedarf_id))!);
      if (vorher.version !== version || !(await zs.aendern(tx, id, version, fte))) throw preconditionFailed(vorher.version);
      const z = (await zs.get(tx, id))!;
      await protokoll(tx, who, 'zuteilung.updated', id, { before: snapshot(vorher), after: snapshot(z) }, snapshot(z));
      const b = (await bedarf(tx, z.ressourcenbedarf_id))!;
      await informieren(tx, b, z.person_id, `Anteil geändert auf ${fmtFte(fte)}`, { von: z.monat, bis: z.monat });
      const nach = await nachfuehren(tx, who, b.id);
      return { bedarf: nach, zuteilungen: [z], konflikte: await konflikteFuer(tx, z.person_id, b.rolle, [z.monat]) };
    });
    return { bedarf: bedarfOut(e.bedarf), zuteilungen: e.zuteilungen.map(z => zuteilungOut(z, true)), konflikte: e.konflikte };
  });

  app.delete('/v1/zuteilungen/:id', {
    schema: {
      tags: [TAG], summary: 'Zuteilung entfernen',
      description: 'Nur mit `If-Match`, auch bei Projekten, die nicht mehr aktiv sind. Informiert Person und Projektleitung (UC-009 A1.2); «gedeckt» wird nachgeführt.',
      params: IdParams, headers: IfMatchHeaders, response: { 204: Type.Null({ description: 'Entfernt' }) },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('ressource:write');
    const who = actorOf(req);
    await req.tx(async tx => {
      const vorher = await zs.get(tx, id);
      if (!vorher) throw notFound('Zuteilung');
      if (vorher.version !== version || !(await zs.entfernen(tx, id, version))) throw preconditionFailed(vorher.version);
      await protokoll(tx, who, 'zuteilung.deleted', id, snapshot(vorher), { id, ressourcenbedarfId: vorher.ressourcenbedarf_id, projektId: vorher.projekt_id });
      const b = (await bedarf(tx, vorher.ressourcenbedarf_id))!;
      await informieren(tx, b, vorher.person_id, 'Zuteilung aufgehoben', { von: vorher.monat, bis: vorher.monat });
      await nachfuehren(tx, who, b.id);
    });
    return reply.code(204).send();
  });

  app.put('/v1/bedarfe/:id/luecke', {
    schema: {
      tags: [TAG], summary: 'Lücke melden',
      description: 'Bedarf nicht deckbar (UC-009 A2.1): markiert den Bedarf als ungedeckt; er erscheint im Dashboard und in der Priorisierung. Ersetzt eine frühere Meldung; bei gedecktem Bedarf oder Projekt, das nicht mehr aktiv ist, 409.',
      params: IdParams, body: Type.Ref('LueckeMelden'), response: { 200: Type.Ref('Bedarf') },
    },
  }, async req => {
    const { id } = req.params as { id: string };
    await req.need('ressource:write');
    const { text } = req.body as { text: string };
    const who = actorOf(req);
    const b = await req.tx(async tx => {
      const b = await bedarf(tx, id);
      if (!b) throw notFound('Bedarf');
      nurAktiv(b);
      if (b.stand === 'gedeckt') throw conflict('Dieser Bedarf ist gedeckt; eine Lücke gibt es nicht.', { reason: 'gedeckt' });
      await zs.lueckeMelden(tx, id, b.projektId, text);
      const daten = { ressourcenbedarfId: id, projektId: b.projektId, rolle: b.rolle, vonMonat: b.vonMonat, bisMonat: b.bisMonat, text: text.trim() };
      await record(tx, who, { action: 'ressourcenbedarf.gap_reported', resourceType: 'ressourcenbedarf', resourceId: id, data: daten, event: daten });
      return nachfuehren(tx, who, id);
    });
    return bedarfOut(b);
  });

  app.delete('/v1/bedarfe/:id/luecke', {
    schema: { tags: [TAG], summary: 'Lücke zurücknehmen', description: 'Die Meldung entfällt; der Bedarf ist wieder offen bzw. teilweise gedeckt.', params: IdParams, response: { 200: Type.Ref('Bedarf') } },
  }, async req => {
    const { id } = req.params as { id: string };
    await req.need('ressource:write');
    const who = actorOf(req);
    const b = await req.tx(async tx => {
      if (!(await bedarf(tx, id))) throw notFound('Bedarf');
      if (await zs.lueckeEntfernen(tx, id)) {
        await record(tx, who, { action: 'ressourcenbedarf.gap_withdrawn', resourceType: 'ressourcenbedarf', resourceId: id, data: { ressourcenbedarfId: id }, event: { ressourcenbedarfId: id } });
      }
      return nachfuehren(tx, who, id);
    });
    return bedarfOut(b);
  });

  app.get('/v1/zuteilungen/konflikte', {
    schema: {
      tags: [TAG], summary: 'Überbuchungen',
      description: 'Personen mit mehr als einer Stelle und Rollen (Pools) mit mehr Zuteilung als Angebot je Monat (UC-009 A1), die beteiligten Projekte nach Priorität. Zuteilungen von Projekten, die nicht mehr aktiv sind, zählen nicht (UC-015 Schritt 6). Ohne Zeitraum der laufende Monat und die elf folgenden.',
      querystring: Type.Object({ von: Type.Optional(Type.String({ pattern: '^[0-9]{4}-(0[1-9]|1[0-2])$' })), bis: Type.Optional(Type.String({ pattern: '^[0-9]{4}-(0[1-9]|1[0-2])$' })) }, { additionalProperties: false }),
      response: { 200: Type.Ref('KonfliktList') },
    },
  }, async req => {
    await req.need('ressource:read');
    const { von, bis } = zeitraum(req.query as { von?: string; bis?: string });
    const items = await req.tx(tx => konflikte(tx, von, bis));
    return { von, bis, items, prioritaetVorhanden: items.some(k => k.beteiligte.some(b => b.prioritaet)), can: await kann(req) };
  });

  app.get('/v1/zuteilungen', {
    schema: {
      tags: [TAG], summary: 'Zuteilungen lesen',
      description: 'Eigene Zuteilungen (`person=ich`, jede Person), die eines Projekts (Projektleitung, RM, UE) oder einer Person (RM, UE); darstellung.md: Zuteilung einzelner Personen nur für RM, UE und die Person selbst, die Projektleitung für das eigene Projekt. Ohne `projekt` fehlen Zuteilungen sichtbarer Projekte, die nicht mehr aktiv sind (UC-015 Schritt 6).',
      querystring: ZuteilungQuery, response: { 200: Type.Ref('ZuteilungList') },
    },
  }, async req => {
    const q = req.query as { person?: string; projekt?: string; von?: string; bis?: string };
    const p = req.requirePrincipal();
    const ich = q.person === 'ich' || q.person === p.principalId;
    if (q.projekt) await req.need('projekt:read', { type: 'projekt', id: q.projekt });
    else if (!ich) await req.need('ressource:read');
    const personId = q.person === 'ich' ? p.principalId : q.person;
    const rows = await req.tx(tx => zs.list(tx, { personId, projektId: q.projekt, von: q.von, bis: q.bis, nurZaehlende: !q.projekt }));
    const write = await req.can('ressource:write');
    return { items: rows.map(z => zuteilungOut(z, write)) };
  });
}
