/**
 * Routen für Ideenpool und Prüfung (AP-E4-2; BC DM.01.02–04, PP.02.04; UC-001 Schritte 3–5, A1–A3; Kernablauf K4):
 * Pool mit Funnel «Pre-P0», ähnliche Ideen (nur `idee:write`, A-32), Leitfragen zum Eintritt P0, Kriterienraster mit
 * Vorschlag, Kategorie mit Portfolio, Rückfrage, Zurückweisen (A-06: die UE allein, Gremium informiert), Zusammenführen.
 * Übergänge mit `If-Match` auf die Idee, Audit und Ereignis, Aufgaben und Mitteilungen des Eingangs in derselben
 * Transaktion. Die erste Prüfhandlung setzt «eingereicht» auf «in Prüfung» und informiert die Antragstellenden (I-B1).
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  actorOf, conflict, decodeCursor, encodeCursor, etag, IdempotencyHeaders, IdParams, IfMatchHeaders, invalid, notFound, preconditionFailed,
  requireIfMatch, type Deps, type Tx,
} from '@vollholz/platform';
import { record } from '../../platform.ts';
import { aufgabe, mitteilung } from '../eingang/index.ts';
import { aktuellesPhasenmodell } from '../phasenmodell/index.ts';
import { entscheidendesGremium } from '../portfolio/index.ts';
import {
  Aehnliche, Funnel, KategorieIn, KRITERIEN, LeitfragenIn, OFFEN, PoolList, PoolQuery, PoolZeile, Pruefung, RasterIn, RueckfragenIn,
  ZurueckweisenIn, ZusammenfuehrenIn, type Kriterium, type PoolZeileOut, type PruefungOut,
} from './pruefung-schemas.ts';
import * as ps from './pruefung-store.ts';
import { TAG } from './routes.ts';
import type { Stand } from './schemas.ts';
import * as store from './store.ts';

/** Leitfragen, Raster, Kategorie und Rückfrage: solange die Idee bei der UE liegt. */
const PRUEFBAR: readonly Stand[] = ['eingereicht', 'in_pruefung', 'zurueckgestellt'];
/** Zurückweisen und Zusammenführen: jede offene Idee im Pool (auch in Ergänzung). */
const ABSCHLIESSBAR: readonly Stand[] = ['eingereicht', 'in_pruefung', 'in_ergaenzung', 'zurueckgestellt'];

const zeile = (r: ps.PoolRow): PoolZeileOut => ({
  id: r.id, nummer: r.nummer, titel: r.titel, stand: r.stand, standAt: r.stand_at, eingereichtAt: r.eingereicht_at, erfasstVon: r.erfasst_von,
  handlungsfeldId: r.handlungsfeld_id, bereiche: r.org_einheit_ids, herkunft: r.herkunft, kategorie: r.kategorie, rueckfragenOffen: r.rueckfragen_offen,
});

const link = (nummer: number) => `/portfolio/ideen/${nummer}`;
const titelVon = (r: store.Row) => r.titel || `Idee ${r.nummer}`;

/** Idee für eine Prüfhandlung: vorhanden (sonst 404), Version per If-Match (412), Stand passend (409). */
async function laden(tx: Tx, id: string, version: number, staende: readonly Stand[]): Promise<store.Row> {
  // Zeile sperren: Version und Stand gelten bis zum Ende der Transaktion (parallele Prüfhandlungen mit demselben If-Match)
  await ps.sperren(tx, id);
  const r = await store.get(tx, id);
  if (!r || r.stand === 'entwurf') throw notFound('Idee');
  if (r.version !== version) throw preconditionFailed(r.version);
  if (!staende.includes(r.stand)) throw conflict(`Die Idee ist ${r.stand.replace('_', ' ')}; diese Handlung ist jetzt nicht möglich.`);
  return r;
}

/** Erste Prüfhandlung: «eingereicht» → «in Prüfung», Antragstellende informiert (K4 Stand verfolgen, I-B1). */
async function beginnen(tx: Tx, r: store.Row): Promise<void> {
  if (r.stand !== 'eingereicht') return;
  await ps.setzen(tx, r.id, { stand: 'in_pruefung' });
  await mitteilung.senden(tx, { an: r.erfasst_von, bezug: { typ: 'idee', id: r.id }, text: `Ihre Projektidee «${titelVon(r)}» ist in Prüfung bei der Unternehmensentwicklung.`, link: link(r.nummer) });
}

async function pruefungOut(req: FastifyRequest, tx: Tx, r: store.Row): Promise<PruefungOut> {
  const angaben = (await ps.pruefAngaben(tx, r.id))!;
  const gespeichert = await ps.leitfragen(tx, r.id);
  const pm = await aktuellesPhasenmodell(tx);
  const fragen = pm?.gates.find(g => g.code === 'EINTRITT_P0')?.leitfragen ?? [];
  const leitfragen = fragen.map((f, position) => ({ position, wertestrom: f.wertestrom, frage: f.text, antwort: gespeichert.find(g => g.position === position)?.antwort ?? '' }));
  // Antworten zu Fragen, die es in der Version in Kraft nicht mehr gibt, bleiben sichtbar (Abschrift)
  for (const g of gespeichert) if (!leitfragen.some(l => l.position === g.position)) leitfragen.push(g);
  const raster = await ps.raster(tx, r.id);
  const gremium = angaben.portfolio_id ? await entscheidendesGremium(tx, angaben.portfolio_id) : null;
  const write = await req.can('idee:write');
  return {
    leitfragen: leitfragen.sort((a, b) => a.position - b.position),
    vorgesehenerSponsor: angaben.vorgesehener_sponsor,
    raster: KRITERIEN.map(k => ({ kriterium: k, einschaetzung: raster.get(k) ?? null })),
    vorschlag: ps.vorschlag(raster),
    kategorie: angaben.kategorie, kategorieBegruendung: angaben.kategorie_begruendung, portfolioId: angaben.portfolio_id,
    zustaendig: gremium ? { kuerzel: gremium.kuerzel, name: gremium.name } : null,
    can: { pruefen: write && PRUEFBAR.includes(r.stand), abschliessen: write && ABSCHLIESSBAR.includes(r.stand) },
  };
}

const snap = (r: store.Row) => ({ id: r.id, nummer: r.nummer, stand: r.stand, version: r.version });

export function registerPruefungRoutes(app: FastifyInstance, deps: Deps): void {
  for (const s of [PoolZeile, PoolList, Funnel, Aehnliche, Pruefung, LeitfragenIn, RasterIn, KategorieIn, RueckfragenIn, ZurueckweisenIn, ZusammenfuehrenIn]) app.addSchema(s);
  const ctxOf = (req: FastifyRequest) => ({ db: deps.db, tenantId: req.requirePrincipal().tenantId });

  /** Antwort einer Prüfhandlung: Prüfung mit ETag der Idee. */
  const antwort = async (req: FastifyRequest, reply: { header(k: string, v: string): unknown }, tx: Tx, id: string) => {
    const r = (await store.get(tx, id))!;
    reply.header('etag', etag(r.version));
    return pruefungOut(req, tx, r);
  };

  app.get('/v1/ideen/pool', {
    schema: { tags: [TAG], summary: 'Ideenpool', description: 'Alle eingereichten Ideen (ohne Entwürfe) mit `idee:read`; Standard «wartet am längsten zuerst» (K4 Prüfen 5), Filter Stand, Handlungsfeld, Herkunft, Cursor.', querystring: PoolQuery, response: { 200: Type.Ref('IdeePoolList') } },
  }, async req => {
    await req.needSomewhere('idee:read');
    const q = req.query as { stand?: Stand[]; handlungsfeld?: string; herkunft?: string; sort?: 'wartet' | 'neu'; cursor?: string; limit?: number };
    const limit = q.limit ?? 50;
    const sort = q.sort ?? 'wartet';
    const filter = `${(q.stand ?? []).join(',')}|${q.handlungsfeld ?? ''}|${q.herkunft ?? ''}|${sort}`;
    const after = decodeCursor<{ a: string; i: string; f: string }>(q.cursor, v => typeof v.a === 'string' && typeof v.i === 'string' && v.f === filter);
    const rows = await req.tx(tx => ps.pool(tx, { stand: q.stand, handlungsfeld: q.handlungsfeld, herkunft: q.herkunft, sort, after: after && { at: after.a, id: after.i }, limit }));
    const page = rows.slice(0, limit);
    const last = page[page.length - 1] as (ps.PoolRow & { sort_at: Date }) | undefined;
    return { items: page.map(zeile), nextCursor: rows.length > limit && last ? encodeCursor({ a: new Date(last.sort_at).toISOString(), i: last.id, f: filter }) : null };
  });

  app.get('/v1/ideen/pool/funnel', {
    schema: { tags: [TAG], summary: 'Funnel «Pre-P0»', description: 'Anzahl Ideen je Stand (ohne Entwürfe) und Zeitpunkt der letzten Einreichung (K4 Prüfen 5, UC-001 UI).', response: { 200: Type.Ref('IdeeFunnel') } },
  }, async req => {
    await req.needSomewhere('idee:read');
    const f = await req.tx(tx => ps.funnel(tx));
    const reihenfolge: readonly Stand[] = [...OFFEN, 'freigegeben', 'zurueckgewiesen', 'zusammengefuehrt'];
    return { stufen: reihenfolge.map(s => ({ stand: s, anzahl: f.stufen.find(x => x.stand === s)?.anzahl ?? 0 })), letzteEinreichung: f.letzte };
  });

  app.get('/v1/ideen/:id/aehnliche', {
    schema: { tags: [TAG], summary: 'Ähnliche Ideen', description: 'Ideen mit gleichem Handlungsfeld oder gemeinsamen betroffenen Bereichen (UC-001 Schritt 3, A1); nur mit `idee:write` (A-32).', params: IdParams, response: { 200: Type.Ref('IdeeAehnliche') } },
  }, async req => {
    const { id } = req.params as { id: string };
    await req.need('idee:write');
    return req.tx(async tx => {
      const r = await store.get(tx, id);
      if (!r || r.stand === 'entwurf') throw notFound('Idee');
      const rows = await ps.aehnliche(tx, r);
      return { items: rows.map(x => ({ idee: zeile(x), gleichesHandlungsfeld: x.gleiches_feld, gemeinsameBereiche: x.gemeinsam })) };
    });
  });

  app.get('/v1/ideen/:id/pruefung', {
    schema: { tags: [TAG], summary: 'Prüfung einer Idee', description: 'Leitfragen zum Eintritt P0 mit Antworten, Kriterienraster mit Vorschlag, Kategorie und zuständiges Gremium; nur mit `idee:read` (Antragstellende sehen sie nicht, K4 Z8).', params: IdParams, response: { 200: Type.Ref('IdeePruefung') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await req.needSomewhere('idee:read');
    return req.tx(async tx => {
      const r = await store.get(tx, id);
      if (!r || r.stand === 'entwurf') throw notFound('Idee');
      reply.header('etag', etag(r.version));
      return pruefungOut(req, tx, r);
    });
  });

  app.put('/v1/ideen/:id/leitfragen', {
    schema: { tags: [TAG], summary: 'Leitfragen zum Eintritt P0 beantworten', description: 'Antworten je Position der Leitfragen des Phasenmodells in Kraft (Frage als Abschrift), vorgesehener Sponsor (UC-001 Schritt 4). Nur mit `If-Match` der Idee.', params: IdParams, headers: IfMatchHeaders, body: Type.Ref('IdeeLeitfragenIn'), response: { 200: Type.Ref('IdeePruefung') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('idee:write');
    const body = req.body as { antworten: { position: number; antwort: string }[]; vorgesehenerSponsor?: string | null };
    const who = actorOf(req);
    return req.tx(async tx => {
      const r = await laden(tx, id, version, PRUEFBAR);
      const pm = await aktuellesPhasenmodell(tx);
      const fragen = pm?.gates.find(g => g.code === 'EINTRITT_P0')?.leitfragen ?? [];
      const fehlt = body.antworten.filter(a => !fragen[a.position]);
      if (fehlt.length) throw invalid('Diese Leitfragen gibt es im Phasenmodell in Kraft nicht.', fehlt.map(a => ({ path: `/antworten/${a.position}`, message: 'Unbekannte Leitfrage.' })));
      for (const a of body.antworten) {
        const f = fragen[a.position]!;
        await ps.leitfrageSetzen(tx, id, { position: a.position, phasenmodellId: pm!.id, wertestrom: f.wertestrom, frage: f.text, antwort: a.antwort });
      }
      if (body.vorgesehenerSponsor !== undefined) {
        try {
          await ps.setzen(tx, id, { vorgesehener_sponsor: body.vorgesehenerSponsor });
        } catch (e) {
          if ((e as { code?: string }).code === '23503') throw invalid('Unbekannte Person.', [{ path: '/vorgesehenerSponsor', message: 'Unbekannte Person.' }]);
          throw e;
        }
      }
      await beginnen(tx, r);
      await record(tx, who, { action: 'idee.questions_answered', resourceType: 'idee', resourceId: id, data: { ...snap(r), antworten: body.antworten.length, sponsor: body.vorgesehenerSponsor }, event: snap(r) });
      return antwort(req, reply, tx, id);
    });
  });

  app.put('/v1/ideen/:id/raster', {
    schema: { tags: [TAG], summary: 'Kriterienraster einschätzen', description: 'Je Kriterium «hoch / mittel / tief» (null = offen); die Antwort zeigt die naheliegende Kategorie mit Herleitung (PP.02.04, G11). Nur mit `If-Match` der Idee.', params: IdParams, headers: IfMatchHeaders, body: Type.Ref('IdeeRasterIn'), response: { 200: Type.Ref('IdeePruefung') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('idee:write');
    const body = req.body as { raster: { kriterium: Kriterium; einschaetzung: 'hoch' | 'mittel' | 'tief' | null }[] };
    const who = actorOf(req);
    return req.tx(async tx => {
      const r = await laden(tx, id, version, PRUEFBAR);
      for (const k of body.raster) await ps.rasterSetzen(tx, id, k.kriterium, k.einschaetzung);
      const v = ps.vorschlag(await ps.raster(tx, id));
      await ps.setzen(tx, id, { kategorie_vorschlag: v?.kategorie ?? null });
      await beginnen(tx, r);
      await record(tx, who, { action: 'idee.rated', resourceType: 'idee', resourceId: id, data: { ...snap(r), raster: body.raster, vorschlag: v?.kategorie ?? null }, event: snap(r) });
      return antwort(req, reply, tx, id);
    });
  });

  app.post('/v1/ideen/:id/kategorie', {
    schema: { tags: [TAG], summary: 'Kategorie zuordnen', description: 'Kategorie A, B oder C als Gesamtbeurteilung der UE und damit Portfolio und zuständiges Gremium (UC-001 Schritt 5). Bei mehreren Portfolios der Kategorie (C: je Direktion) ist `portfolioId` nötig (sonst 422). Nur mit `If-Match`.', params: IdParams, headers: Type.Composite([IfMatchHeaders, IdempotencyHeaders]), body: Type.Ref('IdeeKategorieIn'), response: { 200: Type.Ref('IdeePruefung') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('idee:write');
    const body = req.body as { kategorie: 'A' | 'B' | 'C'; portfolioId?: string; begruendung?: string };
    const who = actorOf(req);
    return req.tx(async tx => {
      const r = await laden(tx, id, version, PRUEFBAR);
      const portfolios = await ps.portfoliosDerKategorie(tx, body.kategorie);
      const portfolio = body.portfolioId ? portfolios.find(p => p.id === body.portfolioId) : portfolios.length === 1 ? portfolios[0] : undefined;
      if (!portfolio) {
        throw invalid('Das Portfolio der Kategorie ist nicht eindeutig.', [{
          path: '/portfolioId', message: portfolios.length ? 'Wählen Sie das Portfolio (bei Kategorie C die Direktion).' : `Es gibt noch kein Portfolio der Kategorie ${body.kategorie}. Die UE erfasst es unter Administration › Portfolios.`,
        }]);
      }
      await ps.setzen(tx, id, { kategorie: body.kategorie, portfolio_id: portfolio.id, kategorie_begruendung: (body.begruendung ?? '').trim() });
      await beginnen(tx, r);
      await record(tx, who, { action: 'idee.categorized', resourceType: 'idee', resourceId: id, data: { ...snap(r), kategorie: body.kategorie, portfolioId: portfolio.id, begruendung: body.begruendung ?? '' }, event: { ...snap(r), kategorie: body.kategorie } });
      return antwort(req, reply, tx, id);
    });
  });

  app.post('/v1/ideen/:id/rueckfragen', {
    schema: { tags: [TAG], summary: 'Rückfrage stellen', description: 'Rückfragen je Feld der Idee (UC-001 A2.1): Stand «in Ergänzung», Antragstellende erhalten «Rückfragen zu Ihrer Idee beantworten»; die Prüfaufgabe entfällt bis zum erneuten Einreichen. Nur mit `If-Match`.', params: IdParams, headers: Type.Composite([IfMatchHeaders, IdempotencyHeaders]), body: Type.Ref('IdeeRueckfragenIn'), response: { 200: Type.Ref('IdeePruefung') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('idee:write');
    const body = req.body as { fragen: { feld?: string | null; text: string }[] };
    const who = actorOf(req);
    return req.tx(async tx => {
      const r = await laden(tx, id, version, ['eingereicht', 'in_pruefung']);
      await ps.rueckfragenStellen(tx, id, body.fragen);
      await ps.setzen(tx, id, { stand: 'in_ergaenzung' });
      await aufgabe.entfallen(tx, { art: 'idee.pruefen', bezug: { typ: 'idee', id } });
      await aufgabe.oeffnen(tx, {
        art: 'idee.ergaenzen', bezug: { typ: 'idee', id }, empfaenger: { person: r.erfasst_von },
        titel: `Rückfragen zu Ihrer Idee beantworten · ${titelVon(r)}`, kontext: `Idee ${r.nummer}`, link: link(r.nummer),
      });
      await record(tx, who, { action: 'idee.questioned', resourceType: 'idee', resourceId: id, data: { ...snap(r), fragen: body.fragen }, event: { ...snap(r), stand: 'in_ergaenzung' } });
      return antwort(req, reply, tx, id);
    });
  });

  app.post('/v1/ideen/:id/zurueckweisen', {
    schema: { tags: [TAG], summary: 'Idee zurückweisen', description: 'Mit Begründung (Pflicht, UC-001 A3): Stand «zurückgewiesen», Antragstellende und – bei zugeordnetem Portfolio – die Mitglieder des Gremiums werden informiert (A-06). Nur mit `If-Match`.', params: IdParams, headers: Type.Composite([IfMatchHeaders, IdempotencyHeaders]), body: Type.Ref('IdeeZurueckweisenIn'), response: { 200: Type.Ref('IdeePruefung') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('idee:write');
    const begruendung = (req.body as { begruendung: string }).begruendung.trim();
    if (!begruendung) throw invalid('Begründung fehlt.', [{ path: '/begruendung', message: 'Begründung fehlt: Die antragstellende Person erfährt sonst nicht, warum die Idee nicht weiterverfolgt wird.' }]);
    const who = actorOf(req);
    const ctx = ctxOf(req);
    return req.tx(async tx => {
      const r = await laden(tx, id, version, ABSCHLIESSBAR);
      await ps.setzen(tx, id, { stand: 'zurueckgewiesen', begruendung });
      await aufgabe.erledigen(tx, { art: 'idee.pruefen', bezug: { typ: 'idee', id } });
      await aufgabe.entfallen(tx, { art: 'idee.ergaenzen', bezug: { typ: 'idee', id } });
      await mitteilung.senden(tx, { an: r.erfasst_von, bezug: { typ: 'idee', id }, text: `Ihre Projektidee «${titelVon(r)}» wird nicht weiterverfolgt. Die Begründung steht bei der Idee.`, link: link(r.nummer) });
      const portfolioId = (await ps.pruefAngaben(tx, id))!.portfolio_id;
      if (portfolioId) {
        for (const p of await ps.gremiumsmitglieder(ctx, portfolioId)) {
          if (p !== r.erfasst_von) await mitteilung.senden(tx, { an: p, bezug: { typ: 'idee', id }, text: `Die Unternehmensentwicklung hat die Projektidee «${titelVon(r)}» zurückgewiesen.`, link: link(r.nummer) });
        }
      }
      await record(tx, who, { action: 'idee.rejected', resourceType: 'idee', resourceId: id, data: { ...snap(r), begruendung }, event: { ...snap(r), stand: 'zurueckgewiesen' } });
      return antwort(req, reply, tx, id);
    });
  });

  app.post('/v1/ideen/:id/zusammenfuehren', {
    schema: { tags: [TAG], summary: 'Ideen zusammenführen', description: 'Schliesst diese Idee als «zusammengeführt» mit Verweis auf die führende Idee; Bereiche und Texte gehen in die führende über, beide Antragstellenden werden informiert (UC-001 A1, DM.01.03). Nur mit `If-Match` dieser Idee; die führende muss offen sein (sonst 409).', params: IdParams, headers: Type.Composite([IfMatchHeaders, IdempotencyHeaders]), body: Type.Ref('IdeeZusammenfuehrenIn'), response: { 200: Type.Ref('IdeePruefung') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('idee:write');
    const { fuehrendeIdeeId } = req.body as { fuehrendeIdeeId: string };
    if (fuehrendeIdeeId === id) throw invalid('Eine Idee lässt sich nicht mit sich selbst zusammenführen.', [{ path: '/fuehrendeIdeeId', message: 'Wählen Sie eine andere Idee.' }]);
    const who = actorOf(req);
    return req.tx(async tx => {
      const r = await laden(tx, id, version, ABSCHLIESSBAR);
      await ps.sperren(tx, fuehrendeIdeeId);
      const f = await store.get(tx, fuehrendeIdeeId);
      if (!f || f.stand === 'entwurf') throw notFound('Führende Idee');
      if (!ABSCHLIESSBAR.includes(f.stand)) throw conflict('Die führende Idee ist nicht mehr offen.');
      // Angaben übernehmen: Bereiche vereinigt, Texte der zusammengeführten Idee als Absatz angehängt
      const bereiche = [...new Set([...f.org_einheit_ids, ...r.org_einheit_ids])];
      const anhang = (feld: 'ausgangslage' | 'zielsetzung') => (r[feld] && !f[feld].includes(r[feld]) ? `${f[feld]}\n\nAus Idee ${r.nummer} (${titelVon(r)}): ${r[feld]}`.trim().slice(0, 4000) : f[feld]);
      await ps.setzen(tx, f.id, { org_einheit_ids: bereiche, ausgangslage: anhang('ausgangslage'), zielsetzung: anhang('zielsetzung') });
      await ps.setzen(tx, id, { stand: 'zusammengefuehrt', fuehrende_idee_id: f.id });
      await aufgabe.erledigen(tx, { art: 'idee.pruefen', bezug: { typ: 'idee', id } });
      await aufgabe.entfallen(tx, { art: 'idee.ergaenzen', bezug: { typ: 'idee', id } });
      const text = `Die Projektideen «${titelVon(r)}» und «${titelVon(f)}» wurden zusammengeführt; weiterverfolgt wird Idee ${f.nummer}.`;
      for (const p of new Set([r.erfasst_von, f.erfasst_von])) await mitteilung.senden(tx, { an: p, bezug: { typ: 'idee', id: f.id }, text, link: link(f.nummer) });
      await record(tx, who, { action: 'idee.merged', resourceType: 'idee', resourceId: id, data: { ...snap(r), fuehrendeIdeeId: f.id, fuehrendeNummer: f.nummer }, event: { ...snap(r), stand: 'zusammengefuehrt', fuehrendeIdeeId: f.id } });
      return antwort(req, reply, tx, id);
    });
  });
}
