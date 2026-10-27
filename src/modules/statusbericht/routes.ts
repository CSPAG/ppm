/**
 * Routen des Statusberichts (BC PS.01.01, UC-004, Kernablauf K1) nach dem Muster der Handlungsfelder: Rechte über
 * `req.need` am Projekt, Lesesicht über `req.tx`, Fähigkeiten `can`, ETag/If-Match (412), Idempotenz (Querschnitt),
 * Audit und Ereignis in derselben Transaktion. Übergänge als eigene `POST`-Routen (`…/einreichen`, `…/zurueckziehen`).
 * Prüfung, Rückfrage und Perioden-Routen ergänzt AP-E1-2 in eigenen Dateien (`routes-pruefung.ts`).
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { actorOf, conflict, etag, IdempotencyHeaders, IdParams, IfMatchHeaders, notFound, preconditionFailed, requireIfMatch, type Deps, type Tx } from '@vollholz/platform';
import { projektdaten } from '../projektdaten/index.ts';
import { record } from '../../platform.ts';
import {
  abweichungVon, fehlend, laufendePeriode, meilensteinText, pruefeBearbeitbar, pruefePflichtangaben, rueckgaengigMoeglich, sperre, vorbelegung, werteVon,
} from './bericht.ts';
import { nachEinreichen, nachZurueckziehen } from './folgen.ts';
import {
  Abweichung, BerichtParams, Fehlend, Statusbericht, StatusberichtKurz, StatusberichtList, StatusberichtPut,
  type StatusberichtOut, type StatusberichtPutIn,
} from './schemas.ts';
import * as store from './store.ts';

const TAG = 'Statusberichte';

const ort = (id: string) => ({ type: 'projekt', id });

/** Alles, was eine Antwort braucht, in einer Transaktion gelesen. */
interface Lage {
  projekt: store.ProjektRow; periode: string; laufend: string; periodeStand: 'offen' | 'abgeschlossen';
  bericht: store.Row | null; vor: store.Row | null; sekunden: number | null;
  /** Nächster offener Meilenstein aus dem Plan (nur für die Vorbelegung gelesen). */
  plan: string | null;
}

async function lage(tx: Tx, projektId: string, periode: string, o: { sperren?: boolean } = {}): Promise<Lage> {
  const projekt = await store.projekt(tx, projektId);
  if (!projekt) throw notFound('Projekt');
  const bericht = await store.get(tx, projektId, periode, o);
  return {
    projekt, periode, bericht,
    laufend: await laufendePeriode(tx),
    periodeStand: await store.periodeStand(tx, periode),
    vor: await store.vorperiode(tx, projektId, periode),
    sekunden: bericht?.eingereicht_at ? await store.sekundenSeitEinreichen(tx, bericht.id) : null,
    plan: bericht ? null : await naechsterMeilenstein(tx, projektId),
  };
}

/** Frühester nicht erreichter Meilenstein des Meilensteinplans (Register, PS.02.04), Termin aktuell vor Baseline. */
async function naechsterMeilenstein(tx: Tx, projektId: string): Promise<string | null> {
  const offen = (await projektdaten.lesen(tx, 'meilenstein', { projektId }))
    .filter(m => m.art === 'meilenstein' && !m.erreichtAm)
    .map(m => ({ text: String(m.text), termin: (m.terminAktuell ?? m.terminBaseline ?? null) as string | null }))
    .sort((a, b) => (a.termin ?? '9999').localeCompare(b.termin ?? '9999'));
  return offen[0] ? meilensteinText(offen[0]) : null;
}

const snapshot = (r: store.Row) => ({
  id: r.id, projektId: r.projekt_id, periode: r.periode, anlass: r.anlass, stand: r.stand, status: r.status, trend: r.trend, phase: r.phase,
  abschlussPer: r.abschluss_per, naechsterMeilenstein: r.naechster_meilenstein, abweichung: abweichungVon(r.abweichung),
  abhaengigkeiten: r.abhaengigkeiten, entscheide: r.entscheide, begruendung: r.begruendung, massnahme: r.massnahme,
  entscheidNoetig: r.entscheid_noetig, version: r.version,
});

function out(l: Lage, schreiben: boolean, principalId: string | null): StatusberichtOut {
  const r = l.bericht;
  const felder = r
    ? { anlass: r.anlass, status: r.status, trend: r.trend, abschlussPer: r.abschluss_per, naechsterMeilenstein: r.naechster_meilenstein,
        abweichung: abweichungVon(r.abweichung), abhaengigkeiten: r.abhaengigkeiten, entscheide: r.entscheide, begruendung: r.begruendung,
        massnahme: r.massnahme, entscheidNoetig: r.entscheid_noetig }
    : vorbelegung(l.vor, l.plan);
  const bearbeitbar = schreiben && !sperre(l.projekt, l.periode, l.laufend, l.periodeStand, r);
  return {
    id: r?.id ?? null, projektId: l.projekt.id, projektNummer: l.projekt.nummer, projektName: l.projekt.name,
    periode: l.periode, periodeStand: l.periodeStand, stand: r?.stand ?? 'entwurf',
    // Phase: beim Einreichen festgehalten, sonst die aktuelle des Projekts
    phase: r && r.stand !== 'entwurf' && r.stand !== 'zurueckgegeben' ? r.phase : l.projekt.phase,
    ...felder,
    vorperiode: l.vor ? { periode: l.vor.periode, status: l.vor.status, trend: l.vor.trend, stand: l.vor.stand } : null,
    fehlend: fehlend(felder),
    eingereichtAt: r?.eingereicht_at ?? null, eingereichtBy: r?.eingereicht_by ?? null, geprueftAt: r?.geprueft_at ?? null,
    version: r?.version ?? 0, updatedAt: r?.updated_at ?? null,
    can: {
      write: bearbeitbar,
      einreichen: bearbeitbar && !!r,
      zurueckziehen: schreiben && !!r && !!principalId && l.periodeStand === 'offen' && rueckgaengigMoeglich(r, principalId, l.sekunden),
    },
  };
}

async function antwort(req: FastifyRequest, l: Lage): Promise<StatusberichtOut> {
  const schreiben = await req.can('statusbericht:write', ort(l.projekt.id));
  return out(l, schreiben, req.principal?.principalId ?? null);
}

/** Version des Berichts prüfen (0 = noch nicht gespeichert). */
function pruefeVersion(r: store.Row | null, version: number): void {
  if ((r?.version ?? 0) !== version) throw preconditionFailed(r?.version ?? 0);
}

export function registerRoutes(app: FastifyInstance, _deps: Deps): void {
  for (const s of [Abweichung, Fehlend, Statusbericht, StatusberichtKurz, StatusberichtList, StatusberichtPut]) app.addSchema(s);

  app.get('/v1/projekte/:id/berichte', {
    schema: {
      tags: [TAG], summary: 'Statusberichte eines Projekts', description: 'Alle gespeicherten Berichte, neueste Periode zuerst (Verlauf, Vorperiode).',
      params: IdParams, response: { 200: Type.Ref('StatusberichtList') },
    },
  }, async req => {
    const { id } = req.params as { id: string };
    await req.need('projekt:read', ort(id));
    const rows = await req.tx(async tx => {
      if (!(await store.projekt(tx, id))) throw notFound('Projekt');
      return store.list(tx, id);
    });
    return {
      items: rows.map(r => ({ id: r.id, periode: r.periode, anlass: r.anlass, stand: r.stand, status: r.status, trend: r.trend, phase: r.phase, eingereichtAt: r.eingereicht_at, version: r.version })),
    };
  });

  app.get('/v1/projekte/:id/berichte/:periode', {
    schema: {
      tags: [TAG], summary: 'Statusbericht der Periode lesen',
      description: 'Gespeicherter Bericht oder, solange keiner gespeichert ist, die Vorbelegung aus der Vorperiode (UC-004 Schritt 1) mit `version` 0 – alle Werte ausser Status und Trend (K1). `fehlend` nennt die Pflichtangaben, die für das Einreichen noch fehlen.',
      params: BerichtParams, response: { 200: Type.Ref('Statusbericht') },
    },
  }, async (req, reply) => {
    const { id, periode } = req.params as { id: string; periode: string };
    await req.need('projekt:read', ort(id));
    const l = await req.tx(tx => lage(tx, id, periode));
    reply.header('etag', etag(l.bericht?.version ?? 0));
    return antwort(req, l);
  });

  app.put('/v1/projekte/:id/berichte/:periode', {
    schema: {
      tags: [TAG], summary: 'Entwurf des Statusberichts speichern',
      description: 'Automatisches Speichern (I-R3): nur die gesendeten Felder ändern sich; der erste Aufruf (`If-Match: W/"0"`) legt den Entwurf mit der Vorbelegung an. Nur im Stand Entwurf oder zurückgegeben, in offener Periode, für aktive Projekte in P0–P3 (sonst 409).',
      params: BerichtParams, headers: IfMatchHeaders, body: Type.Ref('StatusberichtPut'), response: { 200: Type.Ref('Statusbericht') },
    },
  }, async (req, reply) => {
    const { id, periode } = req.params as { id: string; periode: string };
    const version = requireIfMatch(req);
    await req.need('statusbericht:write', ort(id));
    const body = req.body as StatusberichtPutIn;
    const who = actorOf(req);
    const l = await req.tx(async tx => {
      const vorher = await lage(tx, id, periode, { sperren: true });
      pruefeVersion(vorher.bericht, version);
      pruefeBearbeitbar(vorher.projekt, periode, vorher.laufend, vorher.periodeStand, vorher.bericht);
      if ((await store.periodeSichern(tx, periode)) !== 'offen') throw conflict('Die Periode ist abgeschlossen.', { reason: 'periode' });
      const felder = body.status !== undefined && body.status !== 'kritisch' && body.entscheidNoetig === undefined ? { ...body, entscheidNoetig: false } : body;
      let r: store.Row | null;
      if (vorher.bericht) {
        r = await store.update(tx, vorher.bericht.id, version, vorher.projekt.phase, felder);
        if (!r) throw preconditionFailed(vorher.bericht.version);
        await record(tx, who, { action: 'statusbericht.updated', resourceType: 'statusbericht', resourceId: r.id, data: { before: snapshot(vorher.bericht), after: snapshot(r) }, event: snapshot(r) });
      } else {
        r = await store.create(tx, id, periode, vorher.projekt.phase, { ...vorbelegung(vorher.vor, vorher.plan), ...felder });
        await record(tx, who, { action: 'statusbericht.created', resourceType: 'statusbericht', resourceId: r.id, data: snapshot(r), event: snapshot(r) });
      }
      return { ...vorher, bericht: r, periodeStand: 'offen' as const };
    });
    reply.header('etag', etag(l.bericht!.version));
    return antwort(req, l);
  });

  app.post('/v1/projekte/:id/berichte/:periode/einreichen', {
    schema: {
      tags: [TAG], summary: 'Statusbericht einreichen',
      description: 'Prüft die Pflichtangaben (UC-004 Schritt 7, A2; sonst 422 mit allen fehlenden Angaben in `errors`) und reicht den Bericht zur Prüfung ein (Schritt 8). Danach nur lesbar, bis die Unternehmensentwicklung ihn prüft oder zurückgibt; innert 10 s mit `…/zurueckziehen` rückgängig.',
      params: BerichtParams, headers: Type.Composite([IfMatchHeaders, IdempotencyHeaders]), response: { 200: Type.Ref('Statusbericht') },
    },
  }, async (req, reply) => {
    const { id, periode } = req.params as { id: string; periode: string };
    const version = requireIfMatch(req);
    await req.need('statusbericht:write', ort(id));
    const who = actorOf(req);
    const l = await req.tx(async tx => {
      const vorher = await lage(tx, id, periode, { sperren: true });
      if (!vorher.bericht) throw notFound('Statusbericht');
      pruefeVersion(vorher.bericht, version);
      pruefeBearbeitbar(vorher.projekt, periode, vorher.laufend, vorher.periodeStand, vorher.bericht);
      pruefePflichtangaben(werteVon(vorher.bericht));
      if ((await store.periodeSichern(tx, periode)) !== 'offen') throw conflict('Die Periode ist abgeschlossen.', { reason: 'periode' });
      const r = await store.stand(tx, vorher.bericht.id, version, 'eingereicht', vorher.projekt.phase);
      if (!r) throw preconditionFailed(vorher.bericht.version);
      await record(tx, who, { action: 'statusbericht.submitted', resourceType: 'statusbericht', resourceId: r.id, data: snapshot(r), event: snapshot(r) });
      await nachEinreichen(tx, r, who);
      return { ...vorher, bericht: r, sekunden: 0 };
    });
    reply.header('etag', etag(l.bericht!.version));
    return antwort(req, l);
  });

  app.post('/v1/projekte/:id/berichte/:periode/zurueckziehen', {
    schema: {
      tags: [TAG], summary: 'Einreichen rückgängig machen',
      description: 'Rückgängig im Toast nach dem Einreichen (K1 Schritt 8, G6): nur durch die einreichende Person, innert 10 s und solange der Bericht nicht geprüft ist (sonst 409). Der Bericht ist wieder ein Entwurf.',
      params: BerichtParams, headers: IfMatchHeaders, response: { 200: Type.Ref('Statusbericht') },
    },
  }, async (req, reply) => {
    const { id, periode } = req.params as { id: string; periode: string };
    const version = requireIfMatch(req);
    await req.need('statusbericht:write', ort(id));
    const p = req.requirePrincipal();
    const who = actorOf(req);
    const l = await req.tx(async tx => {
      const vorher = await lage(tx, id, periode, { sperren: true });
      if (!vorher.bericht) throw notFound('Statusbericht');
      pruefeVersion(vorher.bericht, version);
      if (vorher.periodeStand !== 'offen' || !rueckgaengigMoeglich(vorher.bericht, p.principalId, vorher.sekunden)) {
        throw conflict('Rückgängig ist nicht mehr möglich. Die Unternehmensentwicklung kann den Bericht mit einer Rückfrage zurückgeben.', { reason: 'rueckgaengig' });
      }
      const r = await store.stand(tx, vorher.bericht.id, version, 'entwurf', vorher.bericht.phase);
      if (!r) throw preconditionFailed(vorher.bericht.version);
      await record(tx, who, { action: 'statusbericht.withdrawn', resourceType: 'statusbericht', resourceId: r.id, data: snapshot(r), event: snapshot(r) });
      await nachZurueckziehen(tx, r, who);
      return { ...vorher, bericht: r, sekunden: null };
    });
    reply.header('etag', etag(l.bericht!.version));
    return antwort(req, l);
  });
}
