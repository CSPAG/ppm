/**
 * Routen der Projektideen für Antragstellende (BC DM.01.01; UC-001 Schritte 1–2, A2.2; Kernablauf K4) nach dem Muster
 * der Handlungsfelder: Rechte über `req.need`, Lesesicht über `req.tx` (Muster EIGEN), Fähigkeiten `can`, Cursor,
 * ETag/If-Match (412), Idempotenz (Querschnitt), Audit und Ereignis in derselben Transaktion; Aufgaben des Eingangs in
 * derselben Transaktion (fachmodell.md 4.1). Prüfung, Pool und Freigabe (AP-E4-2, AP-E4-3) hängen eigene Dateien ein.
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  actorOf, conflict, decodeCursor, encodeCursor, etag, forbidden, IdempotencyHeaders, IdParams, IfMatchHeaders, invalid, notFound,
  preconditionFailed, requireIfMatch, type Deps, type Tx,
} from '@vollholz/platform';
import { record } from '../../platform.ts';
import { aufgabe } from '../eingang/index.ts';
import { codewertAktiv } from '../stammdaten/index.ts';
import {
  FELDER, Idee, IdeeAuswahl, IdeeCreate, IdeeKopf, IdeeList, IdeePatch, IdeeZeile, ListQuery, Rueckfrage, RueckfrageAntwort, RueckfrageParams,
  type CanOut, type Felder, type IdeeOut, type IdeePatchIn, type IdeeZeileOut, type Stand,
} from './schemas.ts';
import * as store from './store.ts';

export const TAG = 'Ideen';

/** Stände, in denen Antragstellende ihre Idee bearbeiten (Entwurf; in Ergänzung nach Rückfrage, UC-001 A2.2). */
const BEARBEITBAR: readonly Stand[] = ['entwurf', 'in_ergaenzung'];

/**
 * Pflichtfelder beim Einreichen (UC-001 Schritt 2) mit Text der Sperre (K4 Regeln: was fehlt, warum, was tun). Ziel,
 * Bereiche und Herkunft sind freiwillig, damit Personen ohne Kenntnis der Strategie einreichen können (K4-1).
 */
const PFLICHT: readonly { feld: keyof Felder; fehlt: (r: store.Row) => boolean; text: string }[] = [
  { feld: 'titel', fehlt: r => !r.titel, text: 'Titel fehlt: Gib der Idee einen kurzen Namen, unter dem sie im Ideenpool erscheint.' },
  { feld: 'ausgangslage', fehlt: r => !r.ausgangslage, text: 'Ausgangslage fehlt: Beschreibe, was heute ist und was daran stört.' },
  { feld: 'zielsetzung', fehlt: r => !r.zielsetzung, text: 'Zielsetzung fehlt: Ohne Ziel kann die Unternehmensentwicklung die Idee nicht einordnen. Beschreibe in zwei, drei Sätzen, was erreicht werden soll.' },
  { feld: 'handlungsfeldId', fehlt: r => !r.handlungsfeld_id, text: 'Handlungsfeld fehlt: Wähle das Handlungsfeld, zu dem die Idee am besten passt.' },
  { feld: 'nutzen', fehlt: r => !r.nutzen, text: 'Nutzen fehlt: Schätze den Nutzen als hoch, mittel oder tief ein.' },
  { feld: 'aufwand', fehlt: r => !r.aufwand, text: 'Aufwand fehlt: Schätze den Aufwand als hoch, mittel oder tief ein.' },
  { feld: 'relevanz', fehlt: r => !r.relevanz, text: 'Relevanz fehlt: Schätze die Relevanz als hoch, mittel oder tief ein.' },
];

interface Ctx { me: string; create: boolean }

async function ctxOf(req: FastifyRequest): Promise<Ctx> {
  return { me: req.requirePrincipal().principalId, create: await req.can('idee:create') };
}

function can(r: store.Row, c: Ctx): CanOut {
  const eigen = r.erfasst_von === c.me && c.create;
  return { bearbeiten: eigen && BEARBEITBAR.includes(r.stand), einreichen: eigen && BEARBEITBAR.includes(r.stand), loeschen: eigen && r.stand === 'entwurf' };
}

function felder(r: store.Row): Felder {
  return {
    titel: r.titel, ausgangslage: r.ausgangslage, zielsetzung: r.zielsetzung, handlungsfeldId: r.handlungsfeld_id,
    strategischesZielId: r.strategisches_ziel_id, bereiche: r.org_einheit_ids, nutzen: r.nutzen, nutzenText: r.nutzen_text,
    aufwand: r.aufwand, aufwandText: r.aufwand_text, relevanz: r.relevanz, relevanzText: r.relevanz_text, herkunft: r.herkunft,
  };
}

function rueckfrageOut(q: store.RueckfrageRow) {
  return { id: q.id, feld: q.feld as (typeof FELDER)[number] | null, text: q.text, antwort: q.antwort, gestelltAt: q.gestellt_at, beantwortetAt: q.beantwortet_at };
}

function out(r: store.Row, rueckfragen: store.RueckfrageRow[], c: Ctx): IdeeOut {
  return {
    id: r.id, nummer: r.nummer, stand: r.stand, standAt: r.stand_at, eingereichtAt: r.eingereicht_at, erfasstVon: r.erfasst_von,
    eigene: r.erfasst_von === c.me, ...felder(r), fuehrendeIdeeId: r.fuehrende_idee_id, begruendung: r.begruendung,
    rueckfragen: rueckfragen.map(rueckfrageOut), version: r.version, createdAt: r.created_at, updatedAt: r.updated_at, can: can(r, c),
  };
}

function zeile(r: store.Row, c: Ctx): IdeeZeileOut {
  return {
    id: r.id, nummer: r.nummer, titel: r.titel, stand: r.stand, standAt: r.stand_at, eingereichtAt: r.eingereicht_at,
    eigene: r.erfasst_von === c.me, handlungsfeldId: r.handlungsfeld_id, rueckfragenOffen: r.rueckfragen_offen, updatedAt: r.updated_at,
  };
}

/** Daten für Audit und Ereignis (ohne Fähigkeiten und ohne Rückfragen). */
const snapshot = (r: store.Row) => ({ id: r.id, nummer: r.nummer, stand: r.stand, ...felder(r), version: r.version });

/**
 * Lesen der Ideen: eigene mit `idee:create`, eingereichte mit `idee:list` (alle Mitglieder, Master Entscheid 14), der
 * Pool mit `idee:read` (an der Organisation oder an einem Portfolio). Was sichtbar ist, entscheidet die Lesesicht.
 */
async function needLesen(req: FastifyRequest): Promise<void> {
  if (!(await req.can('idee:create')) && !(await req.can('idee:list'))) await req.needSomewhere('idee:read');
}

/**
 * Bezüge prüfen (Handlungsfeld, Ziel, Bereiche, Herkunft): Unbekanntes – auch aus anderen Organisationen – ist eine
 * ungültige Eingabe (422) statt eines Konflikts aus dem Fremdschlüssel. Ein Ziel ohne Handlungsfeld ergänzt dieses.
 */
async function bezuegePruefen(req: FastifyRequest, deps: Deps, tx: Tx, input: IdeePatchIn, vorher: store.Row | null): Promise<IdeePatchIn> {
  const ctx = { db: deps.db, tenantId: req.requirePrincipal().tenantId };
  const fehler: { path: string; message: string }[] = [];
  const next = { ...input };
  const zielId = input.strategischesZielId !== undefined ? input.strategischesZielId : vorher?.strategisches_ziel_id ?? null;
  if (zielId) {
    const z = await store.zielVon(ctx, zielId);
    const feld = input.handlungsfeldId !== undefined ? input.handlungsfeldId : vorher?.handlungsfeld_id ?? null;
    if (!z) fehler.push({ path: '/strategischesZielId', message: 'Unbekanntes strategisches Ziel.' });
    else if (!feld) next.handlungsfeldId = z.handlungsfeld_id;
    else if (feld !== z.handlungsfeld_id) fehler.push({ path: '/strategischesZielId', message: 'Das strategische Ziel gehört zu einem anderen Handlungsfeld.' });
  }
  if (input.bereiche?.length && (await store.bereicheAktiv(tx, input.bereiche)) !== input.bereiche.length) {
    fehler.push({ path: '/bereiche', message: 'Unbekannte oder inaktive Organisationseinheit.' });
  }
  if (input.herkunft && !(await codewertAktiv(tx, 'idee_herkunft', input.herkunft))) {
    fehler.push({ path: '/herkunft', message: 'Unbekannte Herkunft.' });
  }
  if (fehler.length) throw invalid('Die Angaben verweisen auf Unbekanntes.', fehler);
  return next;
}

/** Unbekanntes Handlungsfeld aus dem Fremdschlüssel als 422 (fremde und nirgends vorhandene IDs gleich behandelt). */
async function fremdschluessel<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if ((e as { code?: string }).code === '23503') throw invalid('Die Angaben verweisen auf Unbekanntes.', [{ path: '/handlungsfeldId', message: 'Unbekanntes Handlungsfeld.' }]);
    throw e;
  }
}

/** Eigene Idee in einem bearbeitbaren Stand oder 404/409; Version per If-Match. */
async function eigeneBearbeitbar(tx: Tx, id: string, me: string, version: number | null): Promise<store.Row> {
  const r = await store.get(tx, id);
  if (!r) throw notFound('Idee');
  if (r.erfasst_von !== me) throw forbidden('Nur die Person, die die Idee erfasst hat, kann sie bearbeiten.');
  if (!BEARBEITBAR.includes(r.stand)) throw conflict('Die Idee ist eingereicht. Ändern kannst du sie erst, wenn die Unternehmensentwicklung Rückfragen stellt.');
  if (version !== null && r.version !== version) throw preconditionFailed(r.version);
  return r;
}

export function registerRoutes(app: FastifyInstance, deps: Deps): void {
  for (const s of [Rueckfrage, Idee, IdeeZeile, IdeeList, IdeeCreate, IdeePatch, RueckfrageAntwort, IdeeAuswahl, IdeeKopf]) app.addSchema(s);

  app.get('/v1/ideen', {
    schema: { tags: [TAG], summary: 'Projektideen auflisten', description: 'Neueste zuerst, Cursor-Paginierung. Alle Mitglieder sehen eingereichte Ideen (`idee:list`, Master Entscheid 14), mit `eigene` nur die eigenen; Entwürfe nur, wer sie erfasst.', querystring: ListQuery, response: { 200: Type.Ref('IdeeList') } },
  }, async req => {
    await needLesen(req);
    const q = req.query as { stand?: Stand[]; eigene?: boolean; nummer?: number; q?: string; cursor?: string; limit?: number };
    const limit = q.limit ?? 50;
    const filter = `${(q.stand ?? []).join(',')}|${q.eigene ? 1 : 0}|${q.nummer ?? ''}|${q.q ?? ''}`;
    const after = decodeCursor<{ n: number; f: string }>(q.cursor, v => Number.isInteger(v.n) && v.f === filter);
    const rows = await req.tx(tx => store.list(tx, { stand: q.stand, eigene: q.eigene, nummer: q.nummer, q: q.q?.trim() || undefined, after: after?.n, limit }));
    const page = rows.slice(0, limit);
    const c = await ctxOf(req);
    const last = page[page.length - 1];
    return { items: page.map(r => zeile(r, c)), nextCursor: rows.length > limit && last ? encodeCursor({ n: last.nummer, f: filter }) : null };
  });

  app.get('/v1/ideen/kopf', {
    schema: { tags: [TAG], summary: 'Kennzahlen der Ideen für die Startseite', description: 'Eigene Ideen nach Stand; mit `idee:write` die eingereichten Ideen im Pool.', response: { 200: Type.Ref('IdeeKopf') } },
  }, async req => {
    await needLesen(req);
    const pool = await req.can('idee:write');
    return req.tx(tx => store.kopf(tx, { pool }));
  });

  app.get('/v1/ideen/auswahl', {
    schema: { tags: [TAG], summary: 'Auswahl für den Assistenten', description: 'Handlungsfelder mit Leitsatz und ihren strategischen Zielen, aktive Bereiche und Herkunft (K4 Schritt 2) – mit `idee:create` oder `idee:read` (Pool und Prüfung), auch ohne Leserecht auf Ziele.', response: { 200: Type.Ref('IdeeAuswahl') } },
  }, async req => {
    await needLesen(req);
    const ctx = { db: deps.db, tenantId: req.requirePrincipal().tenantId };
    return req.tx(tx => store.auswahl(tx, ctx));
  });

  app.get('/v1/ideen/:id', {
    schema: { tags: [TAG], summary: 'Projektidee lesen', description: 'Nach Vorlage; Rückfragen der UE und ihre Antworten nur für die Person, die die Idee erfasst hat, und mit `idee:read` (A-73).', params: IdParams, response: { 200: Type.Ref('Idee') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await needLesen(req);
    const found = await req.tx(async tx => {
      const r = await store.get(tx, id);
      return r ? { r, q: await store.rueckfragen(tx, id) } : null;
    });
    if (!found) throw notFound('Idee');
    reply.header('etag', etag(found.r.version));
    return out(found.r, found.q, await ctxOf(req));
  });

  app.post('/v1/ideen', {
    schema: { tags: [TAG], summary: 'Projektidee anlegen (Entwurf)', description: 'Neuer Entwurf mit laufender Nummer (UC-001 Schritt 1); Angaben optional, z. B. Vorbelegung aus einer Hauptaktivität (Handlungsfeld, Ziel) oder Herkunft aus dem Direktlink. Unbekannte Bezüge: 422.', headers: IdempotencyHeaders, body: Type.Ref('IdeeCreate'), response: { 201: Type.Ref('Idee') } },
  }, async (req, reply) => {
    await req.need('idee:create');
    const who = actorOf(req);
    const ctx = { db: deps.db, tenantId: req.requirePrincipal().tenantId };
    const row = await fremdschluessel(() => req.tx(async tx => {
      const input = await bezuegePruefen(req, deps, tx, req.body as IdeePatchIn, null);
      const r = await store.create(tx, await store.naechsteNummer(tx, ctx), input);
      await record(tx, who, { action: 'idee.created', resourceType: 'idee', resourceId: r.id, data: snapshot(r), event: { id: r.id, nummer: r.nummer, stand: r.stand } });
      return r;
    }));
    return reply.code(201).header('location', `/v1/ideen/${row.id}`).header('etag', etag(row.version)).send(out(row, [], await ctxOf(req)));
  });

  app.patch('/v1/ideen/:id', {
    schema: { tags: [TAG], summary: 'Projektidee ändern', description: 'Eigene Idee im Entwurf oder in Ergänzung (sonst 409), nur mit `If-Match` (412 bei abweichender Version). Der Assistent speichert damit jeden Schritt (I-F7).', params: IdParams, headers: IfMatchHeaders, body: Type.Ref('IdeePatch'), response: { 200: Type.Ref('Idee') } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('idee:create');
    const who = actorOf(req);
    const me = req.requirePrincipal().principalId;
    const res = await fremdschluessel(() => req.tx(async tx => {
      const before = await eigeneBearbeitbar(tx, id, me, version);
      const patch = await bezuegePruefen(req, deps, tx, req.body as IdeePatchIn, before);
      const r = await store.update(tx, id, version, patch);
      if (!r) throw preconditionFailed(before.version);
      await record(tx, who, { action: 'idee.updated', resourceType: 'idee', resourceId: id, data: { before: snapshot(before), after: snapshot(r) }, event: { id, nummer: r.nummer, stand: r.stand } });
      return { r, q: await store.rueckfragen(tx, id) };
    }));
    reply.header('etag', etag(res.r.version));
    return out(res.r, res.q, await ctxOf(req));
  });

  app.delete('/v1/ideen/:id', {
    schema: { tags: [TAG], summary: 'Entwurf verwerfen', description: 'Nur den eigenen Entwurf (sonst 409), nur mit `If-Match`.', params: IdParams, headers: IfMatchHeaders, response: { 204: Type.Null({ description: 'Verworfen' }) } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('idee:create');
    const who = actorOf(req);
    const me = req.requirePrincipal().principalId;
    await req.tx(async tx => {
      const before = await eigeneBearbeitbar(tx, id, me, version);
      if (before.stand !== 'entwurf') throw conflict('Nur ein Entwurf lässt sich verwerfen.');
      if (!(await store.remove(tx, id, version))) throw preconditionFailed(before.version);
      await record(tx, who, { action: 'idee.deleted', resourceType: 'idee', resourceId: id, data: snapshot(before), event: { id } });
    });
    return reply.code(204).send();
  });

  app.post('/v1/ideen/:id/einreichen', {
    schema: {
      tags: [TAG], summary: 'Projektidee einreichen',
      description: 'Prüft die Pflichtfelder (422 mit allen fehlenden Feldern), stellt die Idee in den Ideenpool und legt der UE die Prüfaufgabe in den Eingang (UC-001 Schritt 2). Aus «in Ergänzung» erneut einreichen schliesst «Rückfragen beantworten» und legt die Prüfaufgabe wieder an (A2.2). Nur mit `If-Match`.',
      params: IdParams, headers: Type.Composite([IfMatchHeaders, IdempotencyHeaders]), response: { 200: Type.Ref('Idee') },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    await req.need('idee:create');
    const who = actorOf(req);
    const me = req.requirePrincipal().principalId;
    const res = await req.tx(async tx => {
      const before = await eigeneBearbeitbar(tx, id, me, version);
      const fehlt = PFLICHT.filter(p => p.fehlt(before));
      if (fehlt.length) throw invalid('Es fehlen Angaben, ohne die die Unternehmensentwicklung die Idee nicht prüfen kann.', fehlt.map(p => ({ path: `/${p.feld}`, message: p.text })));
      const r = await store.setStand(tx, id, version, 'eingereicht', { eingereicht: true });
      if (!r) throw preconditionFailed(before.version);
      if (before.stand === 'in_ergaenzung') await aufgabe.erledigen(tx, { art: 'idee.ergaenzen', bezug: { typ: 'idee', id } });
      await aufgabe.oeffnen(tx, {
        art: 'idee.pruefen', bezug: { typ: 'idee', id }, empfaenger: { recht: 'idee:write' },
        titel: `Projektidee prüfen · ${r.titel}`, kontext: `Idee ${r.nummer}`, link: `/portfolio/ideen/${r.nummer}`,
      });
      await record(tx, who, {
        action: 'idee.submitted', resourceType: 'idee', resourceId: id,
        data: { ...snapshot(r), erneut: before.stand === 'in_ergaenzung' }, event: { id, nummer: r.nummer, stand: r.stand, erneut: before.stand === 'in_ergaenzung' },
      });
      return { r, q: await store.rueckfragen(tx, id) };
    });
    reply.header('etag', etag(res.r.version));
    return out(res.r, res.q, await ctxOf(req));
  });

  app.put('/v1/ideen/:id/rueckfragen/:rueckfrageId', {
    schema: { tags: [TAG], summary: 'Rückfrage beantworten', description: 'Antwort der Antragstellenden auf eine Rückfrage der UE, solange die Idee in Ergänzung ist (sonst 409; UC-001 A2.2). Ändert die Version der Idee nicht.', params: RueckfrageParams, body: Type.Ref('IdeeRueckfrageAntwort'), response: { 200: Type.Ref('IdeeRueckfrage') } },
  }, async req => {
    const { id, rueckfrageId } = req.params as { id: string; rueckfrageId: string };
    await req.need('idee:create');
    const who = actorOf(req);
    const me = req.requirePrincipal().principalId;
    const { antwort } = req.body as { antwort: string };
    return req.tx(async tx => {
      const idee = await eigeneBearbeitbar(tx, id, me, null);
      if (idee.stand !== 'in_ergaenzung') throw conflict('Zu dieser Idee sind keine Rückfragen offen.');
      const q = await store.rueckfrageBeantworten(tx, id, rueckfrageId, antwort);
      if (!q) throw notFound('Rückfrage');
      await record(tx, who, { action: 'idee.answered', resourceType: 'idee', resourceId: id, data: { rueckfrage: q.id, antwort: q.antwort }, event: { id, rueckfrage: q.id } });
      return rueckfrageOut(q);
    });
  });
}
