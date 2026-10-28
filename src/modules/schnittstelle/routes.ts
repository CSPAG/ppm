/**
 * Routen der Schnittstellen (BC AM.03.02; UC-018 Schritte 3–4, A1) und des Änderungsprotokolls (BC AM.03.03; UC-018
 * Schritt 5). Schnittstellen nur mit `schnittstelle:admin` (ADM), das Änderungsprotokoll mit `audit:read` (ADM, UE).
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  actorOf, conflict, decodeCursor, encodeCursor, etag, IdempotencyHeaders, IdParams, IfMatchHeaders, invalid, notFound,
  preconditionFailed, requireIfMatch, resolveTarget, SsrfError, type Deps,
} from '@vollholz/platform';
import { record } from '../../platform.ts';
import { eintrag, KATALOG, nameVon, verarbeitung, type Rhythmus } from './katalog.ts';
import { ausfuehren, LaeuftSchon, TIMEOUT_MS, type TxRunner } from './lauf.ts';
import * as protokoll from './protokoll.ts';
import {
  Katalogeintrag, Lauf, LaufList, LaufQuery, ProtokollEintrag, ProtokollList, ProtokollObjekte, ProtokollQuery, Schnittstelle,
  SchnittstelleCreate, SchnittstelleErgebnis, SchnittstelleList, SchnittstellePatch,
} from './schemas.ts';
import * as store from './store.ts';

export const TAG = 'Schnittstellen';
export const TAG_PROTOKOLL = 'Änderungsprotokoll';

const laufOut = (l: store.LaufRow) => ({
  id: l.id, schnittstelleId: l.schnittstelle_id, art: l.art, stand: l.stand, start: l.start, ende: l.ende, umfang: l.umfang, fehler: l.fehler,
  gestartetVon: l.gestartet_by ? { id: l.gestartet_by, name: l.gestartet_name } : null,
});
const out = (r: store.Row, letzter: store.LaufRow | null) => ({
  id: r.id, umsystem: r.umsystem, daten: r.daten, name: nameVon(r.umsystem, r.daten), richtung: r.richtung, rhythmus: r.rhythmus,
  adresse: r.adresse, aktiv: r.aktiv, verfuegbar: istVerfuegbar(r.daten, r.richtung), letzterLauf: letzter ? laufOut(letzter) : null,
  version: r.version, updatedAt: r.updated_at,
});
const istVerfuegbar = (daten: string, richtung: 'eingehend' | 'ausgehend') => {
  const v = verarbeitung(daten);
  return !!(richtung === 'eingehend' ? v?.uebernehmen : v?.liefern);
};
/** Daten für das Audit (Änderungsprotokoll): ohne Lauf und Fähigkeiten. */
const snapshot = (r: store.Row) => ({ id: r.id, umsystem: r.umsystem, daten: r.daten, richtung: r.richtung, rhythmus: r.rhythmus, adresse: r.adresse, aktiv: r.aktiv, version: r.version });

export function registerRoutes(app: FastifyInstance, deps: Deps): void {
  for (const s of [Katalogeintrag, Lauf, Schnittstelle, SchnittstelleList, SchnittstelleErgebnis, SchnittstelleCreate, SchnittstellePatch, LaufList, ProtokollEintrag, ProtokollList, ProtokollObjekte]) app.addSchema(s);
  const optionen = { timeoutMs: TIMEOUT_MS, allowPrivate: deps.cfg.app.events.allowPrivate };
  const runner = (req: FastifyRequest): TxRunner => fn => req.tx(fn);

  /** Adresse prüfen wie bei Webhooks: in Produktion nur https, keine privaten Ziele (SSRF). */
  async function adressePruefen(adresse: string): Promise<void> {
    if (deps.cfg.mode === 'production' && !adresse.startsWith('https://')) throw invalid('In Produktion nur https-Adressen.');
    try { await resolveTarget(adresse, { allowPrivate: optionen.allowPrivate }); } catch (e) {
      if (e instanceof SsrfError) throw invalid(`Adresse nicht zulässig: ${e.message}.`);
      throw e;
    }
  }
  async function testlauf(req: FastifyRequest, id: string) {
    try { return await ausfuehren(runner(req), id, 'test', optionen); } catch (e) {
      if (e instanceof LaeuftSchon) return null;
      throw e;
    }
  }

  app.get('/v1/schnittstellen', {
    schema: {
      tags: [TAG], summary: 'Schnittstellen auflisten', response: { 200: Type.Ref('SchnittstelleList') },
      description: 'Eingerichtete Schnittstellen mit letztem Lauf und der Katalog der Umsysteme und Daten (UC-018 Schritte 3–4).',
    },
  }, async req => {
    await req.need('schnittstelle:admin');
    const { rows, letzte } = await req.tx(async tx => ({ rows: await store.list(tx), letzte: await store.letzteLaeufe(tx) }));
    return {
      items: rows.map(r => out(r, letzte.get(r.id) ?? null)),
      katalog: KATALOG.map(e => ({ ...e, verfuegbar: istVerfuegbar(e.daten, e.richtung) })),
    };
  });

  app.get('/v1/schnittstellen/:id', {
    schema: { tags: [TAG], summary: 'Schnittstelle lesen', params: IdParams, response: { 200: Type.Ref('Schnittstelle') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await req.need('schnittstelle:admin');
    const r = await req.tx(async tx => {
      const s = await store.get(tx, id);
      return s && { s, letzter: (await store.letzteLaeufe(tx)).get(id) ?? null };
    });
    if (!r) throw notFound('Schnittstelle');
    reply.header('etag', etag(r.s.version));
    return out(r.s, r.letzter);
  });

  app.post('/v1/schnittstellen', {
    schema: {
      tags: [TAG], summary: 'Schnittstelle einrichten', headers: IdempotencyHeaders, body: Type.Ref('SchnittstelleCreate'), response: { 201: Type.Ref('SchnittstelleErgebnis') },
      description: 'Umsystem, Daten, Rhythmus und Adresse; die Richtung folgt aus dem Katalog. Speichert und führt bei aktiver Schnittstelle einen Testlauf aus (UC-018 Schritt 3). 409, wenn es für Umsystem und Daten schon eine gibt.',
    },
  }, async (req, reply) => {
    await req.need('schnittstelle:admin');
    const body = req.body as typeof SchnittstelleCreate.static;
    const e = eintrag(body.umsystem, body.daten);
    if (!e) throw invalid('Umsystem und Daten stehen nicht im Katalog der Schnittstellen.');
    await adressePruefen(body.adresse);
    const who = actorOf(req);
    const row = await req.tx(async tx => {
      const r = await store.create(tx, { umsystem: e.umsystem, daten: e.daten, richtung: e.richtung, rhythmus: body.rhythmus, adresse: body.adresse, aktiv: body.aktiv ?? true });
      if (!r) throw conflict(`Für «${nameVon(e.umsystem, e.daten)}» ist schon eine Schnittstelle eingerichtet.`);
      await record(tx, who, { action: 'schnittstelle.created', resourceType: 'schnittstelle', resourceId: r.id, data: snapshot(r) });
      return r;
    });
    const lauf = row.aktiv ? await testlauf(req, row.id) : null;
    return reply.code(201).header('location', `/v1/schnittstellen/${row.id}`).header('etag', etag(row.version))
      .send({ schnittstelle: out(row, lauf), testlauf: lauf && laufOut(lauf) });
  });

  app.patch('/v1/schnittstellen/:id', {
    schema: {
      tags: [TAG], summary: 'Schnittstelle ändern', params: IdParams, headers: IfMatchHeaders, body: Type.Ref('SchnittstellePatch'), response: { 200: Type.Ref('SchnittstelleErgebnis') },
      description: 'Rhythmus, Adresse, aktiv (deaktivieren statt löschen). Neue Adresse oder Aktivieren führt einen Testlauf aus. `If-Match` erforderlich.',
    },
  }, async req => {
    const { id } = req.params as { id: string };
    await req.need('schnittstelle:admin');
    const version = requireIfMatch(req);
    const body = req.body as { rhythmus?: Rhythmus; adresse?: string; aktiv?: boolean };
    if (body.adresse !== undefined) await adressePruefen(body.adresse);
    const who = actorOf(req);
    const { before, row } = await req.tx(async tx => {
      const b = await store.get(tx, id);
      if (!b) throw notFound('Schnittstelle');
      const r = await store.update(tx, id, version, body);
      if (!r) throw preconditionFailed(b.version);
      await record(tx, who, { action: 'schnittstelle.updated', resourceType: 'schnittstelle', resourceId: id, data: { before: snapshot(b), after: snapshot(r) } });
      return { before: b, row: r };
    });
    const neu = row.aktiv && (row.adresse !== before.adresse || !before.aktiv);
    const lauf = neu ? await testlauf(req, id) : null;
    const letzter = lauf ?? (await req.tx(async tx => (await store.letzteLaeufe(tx)).get(id) ?? null));
    return { schnittstelle: out(row, letzter), testlauf: lauf && laufOut(lauf) };
  });

  app.get('/v1/schnittstellen/:id/laeufe', {
    schema: {
      tags: [TAG], summary: 'Läufe einer Schnittstelle', params: IdParams, querystring: LaufQuery, response: { 200: Type.Ref('SchnittstelleLaufList') },
      description: 'Laufprotokoll: je Lauf Zeitpunkt, Umfang und Fehler, neueste zuerst (UC-018 Schritt 4).',
    },
  }, async req => {
    const { id } = req.params as { id: string };
    await req.need('schnittstelle:admin');
    const q = req.query as { cursor?: string; limit?: number };
    const limit = q.limit ?? 50;
    const after = decodeCursor<{ s: string; i: string; x: string }>(q.cursor, v => typeof v.s === 'string' && typeof v.i === 'string' && v.x === id);
    const rows = await req.tx(async tx => {
      if (!(await store.get(tx, id))) throw notFound('Schnittstelle');
      return store.laeufe(tx, id, { after: after ? { start: after.s, id: after.i } : undefined, limit });
    });
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return { items: page.map(laufOut), nextCursor: rows.length > limit && last ? encodeCursor({ s: last.start.toISOString(), i: last.id, x: id }) : null };
  });

  app.post('/v1/schnittstellen/:id/starten', {
    schema: {
      tags: [TAG], summary: 'Lauf starten', params: IdParams, headers: IdempotencyHeaders, response: { 201: Type.Ref('SchnittstelleLauf') },
      description: 'Lauf von Hand, auch erneut nach einem Fehler (UC-018 A1.1); wartet auf das Ergebnis. 409, wenn die Schnittstelle nicht aktiv ist oder schon ein Lauf läuft.',
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await req.need('schnittstelle:admin');
    const s = await req.tx(tx => store.get(tx, id));
    if (!s) throw notFound('Schnittstelle');
    if (!s.aktiv) throw conflict('Die Schnittstelle ist nicht aktiv.');
    let lauf: store.LaufRow | null;
    try { lauf = await ausfuehren(runner(req), id, 'manuell', optionen); } catch (e) {
      if (e instanceof LaeuftSchon) throw conflict('Für diese Schnittstelle läuft schon ein Lauf.');
      throw e;
    }
    if (!lauf) throw notFound('Schnittstelle');
    return reply.code(201).send(laufOut(lauf));
  });

  // ---------------------------------------------------------------- Änderungsprotokoll (AM.03.03)

  app.get('/v1/aenderungsprotokoll', {
    schema: {
      tags: [TAG_PROTOKOLL], summary: 'Änderungsprotokoll', querystring: ProtokollQuery, response: { 200: Type.Ref('AenderungsprotokollList') },
      description: 'Änderungen aus dem Audit mit Person, Zeitpunkt, altem und neuem Wert; neueste zuerst, filterbar nach Objekt (Typ, Kennung) und Zeitraum (Kalendertage, Europe/Zurich; UC-018 Schritt 5).',
    },
  }, async req => {
    await req.need('audit:read');
    const q = req.query as { objekt?: string; objektId?: string; von?: string; bis?: string; cursor?: string; limit?: number };
    if (q.von && q.bis && q.von > q.bis) throw invalid('«von» liegt nach «bis».');
    const limit = q.limit ?? 50;
    const filter = `${q.objekt ?? ''}|${q.objektId ?? ''}|${q.von ?? ''}|${q.bis ?? ''}`;
    const after = decodeCursor<{ n: string; f: string }>(q.cursor, v => typeof v.n === 'string' && /^\d+$/.test(v.n) && v.f === filter);
    const rows = await req.tx(tx => protokoll.liste(tx, { objekt: q.objekt, objektId: q.objektId, von: q.von, bis: q.bis, nach: after?.n, limit }));
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return { items: page, nextCursor: rows.length > limit && last ? encodeCursor({ n: last.id, f: filter }) : null };
  });

  app.get('/v1/aenderungsprotokoll/objekte', {
    schema: { tags: [TAG_PROTOKOLL], summary: 'Objekttypen im Änderungsprotokoll', response: { 200: Type.Ref('AenderungsprotokollObjekte') }, description: 'Objekttypen mit Einträgen, für den Filter.' },
  }, async req => {
    await req.need('audit:read');
    return { items: await req.tx(tx => protokoll.objekte(tx)) };
  });
}
