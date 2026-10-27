/**
 * Routen des Sitzungsmodus (BC PP.04.02, PS.02.02; UC-006 Schritte 6–8, A1, A3, A4; K3 Schritte 7–9; AP-E2-2) nach dem
 * Muster der Handlungsfelder: Rechte über `req.need` am Portfolio des Gremiums, Lesesicht über `req.tx`, Fähigkeiten
 * `can`, Cursor, ETag/If-Match (412), Audit und Ereignis in derselben Transaktion. Übergänge sind eigene `POST`-Routen.
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  actorOf, conflict, decodeCursor, encodeCursor, etag, IdempotencyHeaders, IdParams, IfMatchHeaders, notFound, preconditionFailed,
  requireIfMatch, type Deps, type Tx,
} from '@vollholz/platform';
import { record } from '../../platform.ts';
import { stellvertretung } from '../eingang/index.ts';
import { artLabel } from './arten.ts';
import { auflageErfuellen, ergebnisLabel, erfassen, ohneEntscheid, optionen, schliessen, snsNachtragen, starten } from './entscheid.ts';
import {
  Auflage, AuflageParams, Entscheid, EntscheidEintrag, EntscheidList, EntscheidPut, EntscheidQuery, Ergebnis, Geschlossen, Sitzungsmodus, SnsPut,
  type AuflageOut, type EntscheidEintragOut, type EntscheidOut, type EntscheidPutIn, type SitzungsmodusOut,
} from './entscheid-schemas.ts';
import * as es from './entscheid-store.ts';
import { TAG } from './routes.ts';
import * as store from './store.ts';

const ort = (portfolioId: string) => ({ type: 'portfolio', id: portfolioId });

async function sitzungLesen(tx: Tx, id: string): Promise<store.SitzungRow> {
  const s = await store.getSitzung(tx, id);
  if (!s) throw notFound('Sitzung');
  return s;
}

/** Traktandum mit Sitzung; Bearbeiten nur mit sitzung:write am Portfolio. */
async function traktandumLesen(req: FastifyRequest, tx: Tx, id: string): Promise<{ t: store.TraktandumRow; s: store.SitzungRow }> {
  const t = await store.getTraktandum(tx, id);
  if (!t) throw notFound('Traktandum');
  await req.need('sitzung:write', ort(t.portfolio_id));
  if (!t.sitzung_id) throw conflict('Das Traktandum ist ein Vorschlag ohne Sitzung.');
  return { t, s: await sitzungLesen(tx, t.sitzung_id) };
}

/** Darf die Person die Auflage erledigt melden? Verantwortliche Person, ihre Vertretung (fachmodell.md 4.3) oder sitzung:write. */
async function darfErfuellen(req: FastifyRequest, tx: Tx, a: es.AuflageRow): Promise<boolean> {
  if (a.stand !== 'offen') return false;
  const ich = req.requirePrincipal().principalId;
  if (a.verantwortlich === ich) return true;
  if (await stellvertretung.aktiv(tx, { vertretene: a.verantwortlich, vertreter: ich })) return true;
  return a.portfolio_id ? req.can('sitzung:write', ort(a.portfolio_id)) : false;
}

async function auflagenOut(req: FastifyRequest, tx: Tx, rows: readonly es.AuflageRow[]): Promise<AuflageOut[]> {
  const out: AuflageOut[] = [];
  for (const a of rows) {
    out.push({
      id: a.id, entscheidId: a.entscheid_id, text: a.text, verantwortlich: { id: a.verantwortlich, name: a.verantwortlich_name },
      termin: a.termin, stand: a.stand, erfuelltAt: a.erfuellt_at, can: { erfuellen: await darfErfuellen(req, tx, a) },
    });
  }
  return out;
}

function entscheidFelder(t: Pick<store.TraktandumRow, 'art'>, e: es.EntscheidRow, auflagen: AuflageOut[]) {
  return {
    id: e.id, traktandumId: e.traktandum_id, sitzungId: e.sitzung_id, ergebnis: e.ergebnis, label: ergebnisLabel(t.art, e.ergebnis),
    begruendung: e.begruendung, stellungnahme: e.stellungnahme, anVr: e.an_vr,
    sns: e.sns_ergebnis && e.sns_erfasst_at ? { ergebnis: e.sns_ergebnis, label: ergebnisLabel(t.art, e.sns_ergebnis), begruendung: e.sns_begruendung ?? '', erfasstAt: e.sns_erfasst_at } : null,
    erfasstAt: e.erfasst_at, erfasstVon: e.erfasst_von, auflagen, version: e.version,
  };
}

async function entscheidOut(req: FastifyRequest, tx: Tx, s: store.SitzungRow, t: store.TraktandumRow, e: es.EntscheidRow): Promise<EntscheidOut> {
  const schreiben = await req.can('sitzung:write', ort(s.portfolio_id));
  const geschlossen = s.stand === 'geschlossen' || s.stand === 'protokoll_versendet';
  return {
    ...entscheidFelder(t, e, await auflagenOut(req, tx, await es.auflagen(tx, [e.id]))),
    verlauf: (await es.verlauf(tx, e.id)).map(v => ({
      version: v.version, ergebnis: v.ergebnis, label: ergebnisLabel(t.art, v.ergebnis), begruendung: v.begruendung, anVr: v.an_vr,
      snsErgebnis: v.sns_ergebnis, at: v.changed_at, von: v.changed_von,
    })),
    can: { korrigieren: schreiben && s.stand === 'laufend', snsErfassen: schreiben && geschlossen && e.stellungnahme && !e.sns_ergebnis },
  };
}

async function sitzungsmodusOut(req: FastifyRequest, tx: Tx, s: store.SitzungRow): Promise<SitzungsmodusOut> {
  const ts = await store.traktanden(tx, s.id);
  const ent = await es.entscheideDerSitzung(tx, s.id);
  const schreiben = await req.can('sitzung:write', ort(s.portfolio_id));
  const out: SitzungsmodusOut = {
    sitzungId: s.id, gremium: { kuerzel: s.gremium_kuerzel, name: s.gremium_name }, datum: s.datum, stand: s.stand, geschlossenAt: s.geschlossen_at, version: s.version,
    traktanden: [],
    ohneEntscheid: s.stand === 'laufend' || s.stand === 'versendet' ? (await ohneEntscheid(tx, s)).length : 0,
    can: { starten: schreiben && s.stand === 'versendet', erfassen: schreiben && s.stand === 'laufend', schliessen: schreiben && s.stand === 'laufend' },
  };
  // nacheinander: eine Transaktion, eine Verbindung
  for (const t of ts) {
    const e = ent.get(t.id);
    out.traktanden.push({
      traktandumId: t.id, position: t.position, art: t.art, artLabel: artLabel(t.art), titel: t.titel, antrag: t.antrag,
              projekt: t.projekt_id && t.projekt_nummer ? { id: t.projekt_id, nummer: t.projekt_nummer, name: t.projekt_name ?? '' } : null,
        viaSns: t.via_sns, vertraulich: t.vertraulich, optionen: [...optionen(t.art)],
        entscheid: e ? await entscheidOut(req, tx, s, t, e) : null,
    });
  }
  return out;
}

const entscheidSnapshot = (t: store.TraktandumRow, e: es.EntscheidRow, auflagen: number) => ({
  id: e.id, traktandumId: t.id, sitzungId: e.sitzung_id, art: t.art, bezug: { typ: t.bezug_typ, id: t.bezug_id }, projektId: t.projekt_id,
  ergebnis: e.ergebnis, stellungnahme: e.stellungnahme, anVr: e.an_vr, snsErgebnis: e.sns_ergebnis, auflagen, version: e.version,
});

export function registerEntscheidRoutes(app: FastifyInstance, _deps: Deps): void {
  for (const s of [Ergebnis, Auflage, Entscheid, EntscheidPut, SnsPut, Sitzungsmodus, Geschlossen, EntscheidEintrag, EntscheidList]) app.addSchema(s);

  // --- Sitzungsmodus ----------------------------------------------------------------------------------------------

  app.get('/v1/sitzungen/:id/entscheide', {
    schema: {
      tags: [TAG], summary: 'Sitzungsmodus: Traktanden mit Entscheiden',
      description: 'Je Traktandum Antrag, Optionen der Art (K3 Schritt 8) und erfasster Entscheid mit Auflagen und Verlauf; Zahl der Traktanden ohne Entscheid für «Sitzung schliessen». Mitglieder ab Versand.',
      params: IdParams, response: { 200: Type.Ref('Sitzungsmodus') },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const out = await req.tx(async tx => sitzungsmodusOut(req, tx, await sitzungLesen(tx, id)));
    reply.header('etag', etag(out.version));
    return out;
  });

  app.post('/v1/sitzungen/:id/starten', {
    schema: {
      tags: [TAG], summary: 'Sitzung starten',
      description: 'Schaltet in den Sitzungsmodus (K3 Schritt 7); erst danach lassen sich Entscheide erfassen. Nur nach dem Versand der Unterlagen und mit `If-Match`.',
      params: IdParams, headers: IfMatchHeaders, response: { 200: Type.Ref('Sitzungsmodus') },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    const who = actorOf(req);
    const out = await req.tx(async tx => {
      const s = await sitzungLesen(tx, id);
      await req.need('sitzung:write', ort(s.portfolio_id));
      if (s.version !== version) throw preconditionFailed(s.version);
      const vorher = s.stand;
      await starten(tx, s, version);
      const n = await sitzungLesen(tx, id);
      if (vorher !== n.stand) {
        const data = { id, gremiumId: n.gremium_id, portfolioId: n.portfolio_id, datum: n.datum, stand: n.stand };
        await record(tx, who, { action: 'sitzung.started', resourceType: 'sitzung', resourceId: id, data, event: data });
      }
      return sitzungsmodusOut(req, tx, n);
    });
    reply.header('etag', etag(out.version));
    return out;
  });

  app.post('/v1/sitzungen/:id/schliessen', {
    schema: {
      tags: [TAG], summary: 'Sitzung schliessen',
      description: 'UC-006 Schritt 8: erzeugt den Protokollentwurf, schlägt Traktanden ohne Entscheid und zurückgestellte Geschäfte für die nächste Sitzung vor, legt Auflagen als Aufgaben in den Eingang der Verantwortlichen, öffnet «Protokoll versenden» (3 Arbeitstage) und benachrichtigt PL, SP und Verantwortliche gebündelt je Person (I-B3). Danach sind die Entscheide fest (A-30). Nur mit `If-Match`.',
      params: IdParams, headers: IfMatchHeaders, response: { 200: Type.Ref('SitzungGeschlossen') },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    const who = actorOf(req);
    const out = await req.tx(async tx => {
      const s = await sitzungLesen(tx, id);
      await req.need('sitzung:write', ort(s.portfolio_id));
      if (s.version !== version) throw preconditionFailed(s.version);
      const r = await schliessen(tx, s, version);
      const n = await sitzungLesen(tx, id);
      const data = { id, gremiumId: n.gremium_id, portfolioId: n.portfolio_id, datum: n.datum, stand: n.stand, geschlossenAt: n.geschlossen_at, ...r };
      await record(tx, who, { action: 'sitzung.closed', resourceType: 'sitzung', resourceId: id, data, event: data });
      return { ...r, sitzung: await sitzungsmodusOut(req, tx, n) };
    });
    reply.header('etag', etag(out.sitzung.version));
    return out;
  });

  // --- Entscheid je Traktandum --------------------------------------------------------------------------------------

  app.get('/v1/traktanden/:id/entscheid', {
    schema: { tags: [TAG], summary: 'Entscheid lesen', description: 'Entscheid mit Auflagen und Verlauf (A-30); 404, solange keiner erfasst ist.', params: IdParams, response: { 200: Type.Ref('Entscheid') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const out = await req.tx(async tx => {
      const t = await store.getTraktandum(tx, id);
      const e = t ? await es.entscheidVon(tx, t.id) : null;
      if (!t || !e) throw notFound('Entscheid');
      return entscheidOut(req, tx, await sitzungLesen(tx, e.sitzung_id), t, e);
    });
    reply.header('etag', etag(out.version));
    return out;
  });

  app.put('/v1/traktanden/:id/entscheid', {
    schema: {
      tags: [TAG], summary: 'Entscheid erfassen oder korrigieren',
      description: 'UC-006 Schritt 7, A3, A4 in der laufenden Sitzung: Ergebnis aus den Optionen der Art, Begründung (Pflicht), Auflagen mit Text, Termin und Verantwortlichen (bei «Mit Auflagen» mindestens eine), Weiterleitung an den VR. Die Folge der Art läuft sofort in derselben Transaktion; bei «via SNS-VR» ist der Entscheid eine Stellungnahme und die Folge kommt mit dem SNS-VR (A1). Korrektur mit `If-Match` (Version des Entscheids) bis zum Schliessen (A-30).',
      params: IdParams, headers: IfMatchHeaders, body: Type.Ref('EntscheidPut'), response: { 200: Type.Ref('Entscheid') },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as EntscheidPutIn;
    const who = actorOf(req);
    const out = await req.tx(async tx => {
      const { t, s } = await traktandumLesen(req, tx, id);
      const bestehend = await es.entscheidVon(tx, t.id);
      const version = bestehend ? requireIfMatch(req) : null;
      if (bestehend && bestehend.version !== version) throw preconditionFailed(bestehend.version);
      const r = await erfassen(tx, s, t, body, version);
      const n = (await store.getTraktandum(tx, t.id))!;
      const snap = entscheidSnapshot(n, r.entscheid, body.auflagen?.length ?? 0);
      await record(tx, who, {
        action: r.neu ? 'entscheid.recorded' : 'entscheid.corrected', resourceType: 'entscheid', resourceId: r.entscheid.id,
        data: r.vorher ? { before: { ergebnis: r.vorher.ergebnis, begruendung: r.vorher.begruendung, anVr: r.vorher.an_vr }, after: snap } : snap, event: snap,
      });
      return entscheidOut(req, tx, await sitzungLesen(tx, s.id), n, r.entscheid);
    });
    reply.header('etag', etag(out.version));
    return out;
  });

  app.put('/v1/traktanden/:id/entscheid/sns', {
    schema: {
      tags: [TAG], summary: 'Entscheid des SNS-VR nachtragen',
      description: 'UC-006 A1 (K02 Vorschlag, A-02): Die UE erfasst den Entscheid des SNS-VR zur Stellungnahme des Gremiums, nach dem Schliessen der Sitzung und einmal. Jetzt läuft die Folge der Art; PL und SP werden informiert. Nur mit `If-Match` (Version des Entscheids).',
      params: IdParams, headers: IfMatchHeaders, body: Type.Ref('SnsEntscheidPut'), response: { 200: Type.Ref('Entscheid') },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    const body = req.body as { ergebnis: string; begruendung: string };
    const who = actorOf(req);
    const out = await req.tx(async tx => {
      const { t, s } = await traktandumLesen(req, tx, id);
      const e = await es.entscheidVon(tx, t.id);
      if (!e) throw notFound('Entscheid');
      if (e.version !== version) throw preconditionFailed(e.version);
      const n = await snsNachtragen(tx, s, t, body, version);
      const snap = entscheidSnapshot(t, n, 0);
      await record(tx, who, { action: 'entscheid.sns_recorded', resourceType: 'entscheid', resourceId: n.id, data: snap, event: snap });
      return entscheidOut(req, tx, s, t, n);
    });
    reply.header('etag', etag(out.version));
    return out;
  });

  // --- Entscheide und Auflagen (UI-36) ------------------------------------------------------------------------------

  app.get('/v1/entscheide', {
    schema: {
      tags: [TAG], summary: 'Entscheide und Auflagen',
      description: 'Entscheide der Gremien, die die Person sieht, neueste Sitzung zuerst; Filter Projekt, Gremium, Weiterleitung an den VR (UC-006 A4) und offene Auflagen. Cursor-Paginierung.',
      querystring: EntscheidQuery, response: { 200: Type.Ref('EntscheidList') },
    },
  }, async req => {
    const q = req.query as { projektId?: string; gremium?: string; anVr?: boolean; auflagen?: 'offen'; cursor?: string; limit?: number };
    const limit = q.limit ?? 50;
    const nach = decodeCursor<{ d: string; p: number; id: string }>(q.cursor, v => typeof v.d === 'string' && typeof v.p === 'number' && typeof v.id === 'string');
    await req.needSomewhere('sitzung:read');
    return req.tx(async tx => {
      const rows = await es.entscheidListe(tx, { projektId: q.projektId, gremium: q.gremium, anVr: q.anVr, auflagenOffen: q.auflagen === 'offen', nach: nach ?? undefined, limit });
      const page = rows.slice(0, limit);
      const auflagen = await auflagenOut(req, tx, await es.auflagen(tx, page.map(r => r.id)));
      const items: EntscheidEintragOut[] = page.map(r => ({
        ...entscheidFelder(r, r, auflagen.filter(a => a.entscheidId === r.id)),
        traktandum: { id: r.traktandum_id, art: r.art, artLabel: artLabel(r.art), titel: r.titel, antrag: r.antrag, viaSns: r.via_sns },
        projekt: r.projekt_id && r.projekt_nummer ? { id: r.projekt_id, nummer: r.projekt_nummer, name: r.projekt_name ?? '' } : null,
        sitzung: { id: r.sitzung_id, datum: r.sitzung_datum, gremium: { kuerzel: r.gremium_kuerzel, name: r.gremium_name } },
      }));
      const last = page[page.length - 1];
      return { items, nextCursor: rows.length > limit && last ? encodeCursor({ d: last.sitzung_datum, p: last.position ?? 0, id: last.id }) : null };
    });
  });

  app.post('/v1/auflagen/:id/erfuellen', {
    schema: {
      tags: [TAG], summary: 'Auflage erledigt melden',
      description: 'Die verantwortliche Person (oder ihre Vertretung, sonst sitzung:write) meldet die Auflage erfüllt (UC-006 A3); die Aufgabe im Eingang ist erledigt. Wiederholt ohne Wirkung.',
      params: AuflageParams, headers: IdempotencyHeaders, response: { 200: Type.Ref('Auflage') },
    },
  }, async req => {
    const { id } = req.params as { id: string };
    const who = actorOf(req);
    return req.tx(async tx => {
      const a = await es.getAuflage(tx, id);
      if (!a) throw notFound('Auflage');
      if (a.stand === 'offen') {
        if (!(await darfErfuellen(req, tx, a))) {
          if (a.portfolio_id) await req.need('sitzung:write', ort(a.portfolio_id));
          throw notFound('Auflage');
        }
        await auflageErfuellen(tx, a);
        const data = { id, entscheidId: a.entscheid_id, verantwortlich: a.verantwortlich, termin: a.termin };
        await record(tx, who, { action: 'auflage.fulfilled', resourceType: 'auflage', resourceId: id, data, event: data });
      }
      return (await auflagenOut(req, tx, [(await es.getAuflage(tx, id))!]))[0]!;
    });
  });
}
