/**
 * Routen des Abschlusses (docs/fachmodell.md 5: `/projekte/:id/abschluss`, `POST …/einreichen`, `POST
 * /projekte/:id/wiederaufnahme`) nach dem Muster der Handlungsfelder: Lesesicht über `req.tx` (fremde und unbekannte
 * Projekte 404), Rechte am Projekt, `can`, ETag/If-Match (412), Audit und Ereignis in derselben Transaktion.
 *
 * - Bericht erfassen und einreichen: Projektleitung (`projekt:write`, UC-015 Schritte 2, 4, 5, A1.1). Die Art folgt aus
 *   der Lage: Phase P4 = Abschluss, sistiert = Sistierung, abgebrochen = Abbruch (Bericht entsteht mit dem Entscheid).
 * - Nutzenrealisierung beurteilen: Sponsor (`vertrag:decide`) und UE (`vertrag:review`), Schritt 3.
 * - Einreichen des Abschlussberichts schlägt das Exit-Gate dem entscheidenden Gremium vor (Art `abschluss`).
 * - Wiederaufnahme sistierter Vorhaben als Antrag an das Gremium (A-09); die Folge setzt der Entscheid (`folge.ts`).
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  actorOf, conflict, etag, IdempotencyHeaders, IdParams, IfMatchHeaders, invalid, notFound, preconditionFailed, requireIfMatch, type Deps, type Tx,
} from '@vollholz/platform';
import { record } from '../../platform.ts';
import { projekt as projektAktion } from '../projekt/index.ts';
import { projektdaten } from '../projektdaten/index.ts';
import { traktandum } from '../sitzung/index.ts';
import { vertrag } from '../vertrag/index.ts';
import { erstellenErledigen } from './folge.ts';
import { lessonOut } from './lessons-routes.ts';
import { SCHEMAS, type AbschlussInT, type AbschlussOut, type NutzenInT, type WiederaufnahmeInT } from './schemas.ts';
import * as store from './store.ts';
import { abschlussVermerke, vorabAbschliessbar } from './vermerk.ts';

export const TAG = 'Abschluss';

const projektOrt = (id: string) => ({ type: 'projekt', id });

/** Art des Berichts aus der Lage des Projekts; null = kein Abschluss möglich (Phase P0–P3, aktiv). */
export function artFuer(p: Pick<store.ProjektKopf, 'phase' | 'lebenszyklus'>): store.Art | null {
  if (p.lebenszyklus === 'aktiv') return p.phase === 'P4' ? 'abschluss' : null;
  if (p.lebenszyklus === 'sistiert') return 'sistierung';
  if (p.lebenszyklus === 'abgebrochen') return 'abbruch';
  return null;
}

/** Ein offener Bericht ist bearbeitbar, solange er in Arbeit ist und zur Lage des Projekts passt. */
function bearbeitbar(b: store.BerichtRow | null, p: store.ProjektKopf): boolean {
  if (b && b.stand !== 'entwurf' && b.stand !== 'nacharbeit') return false;
  const art = artFuer(p);
  // ohne offenen Bericht legt die PL nur den Abschlussbericht in P4 an; Sistierung und Abbruch entstehen mit dem Entscheid
  return b ? b.art === art : art === 'abschluss';
}

async function sichtbar(tx: Tx, id: string): Promise<store.ProjektKopf> {
  const p = await store.projekt(tx, id);
  if (!p) throw notFound('Projekt');
  return p;
}

const summe = (xs: Record<string, unknown>[], k: string) => xs.reduce((s, x) => s + (typeof x[k] === 'number' ? (x[k] as number) : 0), 0);

/** Antwort mit Bericht, Grundlagen aus Vertrag und Register, Lessons Learned und Fähigkeiten (UC-015 Schritt 1). */
export async function ausgabe(req: FastifyRequest, tx: Tx, p: store.ProjektKopf): Promise<AbschlussOut> {
  const offen = await store.offenerBericht(tx, p.id);
  const alle = await store.berichte(tx, p.id);
  const b = offen ?? alle[0] ?? null;
  const baseline = (await vertrag.versionen(tx, p.id)).find(v => v.baseline) ?? null;
  const k3 = baseline ? ((await vertrag.kapitel(tx, baseline.id)).find(k => k.kapitel === 3)?.inhalt ?? {}) as Record<string, unknown> : {};
  const ist = await store.letzteKpiWerte(tx, p.id);
  const kpis = await projektdaten.lesen(tx, 'kpi', { projektId: p.id });
  const finanzen = await req.can('finanzen:read', projektOrt(p.id));
  const kosten = finanzen ? await projektdaten.lesen(tx, 'kosten', { projektId: p.id }) : [];
  const meilensteine = await projektdaten.lesen(tx, 'meilenstein', { projektId: p.id });
  const lessons = await store.lessons(tx, { projektId: p.id, limit: 500 });
  const personen = await store.personen(tx, [...new Set([b?.nutzen_sp_by, b?.nutzen_ue_by, ...lessons.map(l => l.created_by)].filter((x): x is string => !!x))]);
  const entscheid = await store.letzterEntscheid(tx, p.id);
  const nutzenpruefung = await store.letzteNutzenpruefung(tx, p.id);
  const schreiben = await req.can('projekt:write', projektOrt(p.id));
  const nutzenOffen = !!b && b.art === 'abschluss' && ['entwurf', 'nacharbeit', 'eingereicht', 'traktandiert'].includes(b.stand) && p.lebenszyklus === 'aktiv';
  const art = artFuer(p);
  const beurteilung = (text: string, at: Date | null, by: string | null) => (at ? { text, at, von: (by && personen.get(by)) || 'Person nicht verfügbar' } : null);
  const lessonCan = { write: schreiben };
  return {
    projekt: { id: p.id, nummer: p.nummer, name: p.name, phase: p.phase, lebenszyklus: p.lebenszyklus as AbschlussOut['projekt']['lebenszyklus'] },
    lage: p.lebenszyklus === 'abgeschlossen' ? 'abgeschlossen' : art ?? 'keine',
    bericht: b && {
      id: b.id, art: b.art, stand: b.stand, projektstand: b.projektstand, zielerreichung: b.zielerreichung, kpiWerte: b.kpi_werte,
      businessCase: b.business_case, uebergabe: b.uebergabe, offenePunkte: b.offene_punkte,
      nutzen: { sp: beurteilung(b.nutzen_sp, b.nutzen_sp_at, b.nutzen_sp_by), ue: beurteilung(b.nutzen_ue, b.nutzen_ue_at, b.nutzen_ue_by) },
      eingereichtAt: b.eingereicht_at, abgenommenAt: b.abgenommen_at, version: b.version, updatedAt: b.updated_at,
    },
    berichte: alle.map(x => ({ id: x.id, art: x.art, stand: x.stand, eingereichtAt: x.eingereicht_at, abgenommenAt: x.abgenommen_at })),
    grundlagen: {
      baseline: baseline?.nummer ?? null,
      ziele: String(k3.ziele ?? ''), nutzen: String(k3.nutzen ?? ''), businessCase: String(k3.businessCase ?? ''),
      kpis: kpis.map(k => ({
        id: k.id, art: String(k.art ?? ''), text: String(k.text ?? ''), einheit: String(k.einheit ?? ''), zielwert: (k.zielwert as string | null) ?? null,
        ist: ist.get(k.id) ?? null,
      })),
      kosten: finanzen ? { budgetBaseline: summe(kosten, 'budgetBaseline'), prognose: summe(kosten, 'prognose'), ist: summe(kosten, 'ist') } : null,
      offeneMeilensteine: meilensteine.filter(m => !m.erreichtAm && m.art !== 'kommunikation').map(m => ({
        id: m.id, phase: String(m.phase), art: String(m.art), text: String(m.text ?? ''),
        terminBaseline: (m.terminBaseline as string | null) ?? null, terminAktuell: (m.terminAktuell as string | null) ?? null,
      })),
      nutzenpruefung,
    },
    lessonsLearned: lessons.map(l => lessonOut(l, personen, lessonCan)),
    entscheid: entscheid && { ergebnis: entscheid.ergebnis, at: entscheid.entschieden_at },
    can: {
      bearbeiten: schreiben && bearbeitbar(offen, p),
      einreichen: schreiben && !!offen && bearbeitbar(offen, p),
      nutzenSp: nutzenOffen && await req.can('vertrag:decide', projektOrt(p.id)),
      nutzenUe: nutzenOffen && await req.can('vertrag:review'),
      wiederaufnahme: schreiben && p.lebenszyklus === 'sistiert',
      lessons: schreiben && p.lebenszyklus !== 'zurueckgezogen',
      dokument: !!b,
      abschliessen: schreiben && vorabAbschliessbar(p, offen),
    },
    vermerke: abschlussVermerke(p, offen),
  };
}

/** Eingaben prüfen: KPIs aus dem Register, Termine im Kalender. */
async function pruefeInhalt(tx: Tx, p: store.ProjektKopf, body: AbschlussInT): Promise<void> {
  const kpis = new Set((await projektdaten.lesen(tx, 'kpi', { projektId: p.id })).map(k => k.id));
  const fehler = body.kpiWerte.flatMap((w, i) => (kpis.has(w.kpiId) ? [] : [{ path: `/kpiWerte/${i}/kpiId`, message: 'KPI nicht im Register des Projekts' }]));
  if (new Set(body.kpiWerte.map(w => w.kpiId)).size !== body.kpiWerte.length) fehler.push({ path: '/kpiWerte', message: 'KPI doppelt' });
  body.offenePunkte.forEach((o, i) => {
    if (o.termin && Number.isNaN(Date.parse(`${o.termin}T00:00:00Z`))) fehler.push({ path: `/offenePunkte/${i}/termin`, message: 'kein gültiges Datum' });
  });
  if (fehler.length) throw invalid('Die Angaben passen nicht zum Projekt.', fehler);
}

/** Pflichtangaben je Art (UC-015 Schritte 2, 4; A1.1); fehlen sie, 422 mit je einem Fehler. */
export function fehlend(b: store.BerichtRow): { path: string; message: string }[] {
  const leer = (s: string) => !s.trim();
  const f: { path: string; message: string }[] = [];
  if (b.art === 'abschluss') {
    if (leer(b.zielerreichung)) f.push({ path: '/zielerreichung', message: 'Zielerreichung' });
    if (leer(b.business_case)) f.push({ path: '/businessCase', message: 'Business Case Abschluss P4' });
    if (leer(b.uebergabe)) f.push({ path: '/uebergabe', message: 'Übergabe an Betrieb und Linie' });
  } else if (leer(b.projektstand)) {
    f.push({ path: '/projektstand', message: 'Stand des Vorhabens' });
  }
  return f;
}

const snapshot = (b: store.BerichtRow, p: store.ProjektKopf) => ({ id: b.id, projektId: p.id, nummer: p.nummer, art: b.art, stand: b.stand, version: b.version });

export function registerRoutes(app: FastifyInstance, _deps: Deps): void {
  for (const s of SCHEMAS) app.addSchema(s);

  app.get('/v1/projekte/:id/abschluss', {
    schema: {
      tags: [TAG], summary: 'Abschluss des Projekts', params: IdParams, response: { 200: Type.Ref('Abschluss') },
      description: 'Lage (Abschluss in P4, Sistierung, Abbruch, abgeschlossen), offener bzw. letzter Bericht, Grundlagen zum Abschluss (Ziele und Business Case der '
        + 'Baseline, KPIs mit Ziel- und Ist-Wert, Kosten nur mit `finanzen:read`, offene Meilensteine; UC-015 Schritt 1), Lessons Learned des Projekts und der '
        + 'letzte Entscheid des Gremiums. ETag = Stand des Berichts (`W/"0"` ohne Bericht).',
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const p = await req.tx(tx => sichtbar(tx, id));
    await req.need('projekt:read', projektOrt(p.id));
    const { out, offen } = await req.tx(async tx => ({ out: await ausgabe(req, tx, p), offen: await store.offenerBericht(tx, p.id) }));
    reply.header('etag', etag(offen?.version ?? 0));
    return out;
  });

  app.put('/v1/projekte/:id/abschluss', {
    schema: {
      tags: [TAG], summary: 'Bericht erfassen', params: IdParams, headers: IfMatchHeaders, body: Type.Ref('AbschlussIn'), response: { 200: Type.Ref('Abschluss') },
      description: 'Abschlussbericht (P4: Zielerreichung mit Werten je KPI, Business Case Abschluss, Übergabe, offene Punkte; UC-015 Schritte 2, 4) bzw. Bericht zu '
        + 'Sistierung oder Abbruch (Stand, offene Punkte; A1.1), automatisch gespeichert. Nur die Projektleitung (`projekt:write`), nur in Arbeit oder Nacharbeit. '
        + '`If-Match` = Stand des Berichts, `W/"0"` legt den Abschlussbericht in P4 an. Ausserhalb von P4 ohne Entscheid: 409.',
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const erwartet = requireIfMatch(req);
    const body = req.body as AbschlussInT;
    const p = await req.tx(tx => sichtbar(tx, id));
    await req.need('projekt:write', projektOrt(p.id));
    const who = actorOf(req);
    const out = await req.tx(async tx => {
      let b = await store.offenerBericht(tx, p.id);
      const art = artFuer(p);
      if (!art) {
        throw conflict(p.lebenszyklus === 'aktiv'
          ? `Der Abschluss beginnt in Phase P4 oder mit einem Entscheid des Gremiums zu Sistierung oder Abbruch; ${p.nummer} ist in ${p.phase}.`
          : `Das Projekt ${p.nummer} ist ${p.lebenszyklus === 'abgeschlossen' ? 'abgeschlossen' : 'beendet'} und kann nur noch gelesen werden.`, { reason: 'lebenszyklus', lebenszyklus: p.lebenszyklus });
      }
      if (b && !bearbeitbar(b, p)) throw conflict(`Der Bericht ist ${b.stand === 'traktandiert' ? 'beim Gremium' : 'eingereicht'} und kann nicht mehr geändert werden.`, { reason: 'stand', stand: b.stand });
      if (!b) {
        if (art !== 'abschluss') throw conflict(`Zum ${p.lebenszyklus === 'sistiert' ? 'sistierten' : 'abgebrochenen'} Projekt ${p.nummer} liegt kein offener Bericht vor.`, { reason: 'bericht' });
        if (erwartet !== 0) throw preconditionFailed(0);
        b = await store.berichtAnlegen(tx, p.id, art);
      } else if (b.version !== erwartet) {
        throw preconditionFailed(b.version);
      }
      await pruefeInhalt(tx, p, body);
      const r = await store.inhaltSetzen(tx, b.id, b.version, {
        projektstand: body.projektstand.trim(), zielerreichung: body.zielerreichung.trim(), businessCase: body.businessCase.trim(), uebergabe: body.uebergabe.trim(),
        kpiWerte: body.kpiWerte.map(w => ({ kpiId: w.kpiId, wert: w.wert.trim(), bemerkung: w.bemerkung.trim() })),
        offenePunkte: body.offenePunkte.map(o => ({ text: o.text.trim(), verantwortlich: o.verantwortlich.trim(), termin: o.termin })),
      });
      if (!r) throw preconditionFailed(b.version + 1);
      await record(tx, who, { action: 'abschlussbericht.updated', resourceType: 'abschlussbericht', resourceId: r.id, data: snapshot(r, p), event: snapshot(r, p) });
      return ausgabe(req, tx, p);
    });
    reply.header('etag', etag(out.bericht!.version));
    return out;
  });

  app.put('/v1/projekte/:id/abschluss/nutzen', {
    schema: {
      tags: [TAG], summary: 'Nutzenrealisierung beurteilen', params: IdParams, headers: IfMatchHeaders, body: Type.Ref('AbschlussNutzenIn'), response: { 200: Type.Ref('Abschluss') },
      description: 'Beurteilung am Abschlussbericht (UC-015 Schritt 3, PC.03.02): als Sponsor mit `vertrag:decide` am Projekt, als UE mit `vertrag:review`; bis zum '
        + 'Entscheid am Exit-Gate. `If-Match` = Stand des Berichts.',
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const erwartet = requireIfMatch(req);
    const body = req.body as NutzenInT;
    const p = await req.tx(tx => sichtbar(tx, id));
    if (body.rolle === 'sp') await req.need('vertrag:decide', projektOrt(p.id));
    else await req.need('vertrag:review');
    const who = actorOf(req);
    const out = await req.tx(async tx => {
      const b = await store.offenerBericht(tx, p.id);
      if (!b || b.art !== 'abschluss' || p.lebenszyklus !== 'aktiv') throw conflict('Die Nutzenrealisierung wird am Abschlussbericht in Phase P4 beurteilt; es liegt keiner vor.', { reason: 'bericht' });
      if (b.version !== erwartet) throw preconditionFailed(b.version);
      const r = await store.nutzenSetzen(tx, b.id, b.version, body.rolle, body.beurteilung);
      if (!r) throw preconditionFailed(b.version + 1);
      const daten = { ...snapshot(r, p), rolle: body.rolle, beurteilt: !!body.beurteilung.trim() };
      await record(tx, who, { action: 'abschlussbericht.benefit_assessed', resourceType: 'abschlussbericht', resourceId: r.id, data: daten, event: daten });
      return ausgabe(req, tx, p);
    });
    reply.header('etag', etag(out.bericht!.version));
    return out;
  });

  app.post('/v1/projekte/:id/abschluss/einreichen', {
    schema: {
      tags: [TAG], summary: 'Bericht einreichen', params: IdParams, headers: IfMatchHeaders, response: { 200: Type.Ref('Abschluss') },
      description: 'Abschlussbericht: zum Exit-Gate P4 beim entscheidenden Gremium des Portfolios vorgeschlagen (Art `abschluss`, UC-015 Schritt 5), Stand «traktandiert»; '
        + 'ohne Gremium «eingereicht» (die UE plant ein). Bericht zu Sistierung oder Abbruch: «eingereicht» (A1). Erledigt «Abschlussbericht erstellen». '
        + 'Fehlende Angaben: 422 mit je einem Fehler. `If-Match` Pflicht.',
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const erwartet = requireIfMatch(req);
    const p = await req.tx(tx => sichtbar(tx, id));
    await req.need('projekt:write', projektOrt(p.id));
    const who = actorOf(req);
    const out = await req.tx(async tx => {
      const b = await store.offenerBericht(tx, p.id);
      if (!b || !bearbeitbar(b, p)) throw conflict(b ? 'Der Bericht ist bereits eingereicht.' : 'Es liegt kein Bericht vor; erfasse ihn zuerst.', { reason: 'stand', stand: b?.stand ?? null });
      if (b.version !== erwartet) throw preconditionFailed(b.version);
      const f = fehlend(b);
      if (f.length) throw invalid(`Angaben fehlen: ${f.map(x => x.message).join(', ')}. Ergänze sie, um einzureichen.`, f);
      let nach: 'eingereicht' | 'traktandiert' = 'eingereicht';
      let traktandumId: string | null = null;
      if (b.art === 'abschluss') {
        try {
          traktandumId = await traktandum.vorschlagen(tx, {
            art: 'abschluss', bezug: { typ: 'projekt', id: p.id }, projektId: p.id,
            titel: `Exit-Gate P4 ${p.nummer} ${p.name}`, antrag: 'Abschlussbericht abnehmen und das Vorhaben formell abschliessen',
          });
          nach = 'traktandiert';
        } catch (err) {
          // ohne entscheidendes Gremium (Portfolio ohne Gremium) bleibt der Bericht eingereicht; die UE plant ein
          if ((err as { status?: number }).status !== 409) throw err;
        }
      }
      const r = await store.eingereicht(tx, b.id, b.version, nach, traktandumId);
      if (!r) throw preconditionFailed(b.version + 1);
      await erstellenErledigen(tx, p);
      await record(tx, who, { action: 'abschlussbericht.submitted', resourceType: 'abschlussbericht', resourceId: r.id, data: snapshot(r, p), event: snapshot(r, p) });
      return ausgabe(req, tx, p);
    });
    reply.header('etag', etag(out.bericht!.version));
    return out;
  });

  app.post('/v1/projekte/:id/abschluss/abschliessen', {
    schema: {
      tags: [TAG], summary: 'Vor der Abnahme abschliessen', params: IdParams, headers: IfMatchHeaders, response: { 200: Type.Ref('Abschluss') },
      description: 'UC-015 A3 (A-74): PL oder UE schliessen das Vorhaben, bevor das Gremium den Abschlussbericht abnimmt. Das Projekt ist «abgeschlossen» und lesend, '
        + 'mit dem Vermerk «Abnahme offen»; das Traktandum bleibt offen. Die Abnahme löst den Vermerk; «Nacharbeiten» nimmt den Abschluss zurück. '
        + 'Voraussetzung: eingereichter Abschlussbericht (sonst 409). `projekt:write`; `If-Match` = Stand des Berichts.',
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const erwartet = requireIfMatch(req);
    const p = await req.tx(tx => sichtbar(tx, id));
    await req.need('projekt:write', projektOrt(p.id));
    const who = actorOf(req);
    const out = await req.tx(async tx => {
      const b = await store.offenerBericht(tx, p.id);
      if (!vorabAbschliessbar(p, b)) {
        throw conflict('Abschliessen setzt einen eingereichten Abschlussbericht voraus; reiche ihn zuerst ein.', { reason: 'bericht', stand: b?.stand ?? null });
      }
      if (b!.version !== erwartet) throw preconditionFailed(b!.version);
      await projektAktion.lebenszyklusWechseln(tx, who, p.id, 'abgeschlossen', { vorAbnahme: true, berichtId: b!.id });
      return ausgabe(req, tx, (await sichtbar(tx, id)));
    });
    reply.header('etag', etag(out.bericht?.version ?? 0));
    return out;
  });

  app.post('/v1/projekte/:id/wiederaufnahme', {
    schema: {
      tags: [TAG], summary: 'Wiederaufnahme beantragen', params: IdParams, headers: IdempotencyHeaders, body: Type.Ref('AbschlussWiederaufnahmeIn'),
      response: { 200: Type.Ref('Abschluss') },
      description: 'Antrag an das entscheidende Gremium, ein sistiertes Vorhaben weiterzuführen (A-09, K10): Traktandum der Art `abschluss`. Mit «Weiterführen» ist '
        + 'das Projekt wieder aktiv, der Vertrag wird über ein Gate fortgeschrieben (UC-003). Nur sistierte Projekte (sonst 409), `projekt:write`.',
    },
  }, async req => {
    const { id } = req.params as { id: string };
    const body = req.body as WiederaufnahmeInT;
    const p = await req.tx(tx => sichtbar(tx, id));
    await req.need('projekt:write', projektOrt(p.id));
    const who = actorOf(req);
    return req.tx(async tx => {
      if (p.lebenszyklus !== 'sistiert') throw conflict(`Das Projekt ${p.nummer} ist nicht sistiert.`, { reason: 'lebenszyklus', lebenszyklus: p.lebenszyklus });
      const traktandumId = await traktandum.vorschlagen(tx, {
        art: 'abschluss', bezug: { typ: 'projekt', id: p.id }, projektId: p.id, titel: `Wiederaufnahme ${p.nummer} ${p.name}`, antrag: body.begruendung,
      });
      const daten = { projektId: p.id, nummer: p.nummer, traktandumId };
      await record(tx, who, { action: 'projekt.resumption_requested', resourceType: 'projekt', resourceId: p.id, data: { ...daten, begruendung: body.begruendung }, event: daten });
      return ausgabe(req, tx, p);
    });
  });
}
