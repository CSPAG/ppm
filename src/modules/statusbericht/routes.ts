/**
 * Routen des Statusberichts (BC PS.01.01, UC-004, Kernablauf K1) nach dem Muster der Handlungsfelder: Rechte über
 * `req.need` am Projekt, Lesesicht über `req.tx`, Fähigkeiten `can`, ETag/If-Match (412), Idempotenz (Querschnitt),
 * Audit und Ereignis in derselben Transaktion. Übergänge als eigene `POST`-Routen (`…/einreichen`, `…/zurueckziehen`).
 * Prüfung, Rückfrage und Perioden-Routen ergänzt AP-E1-2 in eigenen Dateien (`routes-pruefung.ts`).
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { actorOf, conflict, etag, IdempotencyHeaders, IdParams, IfMatchHeaders, invalid, notFound, preconditionFailed, requireIfMatch, type Deps, type Tx } from '@vollholz/platform';
import { projektdaten } from '../projektdaten/index.ts';
import { record } from '../../platform.ts';
import {
  abweichungVon, BERICHTSPHASEN, fehlend, laufendePeriode, meilensteinText, pruefeBearbeitbar, pruefePflichtangaben, rueckgaengigMoeglich, sperre, vorbelegung, werteVon,
} from './bericht.ts';
import * as eskalation from './eskalation.ts';
import { nachEinreichen, nachZurueckziehen } from './folgen.ts';
import {
  Abweichung, BerichtParams, BerichtStandList, BerichtStandQuery, EskalationNeu, Fehlend, Statusbericht, StatusberichtKurz, StatusberichtList, StatusberichtPut,
  type EskalationNeuIn, type StatusberichtOut, type StatusberichtPutIn,
} from './schemas.ts';
import { fristen } from './pruefung.ts';
import * as store from './store.ts';
import { dashboardNachfuehren, GEAENDERT_TEXT, markieren, nachWas } from './verlauf.ts';

const TAG = 'Statusberichte';

const ort = (id: string) => ({ type: 'projekt', id });

/** Alles, was eine Antwort braucht, in einer Transaktion gelesen. */
interface Lage {
  projekt: store.ProjektRow; periode: string; laufend: string; periodeStand: 'offen' | 'abgeschlossen';
  bericht: store.Row | null; vor: store.Row | null; sekunden: number | null;
  /** Nächster offener Meilenstein aus dem Plan (nur für die Vorbelegung gelesen). */
  plan: string | null;
  /** Eskalation zum Bericht (UC-004 A1.2, A2.2). */
  eskalation: eskalation.EskalationRow | null;
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
    eskalation: bericht ? await eskalation.vonBericht(tx, bericht.id) : null,
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
    geaendertNach: r?.geaendert_nach && r.geaendert_nach_at ? { art: r.geaendert_nach, text: GEAENDERT_TEXT[r.geaendert_nach], at: r.geaendert_nach_at } : null,
    version: r?.version ?? 0, updatedAt: r?.updated_at ?? null,
    eskalation: l.eskalation ? { id: l.eskalation.id, anlass: l.eskalation.anlass, stand: l.eskalation.stand, vorgeschlagen: l.eskalation.vorgeschlagen, angelegtAt: l.eskalation.created_at.toISOString() } : null,
    can: {
      write: bearbeitbar,
      einreichen: bearbeitbar && !!r && (r.stand === 'entwurf' || r.stand === 'zurueckgegeben'),
      zurueckziehen: schreiben && !!r && !!principalId && l.periodeStand === 'offen' && rueckgaengigMoeglich(r, principalId, l.sekunden),
      eskalieren: bearbeitbar && !l.eskalation && l.periodeStand === 'offen' && (!r || r.stand === 'entwurf' || r.stand === 'zurueckgegeben'),
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

export function registerRoutes(app: FastifyInstance, deps: Deps): void {
  for (const s of [Abweichung, BerichtStandList, EskalationNeu, Fehlend, Statusbericht, StatusberichtKurz, StatusberichtList, StatusberichtPut]) app.addSchema(s);

  app.get('/v1/statusberichte/stand', {
    schema: {
      tags: [TAG], summary: 'Stand der Berichte mehrerer Projekte',
      description: 'Kopfkarte «Meine Projekte» im Eingang (informationsarchitektur.md «Startseite je Rolle»): je Projekt der letzte eingereichte Bericht mit Status, Trend und Begründung und der Bericht der laufenden Periode mit Stichtag. Projekte ohne Leserecht entfallen.',
      querystring: BerichtStandQuery, response: { 200: Type.Ref('BerichtStandList') },
    },
  }, async req => {
    const ids = [...new Set((req.query as { projektId: string[] }).projektId)];
    await req.needSomewhere('projekt:read');
    const sichtbar = (await Promise.all(ids.map(async id => ((await req.can('projekt:read', ort(id))) ? id : null)))).filter((x): x is string => !!x);
    return req.tx(async tx => {
      const laufend = await laufendePeriode(tx);
      const { stichtag } = await fristen(tx, laufend);
      const items = [];
      for (const id of sichtbar) {
        const p = await store.projekt(tx, id);
        if (!p) continue;
        // Letzter eingereichter Bericht bis und mit der laufenden Periode
        const l = await store.vorperiode(tx, id, '9999-12');
        const pflichtig = p.lebenszyklus === 'aktiv' && BERICHTSPHASEN.includes(p.phase);
        items.push({
          projektId: id,
          letzter: l ? { periode: l.periode, status: l.status, trend: l.trend, begruendung: l.begruendung, naechsterMeilenstein: l.naechster_meilenstein } : null,
          laufend: pflichtig ? { periode: laufend, stand: (await store.get(tx, id, laufend))?.stand ?? null, stichtag } : null,
        });
      }
      return { items };
    });
  });

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
      await store.periodeSichern(tx, periode);
      const felder = body.status !== undefined && body.status !== 'kritisch' && body.entscheidNoetig === undefined ? { ...body, entscheidNoetig: false } : body;
      // nach dem Einreichen bzw. nach dem Abschluss: Version mit Markierung (A-75); die Phase des Einreichens bleibt
      const nach = nachWas(vorher.bericht, vorher.periodeStand);
      let r: store.Row | null;
      if (vorher.bericht) {
        r = await store.update(tx, vorher.bericht.id, version, nach && vorher.bericht.stand !== 'entwurf' && vorher.bericht.stand !== 'zurueckgegeben' ? vorher.bericht.phase : vorher.projekt.phase, felder);
        if (!r) throw preconditionFailed(vorher.bericht.version);
        await record(tx, who, { action: 'statusbericht.updated', resourceType: 'statusbericht', resourceId: r.id, data: { before: snapshot(vorher.bericht), after: snapshot(r) }, event: snapshot(r) });
        if (nach) {
          await markieren(tx, who, vorher.bericht, r, nach);
          r = (await store.get(tx, id, periode))!;
        }
      } else {
        r = await store.create(tx, id, periode, vorher.projekt.phase, { ...vorbelegung(vorher.vor, vorher.plan), ...felder });
        await record(tx, who, { action: 'statusbericht.created', resourceType: 'statusbericht', resourceId: r.id, data: snapshot(r), event: snapshot(r) });
      }
      return { ...vorher, bericht: r };
    });
    if (l.periodeStand === 'abgeschlossen') await dashboardNachfuehren(deps.db, req.requirePrincipal().tenantId, l.bericht!);
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
      if (vorher.bericht.stand === 'eingereicht' || vorher.bericht.stand === 'geprueft') throw conflict('Der Bericht ist bereits eingereicht; Änderungen speicherst du direkt (sie sind markiert).', { reason: 'stand' });
      pruefePflichtangaben(werteVon(vorher.bericht));
      await store.periodeSichern(tx, periode);
      let r = await store.stand(tx, vorher.bericht.id, version, 'eingereicht', vorher.projekt.phase);
      if (!r) throw preconditionFailed(vorher.bericht.version);
      await record(tx, who, { action: 'statusbericht.submitted', resourceType: 'statusbericht', resourceId: r.id, data: snapshot(r), event: snapshot(r) });
      await nachEinreichen(tx, r, who);
      // nach dem Abschluss nachgereicht (UC-005 A4.1): markiert, das Dashboard der Periode wird nachgeführt
      if (vorher.periodeStand === 'abgeschlossen') {
        await markieren(tx, who, vorher.bericht, r, 'abschluss');
        r = (await store.get(tx, id, periode))!;
      }
      // Eskalation nach den Folgen neu lesen («kritisch» mit Entscheidbedarf legt sie eben an)
      return { ...vorher, bericht: r, sekunden: 0, eskalation: await eskalation.vonBericht(tx, r.id) };
    });
    if (l.periodeStand === 'abgeschlossen') await dashboardNachfuehren(deps.db, req.requirePrincipal().tenantId, l.bericht!);
    reply.header('etag', etag(l.bericht!.version));
    return antwort(req, l);
  });

  app.post('/v1/projekte/:id/berichte/:periode/eskalation', {
    schema: {
      tags: [TAG], summary: 'Aus der Warnung «wesentliche Abweichung» eskalieren',
      description: 'UC-004 A1.2, K1 Schritt 2: Die PL startet eine Eskalation (UC-006) zum Bericht, auch im Entwurf und unabhängig vom Status; '
        + 'fehlt der Entwurf noch, entsteht er mit der Vorbelegung. Die Eskalation geht als Traktandenvorschlag an die nächste Sitzung des '
        + 'entscheidenden Gremiums, die Unternehmensentwicklung erhält die Aufgabe, sie zu traktandieren. Der Bericht bleibt, wie er ist. '
        + 'Je Bericht höchstens eine Eskalation (409); nur, solange der Bericht bearbeitbar ist (409).',
      params: BerichtParams, headers: IdempotencyHeaders, body: Type.Ref('StatusberichtEskalationNeu'), response: { 200: Type.Ref('Statusbericht') },
    },
  }, async (req, reply) => {
    const { id, periode } = req.params as { id: string; periode: string };
    await req.need('statusbericht:write', ort(id));
    const body = req.body as EskalationNeuIn;
    if (!body.grund.trim()) throw invalid('Angaben fehlen: Der Grund ist leer. Beschreib, worum es geht.', [{ path: '/grund', message: 'Grund' }]);
    const who = actorOf(req);
    const l = await req.tx(async tx => {
      const vorher = await lage(tx, id, periode, { sperren: true });
      pruefeBearbeitbar(vorher.projekt, periode, vorher.laufend, vorher.periodeStand, vorher.bericht);
      if ((await store.periodeSichern(tx, periode)) !== 'offen') throw conflict('Die Periode ist abgeschlossen.', { reason: 'periode' });
      let r = vorher.bericht;
      if (!r) {
        r = await store.create(tx, id, periode, vorher.projekt.phase, vorbelegung(vorher.vor, vorher.plan));
        await record(tx, who, { action: 'statusbericht.created', resourceType: 'statusbericht', resourceId: r.id, data: snapshot(r), event: snapshot(r) });
      }
      const e = await eskalation.ausAbweichung(tx, r, { grund: body.grund, massnahme: body.massnahme ?? '' });
      const daten = { statusbericht: r.id, projekt: vorher.projekt.nummer, periode, anlass: 'abweichung', vorgeschlagen: e.eskalation.vorgeschlagen };
      // im Audit; kein eigenes Ereignis (Traktandenvorschlag und Aufgabe sind die Wirkung)
      await record(tx, who, { action: 'eskalation.created', resourceType: 'eskalation', resourceId: e.eskalation.id, data: daten });
      return { ...vorher, bericht: r, eskalation: e.eskalation, periodeStand: 'offen' as const };
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
      // Eskalation nach den Folgen neu lesen (die aus dem Einreichen entfällt, die der PL bleibt)
      return { ...vorher, bericht: r, sekunden: null, eskalation: await eskalation.vonBericht(tx, r.id) };
    });
    reply.header('etag', etag(l.bericht!.version));
    return antwort(req, l);
  });
}
