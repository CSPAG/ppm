/**
 * Routen des Bewertungsmodells mit Budgetrahmen (BC PP.01.02, PP.01.03; UC-008 A1) und der Bewertung je Projekt und
 * Kriterium (BC PP.02.01; UC-008 Schritte 1–2) nach dem Muster der Handlungsfelder: Rechte über `req.need`, Lesesicht über
 * `req.tx`, Fähigkeiten `can`, ETag/If-Match (412), Idempotenz (Querschnitt), Audit und Ereignis in derselben Transaktion.
 * Lebenslauf des Modells wie das Phasenmodell: Entwurf ändern oder verwerfen, mit dem Entscheid des Gremiums in Kraft setzen.
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  actorOf, conflict, etag, IdempotencyHeaders, IdParams, IfMatchHeaders, invalid, notFound, preconditionFailed, requireIfMatch, type Deps, type Tx,
} from '@vollholz/platform';
import { record } from '../../platform.ts';
import {
  Bewertungsmodell, BewertungsmodellCreate, BewertungsmodellKurz, BewertungsmodellList, BewertungsmodellPatch, Bewertungsraster, BewertungenGespeichert,
  BewertungenPut, BewertungenQuery, Budgetrahmen, InKraftSetzen, Kriterium,
  type BewertungenPutIn, type BewertungsmodellKurzOut, type BewertungsmodellOut, type BewertungsmodellPatchIn, type BewertungsrasterOut,
} from './schemas.ts';
import * as store from './store.ts';
import { schluesselAus, VORGABE_KRITERIEN } from './vorgabe.ts';

export const TAG = 'Priorisierung';
const NAME = 'Bewertungsmodell';

const portfolioOrt = (id: string) => ({ type: 'portfolio', id });

function kurz(r: store.ModellRow, aktuellId: string | null): BewertungsmodellKurzOut {
  return {
    id: r.id, nummer: r.nummer, stand: r.stand, aktuell: r.id === aktuellId, beschreibung: r.beschreibung, beschluss: r.beschluss,
    inKraftAt: r.in_kraft_at, inKraftBy: r.in_kraft_by, version: r.version, createdAt: r.created_at, updatedAt: r.updated_at,
  } as BewertungsmodellKurzOut;
}

/** Prüfbericht des Modells (I-P1): ohne Kriterien Sperre; fehlende Zuordnung zur Matrix (A-39) und fehlende Budgetrahmen (A-18) als Hinweis. */
function pruefe(k: readonly store.KriteriumRow[], b: readonly store.BudgetRow[]): BewertungsmodellOut['pruefung'] {
  const out: BewertungsmodellOut['pruefung'] = [];
  if (!k.length) out.push({ stufe: 'sperre', text: 'Kriterien: keines statt mindestens eines. Erfassen Sie die Kriterien der Bewertung.', pfad: '/kriterien' });
  k.forEach((x, i) => {
    if (!x.dimension) out.push({ stufe: 'hinweis', text: `Kriterium «${x.text}»: weder Nutzen noch Risiko zugeordnet. Die Matrix berücksichtigt es nicht.`, pfad: `/kriterien/${i}/dimension` });
  });
  if (!b.length) out.push({ stufe: 'hinweis', text: 'Budgetrahmen: keiner erfasst. Ohne Budgetrahmen zeigt die Wasserlinie nur die Kapazität.', pfad: '/budgetrahmen' });
  return out;
}

async function lade(tx: Tx, r: store.ModellRow, write: boolean): Promise<BewertungsmodellOut> {
  const [k, b, a] = await Promise.all([store.kriterien(tx, r.id), store.budgetrahmen(tx, r.id), store.aktuell(tx)]);
  return {
    ...kurz(r, a?.id ?? null),
    kriterien: k,
    budgetrahmen: b.map(x => ({ portfolioId: x.portfolio_id, kategorie: x.kategorie, betrag: x.betrag })),
    pruefung: pruefe(k, b),
    can: { write: write && r.stand === 'entwurf' },
  };
}

const snapshot = (m: BewertungsmodellOut) => ({
  id: m.id, nummer: m.nummer, stand: m.stand, version: m.version, kriterien: (m.kriterien as store.KriteriumRow[]).map(k => ({ schluessel: k.schluessel, text: k.text, dimension: k.dimension })),
});

/** Fremdschlüssel- und Prüfregelfehler der Datenbank als Antwort (Modell in Kraft ist unveränderlich → 409). */
async function db<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === '23505') throw conflict('Es gibt bereits einen Entwurf des Bewertungsmodells. Bearbeiten oder verwerfen Sie ihn.', { reason: 'entwurf' });
    if (code === '23514') throw conflict('Ein Bewertungsmodell in Kraft lässt sich nicht ändern. Legen Sie einen Entwurf an.', { reason: 'in_kraft' });
    throw e;
  }
}

export function registerRoutes(app: FastifyInstance, _deps: Deps): void {
  for (const s of [Kriterium, Budgetrahmen, BewertungsmodellKurz, Bewertungsmodell, BewertungsmodellList, BewertungsmodellPatch, BewertungsmodellCreate, InKraftSetzen, Bewertungsraster, BewertungenPut, BewertungenGespeichert]) app.addSchema(s);

  const darf = (req: FastifyRequest) => req.can('priorisierung:write');

  // ---------------------------------------------------------------- Bewertungsmodell (PP.01.02, PP.01.03; UC-008 A1)

  app.get('/v1/bewertungsmodelle', {
    schema: { tags: [TAG], summary: 'Bewertungsmodelle auflisten', description: 'Alle Versionen, neueste zuerst; `aktuell` ist das zuletzt in Kraft gesetzte (UC-008 A1).', response: { 200: Type.Ref('BewertungsmodellList') } },
  }, async req => {
    await req.need('priorisierung:read');
    const { rows, aktuellId } = await req.tx(async tx => ({ rows: await store.modelle(tx), aktuellId: (await store.aktuell(tx))?.id ?? null }));
    return { items: rows.map(r => kurz(r, aktuellId)), can: { create: (await darf(req)) && !rows.some(r => r.stand === 'entwurf') } };
  });

  app.get('/v1/bewertungsmodelle/aktuell', {
    schema: { tags: [TAG], summary: 'Bewertungsmodell in Kraft', description: 'Das zuletzt in Kraft gesetzte Modell mit Kriterien und Budgetrahmen; 404, solange keines in Kraft ist.', response: { 200: Type.Ref('Bewertungsmodell') } },
  }, async (req, reply) => {
    await req.need('priorisierung:read');
    const write = await darf(req);
    const m = await req.tx(async tx => {
      const r = await store.aktuell(tx);
      return r ? lade(tx, r, write) : null;
    });
    if (!m) throw notFound(NAME);
    reply.header('etag', etag(m.version));
    return m;
  });

  app.get('/v1/bewertungsmodelle/:id', {
    schema: { tags: [TAG], summary: 'Bewertungsmodell lesen', description: 'Mit Kriterien, Budgetrahmen und Prüfbericht.', params: IdParams, response: { 200: Type.Ref('Bewertungsmodell') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await req.need('priorisierung:read');
    const write = await darf(req);
    const m = await req.tx(async tx => {
      const r = await store.modell(tx, id);
      return r ? lade(tx, r, write) : null;
    });
    if (!m) throw notFound(NAME);
    reply.header('etag', etag(m.version));
    return m;
  });

  app.post('/v1/bewertungsmodelle', {
    schema: {
      tags: [TAG], summary: 'Entwurf anlegen',
      description: 'Kopie des Modells in Kraft (Kriterien und Budgetrahmen), beim ersten Mal die Kriterien aus UC-008 Schritt 2. Höchstens ein Entwurf (sonst 409).',
      headers: IdempotencyHeaders, body: Type.Ref('BewertungsmodellCreate'), response: { 201: Type.Ref('Bewertungsmodell') },
    },
  }, async (req, reply) => {
    await req.need('priorisierung:write');
    const body = req.body as { beschreibung?: string };
    const who = actorOf(req);
    const m = await db(() => req.tx(async tx => {
      const vorlage = await store.aktuell(tx);
      const r = await store.entwurfAnlegen(tx, body.beschreibung ?? vorlage?.beschreibung ?? '');
      if (vorlage) {
        await store.kriterienSetzen(tx, r.id, await store.kriterien(tx, vorlage.id));
        await store.budgetrahmenSetzen(tx, r.id, (await store.budgetrahmen(tx, vorlage.id)).map(b => ({ portfolioId: b.portfolio_id, betrag: b.betrag })));
      } else {
        await store.kriterienSetzen(tx, r.id, VORGABE_KRITERIEN.map(k => ({ ...k, beschreibung: '', dimension: null })));
      }
      const m = await lade(tx, (await store.modell(tx, r.id))!, true);
      await record(tx, who, { action: 'bewertungsmodell.created', resourceType: 'bewertungsmodell', resourceId: r.id, data: { ...snapshot(m), vorlage: vorlage?.id ?? 'vorgabe' }, event: snapshot(m) });
      return m;
    }));
    return reply.code(201).header('location', `/v1/bewertungsmodelle/${m.id}`).header('etag', etag(m.version)).send(m);
  });

  app.patch('/v1/bewertungsmodelle/:id', {
    schema: {
      tags: [TAG], summary: 'Entwurf ändern',
      description: 'Nur im Entwurf und mit `If-Match` (412 bei abweichender Version). Kriterien und Budgetrahmen werden als ganze Listen ersetzt; Schlüssel eindeutig, Portfolio je Budgetrahmen einmal (422).',
      params: IdParams, headers: IfMatchHeaders, body: Type.Ref('BewertungsmodellPatch'), response: { 200: Type.Ref('Bewertungsmodell') },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('priorisierung:write');
    const p = req.body as BewertungsmodellPatchIn;
    const kriterien = p.kriterien?.map(k => ({ schluessel: k.schluessel ?? schluesselAus(k.text), text: k.text.trim(), beschreibung: k.beschreibung ?? '', dimension: k.dimension ?? null }));
    const fehler: { path: string; message: string }[] = [];
    kriterien?.forEach((k, i) => {
      if (!k.text) fehler.push({ path: `/kriterien/${i}/text`, message: 'Text fehlt.' });
      if (kriterien.findIndex(x => x.schluessel === k.schluessel) !== i) fehler.push({ path: `/kriterien/${i}/schluessel`, message: `Schlüssel «${k.schluessel}» ist mehrfach vergeben.` });
    });
    p.budgetrahmen?.forEach((b, i) => {
      if (p.budgetrahmen!.findIndex(x => x.portfolioId === b.portfolioId) !== i) fehler.push({ path: `/budgetrahmen/${i}/portfolioId`, message: 'Je Portfolio höchstens ein Budgetrahmen.' });
    });
    if (fehler.length) throw invalid('Die Angaben zum Bewertungsmodell sind nicht gültig.', fehler);
    const who = actorOf(req);
    const m = await db(() => req.tx(async tx => {
      const vorher = await store.modell(tx, id);
      if (!vorher) throw notFound(NAME);
      if (vorher.stand !== 'entwurf') throw conflict('Ein Bewertungsmodell in Kraft lässt sich nicht ändern. Legen Sie einen Entwurf an.', { reason: 'in_kraft' });
      if (vorher.version !== version) throw preconditionFailed(vorher.version);
      const alt = await lade(tx, vorher, true);
      if (kriterien) await store.kriterienSetzen(tx, id, kriterien);
      if (p.budgetrahmen) {
        const fehlt = await store.budgetrahmenSetzen(tx, id, p.budgetrahmen);
        if (fehlt.length) {
          throw invalid('Ein Portfolio des Budgetrahmens gibt es nicht.', fehlt.map(f => ({ path: `/budgetrahmen/${p.budgetrahmen!.findIndex(b => b.portfolioId === f)}/portfolioId`, message: 'unbekannt' })));
        }
      }
      const ok = p.beschreibung !== undefined ? await store.beschreibungSetzen(tx, id, version, p.beschreibung) : await store.beruehren(tx, id, version);
      if (!ok) throw preconditionFailed(vorher.version);
      const neu = await lade(tx, (await store.modell(tx, id))!, true);
      await record(tx, who, { action: 'bewertungsmodell.updated', resourceType: 'bewertungsmodell', resourceId: id, data: { before: snapshot(alt), after: snapshot(neu) }, event: snapshot(neu) });
      return neu;
    }));
    reply.header('etag', etag(m.version));
    return m;
  });

  app.delete('/v1/bewertungsmodelle/:id', {
    schema: { tags: [TAG], summary: 'Entwurf verwerfen', description: 'Nur im Entwurf und mit `If-Match`; ein Modell in Kraft bleibt (409).', params: IdParams, headers: IfMatchHeaders, response: { 204: Type.Null({ description: 'Verworfen' }) } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('priorisierung:write');
    const who = actorOf(req);
    await req.tx(async tx => {
      const vorher = await store.modell(tx, id);
      if (!vorher) throw notFound(NAME);
      if (vorher.stand !== 'entwurf') throw conflict('Ein Bewertungsmodell in Kraft lässt sich nicht verwerfen.', { reason: 'in_kraft' });
      if (vorher.version !== version || !(await store.entwurfLoeschen(tx, id, version))) throw preconditionFailed(vorher.version);
      await record(tx, who, { action: 'bewertungsmodell.deleted', resourceType: 'bewertungsmodell', resourceId: id, data: { id, nummer: vorher.nummer }, event: { id } });
    });
    return reply.code(204).send();
  });

  app.post('/v1/bewertungsmodelle/:id/in-kraft-setzen', {
    schema: {
      tags: [TAG], summary: 'Entwurf in Kraft setzen',
      description: 'Mit dem Entscheid des Gremiums (UC-008 A1.2) und `If-Match`. Sperren im Prüfbericht verhindern es (422). Ab dann wird nach diesem Modell bewertet; frühere Modelle und ihre Bewertungen bleiben nachvollziehbar.',
      params: IdParams, headers: IfMatchHeaders, body: Type.Ref('InKraftSetzen'), response: { 200: Type.Ref('Bewertungsmodell') },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('priorisierung:write');
    const { beschluss } = req.body as { beschluss: string };
    if (!beschluss.trim()) throw invalid('Nennen Sie den Entscheid des Gremiums.', [{ path: '/beschluss', message: 'fehlt' }]);
    const who = actorOf(req);
    const m = await req.tx(async tx => {
      const vorher = await store.modell(tx, id);
      if (!vorher) throw notFound(NAME);
      if (vorher.stand !== 'entwurf') throw conflict('Dieses Bewertungsmodell ist bereits in Kraft.', { reason: 'in_kraft' });
      if (vorher.version !== version) throw preconditionFailed(vorher.version);
      const sperren = (await lade(tx, vorher, true)).pruefung.filter(x => x.stufe === 'sperre');
      if (sperren.length) throw invalid('Das Bewertungsmodell lässt sich noch nicht in Kraft setzen.', sperren.map(s => ({ path: s.pfad, message: s.text })));
      if (!(await store.inKraftSetzen(tx, id, version, beschluss))) throw preconditionFailed(vorher.version);
      const m = await lade(tx, (await store.modell(tx, id))!, true);
      await record(tx, who, { action: 'bewertungsmodell.activated', resourceType: 'bewertungsmodell', resourceId: id, data: { ...snapshot(m), beschluss: m.beschluss }, event: snapshot(m) });
      return m;
    });
    reply.header('etag', etag(m.version));
    return m;
  });

  // ---------------------------------------------------------------- Bewertung (PP.02.01; UC-008 Schritte 1–2)

  app.get('/v1/portfolios/:id/bewertungen', {
    schema: {
      tags: [TAG], summary: 'Bewertungsraster des Portfolios',
      description: 'Aktive Projekte des Portfolios mit ihrer Bewertung je Kriterium (hoch/mittel/tief, A-01) nach dem Modell in Kraft oder einer früheren Version (`modell`, G11); Fortschritt «bewertet von gesamt».',
      params: IdParams, querystring: BewertungenQuery, response: { 200: Type.Ref('Bewertungsraster') },
    },
  }, async (req): Promise<BewertungsrasterOut> => {
    const { id } = req.params as { id: string };
    const q = req.query as { modell?: string };
    await req.need('priorisierung:read', portfolioOrt(id));
    const write = await darf(req);
    return req.tx(async tx => {
      const pf = await store.portfolio(tx, id);
      if (!pf) throw notFound('Portfolio');
      const a = await store.aktuell(tx);
      const m = q.modell ? await store.modell(tx, q.modell) : a;
      if (q.modell && (!m || m.stand !== 'in_kraft')) throw notFound(NAME);
      const kriterien = m ? await store.kriterien(tx, m.id) : [];
      const projekte = await store.projekte(tx, id, m?.id ?? null);
      const rows = m ? await store.bewertungen(tx, m.id, projekte.map(p => p.id)) : [];
      const anzahl = new Map<string, number>();
      for (const r of rows) anzahl.set(r.projekt_id, (anzahl.get(r.projekt_id) ?? 0) + 1);
      return {
        portfolio: pf,
        modell: m ? { ...kurz(m, a?.id ?? null), kriterien } : null,
        projekte: projekte.map(p => ({ ...p, bewertet: anzahl.get(p.id) ?? 0 })),
        bewertungen: rows.map(r => ({ projektId: r.projekt_id, kriterium: r.kriterium, einschaetzung: r.einschaetzung, kommentar: r.kommentar, version: r.version })),
        fortschritt: { bewertet: projekte.filter(p => kriterien.length > 0 && (anzahl.get(p.id) ?? 0) >= kriterien.length).length, gesamt: projekte.length },
        can: { write: write && !!m && m.id === a?.id },
      };
    });
  });

  app.put('/v1/portfolios/:id/bewertungen', {
    schema: {
      tags: [TAG], summary: 'Projekte bewerten',
      description: 'Mehrere Zellen des Rasters auf einmal (automatisches Speichern), alles oder nichts, immer nach dem Modell in Kraft (sonst 409). Bewertete Zelle nur mit ihrer gelesenen `version` (sonst 412); `einschaetzung: null` entfernt die Bewertung. Nur aktive Projekte des Portfolios und Kriterien des Modells (422).',
      params: IdParams, body: Type.Ref('BewertungenPut'), response: { 200: Type.Ref('BewertungenGespeichert') },
    },
  }, async req => {
    const { id } = req.params as { id: string };
    await req.need('priorisierung:read', portfolioOrt(id));
    await req.need('priorisierung:write');
    const body = req.body as BewertungenPutIn;
    const schluessel = body.zellen.map(z => `${z.projektId}|${z.kriterium}`);
    if (new Set(schluessel).size !== schluessel.length) throw invalid('Jede Zelle darf nur einmal vorkommen.', [{ path: '/zellen', message: 'Projekt und Kriterium doppelt' }]);
    const who = actorOf(req);
    const zellen = await req.tx(async tx => {
      if (!(await store.portfolio(tx, id))) throw notFound('Portfolio');
      const m = await store.aktuell(tx);
      if (!m) throw conflict('Es ist noch kein Bewertungsmodell in Kraft. Legen Sie das Modell fest und setzen Sie es in Kraft.', { reason: 'kein_modell' });
      const kriterien = new Set((await store.kriterien(tx, m.id)).map(k => k.schluessel));
      const projekte = new Map((await store.projekte(tx, id, null)).map(p => [p.id, p]));
      const fehler: { path: string; message: string }[] = [];
      body.zellen.forEach((z, i) => {
        if (!projekte.has(z.projektId)) fehler.push({ path: `/zellen/${i}/projektId`, message: 'kein aktives Projekt dieses Portfolios' });
        if (!kriterien.has(z.kriterium)) fehler.push({ path: `/zellen/${i}/kriterium`, message: `kein Kriterium des Bewertungsmodells ${m.nummer}` });
      });
      if (fehler.length) throw invalid('Die Bewertung passt nicht zu Portfolio oder Bewertungsmodell.', fehler);
      const out: BewertungsrasterOut['bewertungen'] = [];
      for (const z of body.zellen) {
        const vorher = await store.bewertung(tx, m.id, z.projektId, z.kriterium);
        if (vorher && z.version !== vorher.version) throw preconditionFailed(vorher.version);
        if (!vorher && z.version !== undefined) throw preconditionFailed(0);
        const leer = { projektId: z.projektId, kriterium: z.kriterium, einschaetzung: null, kommentar: '', version: null };
        if (z.einschaetzung === null) {
          if (vorher) {
            if (!(await store.bewertungLoeschen(tx, vorher.id, vorher.version))) throw preconditionFailed(vorher.version);
            await record(tx, who, { action: 'bewertung.deleted', resourceType: 'bewertung', resourceId: vorher.id, data: { ...leer, modell: m.nummer, vorher: vorher.einschaetzung }, event: { id: vorher.id, projektId: z.projektId, kriterium: z.kriterium } });
          }
          out.push(leer);
          continue;
        }
        const kommentar = (z.kommentar ?? vorher?.kommentar ?? '').trim();
        if (vorher && vorher.einschaetzung === z.einschaetzung && vorher.kommentar === kommentar) {
          out.push({ projektId: z.projektId, kriterium: z.kriterium, einschaetzung: vorher.einschaetzung, kommentar: vorher.kommentar, version: vorher.version });
          continue;
        }
        const r = vorher ? await store.bewertungAendern(tx, vorher.id, vorher.version, z.einschaetzung, kommentar) : await store.bewertungAnlegen(tx, m.id, z.projektId, z.kriterium, z.einschaetzung, kommentar);
        if (!r) throw preconditionFailed(vorher!.version);
        const daten = { projektId: z.projektId, kriterium: z.kriterium, einschaetzung: r.einschaetzung, modell: m.nummer, version: r.version };
        await record(tx, who, {
          action: vorher ? 'bewertung.updated' : 'bewertung.created', resourceType: 'bewertung', resourceId: r.id,
          data: vorher ? { ...daten, vorher: vorher.einschaetzung, kommentar: r.kommentar } : { ...daten, kommentar: r.kommentar }, event: { id: r.id, ...daten },
        });
        out.push({ projektId: z.projektId, kriterium: z.kriterium, einschaetzung: r.einschaetzung, kommentar: r.kommentar, version: r.version });
      }
      return out;
    });
    return { zellen };
  });
}
