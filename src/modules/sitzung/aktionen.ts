/**
 * Fachaktionen der Sitzungsvorbereitung (UC-006 Schritte 1–5, A1, A2; K3): Traktandum vorschlagen, aufnehmen,
 * einplanen, verschieben, Unterlagenstand, Versand. Jede Aktion läuft in der Transaktion des Aufrufers; Audit und
 * Ereignis schreiben die Routen bzw. der Aufrufer.
 */
import { conflict, invalid, notFound, type Tx } from '@vollholz/platform';
import { aufgabe, mitteilung } from '../eingang/index.ts';
import { fristDatum } from '../phasenmodell/index.ts';
import { entscheidendesGremium, gremienwegFuerGate, type GateCode } from '../portfolio/index.ts';
import { artDauer, artLabel, festeArten, traktandenart, unterlagenVon, type Art, type Bezug, type Unterlage, type UnterlagenStand } from './arten.ts';
import { heute, kurzDatum, plusMinuten } from './format.ts';
import * as store from './store.ts';

/** Adresse der Sitzung in der Oberfläche (informationsarchitektur.md, Adressen). */
export const sitzungLink = (kuerzel: string, datum: string) => `/gremien/${kuerzel}/sitzungen/${datum}`;

export const bezugVon = (t: Pick<store.TraktandumRow, 'bezug_typ' | 'bezug_id' | 'projekt_id'>): Bezug => ({ typ: t.bezug_typ, id: t.bezug_id, projektId: t.projekt_id });

/** Führt `fn` mit `app.sitzung_intern` aus (Vorschläge anderer Module, 130_sitzung.sql) und stellt den Wert wieder her. */
async function intern<T>(tx: Tx, fn: () => Promise<T>): Promise<T> {
  const prev = (await tx.query<{ v: string | null }>("SELECT current_setting('app.sitzung_intern', true) AS v")).rows[0]?.v ?? '';
  await tx.query("SELECT set_config('app.sitzung_intern', 'on', true)");
  let ok = false;
  try {
    const r = await fn();
    ok = true;
    return r;
  } finally {
    if (ok) await tx.query("SELECT set_config('app.sitzung_intern', $1, true)", [prev ?? '']);
  }
}

/**
 * «via SNS-VR» (UC-006 A1; Q8 Kap. 5.1): Ein Gate oder relevanter Meilenstein eines Projekts in P0 oder P1 läuft bis zur
 * Freigabe von P2 zusätzlich über den SNS-VR, wenn der Gremienweg des Portfolios für das nächste Gate ein zusätzliches
 * Gremium nennt.
 */
export async function viaSns(tx: Tx, art: Art, p: store.ProjektKurz | null): Promise<boolean> {
  if (!p || (art !== 'gate' && art !== 'meilenstein')) return false;
  const gate = ({ P0: 'P0_P1', P1: 'P1_P2' } as Record<string, GateCode | undefined>)[p.phase];
  if (!gate) return false;
  return (await gremienwegFuerGate(tx, p.portfolio_id, gate))?.viaSns ?? false;
}

export interface Vorschlag {
  art: Art;
  bezug: { typ: string; id: string };
  /** Projekt des Geschäfts (Einladungen, «via SNS-VR», «vertraulich») */
  projektId?: string | null;
  /** Gremium; sonst das entscheidende Gremium des Portfolios (A-45), Portfolio sonst aus dem Projekt */
  gremiumId?: string;
  portfolioId?: string;
  titel: string;
  antrag?: string;
}

/**
 * Traktandum vorschlagen (für obere Module, in ihrer Transaktion; Rechte prüft der Aufrufer): Das Geschäft erscheint in
 * den Vorschlägen der nächsten Sitzung des Gremiums (UC-006 Schritt 1). Idempotent je Geschäft: Ein offenes Traktandum
 * behält seinen Stand, Titel und Antrag werden nachgeführt, solange es nicht versendet ist. Liefert die ID.
 */
export async function vorschlagen(tx: Tx, v: Vorschlag): Promise<string> {
  return intern(tx, async () => {
    const offen = await store.offenesTraktandum(tx, v.art, v.bezug.typ, v.bezug.id);
    if (offen) {
      await tx.query(
        `UPDATE ppm.traktandum SET titel = btrim($2), antrag = btrim($3) WHERE id = $1 AND versendet_at IS NULL AND (titel, antrag) IS DISTINCT FROM (btrim($2), btrim($3))`,
        [offen.id, v.titel, v.antrag ?? '']);
      return offen.id;
    }
    const p = v.projektId ? await store.projekt(tx, v.projektId) : null;
    if (v.projektId && !p) throw notFound('Projekt');
    let g = v.gremiumId ? await store.gremium(tx, v.gremiumId) : null;
    if (!g) {
      const portfolioId = v.portfolioId ?? p?.portfolio_id;
      const e = portfolioId ? await entscheidendesGremium(tx, portfolioId) : null;
      g = e ? await store.gremium(tx, e.id) : null;
    }
    if (!g) throw conflict('Für das Portfolio ist kein entscheidendes Gremium erfasst. Erfassen Sie es unter Administration › Portfolios und Gremien.');
    return store.createTraktandum(tx, {
      portfolioId: g.portfolio_id, gremiumId: g.id, sitzungId: null, art: v.art, bezugTyp: v.bezug.typ, bezugId: v.bezug.id,
      projektId: p?.id ?? null, titel: v.titel, antrag: v.antrag ?? '', dauerMin: null, stand: 'vorgeschlagen', position: null,
      viaSns: false, vertraulich: p?.vertraulich ?? false,
    });
  });
}

/** Vorschlag zurücknehmen (Geschäft entfällt, z. B. Antrag zurückgezogen), solange er nicht versendet ist. */
export async function vorschlagZuruecknehmen(tx: Tx, v: { art: Art; bezug: { typ: string; id: string } }): Promise<boolean> {
  return intern(tx, async () => ((await tx.query(
    `DELETE FROM ppm.traktandum WHERE art = $1 AND bezug_typ = $2 AND bezug_id = $3 AND versendet_at IS NULL AND stand <> 'entschieden'`,
    [v.art, v.bezug.typ, v.bezug.id])).rowCount ?? 0) > 0);
}

/** Die Traktandenliste lässt sich nur bis zum Versand ändern (danach AP-E2-2: Sitzungsmodus). */
export function pruefeVorbereitung(s: store.SitzungRow): void {
  if (s.stand !== 'geplant' && s.stand !== 'in_vorbereitung') throw conflict('Die Unterlagen sind versendet; die Traktandenliste ist fest.');
}

/** Einladungen nach Projektorganisation vorsetzen: PL, CTL, SP (UC-006 Schritt 2, I-F2). */
async function einladungenVorsetzen(tx: Tx, t: store.TraktandumRow, sitzungId: string): Promise<void> {
  if (!t.projekt_id) return;
  const personen = (await store.projektleitung(tx, t.projekt_id)).map(p => ({ personId: p.person_id, funktion: p.funktion }));
  await store.einladungenSetzen(tx, { id: t.id, sitzung_id: sitzungId, portfolio_id: t.portfolio_id }, personen);
}

/**
 * Traktandum aufnehmen (UC-006 Schritt 2): Vorschlag dieses Gremiums (auch von der vorherigen Sitzung verschoben) wird
 * zuunterst traktandiert, mit Zeitbedarf der Art (Gate-Review 35 Min.), «via SNS-VR» (A1) und Einladungen an PL, CTL, SP.
 */
export async function aufnehmen(tx: Tx, s: store.SitzungRow, traktandumId: string): Promise<store.TraktandumRow> {
  pruefeVorbereitung(s);
  const t = await store.getTraktandum(tx, traktandumId);
  if (!t) throw notFound('Traktandum');
  if (t.gremium_id !== s.gremium_id) throw conflict('Das Traktandum gehört zu einem anderen Gremium.');
  if (t.stand === 'traktandiert' && t.sitzung_id === s.id) return t;
  if (t.stand !== 'vorgeschlagen' && t.stand !== 'verschoben') throw conflict('Das Traktandum ist nicht mehr vorgeschlagen.');
  if (t.sitzung_id && t.sitzung_id !== s.id) {
    const andere = await store.getSitzung(tx, t.sitzung_id);
    if (andere && andere.stand !== 'geplant' && andere.stand !== 'in_vorbereitung') throw conflict('Das Traktandum steht auf einer versendeten Sitzung.');
  }
  const p = t.projekt_id ? await store.projekt(tx, t.projekt_id) : null;
  await store.aufnehmen(tx, t.id, s.id, { dauerMin: artDauer(t.art), viaSns: await viaSns(tx, t.art, p) });
  if (t.sitzung_id && t.sitzung_id !== s.id) await store.positionenSchliessen(tx, t.sitzung_id);
  const neu = (await store.getTraktandum(tx, t.id))!;
  await einladungenVorsetzen(tx, neu, s.id);
  return neu;
}

/**
 * Geschäft einplanen (PP.04.05 Gate-Reviews einplanen; UC-006 Schritt 2): Die UE traktandiert ein Geschäft eines
 * Projekts direkt, auch bevor das Modul der Art es vorgeschlagen hat. Bezug ist dann das Projekt.
 */
export async function einplanen(tx: Tx, s: store.SitzungRow, e: { art: Art; projektId: string | null; titel?: string; antrag?: string }): Promise<store.TraktandumRow> {
  pruefeVorbereitung(s);
  const p = e.projektId ? await store.projekt(tx, e.projektId) : null;
  if (e.projektId && !p) throw notFound('Projekt');
  if (p && p.portfolio_id !== s.portfolio_id) throw invalid('Das Projekt gehört zu einem anderen Portfolio.', [{ path: '/projektId', message: 'anderes Portfolio' }]);
  const bezug = p ? { typ: 'projekt', id: p.id } : { typ: 'sitzung', id: s.id };
  if (await store.offenesTraktandum(tx, e.art, bezug.typ, bezug.id)) throw conflict('Dieses Geschäft ist bereits vorgeschlagen oder traktandiert. Nehmen Sie den Vorschlag auf.');
  const z = await traktandenart(e.art)?.zusammenfassung?.(tx, { ...bezug, projektId: p?.id ?? null });
  const titel = e.titel?.trim() || z?.titel || (p ? `${artLabel(e.art)} ${p.nummer} ${p.name}` : artLabel(e.art));
  const id = await store.createTraktandum(tx, {
    portfolioId: s.portfolio_id, gremiumId: s.gremium_id, sitzungId: null, art: e.art, bezugTyp: bezug.typ, bezugId: bezug.id,
    projektId: p?.id ?? null, titel, antrag: e.antrag ?? z?.antrag ?? '', dauerMin: null, stand: 'vorgeschlagen', position: null,
    viaSns: false, vertraulich: p?.vertraulich ?? false,
  });
  return aufnehmen(tx, s, id);
}

/** Aus der Traktandenliste nehmen: zurück zu den Vorschlägen. */
export async function entfernen(tx: Tx, s: store.SitzungRow, t: store.TraktandumRow): Promise<void> {
  pruefeVorbereitung(s);
  if (t.sitzung_id !== s.id || t.stand !== 'traktandiert') throw conflict('Das Traktandum steht nicht auf dieser Traktandenliste.');
  await store.entfernen(tx, t.id);
  await store.positionenSchliessen(tx, s.id);
}

/**
 * Auf die nächste Sitzung verschieben (UC-006 A2): nächster geplanter Termin des Gremiums; die Sitzung dazu entsteht bei
 * Bedarf. PL und SP werden mit dem Versand dieser Sitzung informiert (K3 Schritt 3). Liefert die Zielsitzung.
 */
export async function verschieben(tx: Tx, s: store.SitzungRow, t: store.TraktandumRow): Promise<store.SitzungRow> {
  pruefeVorbereitung(s);
  if (t.sitzung_id !== s.id || (t.stand !== 'traktandiert' && t.stand !== 'verschoben')) throw conflict('Das Traktandum steht nicht auf dieser Sitzung.');
  const [naechster] = await store.termine(tx, s.gremium_id, { nach: s.datum });
  if (!naechster) throw conflict('Für das Gremium ist kein weiterer Sitzungstermin geplant. Erfassen Sie zuerst den nächsten Termin.');
  const g = (await store.gremium(tx, s.gremium_id))!;
  const ziel = (await store.sitzungAm(tx, g.id, naechster)) ?? (await store.getSitzung(tx, await store.createSitzung(tx, g, naechster)))!;
  await store.verschieben(tx, t.id, s.id, ziel.id);
  await store.positionenSchliessen(tx, s.id);
  return ziel;
}

/** Feste Traktanden (Portfoliobericht als Traktandum 1, UC-006 Schritt 4) beim Anlegen der Sitzung. */
export async function festeTraktanden(tx: Tx, s: store.SitzungRow): Promise<void> {
  for (const a of festeArten()) {
    const bezug = { typ: 'sitzung', id: s.id };
    const z = await a.zusammenfassung?.(tx, { ...bezug, projektId: null });
    const id = await store.createTraktandum(tx, {
      portfolioId: s.portfolio_id, gremiumId: s.gremium_id, sitzungId: null, art: a.art, bezugTyp: bezug.typ, bezugId: bezug.id, projektId: null,
      titel: z?.titel ?? artLabel(a.art), antrag: z?.antrag ?? '', dauerMin: null, stand: 'vorgeschlagen', position: null, viaSns: false, vertraulich: false,
    });
    await aufnehmen(tx, s, id);
  }
}

/** Sitzung zum Termin anlegen (aus dem Sitzungstermin, fachmodell.md 2.4) samt festen Traktanden. */
export async function sitzungAnlegen(tx: Tx, g: store.GremiumRow, datum: string): Promise<store.SitzungRow> {
  if (!(await store.termine(tx, g.id, { von: datum, bis: datum })).length) {
    throw invalid('Für dieses Datum ist kein Sitzungstermin geplant.', [{ path: '/datum', message: 'kein Sitzungstermin des Gremiums' }]);
  }
  if (await store.sitzungAm(tx, g.id, datum)) throw conflict('Die Sitzung besteht bereits.');
  const s = (await store.getSitzung(tx, await store.createSitzung(tx, g, datum)))!;
  await festeTraktanden(tx, s);
  return (await store.getSitzung(tx, s.id))!;
}

// --- Fristen, Unterlagen, Versand ---------------------------------------------------------------------------------

export interface Versandfrist {
  /** Versand spätestens (Q8 Kap. 8.1: 5 Arbeitstage vor der Sitzung) */
  bis: string | null;
  /** verlangte Arbeitstage zwischen Versand und Sitzung */
  arbeitstage: number | null;
  /** Arbeitstage von heute bis zur Frist (negativ: überschritten) */
  restArbeitstage: number | null;
  /** Arbeitstage zwischen heute (bzw. dem Versand) und der Sitzung */
  vorlauf: number;
  eingehalten: boolean;
}

/** Versandfrist aus dem Phasenmodell (`versand`, A-27); ohne Phasenmodell in Kraft keine Frist. */
export async function versandfrist(tx: Tx, s: store.SitzungRow, jetzt = heute()): Promise<Versandfrist> {
  const f = await fristDatum(tx, 'versand', s.datum);
  const vorlauf = s.versand_vorlauf ?? (jetzt < s.datum ? await store.arbeitstageBis(tx, jetzt, s.datum) : 0);
  if (!f) return { bis: null, arbeitstage: null, restArbeitstage: null, vorlauf, eingehalten: true };
  const rest = await store.arbeitstageBis(tx, jetzt, f.datum);
  const soll = f.frist.einheit === 'arbeitstage' ? f.frist.wert : await store.arbeitstageBis(tx, f.datum, s.datum);
  return { bis: f.datum, arbeitstage: soll, restArbeitstage: rest, vorlauf, eingehalten: vorlauf >= soll };
}

export interface TraktandumStandUnterlagen { stand: UnterlagenStand; unterlagen: Unterlage[] }

/** Stand der Unterlagen (UC-006 Schritt 3): nach dem Versand der festgehaltene, vorher live aus der Art. */
export async function unterlagenstand(tx: Tx, s: store.SitzungRow, ts: readonly store.TraktandumRow[]): Promise<Map<string, TraktandumStandUnterlagen>> {
  const m = new Map<string, TraktandumStandUnterlagen>();
  if (s.versendet_at) {
    const gespeichert = await store.unterlagenGespeichert(tx, s.id);
    for (const t of ts) {
      const u = gespeichert.filter(x => x.traktandum_id === t.id).map(x => ({ art: x.art, titel: x.titel, bereit: x.stand_ok, hinweis: x.hinweis || undefined, inhalt: x.inhalt }));
      const art = traktandenart(t.art);
      m.set(t.id, { stand: !u.length ? (art && !art.unterlagen ? 'keine' : 'fehlt') : u.every(x => x.bereit) ? 'bereit' : 'fehlt', unterlagen: u });
    }
    return m;
  }
  for (const t of ts) m.set(t.id, await unterlagenVon(tx, t.art, bezugVon(t)));
  return m;
}

/** Zeitfenster je Traktandum ab Beginn der Sitzung (Einladung «ca. 14:20», K3 Einstieg). */
export function zeitfenster(s: store.SitzungRow, ts: readonly store.TraktandumRow[]): Map<string, string | null> {
  const m = new Map<string, string | null>();
  let min = 0;
  for (const t of ts) {
    m.set(t.id, s.beginn ? plusMinuten(s.beginn, min) : null);
    min += t.dauer_min ?? 0;
  }
  return m;
}

export interface Versandvorschau {
  frist: Versandfrist;
  traktanden: number;
  /** Gate Review Packets, Berichte, Beilagen, die versendet werden */
  unterlagen: { packet: number; bericht: number; beilage: number };
  /** eingeladene Personen (je Person einmal) */
  eingeladene: number;
  /** Traktanden mit fehlenden Unterlagen oder offenem Quality-Check (Warnung, UC-006 A2) */
  warnungen: { traktandumId: string; titel: string; stand: UnterlagenStand }[];
  /** auf die nächste Sitzung verschobene Traktanden: PL und SP werden informiert */
  verschoben: number;
}

export async function versandvorschau(tx: Tx, s: store.SitzungRow): Promise<Versandvorschau> {
  const ts = await store.traktanden(tx, s.id);
  const stand = await unterlagenstand(tx, s, ts);
  const unterlagen = { packet: 0, bericht: 0, beilage: 0 };
  for (const u of [...stand.values()].flatMap(x => x.unterlagen)) unterlagen[u.art] += 1;
  const eingeladene = new Set((await store.einladungen(tx, { sitzungId: s.id })).map(e => e.person_id)).size;
  return {
    frist: await versandfrist(tx, s),
    traktanden: ts.length,
    unterlagen,
    eingeladene,
    warnungen: ts.flatMap(t => {
      const st = stand.get(t.id)!.stand;
      return st === 'fehlt' || st === 'quality_check_offen' ? [{ traktandumId: t.id, titel: t.titel, stand: st }] : [];
    }),
    verschoben: (await store.verschobeneVon(tx, s.id)).length,
  };
}

/**
 * Unterlagen versenden (UC-006 Schritt 5): hält den Stand der Unterlagen fest, gibt die Sitzung den Mitgliedern frei
 * (Aufgabe «Unterlagen lesen» an `sitzung:read` am Portfolio), lädt die Eingeladenen gebündelt je Person ein (I-B3),
 * informiert PL und SP verschobener Traktanden (A2), erledigt «Sitzung vorbereiten» und protokolliert den Versand mit
 * den Arbeitstagen vor der Sitzung (K3-1). Warnungen sperren nicht.
 */
export async function versenden(tx: Tx, s: store.SitzungRow, version: number): Promise<Versandvorschau> {
  pruefeVorbereitung(s);
  const ts = await store.traktanden(tx, s.id);
  if (!ts.length) throw conflict('Die Traktandenliste ist leer. Nehmen Sie zuerst Traktanden auf.');
  const vorschau = await versandvorschau(tx, s);
  const stand = await unterlagenstand(tx, s, ts);
  for (const t of ts) {
    for (const u of stand.get(t.id)!.unterlagen) {
      await store.unterlageAnlegen(tx, t.id, { art: u.art, titel: u.titel, standOk: u.bereit, hinweis: u.hinweis ?? '', inhalt: u.inhalt ?? {} });
    }
  }
  if (!(await store.markVersendet(tx, s.id, version, vorschau.frist.vorlauf))) throw conflict('Die Sitzung wurde inzwischen geändert. Laden Sie sie neu.');

  const g = s.gremium_kuerzel.toUpperCase();
  const datum = kurzDatum(s.datum);
  const link = sitzungLink(s.gremium_kuerzel, s.datum);
  const bezug = { typ: 'sitzung', id: s.id };
  await aufgabe.erledigen(tx, { art: 'sitzung.vorbereiten', bezug });
  const gates = ts.filter(t => t.art === 'gate').length;
  await aufgabe.oeffnen(tx, {
    art: 'sitzung.lesen', bezug, empfaenger: { recht: 'sitzung:read', ort: { typ: 'portfolio', id: s.portfolio_id } },
    titel: `Unterlagen ${g} ${datum} lesen`,
    kontext: `${ts.length} Traktanden${gates ? `, davon ${gates} Gate-Review${gates === 1 ? '' : 's'}` : ''}`,
    link, frist: { datum: s.datum, art: 'kalendertage' }, manuell: true,
  });

  // Einladungen gebündelt je Person (I-B3): «Sie stellen ‹Projekt› am Mi 12.11. im PRAT vor · ca. 14:20»
  const fenster = zeitfenster(s, ts);
  const einladungen = await store.einladungen(tx, { sitzungId: s.id });
  const jePerson = new Map<string, string[]>();
  for (const t of ts) {
    const was = t.projekt_name ? `${t.projekt_nummer} ${t.projekt_name}` : t.titel;
    const um = fenster.get(t.id);
    for (const e of einladungen.filter(x => x.traktandum_id === t.id)) {
      jePerson.set(e.person_id, [...(jePerson.get(e.person_id) ?? []), um ? `${was} · ca. ${um}` : was]);
    }
  }
  for (const [person, was] of jePerson) {
    await mitteilung.senden(tx, { an: person, bezug, text: `Sie stellen am ${datum} im ${g} vor: ${was.join('; ')}.`, link });
  }

  // Verschobene Traktanden (A2): PL und SP informieren
  for (const t of await store.verschobeneVon(tx, s.id)) {
    if (!t.projekt_id) continue;
    const ziel = await store.getSitzung(tx, t.sitzung_id!);
    for (const p of (await store.projektleitung(tx, t.projekt_id)).filter(x => x.funktion !== 'ctl')) {
      await mitteilung.senden(tx, {
        an: p.person_id, bezug: { typ: 'traktandum', id: t.id },
        text: `${t.titel}: im ${g} vom ${datum} nicht traktandiert, verschoben auf ${ziel ? `die Sitzung vom ${kurzDatum(ziel.datum)}` : 'die nächste Sitzung'}`,
        link: ziel ? sitzungLink(s.gremium_kuerzel, ziel.datum) : link,
      });
    }
  }
  return vorschau;
}
