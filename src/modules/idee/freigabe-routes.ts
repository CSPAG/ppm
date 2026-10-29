/**
 * Routen für die Freigabe der Initialisierung (AP-E4-3; UC-001 Schritte 6–7, A4, A5; Kernablauf K4 Schritte 8–10):
 * Stand der Freigabe, dem Gremium vorlegen bzw. der Direktion übergeben (UE, `idee:write`), Sponsor und Projektleitung
 * für den Entscheid erfassen (A-05) und – bei Kategorie C – Freigabe oder Zurückweisung durch die Direktion
 * (`idee:decide` am Portfolio, UC-001 A4.2). Die Direktion hat am Projekt noch keine Rolle und keine Prüfrechte an der
 * Idee; ihre Handlung läuft nach geprüftem Recht mit voller Sicht in einer Transaktion (Projekt, Rollen, Idee, Eingang).
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  actorOf, conflict, etag, IdempotencyHeaders, IdParams, IfMatchHeaders, invalid, notFound, preconditionFailed, requireIfMatch,
  type Deps, type Tx,
} from '@vollholz/platform';
import { fullTx, record } from '../../platform.ts';
import { aufgabe, mitteilung } from '../eingang/index.ts';
import { entscheidendesGremium } from '../portfolio/index.ts';
import { traktandum } from '../sitzung/index.ts';
import { antragVon, initialisieren, link, nichtFreigeben, pruefePersonen, titelVon } from './freigabe.ts';
import { AblehnenIn, AngabenIn, Freigabe, FreigebenIn, type FreigabeOut } from './freigabe-schemas.ts';
import * as fs from './freigabe-store.ts';
import * as ps from './pruefung-store.ts';
import { TAG } from './routes.ts';
import type { Stand } from './schemas.ts';
import * as store from './store.ts';
import { ideeVermerke } from './vermerk.ts';

/** Vorlegen: solange die Idee bei der UE liegt (auch nach «zurückgestellt», UC-001 A5). */
const VORLEGBAR: readonly Stand[] = ['eingereicht', 'in_pruefung', 'zurueckgestellt'];
/** Sponsor und Projektleitung erfassen: bis zum Entscheid (A-05). */
const ANGABEN: readonly Stand[] = ['eingereicht', 'in_pruefung', 'zurueckgestellt', 'traktandiert'];

async function laden(tx: Tx, id: string, version: number, staende: readonly Stand[]): Promise<store.Row> {
  await ps.sperren(tx, id);
  const r = await store.get(tx, id);
  if (!r || r.stand === 'entwurf') throw notFound('Idee');
  if (r.version !== version) throw preconditionFailed(r.version);
  if (!staende.includes(r.stand)) throw conflict(`Die Idee ist ${r.stand.replace('_', ' ')}; diese Handlung ist jetzt nicht möglich.`);
  return r;
}

async function freigabeOut(req: FastifyRequest, tx: Tx, r: store.Row): Promise<FreigabeOut> {
  const a = (await fs.angaben(tx, r.id))!;
  const pf = a.portfolio_id ? await fs.portfolio(tx, a.portfolio_id) : null;
  const weg = !pf ? null : pf.kategorie === 'C' ? 'direktion' : 'gremium';
  const gremium = weg === 'gremium' ? await entscheidendesGremium(tx, pf!.id) : null;
  const write = await req.can('idee:write');
  const p = a.projekt_id ? await fs.projekt(tx, a.projekt_id) : null;
  return {
    weg,
    zustaendig: weg === 'direktion' ? pf!.name : gremium ? `${gremium.kuerzel.toUpperCase()} ${gremium.name}` : null,
    vorgesehenerSponsor: a.vorgesehener_sponsor, sponsor: a.sponsor, projektleitung: a.projektleitung,
    freigegebenAt: a.freigegeben_at?.toISOString() ?? null,
    projekt: p ? { id: p.id, nummer: p.nummer, name: p.name } : null,
    can: {
      traktandieren: write && !!weg && VORLEGBAR.includes(r.stand),
      angaben: write && weg === 'gremium' && ANGABEN.includes(r.stand),
      entscheiden: weg === 'direktion' && r.stand === 'traktandiert' && await req.can('idee:decide', { type: 'portfolio', id: pf!.id }),
      initialisieren: write && r.stand === 'traktandiert' && !a.projekt_id && !!a.sponsor && !!a.projektleitung,
    },
    vermerke: ideeVermerke(r.stand, a.projekt_id),
  };
}

const snap = (r: store.Row) => ({ id: r.id, nummer: r.nummer, stand: r.stand, version: r.version });

export function registerFreigabeRoutes(app: FastifyInstance, deps: Deps): void {
  for (const s of [Freigabe, AngabenIn, FreigebenIn, AblehnenIn]) app.addSchema(s);

  const antwort = async (req: FastifyRequest, reply: { header(k: string, v: string): unknown }, tx: Tx, id: string) => {
    const r = (await store.get(tx, id))!;
    reply.header('etag', etag(r.version));
    return freigabeOut(req, tx, r);
  };

  /**
   * Handlung der Direktion (Kategorie C): Recht `idee:decide` am Portfolio der Idee prüfen (Lesesicht der Person), dann
   * mit voller Sicht in einer Transaktion. 404, wenn die Person die Idee nicht sieht; 403 ohne Recht am Portfolio.
   */
  const alsDirektion = async <T>(req: FastifyRequest, id: string, fn: (tx: Tx) => Promise<T>): Promise<T> => {
    const portfolioId = await req.tx(async tx => {
      const r = await store.get(tx, id);
      if (!r || r.stand === 'entwurf') throw notFound('Idee');
      return (await fs.angaben(tx, id))!.portfolio_id;
    });
    const pf = portfolioId ? await req.tx(tx => fs.portfolio(tx, portfolioId)) : null;
    if (!pf || pf.kategorie !== 'C') throw conflict('Diese Idee ist keiner Direktion übergeben (Kategorie C).');
    await req.need('idee:decide', { type: 'portfolio', id: pf.id });
    return fullTx(deps.db, req.requirePrincipal().tenantId, fn);
  };

  app.get('/v1/ideen/:id/freigabe', {
    schema: { tags: [TAG], summary: 'Freigabe der Initialisierung', description: 'Weg (Gremium bei Kategorie A, B; Direktion bei C), Sponsor und Projektleitung, entstandenes Projekt und was die Person tun darf (UC-001 Schritte 6–7, A4). Sichtbar mit der Idee.', params: IdParams, response: { 200: Type.Ref('IdeeFreigabe') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return req.tx(async tx => {
      const r = await store.get(tx, id);
      if (!r || r.stand === 'entwurf') throw notFound('Idee');
      reply.header('etag', etag(r.version));
      return freigabeOut(req, tx, r);
    });
  });

  app.put('/v1/ideen/:id/freigabe/angaben', {
    schema: { tags: [TAG], summary: 'Sponsor und Projektleitung erfassen', description: 'Für den Entscheid des Gremiums (A-05: das Gremium benennt den Sponsor, der Sponsor die Projektleitung; die UE erfasst beide). Bis zum Entscheid, nur Kategorie A, B. Nur mit `If-Match`.', params: IdParams, headers: Type.Composite([IfMatchHeaders, IdempotencyHeaders]), body: Type.Ref('IdeeFreigabeAngabenIn'), response: { 200: Type.Ref('IdeeFreigabe') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('idee:write');
    const body = req.body as { sponsor: string | null; projektleitung: string | null };
    const who = actorOf(req);
    return req.tx(async tx => {
      const r = await laden(tx, id, version, ANGABEN);
      const pf = (await fs.angaben(tx, id))!.portfolio_id;
      if (!pf || (await fs.portfolio(tx, pf))?.kategorie === 'C') throw conflict('Bei Kategorie C benennt die Direktion Projektauftraggeber:in und Projektleitung mit der Freigabe.');
      const vorhanden = await fs.personenVorhanden(tx, [body.sponsor, body.projektleitung].filter((x): x is string => !!x));
      const fehler = (['sponsor', 'projektleitung'] as const).filter(k => body[k] && !vorhanden.has(body[k]!))
        .map(k => ({ path: `/${k}`, message: 'Diese Person gibt es in der Organisation nicht.' }));
      if (fehler.length) throw invalid('Die Person gibt es nicht.', fehler);
      await ps.setzen(tx, id, { sponsor: body.sponsor, projektleitung: body.projektleitung });
      await record(tx, who, { action: 'idee.staffed', resourceType: 'idee', resourceId: id, data: { ...snap(r), sponsor: body.sponsor, projektleitung: body.projektleitung }, event: snap(r) });
      return antwort(req, reply, tx, id);
    });
  });

  app.post('/v1/ideen/:id/traktandieren', {
    schema: { tags: [TAG], summary: 'Dem Gremium vorlegen bzw. der Direktion übergeben', description: 'Kategorie A, B: Vorschlag der Art «Initialisierung» für die nächste Sitzung des entscheidenden Gremiums (UC-001 Schritt 6); Kategorie C: Aufgabe «Initialisierung freigeben» an die Direktion (`idee:decide` am Portfolio, A4). Stand «traktandiert», Antragstellende informiert, Aufgabe «Projektidee prüfen» erledigt. Ohne Kategorie 409. Nur mit `If-Match`.', params: IdParams, headers: Type.Composite([IfMatchHeaders, IdempotencyHeaders]), response: { 200: Type.Ref('IdeeFreigabe') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('idee:write');
    const who = actorOf(req);
    return req.tx(async tx => {
      const r = await laden(tx, id, version, VORLEGBAR);
      const a = (await fs.angaben(tx, id))!;
      const pf = a.portfolio_id ? await fs.portfolio(tx, a.portfolio_id) : null;
      if (!pf) throw conflict('Ordne zuerst die Kategorie zu; sie bestimmt Portfolio und Gremium.');
      const bezug = { typ: 'idee', id };
      let an: string;
      if (pf.kategorie === 'C') {
        await aufgabe.oeffnen(tx, {
          art: 'idee.freigeben', bezug, empfaenger: { recht: 'idee:decide', ort: { typ: 'portfolio', id: pf.id } },
          titel: `Initialisierung freigeben · ${titelVon(r)}`, kontext: `Idee ${r.nummer} · Kategorie C · ${pf.name}`, link: link(r.nummer),
        });
        an = `der Direktion (${pf.name})`;
      } else {
        await traktandum.vorschlagen(tx, { art: 'idee', bezug, portfolioId: pf.id, titel: `Initialisierung: ${titelVon(r)}`, antrag: antragVon(a.kategorie) });
        const g = await entscheidendesGremium(tx, pf.id);
        an = g ? `dem ${g.kuerzel.toUpperCase()}` : 'dem Gremium';
      }
      await ps.setzen(tx, id, { stand: 'traktandiert' });
      await aufgabe.erledigen(tx, { art: 'idee.pruefen', bezug });
      await mitteilung.senden(tx, { an: r.erfasst_von, bezug, text: `Deine Projektidee «${titelVon(r)}» ist ${an} zum Entscheid vorgelegt.`, link: link(r.nummer) });
      await record(tx, who, { action: 'idee.scheduled', resourceType: 'idee', resourceId: id, data: { ...snap(r), portfolioId: pf.id, kategorie: pf.kategorie }, event: { ...snap(r), stand: 'traktandiert' } });
      return antwort(req, reply, tx, id);
    });
  });

  app.post('/v1/ideen/:id/freigeben', {
    schema: { tags: [TAG], summary: 'Initialisierung freigeben (Direktion)', description: 'Kategorie C (UC-001 A4.2): Die Direktion gibt frei und benennt Sponsor und Projektleitung. Das Projekt entsteht in Phase P0 im Portfolio der Direktion mit den Angaben der Idee; die Projektleitung erhält «Projektvertrag erstellen». Recht `idee:decide` am Portfolio, nur mit `If-Match`.', params: IdParams, headers: Type.Composite([IfMatchHeaders, IdempotencyHeaders]), body: Type.Ref('IdeeFreigebenIn'), response: { 200: Type.Ref('IdeeFreigabe') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    const body = req.body as { sponsor: string; projektleitung: string; begruendung?: string };
    const who = actorOf(req);
    const principalId = req.requirePrincipal().principalId;
    await alsDirektion(req, id, async tx => {
      const r = await laden(tx, id, version, ['traktandiert']);
      await pruefePersonen(tx, body.sponsor, body.projektleitung);
      await initialisieren(tx, { db: deps.db, tuples: deps.iam.tuples }, who, principalId, r, { sponsor: body.sponsor, projektleitung: body.projektleitung, begruendung: (body.begruendung ?? '').trim() });
    });
    return req.tx(tx => antwort(req, reply, tx, id));
  });

  app.post('/v1/ideen/:id/initialisieren', {
    schema: { tags: [TAG], summary: 'Initialisierung vor dem Entscheid starten', description: 'UC-001 A6 (A-74): Die UE legt das Projekt in P0 an wie bei der Freigabe, solange die Idee traktandiert ist; die Idee trägt den Vermerk «Initialisierung nicht freigegeben», Traktandum bzw. Aufgabe der Direktion bleiben offen. Der spätere Entscheid ersetzt den Vermerk; bei Ablehnung läuft das Projekt weiter, Projektleitung und Projektauftraggeber:in werden informiert. Recht `idee:write`; Projektauftraggeber:in und Projektleitung müssen erfasst sein (422); schon initialisiert: 409. Nur mit `If-Match`.', params: IdParams, headers: Type.Composite([IfMatchHeaders, IdempotencyHeaders]), response: { 200: Type.Ref('IdeeFreigabe') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('idee:write');
    const who = actorOf(req);
    const principalId = req.requirePrincipal().principalId;
    // Projekt, Organisation und Zugriff mit voller Sicht wie die Folge des Entscheids (Recht oben geprüft)
    await fullTx(deps.db, req.requirePrincipal().tenantId, async tx => {
      const r = await laden(tx, id, version, ['traktandiert']);
      const a = (await fs.angaben(tx, id))!;
      if (a.projekt_id) throw conflict('Zu dieser Idee läuft die Initialisierung bereits.', { reason: 'projekt' });
      try {
        await pruefePersonen(tx, a.sponsor, a.projektleitung);
      } catch {
        throw invalid('Für die Initialisierung fehlen Projektauftraggeber:in oder Projektleitung. Erfasse beide bei der Idee.', [{ path: '/angaben', message: 'Projektauftraggeber:in und Projektleitung fehlen (A-05).' }]);
      }
      await initialisieren(tx, { db: deps.db, tuples: deps.iam.tuples }, who, principalId, r, { sponsor: a.sponsor!, projektleitung: a.projektleitung!, begruendung: '', vorab: true });
    });
    return req.tx(tx => antwort(req, reply, tx, id));
  });

  app.post('/v1/ideen/:id/ablehnen', {
    schema: { tags: [TAG], summary: 'Initialisierung zurückweisen (Direktion)', description: 'Kategorie C (UC-001 A4.2): Die Direktion weist die Idee mit Begründung (Pflicht) zurück; Stand «zurückgewiesen», Antragstellende informiert. Recht `idee:decide` am Portfolio, nur mit `If-Match`.', params: IdParams, headers: Type.Composite([IfMatchHeaders, IdempotencyHeaders]), body: Type.Ref('IdeeAblehnenIn'), response: { 200: Type.Ref('IdeeFreigabe') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    const begruendung = (req.body as { begruendung: string }).begruendung.trim();
    if (!begruendung) throw invalid('Begründung fehlt.', [{ path: '/begruendung', message: 'Begründung fehlt: Die antragstellende Person erfährt sonst nicht, warum die Idee nicht weiterverfolgt wird.' }]);
    const who = actorOf(req);
    await alsDirektion(req, id, async tx => {
      const r = await laden(tx, id, version, ['traktandiert']);
      await nichtFreigeben(tx, who, r, 'zurueckgewiesen', begruendung);
    });
    return req.tx(tx => antwort(req, reply, tx, id));
  });
}
