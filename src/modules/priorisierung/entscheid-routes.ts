/**
 * Routen des Priorisierungsentscheids (AP-E5-5; UC-008 Schritte 7–8, A2; K5 Schritte 7–8): Folgeentscheide je laufendem
 * Projekt unter der Wasserlinie beantragen und den Antrag «Für das Gremium traktandieren» (Art `priorisierung`).
 * Entschieden wird in der Sitzung (K3, Modul sitzung); die Folge läuft in `entscheid.ts` (`beiEntscheid`).
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { actorOf, conflict, etag, IdParams, IfMatchHeaders, invalid, notFound, preconditionFailed, requireIfMatch, type Deps, type Tx } from '@vollholz/platform';
import { record } from '../../platform.ts';
import { traktandum } from '../sitzung/index.ts';
import { pruefeFolgen, unterWasserlinie, zusammenfassung } from './entscheid.ts';
import { SzenarioEntscheid, SzenarioFolgenPut, SzenarioTraktandiert, type SzenarioEntscheidOut, type SzenarioFolgenPutIn } from './entscheid-schemas.ts';
import * as es from './entscheid-store.ts';
import { TAG } from './routes.ts';
import * as sz from './szenario-store.ts';

const portfolioOrt = (id: string) => ({ type: 'portfolio', id });

async function lade(tx: Tx, s: sz.SzenarioRow, write: boolean): Promise<SzenarioEntscheidOut> {
  const unter = await unterWasserlinie(tx, s);
  const pruefung: string[] = [];
  try { pruefeFolgen(unter); } catch (e) { pruefung.push((e as Error).message); }
  if (s.stand !== 'beantragt') pruefung.push(`Antrag: Szenario «${s.name}» ist nicht als Antrag gewählt. Wähle es im Vergleich als Antrag.`);
  return {
    szenarioId: s.id, stand: s.stand,
    unterWasserlinie: unter.map(u => ({ projektId: u.projektId, nummer: u.nummer, name: u.name, phase: u.phase, folge: u.folge?.folge ?? null, begruendung: u.folge?.begruendung ?? '' })),
    traktandierbar: !pruefung.length,
    pruefung,
    can: { write: write && (s.stand === 'entwurf' || s.stand === 'beantragt') },
  };
}

export function registerEntscheidRoutes(app: FastifyInstance, _deps: Deps): void {
  for (const s of [SzenarioEntscheid, SzenarioFolgenPut, SzenarioTraktandiert]) app.addSchema(s);

  async function szenario(req: FastifyRequest, id: string): Promise<sz.SzenarioRow> {
    const s = await req.tx(tx => sz.lesen(tx, id));
    if (!s) throw notFound('Szenario');
    await req.need('priorisierung:read', portfolioOrt(s.portfolio_id));
    return s;
  }

  app.get('/v1/szenarien/:id/entscheid', {
    schema: {
      tags: [TAG], summary: 'Entscheid vorbereiten',
      description: 'Laufende Projekte (ab Phase P1) unter der Wasserlinie mit dem beantragten Folgeentscheid (UC-008 A2) und ob der Antrag traktandiert werden kann. ETag = Version des Szenarios.',
      params: IdParams, response: { 200: Type.Ref('SzenarioEntscheid') },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const s = await szenario(req, id);
    const write = await req.can('priorisierung:write', portfolioOrt(s.portfolio_id));
    reply.header('etag', etag(s.version));
    return req.tx(tx => lade(tx, s, write));
  });

  app.put('/v1/szenarien/:id/folgen', {
    schema: {
      tags: [TAG], summary: 'Folgeentscheide beantragen',
      description: 'Je laufendem Projekt unter der Wasserlinie «zurückstellen», «sistieren» oder «abbrechen» (UC-008 A2); ersetzt die bisherigen. Nur für laufende Projekte unter der Wasserlinie (422), im Entwurf oder Antrag, mit `If-Match` auf das Szenario (412).',
      params: IdParams, headers: IfMatchHeaders, body: Type.Ref('SzenarioFolgenPut'), response: { 200: Type.Ref('SzenarioEntscheid') },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    const s0 = await szenario(req, id);
    await req.need('priorisierung:write', portfolioOrt(s0.portfolio_id));
    const body = req.body as SzenarioFolgenPutIn;
    const who = actorOf(req);
    const out = await req.tx(async tx => {
      const s = await sz.lesen(tx, id);
      if (!s) throw notFound('Szenario');
      if (s.version !== version) throw preconditionFailed(s.version);
      if (s.stand !== 'entwurf' && s.stand !== 'beantragt') throw conflict(`Das Szenario «${s.name}» ist ${s.stand}; Folgeentscheide sind nicht mehr änderbar.`, { reason: 'stand', stand: s.stand });
      const unter = new Set((await unterWasserlinie(tx, s)).map(u => u.projektId));
      const fehler: { path: string; message: string }[] = [];
      body.folgen.forEach((f, i) => {
        if (!unter.has(f.projektId)) fehler.push({ path: `/folgen/${i}/projektId`, message: 'kein laufendes Projekt unter der Wasserlinie dieses Szenarios' });
        if (body.folgen.findIndex(x => x.projektId === f.projektId) !== i) fehler.push({ path: `/folgen/${i}/projektId`, message: 'Projekt mehrfach genannt' });
      });
      if (fehler.length) throw invalid('Die Folgeentscheide passen nicht zum Szenario.', fehler);
      const neu = await sz.aendern(tx, s.id, s.version, {});
      if (!neu) throw preconditionFailed(s.version);
      await es.folgenSetzen(tx, s.id, body.folgen.map(f => ({ projektId: f.projektId, folge: f.folge, begruendung: f.begruendung ?? '' })));
      const daten = { id: s.id, version: neu.version, folgen: body.folgen.map(f => ({ projektId: f.projektId, folge: f.folge })) };
      await record(tx, who, { action: 'szenario.consequences_proposed', resourceType: 'szenario', resourceId: s.id, data: daten, event: daten });
      return { o: await lade(tx, neu, true), v: neu.version };
    });
    reply.header('etag', etag(out.v));
    return out.o;
  });

  app.post('/v1/szenarien/:id/traktandieren', {
    schema: {
      tags: [TAG], summary: 'Für das Gremium traktandieren',
      description: 'Schlägt den Antrag als Traktandum der Art `priorisierung` dem entscheidenden Gremium des Portfolios vor (UC-008 Schritt 7, K5 Schritt 7); erneut aufgerufen, aktualisiert es Titel und Antrag. Nur für das als Antrag gewählte Szenario und mit Folgeentscheid für jedes laufende Projekt unter der Wasserlinie (409 `folge_fehlt`). Mit `If-Match` (412).',
      params: IdParams, headers: IfMatchHeaders, response: { 200: Type.Ref('SzenarioTraktandiert') },
    },
  }, async req => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    const s0 = await szenario(req, id);
    await req.need('priorisierung:write', portfolioOrt(s0.portfolio_id));
    const who = actorOf(req);
    return req.tx(async tx => {
      const s = await sz.lesen(tx, id);
      if (!s) throw notFound('Szenario');
      if (s.version !== version) throw preconditionFailed(s.version);
      if (s.stand !== 'beantragt') throw conflict(`Das Szenario «${s.name}» ist nicht als Antrag gewählt. Wähle es im Vergleich als Antrag.`, { reason: 'stand', stand: s.stand });
      pruefeFolgen(await unterWasserlinie(tx, s));
      const z = await zusammenfassung(tx, s);
      const traktandumId = await traktandum.vorschlagen(tx, { art: 'priorisierung', bezug: { typ: 'szenario', id: s.id }, portfolioId: s.portfolio_id, titel: z.titel, antrag: z.antrag });
      const daten = { id: s.id, portfolioId: s.portfolio_id, traktandumId };
      await record(tx, who, { action: 'szenario.scheduled', resourceType: 'szenario', resourceId: s.id, data: daten, event: daten });
      return { traktandumId, ...z };
    });
  });
}
