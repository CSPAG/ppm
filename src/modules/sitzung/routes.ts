/**
 * Routen der Sitzungsvorbereitung (BC PP.04.01, PP.04.05; UC-006 Schritte 1–5, A1, A2; K3) nach dem Muster der
 * Handlungsfelder: Rechte über `req.need` am Portfolio des Gremiums, Lesesicht über `req.tx`, Fähigkeiten `can`, Cursor,
 * ETag/If-Match (412), Audit und Ereignis in derselben Transaktion. Übergänge sind eigene `POST`-Routen.
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  actorOf, conflict, decodeCursor, encodeCursor, etag, IdempotencyHeaders, IdParams, IfMatchHeaders, invalid, notFound,
  preconditionFailed, requireIfMatch, type Deps, type Tx,
} from '@vollholz/platform';
import { record } from '../../platform.ts';
import {
  type TraktandumStandUnterlagen, aufnehmen, bezugVon, einplanen, entfernen, istFest, nachVersand, pruefeReihenfolge, pruefeVorbereitung, sitzungAnlegen, unterlagenFesthalten, unterlagenstand, verschieben, versandfrist,
  versandvorschau, versenden, zeitfenster,
} from './aktionen.ts';
import { ARTEN, artLabel, type Art } from './arten.ts';
import { heute } from './format.ts';
import {
  Einladung, EinladungenPut, KuerzelDatumParams, KuerzelParams, Kopf, NaechsteQuery, NaechsteTraktanden, Reihenfolge, Sitzung, SitzungCreate, SitzungEintrag, SitzungenQuery,
  SitzungList, SitzungPatch, Traktandum, TraktandumCreate, TraktandumPatch, Unterlage, Verschoben, Versandfrist, Versandvorschau, Vorschlaege,
  type EinladungenPutIn, type SitzungOut, type SitzungPatchIn, type TraktandumCreateIn, type TraktandumOut, type TraktandumPatchIn,
} from './schemas.ts';
import * as store from './store.ts';
import { traktandumVermerke } from './vermerk.ts';

export const TAG = 'Sitzungen';

const ort = (portfolioId: string) => ({ type: 'portfolio', id: portfolioId });

/** Darf die Person die Traktandenliste bearbeiten (sitzung:write am Portfolio, nur bis zum Versand)? */
async function kannSchreiben(req: FastifyRequest, s: store.SitzungRow): Promise<boolean> {
  // nach dem Versand bleibt die Traktandenliste bis zum Beginn änderbar, markiert (A-75)
  return (s.stand === 'geplant' || s.stand === 'in_vorbereitung' || s.stand === 'versendet') && await req.can('sitzung:write', ort(s.portfolio_id));
}

async function traktandumOut(tx: Tx, t: store.TraktandumRow, o: { stand: Awaited<ReturnType<typeof unterlagenstand>>; zeit?: Map<string, string | null> }): Promise<TraktandumOut> {
  const u = o.stand.get(t.id) ?? { stand: 'fehlt' as const, unterlagen: [] };
  const einl = t.sitzung_id ? await store.einladungen(tx, { traktandumId: t.id }) : [];
  return {
    id: t.id, sitzungId: t.sitzung_id, art: t.art, artLabel: artLabel(t.art), bezug: { typ: t.bezug_typ, id: t.bezug_id },
    projekt: t.projekt_id && t.projekt_nummer ? { id: t.projekt_id, nummer: t.projekt_nummer, name: t.projekt_name!, phase: t.projekt_phase! } : null,
    titel: t.titel, antrag: t.antrag, position: t.position, dauerMin: t.dauer_min, zeit: o.zeit?.get(t.id) ?? null, stand: t.stand,
    viaSns: t.via_sns, vertraulich: t.vertraulich, fest: istFest(t), verschobenVon: t.verschoben_von_datum, geaendertNachVersand: t.geaendert_nach_versand_at,
    unterlagen: {
      stand: u.stand,
      liste: u.unterlagen.map(x => ({ art: x.art, titel: x.titel, bereit: x.bereit, ...(x.hinweis ? { hinweis: x.hinweis } : {}), ...(x.qualityCheck ? { qualityCheck: x.qualityCheck } : {}) })),
    },
    vermerke: traktandumVermerke(u.stand),
    einladungen: einl.map(e => ({ personId: e.person_id, name: e.name, funktion: e.funktion })),
    version: t.version,
  };
}

async function sitzungOut(req: FastifyRequest, tx: Tx, s: store.SitzungRow): Promise<SitzungOut> {
  const ts = await store.traktanden(tx, s.id);
  const stand = await unterlagenstand(tx, s, ts);
  const zeit = zeitfenster(s, ts);
  // nacheinander: eine Transaktion, eine Verbindung
  const traktanden = [];
  for (const t of ts) traktanden.push(await traktandumOut(tx, t, { stand, zeit }));
  return {
    id: s.id, gremium: { id: s.gremium_id, kuerzel: s.gremium_kuerzel, name: s.gremium_name }, portfolioId: s.portfolio_id,
    datum: s.datum, beginn: s.beginn, dauerMin: s.dauer_min, ort: s.ort, stand: s.stand, geaendertNachVersand: s.geaendert_nach_versand_at, versendetAt: s.versendet_at, versandVorlauf: s.versand_vorlauf,
    frist: await versandfrist(tx, s),
    zeitbedarfMin: ts.reduce((n, t) => n + (t.dauer_min ?? 0), 0),
    traktanden,
    version: s.version, createdAt: s.created_at, updatedAt: s.updated_at,
    can: { write: await kannSchreiben(req, s) },
  };
}

const sitzungSnapshot = (s: store.SitzungRow) => ({ id: s.id, gremiumId: s.gremium_id, portfolioId: s.portfolio_id, datum: s.datum, stand: s.stand, version: s.version });
const traktandumSnapshot = (t: store.TraktandumRow) => ({
  id: t.id, sitzungId: t.sitzung_id, art: t.art, bezug: { typ: t.bezug_typ, id: t.bezug_id }, projektId: t.projekt_id, titel: t.titel,
  position: t.position, dauerMin: t.dauer_min, stand: t.stand, viaSns: t.via_sns, version: t.version,
});

/** Sitzung lesen (Lesesicht) oder 404. Mitglieder und Eingeladene sehen sie nach Versand (Policy in 130_sitzung.sql). */
async function lesen(tx: Tx, id: string): Promise<store.SitzungRow> {
  const s = await store.getSitzung(tx, id);
  if (!s) throw notFound('Sitzung');
  return s;
}

/** Traktandum mit seiner Sitzung (zum Bearbeiten: sitzung:write am Portfolio). */
async function traktandumMitSitzung(req: FastifyRequest, tx: Tx, id: string): Promise<{ t: store.TraktandumRow; s: store.SitzungRow }> {
  const t = await store.getTraktandum(tx, id);
  if (!t) throw notFound('Traktandum');
  await req.need('sitzung:write', ort(t.portfolio_id));
  if (!t.sitzung_id) throw conflict('Das Traktandum ist ein Vorschlag ohne Sitzung. Nimm es zuerst in eine Sitzung auf.');
  return { t, s: await lesen(tx, t.sitzung_id) };
}

/** Datum im Kalender (das Schema prüft nur die Form). */
function pruefeDatum(d: string, path: string): void {
  const t = new Date(`${d}T00:00:00Z`);
  if (Number.isNaN(t.getTime()) || t.toISOString().slice(0, 10) !== d) throw invalid('Das Datum gibt es nicht.', [{ path, message: 'kein gültiges Datum' }]);
}

async function gremiumLesen(tx: Tx, kuerzel: string): Promise<store.GremiumRow> {
  const g = await store.gremiumNachKuerzel(tx, kuerzel);
  if (!g) throw notFound('Gremium');
  return g;
}

export function registerRoutes(app: FastifyInstance, _deps: Deps): void {
  for (const s of [NaechsteTraktanden, Versandfrist, Unterlage, Einladung, Traktandum, Sitzung, SitzungPatch, SitzungEintrag, SitzungList, SitzungCreate, Vorschlaege,
    TraktandumCreate, Reihenfolge, TraktandumPatch, EinladungenPut, Verschoben, Versandvorschau, Kopf]) app.addSchema(s);

  // --- Sitzungen eines Gremiums -------------------------------------------------------------------------------------

  app.get('/v1/gremien/:kuerzel/sitzungen', {
    schema: {
      tags: [TAG], summary: 'Sitzungen eines Gremiums',
      description: 'Geplante Termine und Sitzungen aufsteigend (ohne `von`: ab heute); zu einem Termin ohne Sitzung `id: null`. Cursor-Paginierung.',
      params: KuerzelParams, querystring: SitzungenQuery, response: { 200: Type.Ref('SitzungList') },
    },
  }, async req => {
    const { kuerzel } = req.params as { kuerzel: string };
    const q = req.query as { von?: string; bis?: string; cursor?: string; limit?: number };
    if (q.von) pruefeDatum(q.von, '/von');
    if (q.bis) pruefeDatum(q.bis, '/bis');
    const limit = q.limit ?? 50;
    const after = decodeCursor<{ d: string }>(q.cursor, v => typeof v.d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.d));
    await req.needSomewhere('sitzung:read');
    const g = await req.tx(tx => gremiumLesen(tx, kuerzel));
    await req.need('sitzung:read', ort(g.portfolio_id));
    const von = after ? after.d : (q.von ?? heute());
    const { termine, sitzungen } = await req.tx(async tx => ({
      termine: await store.termine(tx, g.id, { von, bis: q.bis }),
      sitzungen: await store.sitzungenVon(tx, g.id, { von, bis: q.bis }),
    }));
    const byDatum = new Map(sitzungen.map(s => [s.datum, s]));
    const daten = [...new Set([...termine, ...sitzungen.map(s => s.datum)])].filter(d => !after || d > after.d).sort();
    const page = daten.slice(0, limit);
    const items = page.map(d => {
      const s = byDatum.get(d);
      return { datum: d, id: s?.id ?? null, stand: s?.stand ?? 'geplant', traktanden: s?.traktanden ?? 0, versendetAt: s?.versendet_at ?? null };
    });
    const last = page[page.length - 1];
    return {
      gremium: { id: g.id, kuerzel: g.kuerzel, name: g.name }, items,
      nextCursor: daten.length > limit && last ? encodeCursor({ d: last }) : null,
      can: { write: await req.can('sitzung:write', ort(g.portfolio_id)) },
    };
  });

  app.post('/v1/gremien/:kuerzel/sitzungen', {
    schema: {
      tags: [TAG], summary: 'Sitzung zum Termin anlegen',
      description: 'Aus einem geplanten Sitzungstermin des Gremiums (sonst 400); besteht sie schon, 409. Feste Traktanden (Portfoliobericht, UC-006 Schritt 4) stehen sofort darauf.',
      params: KuerzelParams, headers: IdempotencyHeaders, body: Type.Ref('SitzungCreate'), response: { 201: Type.Ref('Sitzung') },
    },
  }, async (req, reply) => {
    const { kuerzel } = req.params as { kuerzel: string };
    const { datum } = req.body as { datum: string };
    pruefeDatum(datum, '/datum');
    await req.needSomewhere('sitzung:write');
    const g = await req.tx(tx => gremiumLesen(tx, kuerzel));
    await req.need('sitzung:write', ort(g.portfolio_id));
    const who = actorOf(req);
    const out = await req.tx(async tx => {
      const s = await sitzungAnlegen(tx, g, datum);
      await record(tx, who, { action: 'sitzung.created', resourceType: 'sitzung', resourceId: s.id, data: sitzungSnapshot(s), event: sitzungSnapshot(s) });
      return sitzungOut(req, tx, s);
    });
    return reply.code(201).header('location', `/v1/sitzungen/${out.id}`).header('etag', etag(out.version)).send(out);
  });

  app.get('/v1/gremien/:kuerzel/sitzungen/:datum', {
    schema: { tags: [TAG], summary: 'Sitzung am Datum lesen', description: 'Adresse der Oberfläche (I-N5); wie `GET /v1/sitzungen/{id}`. 404, solange zum Termin keine Sitzung besteht.', params: KuerzelDatumParams, response: { 200: Type.Ref('Sitzung') } },
  }, async (req, reply) => {
    const { kuerzel, datum } = req.params as { kuerzel: string; datum: string };
    pruefeDatum(datum, '/datum');
    const out = await req.tx(async tx => {
      const g = await gremiumLesen(tx, kuerzel);
      const s = await store.sitzungAm(tx, g.id, datum);
      if (!s) throw notFound('Sitzung');
      return sitzungOut(req, tx, s);
    });
    reply.header('etag', etag(out.version));
    return out;
  });

  // --- Sitzung --------------------------------------------------------------------------------------------------------

  app.get('/v1/traktanden/naechste', {
    schema: {
      tags: [TAG], summary: 'Nächstes Traktandum je Projekt',
      description: 'Kopfkarte «Meine Projekte» im Eingang (informationsarchitektur.md «Startseite je Rolle»: «Gate P1–P2 im PRAT Mi 10.12.», «Du stellst am … vor» nur mit Einladung): je Projekt das nächste traktandierte Geschäft in einer Sitzung ab heute, soweit die Person sie sieht.',
      querystring: NaechsteQuery, response: { 200: Type.Ref('NaechsteTraktanden') },
    },
  }, async req => {
    const ids = [...new Set((req.query as { projektId: string[] }).projektId)];
    await req.needSomewhere('projekt:read');
    const rows = await req.tx(tx => store.naechsteTraktanden(tx, ids, heute()));
    return {
      items: rows.map(r => ({
        projektId: r.projekt_id, traktandumId: r.id, art: r.art, artLabel: artLabel(r.art), titel: r.titel, eingeladen: r.eingeladen,
        sitzung: { id: r.sitzung_id, datum: r.datum, gremium: { id: r.gremium_id, kuerzel: r.gremium_kuerzel, name: r.gremium_name } },
      })),
    };
  });

  app.get('/v1/sitzungen/kopf', {
    schema: { tags: [TAG], summary: 'Kopf im Eingang', description: 'Je Gremium die nächste Sitzung, die die Person sieht (höchstens 5, nach Datum), mit Versandfrist und Stand der Unterlagen (fachmodell.md 4.1).', response: { 200: Type.Ref('SitzungKopf') } },
  }, async req => {
    await req.needSomewhere('sitzung:read');
    const items = await req.tx(async tx => {
      // nacheinander: eine Transaktion, eine Verbindung
      const out = [];
      for (const s of await store.naechsteSitzungen(tx, heute(), 5)) {
        const stand = await unterlagenstand(tx, s, await store.traktanden(tx, s.id));
        out.push({
          id: s.id, gremium: { id: s.gremium_id, kuerzel: s.gremium_kuerzel, name: s.gremium_name }, datum: s.datum, stand: s.stand,
          traktanden: s.traktanden, versandBis: (await versandfrist(tx, s)).bis,
          unterlagenBereit: [...stand.values()].filter(u => u.stand === 'bereit' || u.stand === 'keine').length,
        });
      }
      return out;
    });
    return { sitzungen: items };
  });

  app.get('/v1/sitzungen/:id', {
    schema: { tags: [TAG], summary: 'Sitzung mit Traktandenliste', description: 'Kopf mit Versandfrist und Zeitbedarf, Traktanden mit Unterlagenstand und Einladungen (K3 Schritte 1–3). Mitglieder und Eingeladene ab Versand.', params: IdParams, response: { 200: Type.Ref('Sitzung') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const out = await req.tx(async tx => sitzungOut(req, tx, await lesen(tx, id)));
    reply.header('etag', etag(out.version));
    return out;
  });

  app.patch('/v1/sitzungen/:id', {
    schema: { tags: [TAG], summary: 'Sitzung ändern', description: 'Beginn, Dauer und Ort; nur mit `If-Match`, nicht nach dem Schliessen (409).', params: IdParams, headers: IfMatchHeaders, body: Type.Ref('SitzungPatch'), response: { 200: Type.Ref('Sitzung') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    const body = req.body as SitzungPatchIn;
    const who = actorOf(req);
    const out = await req.tx(async tx => {
      const before = await lesen(tx, id);
      await req.need('sitzung:write', ort(before.portfolio_id));
      if (before.version !== version) throw preconditionFailed(before.version);
      if (before.stand === 'geschlossen' || before.stand === 'protokoll_versendet') throw conflict('Die Sitzung ist geschlossen.');
      if (!(await store.updateSitzung(tx, id, version, body))) throw preconditionFailed(before.version);
      const s = await lesen(tx, id);
      await record(tx, who, { action: 'sitzung.updated', resourceType: 'sitzung', resourceId: id, data: { before: { beginn: before.beginn, dauerMin: before.dauer_min, ort: before.ort }, after: { beginn: s.beginn, dauerMin: s.dauer_min, ort: s.ort } }, event: sitzungSnapshot(s) });
      return sitzungOut(req, tx, s);
    });
    reply.header('etag', etag(out.version));
    return out;
  });

  app.get('/v1/sitzungen/:id/vorschlaege', {
    schema: {
      tags: [TAG], summary: 'Traktandenvorschläge',
      description: 'Vorschläge für die Sitzung, gruppiert nach Art (K3 Schritt 1): Geschäfte der Module für das Gremium und von der letzten Sitzung verschobene Traktanden (UC-006 A2).',
      params: IdParams, response: { 200: Type.Ref('Vorschlaege') },
    },
  }, async req => {
    const { id } = req.params as { id: string };
    return req.tx(async tx => {
      const s = await lesen(tx, id);
      await req.need('sitzung:write', ort(s.portfolio_id));
      const vs = await store.vorschlaege(tx, s);
      // nacheinander: eine Transaktion, eine Verbindung
      const stand = new Map<string, TraktandumStandUnterlagen>();
      for (const t of vs) stand.set(t.id, (await unterlagenstand(tx, { ...s, versendet_at: null }, [t])).get(t.id)!);
      const out: TraktandumOut[] = [];
      for (const t of vs) out.push(await traktandumOut(tx, t, { stand }));
      return {
        gruppen: ARTEN.flatMap(art => {
          const ts = out.filter(t => t.art === art).sort((a, b) => Number(!a.verschobenVon) - Number(!b.verschobenVon));
          return ts.length ? [{ art, label: artLabel(art), traktanden: ts }] : [];
        }),
      };
    });
  });

  app.post('/v1/sitzungen/:id/traktanden', {
    schema: {
      tags: [TAG], summary: 'Traktandum aufnehmen oder einplanen',
      description: 'Mit `vorschlagId` einen Vorschlag aufnehmen; mit `art` (und `projektId`) ein Geschäft einplanen (PP.04.05). Zeitbedarf der Art (Gate-Review 35 Min.), «via SNS-VR» aus dem Gremienweg (UC-006 A1) und Einladungen an Projektleitung und Projektauftraggeber:in werden vorgesetzt (UC-006 Schritt 2). Liefert die Sitzung; nach dem Versand 409.',
      params: IdParams, headers: IdempotencyHeaders, body: Type.Ref('TraktandumCreate'), response: { 200: Type.Ref('Sitzung') },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as TraktandumCreateIn;
    const who = actorOf(req);
    const out = await req.tx(async tx => {
      const s = await lesen(tx, id);
      await req.need('sitzung:write', ort(s.portfolio_id));
      const t = 'vorschlagId' in body
        ? await aufnehmen(tx, s, body.vorschlagId)
        : await einplanen(tx, s, { art: body.art as Art, projektId: body.projektId ?? null, titel: body.titel, antrag: body.antrag });
      await store.touchSitzung(tx, s.id);
      await record(tx, who, { action: 'traktandum.scheduled', resourceType: 'traktandum', resourceId: t.id, data: traktandumSnapshot(t), event: traktandumSnapshot(t) });
      return sitzungOut(req, tx, await lesen(tx, s.id));
    });
    reply.header('etag', etag(out.version));
    return out;
  });

  app.put('/v1/sitzungen/:id/traktanden', {
    schema: {
      tags: [TAG], summary: 'Traktanden ordnen',
      description: 'Neue Reihenfolge aller Traktanden der Sitzung (Ziehen oder Alt+↑/↓, I-M2). Nur mit `If-Match` (Version der Sitzung).',
      params: IdParams, headers: IfMatchHeaders, body: Type.Ref('Reihenfolge'), response: { 200: Type.Ref('Sitzung') },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    const { reihenfolge } = req.body as { reihenfolge: string[] };
    const who = actorOf(req);
    const out = await req.tx(async tx => {
      const s = await lesen(tx, id);
      await req.need('sitzung:write', ort(s.portfolio_id));
      if (s.version !== version) throw preconditionFailed(s.version);
      pruefeVorbereitung(s);
      await nachVersand(tx, s);
      const ts = (await store.traktanden(tx, s.id)).filter(t => t.stand === 'traktandiert');
      const ist = ts.map(t => t.id);
      if (ist.length !== reihenfolge.length || new Set(reihenfolge).size !== reihenfolge.length || !reihenfolge.every(x => ist.includes(x))) {
        throw invalid('Die Reihenfolge muss jedes Traktandum der Sitzung genau einmal enthalten.', [{ path: '/reihenfolge', message: 'nicht vollständig' }]);
      }
      pruefeReihenfolge(ts, reihenfolge);
      await store.ordnen(tx, s.id, reihenfolge);
      if ((await store.touchSitzung(tx, s.id, version)) === null) throw preconditionFailed(s.version);
      await record(tx, who, { action: 'sitzung.reordered', resourceType: 'sitzung', resourceId: s.id, data: { before: ist, after: reihenfolge }, event: { id: s.id, reihenfolge } });
      return sitzungOut(req, tx, await lesen(tx, s.id));
    });
    reply.header('etag', etag(out.version));
    return out;
  });

  app.get('/v1/sitzungen/:id/versand', {
    schema: {
      tags: [TAG], summary: 'Vorschau des Versands',
      description: 'Wirkung von «Unterlagen versenden» (I-R1 Stufe 3): Traktanden, Unterlagen, Eingeladene, Frist (5 Arbeitstage, Q8 Kap. 8.1) und Warnungen (UC-006 A2).',
      params: IdParams, response: { 200: Type.Ref('Versandvorschau') },
    },
  }, async req => {
    const { id } = req.params as { id: string };
    return req.tx(async tx => {
      const s = await lesen(tx, id);
      await req.need('sitzung:write', ort(s.portfolio_id));
      return versandvorschau(tx, s);
    });
  });

  app.post('/v1/sitzungen/:id/versenden', {
    schema: {
      tags: [TAG], summary: 'Unterlagen versenden',
      description: 'Stellt Traktandenliste und Unterlagen den Mitgliedern bereit, lädt die Eingeladenen gebündelt ein, informiert PL und SP verschobener Traktanden und protokolliert den Versand mit Zeitpunkt und Arbeitstagen vor der Sitzung (UC-006 Schritt 5, K3-1). Warnungen sperren nicht. Nur mit `If-Match`; leere Liste oder schon versendet 409.',
      params: IdParams, headers: IfMatchHeaders, response: { 200: Type.Ref('Sitzung') },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    const who = actorOf(req);
    const out = await req.tx(async tx => {
      const s = await lesen(tx, id);
      await req.need('sitzung:write', ort(s.portfolio_id));
      if (s.version !== version) throw preconditionFailed(s.version);
      const v = await versenden(tx, s, version);
      const nachher = await lesen(tx, id);
      const data = { ...sitzungSnapshot(nachher), versendetAt: nachher.versendet_at, vorlauf: nachher.versand_vorlauf, fristEingehalten: v.frist.eingehalten, traktanden: v.traktanden, unterlagen: v.unterlagen, eingeladene: v.eingeladene, warnungen: v.warnungen.length };
      await record(tx, who, { action: 'sitzung.dispatched', resourceType: 'sitzung', resourceId: id, data, event: data });
      return sitzungOut(req, tx, nachher);
    });
    reply.header('etag', etag(out.version));
    return out;
  });

  // --- Traktandum -----------------------------------------------------------------------------------------------------

  app.get('/v1/traktanden/:id', {
    schema: { tags: [TAG], summary: 'Traktandum lesen', description: 'Antrag, Unterlagen und Einladungen (K3 Schritt 6). Mitglieder ab Versand, Eingeladene nur ihr Traktandum.', params: IdParams, response: { 200: Type.Ref('Traktandum') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const out = await req.tx(async tx => {
      const t = await store.getTraktandum(tx, id);
      if (!t) throw notFound('Traktandum');
      const s = t.sitzung_id ? await store.getSitzung(tx, t.sitzung_id) : null;
      const stand = await unterlagenstand(tx, s ?? { id: '', versendet_at: null } as store.SitzungRow, [t]);
      return traktandumOut(tx, t, { stand, zeit: s ? zeitfenster(s, await store.traktanden(tx, s.id)) : undefined });
    });
    reply.header('etag', etag(out.version));
    return out;
  });

  app.patch('/v1/traktanden/:id', {
    schema: { tags: [TAG], summary: 'Traktandum ändern', description: 'Titel, Antrag, Zeitbedarf; nur mit `If-Match` und bis zum Versand.', params: IdParams, headers: IfMatchHeaders, body: Type.Ref('TraktandumPatch'), response: { 200: Type.Ref('Traktandum') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    const body = req.body as TraktandumPatchIn;
    const who = actorOf(req);
    const out = await req.tx(async tx => {
      const { t, s } = await traktandumMitSitzung(req, tx, id);
      if (t.version !== version) throw preconditionFailed(t.version);
      pruefeVorbereitung(s);
      if (!(await store.updateTraktandum(tx, id, version, body))) throw preconditionFailed(t.version);
      await store.touchSitzung(tx, s.id);
      await nachVersand(tx, s, id);
      const n = (await store.getTraktandum(tx, id))!;
      await record(tx, who, { action: 'traktandum.updated', resourceType: 'traktandum', resourceId: id, data: { before: traktandumSnapshot(t), after: traktandumSnapshot(n) }, event: traktandumSnapshot(n) });
      return traktandumOut(tx, n, { stand: await unterlagenstand(tx, s, [n]), zeit: zeitfenster(s, await store.traktanden(tx, s.id)) });
    });
    reply.header('etag', etag(out.version));
    return out;
  });

  app.post('/v1/traktanden/:id/entfernen', {
    schema: { tags: [TAG], summary: 'Aus der Traktandenliste nehmen', description: 'Das Traktandum wird wieder Vorschlag; Einladungen entfallen. Bis zum Versand.', params: IdParams, headers: IdempotencyHeaders, response: { 200: Type.Ref('Sitzung') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const who = actorOf(req);
    const out = await req.tx(async tx => {
      const { t, s } = await traktandumMitSitzung(req, tx, id);
      await entfernen(tx, s, t);
      await store.touchSitzung(tx, s.id);
      await record(tx, who, { action: 'traktandum.unscheduled', resourceType: 'traktandum', resourceId: id, data: traktandumSnapshot(t), event: { id, sitzungId: s.id } });
      return sitzungOut(req, tx, await lesen(tx, s.id));
    });
    reply.header('etag', etag(out.version));
    return out;
  });

  app.post('/v1/traktanden/:id/verschieben', {
    schema: {
      tags: [TAG], summary: 'Auf die nächste Sitzung verschieben',
      description: 'UC-006 A2 (Unterlagen fehlen): auf den nächsten Termin des Gremiums, dort als Vorschlag; PL und SP werden mit dem Versand dieser Sitzung informiert. Rückgängig: in dieser Sitzung wieder aufnehmen. Ohne weiteren Termin 409.',
      params: IdParams, headers: IdempotencyHeaders, response: { 200: Type.Ref('Verschoben') },
    },
  }, async req => {
    const { id } = req.params as { id: string };
    const who = actorOf(req);
    return req.tx(async tx => {
      const { t, s } = await traktandumMitSitzung(req, tx, id);
      const ziel = await verschieben(tx, s, t);
      await store.touchSitzung(tx, s.id);
      const n = (await store.getTraktandum(tx, id))!;
      await record(tx, who, { action: 'traktandum.postponed', resourceType: 'traktandum', resourceId: id, data: { von: s.datum, nach: ziel.datum, ...traktandumSnapshot(n) }, event: { id, von: s.id, nach: ziel.id } });
      return { traktandum: await traktandumOut(tx, n, { stand: await unterlagenstand(tx, ziel, [n]) }), nach: { id: ziel.id, datum: ziel.datum } };
    });
  });

  app.post('/v1/traktanden/:id/unterlagen-nachfuehren', {
    schema: {
      tags: [TAG], summary: 'Unterlagen nach dem Versand nachführen', params: IdParams, headers: IfMatchHeaders, response: { 200: Type.Ref('Traktandum') },
      description: 'Nach dem Versand (A-75, K3): hält die Unterlagen des Traktandums neu fest (z. B. nach dem Quality-Check oder einer Änderung am Vertrag); Traktandum und Sitzung tragen «geändert nach Versand», die frühere Fassung steht im Verlauf. Nur «versendet»; `If-Match` = Version des Traktandums.',
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    const who = actorOf(req);
    const out = await req.tx(async tx => {
      const { t, s } = await traktandumMitSitzung(req, tx, id);
      if (t.version !== version) throw preconditionFailed(t.version);
      if (s.stand !== 'versendet') throw conflict('Nachführen ist nach dem Versand und vor dem Beginn der Sitzung möglich; vorher gelten die aktuellen Unterlagen.', { reason: 'stand', stand: s.stand });
      const vorher = (await store.unterlagenGespeichert(tx, s.id)).filter(u => u.traktandum_id === id).map(u => ({ art: u.art, titel: u.titel, standOk: u.stand_ok, hinweis: u.hinweis }));
      await unterlagenFesthalten(tx, t);
      if (!(await store.updateTraktandum(tx, id, version, {}))) throw preconditionFailed(t.version);
      await nachVersand(tx, s, id);
      const n = (await store.getTraktandum(tx, id))!;
      const nachher = (await store.unterlagenGespeichert(tx, s.id)).filter(u => u.traktandum_id === id).map(u => ({ art: u.art, titel: u.titel, standOk: u.stand_ok, hinweis: u.hinweis }));
      await record(tx, who, { action: 'traktandum.amended', resourceType: 'traktandum', resourceId: id, data: { nach: 'versand', unterlagen: { before: vorher, after: nachher } }, event: { id, nach: 'versand' } });
      return traktandumOut(tx, n, { stand: await unterlagenstand(tx, s, [n]), zeit: zeitfenster(s, await store.traktanden(tx, s.id)) });
    });
    reply.header('etag', etag(out.version));
    return out;
  });

  app.put('/v1/traktanden/:id/einladungen', {
    schema: {
      tags: [TAG], summary: 'Eingeladene festlegen',
      description: 'Ersetzt die Eingeladenen des Traktandums (vorgesetzt Projektleitung und Projektauftraggeber:in, UC-006 Schritt 2). Die Einladung geht mit dem Versand (I-B3). Nur mit `If-Match` (Version des Traktandums), bis zum Versand.',
      params: IdParams, headers: IfMatchHeaders, body: Type.Ref('EinladungenPut'), response: { 200: Type.Ref('Traktandum') },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    const body = req.body as EinladungenPutIn;
    const who = actorOf(req);
    const out = await req.tx(async tx => {
      const { t, s } = await traktandumMitSitzung(req, tx, id);
      if (t.version !== version) throw preconditionFailed(t.version);
      pruefeVorbereitung(s);
      if (t.stand !== 'traktandiert') throw conflict('Eingeladen wird nur zu traktandierten Geschäften.');
      const unbekannt: number[] = [];
      for (const [i, e] of body.einladungen.entries()) if (!(await store.personBekannt(tx, e.personId))) unbekannt.push(i);
      if (unbekannt.length) throw invalid('Nicht jede Person gehört zur Organisation.', unbekannt.map(i => ({ path: `/einladungen/${i}/personId`, message: 'unbekannte Person' })));
      const vorher = await store.einladungen(tx, { traktandumId: id });
      await store.einladungenSetzen(tx, { id, sitzung_id: s.id, portfolio_id: t.portfolio_id }, body.einladungen);
      if (!(await store.updateTraktandum(tx, id, version, {}))) throw preconditionFailed(t.version);
      await store.touchSitzung(tx, s.id);
      await nachVersand(tx, s, id);
      const n = (await store.getTraktandum(tx, id))!;
      await record(tx, who, {
        action: 'traktandum.invitations_changed', resourceType: 'traktandum', resourceId: id,
        data: { before: vorher.map(e => ({ personId: e.person_id, funktion: e.funktion })), after: body.einladungen }, event: { id, einladungen: body.einladungen.length },
      });
      return traktandumOut(tx, n, { stand: await unterlagenstand(tx, s, [n]), zeit: zeitfenster(s, await store.traktanden(tx, s.id)) });
    });
    reply.header('etag', etag(out.version));
    return out;
  });
}
