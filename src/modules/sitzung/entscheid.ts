/**
 * Sitzung durchführen (BC PP.04.02, PS.02.02; UC-006 Schritte 6–8, A1, A3, A4; K3 Schritte 7–9; AP-E2-2): Sitzung
 * starten, Entscheid je Traktandum mit Folge über die Arten-Registry, Auflagen, Korrektur bis zum Schliessen (A-30),
 * Entscheid des SNS-VR nachtragen (A-02), Sitzung schliessen mit Folgevorschlägen, Aufgaben und gebündelten
 * Benachrichtigungen (I-B3). Jede Aktion läuft in der Transaktion der Route; Audit und Ereignis schreibt die Route.
 */
import { conflict, invalid, type Tx } from '@vollholz/platform';
import { aufgabe, mitteilung } from '../eingang/index.ts';
import { fristDatum } from '../phasenmodell/index.ts';
import { sitzungLink } from './aktionen.ts';
import { artLabel, traktandenart, type Art, type Ergebnis, type FolgeKontext } from './arten.ts';
import * as es from './entscheid-store.ts';
import { kurzDatum } from './format.ts';
import { protokollErzeugen } from './protokoll.ts';
import * as store from './store.ts';

/**
 * Ergebnisse je Art nach K3 Schritt 8, solange das Modul der Art sie noch nicht registriert hat (die Registry geht vor).
 * Portfoliobericht: Kenntnisnahme ohne Entscheid (fachmodell.md 2.9).
 */
const K3_ERGEBNISSE: Readonly<Record<Art, readonly Ergebnis[]>> = {
  portfoliobericht: [],
  gate: [{ schluessel: 'freigegeben', label: 'Freigegeben' }, { schluessel: 'mit_auflagen', label: 'Mit Auflagen freigegeben' },
    { schluessel: 'zurueckgestellt', label: 'Zurückgestellt' }, { schluessel: 'abgelehnt', label: 'Gestoppt' }],
  idee: [{ schluessel: 'freigegeben', label: 'Freigegeben' }, { schluessel: 'mit_auflagen', label: 'Mit Auflagen freigegeben' },
    { schluessel: 'zurueckgestellt', label: 'Zurückgestellt' }, { schluessel: 'abgelehnt', label: 'Abgelehnt' }],
  aenderung: [{ schluessel: 'freigegeben', label: 'Freigegeben' }, { schluessel: 'abgelehnt', label: 'Abgelehnt' }],
  meilenstein: [{ schluessel: 'abgenommen', label: 'Abgenommen' }, { schluessel: 'nicht_abgenommen', label: 'Nicht abgenommen' }],
  eskalation: [{ schluessel: 'erledigt', label: 'Erledigt mit Massnahme' }, { schluessel: 'zurueckgestellt', label: 'Zurückgestellt' }],
  priorisierung: [{ schluessel: 'szenario_gewaehlt', label: 'Szenario gewählt' }],
  abschluss: [{ schluessel: 'abgeschlossen', label: 'Abgeschlossen' }, { schluessel: 'nacharbeiten', label: 'Nacharbeiten verlangt' },
    { schluessel: 'sistiert', label: 'Sistiert' }, { schluessel: 'abgebrochen', label: 'Abgebrochen' }, { schluessel: 'weiterfuehren', label: 'Weiterführen' }],
  quartalsreporting: [{ schluessel: 'verabschiedet', label: 'Verabschiedet' }, { schluessel: 'anpassungen', label: 'Anpassungen verlangt' }],
  jahresrueckblick: [{ schluessel: 'verabschiedet', label: 'Verabschiedet' }, { schluessel: 'anpassungen', label: 'Anpassungen verlangt' }],
};

/** Ergebnisse, die das Gremium für ein Traktandum der Art wählen kann; leer = Kenntnisnahme ohne Entscheid. */
export const optionen = (art: Art): readonly Ergebnis[] => traktandenart(art)?.ergebnisse ?? K3_ERGEBNISSE[art];

export const ergebnisLabel = (art: Art, schluessel: string): string => optionen(art).find(o => o.schluessel === schluessel)?.label ?? schluessel;

/** Ergebnisse mit diesem Schlüssel verlangen mindestens eine Auflage (K3 Schritt 8, A3). */
const MIT_AUFLAGEN = 'mit_auflagen';
/** Zurückgestellte Geschäfte werden für die Folgesitzung vorgeschlagen (UC-006 A3, K3 Schritt 8). */
const ZURUECKGESTELLT = 'zurueckgestellt';

/** Adresse der Entscheide und Auflagen (UI-36, Gremien › Entscheide). */
export const entscheideLink = '/gremien/entscheide';

const BEGRUENDUNG_FEHLT = 'Begründung fehlt: Die Begründung erscheint im Protokoll und beim Projekt.';

/** Sitzung starten (K3 Schritt 7): Sitzungsmodus, Entscheide lassen sich erfassen. */
export async function starten(tx: Tx, s: store.SitzungRow, version: number): Promise<void> {
  if (s.stand === 'laufend') return;
  if (s.stand === 'geplant' || s.stand === 'in_vorbereitung') throw conflict('Versende zuerst die Unterlagen; danach lässt sich die Sitzung starten.');
  if (s.stand !== 'versendet') throw conflict('Die Sitzung ist geschlossen.');
  if (!(await es.sitzungStarten(tx, s.id, version))) throw conflict('Die Sitzung wurde inzwischen geändert. Lade sie neu.');
}

export interface EntscheidEingabe {
  ergebnis: string;
  begruendung: string;
  anVr?: boolean;
  auflagen?: { text: string; verantwortlich: string; termin: string }[];
}

/** Datum im Kalender (das Schema prüft nur die Form). */
function gueltigesDatum(d: string): boolean {
  const t = new Date(`${d}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
}

/** Prüft die Eingabe gegen die Ergebnisse der Art (K3 Schritt 8, Regeln «Entscheid ohne Begründung»). */
async function pruefeEingabe(tx: Tx, art: Art, e: EntscheidEingabe, pfad = ''): Promise<void> {
  const opts = optionen(art);
  if (!opts.length) throw conflict(`${artLabel(art)}: Das Traktandum wird zur Kenntnis genommen und braucht keinen Entscheid.`);
  const fehler: { path: string; message: string }[] = [];
  if (!opts.some(o => o.schluessel === e.ergebnis)) fehler.push({ path: `${pfad}/ergebnis`, message: `möglich: ${opts.map(o => o.schluessel).join(', ')}` });
  if (!e.begruendung.trim()) fehler.push({ path: `${pfad}/begruendung`, message: 'Begründung fehlt' });
  const auflagen = e.auflagen ?? [];
  if (e.ergebnis === MIT_AUFLAGEN && !auflagen.length) fehler.push({ path: `${pfad}/auflagen`, message: 'mindestens eine Auflage' });
  for (const [i, a] of auflagen.entries()) {
    if (!a.text.trim()) fehler.push({ path: `${pfad}/auflagen/${i}/text`, message: 'Text fehlt' });
    if (!gueltigesDatum(a.termin)) fehler.push({ path: `${pfad}/auflagen/${i}/termin`, message: 'kein gültiges Datum' });
    if (!(await store.personBekannt(tx, a.verantwortlich))) fehler.push({ path: `${pfad}/auflagen/${i}/verantwortlich`, message: 'unbekannte Person' });
  }
  if (!fehler.length) return;
  const text = fehler.some(f => f.path.endsWith('/begruendung')) ? BEGRUENDUNG_FEHLT
    : fehler.some(f => f.path.endsWith('/auflagen')) ? 'Auflagen fehlen: Erfasse je Auflage Text, Termin und Verantwortliche.'
      : 'Der Entscheid ist unvollständig.';
  throw invalid(text, fehler);
}

/**
 * Entscheid erfassen oder korrigieren (UC-006 Schritt 7, A3, A4; A-30): nur in der laufenden Sitzung. Die Folge der Art
 * (`beiEntscheid`) läuft sofort in dieser Transaktion, bei «via SNS-VR» erst mit dem Entscheid des SNS-VR (A1);
 * Benachrichtigungen und Aufgaben der Auflagen erst beim Schliessen (K3 Entscheide). Liefert den Entscheid und ob er neu ist.
 */
export async function erfassen(tx: Tx, s: store.SitzungRow, t: store.TraktandumRow, e: EntscheidEingabe, version: number | null, u?: FolgeUmgebung): Promise<{ entscheid: es.EntscheidRow; neu: boolean; vorher: es.EntscheidRow | null }> {
  if (t.sitzung_id !== s.id || (t.stand !== 'traktandiert' && t.stand !== 'entschieden')) throw conflict('Das Traktandum steht nicht auf dieser Traktandenliste.');
  if (s.stand === 'versendet') throw conflict('Starte zuerst die Sitzung.');
  if (s.stand !== 'laufend') {
    throw conflict(s.stand === 'geschlossen' || s.stand === 'protokoll_versendet'
      ? 'Die Sitzung ist geschlossen. Ein Entscheid lässt sich nur noch über ein neues Traktandum ändern.'
      : 'Versende zuerst die Unterlagen und starte die Sitzung.');
  }
  await pruefeEingabe(tx, t.art, e);
  const daten = { ergebnis: e.ergebnis, begruendung: e.begruendung, stellungnahme: t.via_sns, anVr: e.anVr ?? false };
  const vorher = await es.entscheidVon(tx, t.id);
  let id: string;
  if (vorher) {
    if (version === null) throw conflict('Für dieses Traktandum ist bereits ein Entscheid erfasst. Lade ihn neu, um ihn zu korrigieren.');
    if (!(await es.entscheidKorrigieren(tx, vorher.id, version, daten))) throw conflict('Der Entscheid wurde inzwischen geändert. Lade ihn neu.');
    id = vorher.id;
  } else {
    id = await es.entscheidAnlegen(tx, { id: t.id, sitzung_id: s.id }, daten);
  }
  await es.auflagenSetzen(tx, id, (e.auflagen ?? []).map(a => ({ text: a.text, verantwortlich: a.verantwortlich, termin: a.termin })));
  await es.traktandumEntschieden(tx, t.id);
  if (!t.via_sns) await folge(tx, t, e.ergebnis, e.begruendung, false, u && { ...u, sitzungId: s.id, vorher: vorher ? { ergebnis: vorher.ergebnis, begruendung: vorher.begruendung } : null });
  await store.touchSitzung(tx, s.id);
  return { entscheid: (await es.getEntscheid(tx, id))!, neu: !vorher, vorher };
}

/** Was die Route der Folge mitgibt: entscheidende Person und Zugang wie `deps` (FolgeKontext ohne Sitzung und Vorher). */
export type FolgeUmgebung = Pick<FolgeKontext, 'akteur' | 'principalId' | 'db' | 'tuples'>;

/**
 * Folge der Art in der Transaktion des Entscheids (fachmodell.md 2.9); bei Korrektur erneut mit dem neuen Ergebnis und
 * dem vorherigen im Kontext (`k.vorher`, A-30).
 */
async function folge(tx: Tx, t: store.TraktandumRow, ergebnis: string, begruendung: string, viaSns: boolean,
  k?: Omit<FolgeKontext, 'traktandumId'>): Promise<void> {
  await traktandenart(t.art)?.beiEntscheid?.(tx, {
    traktandumId: t.id, bezug: { typ: t.bezug_typ, id: t.bezug_id, projektId: t.projekt_id }, ergebnis, begruendung, viaSns,
  }, k && { ...k, traktandumId: t.id });
}

/**
 * Entscheid des SNS-VR nachtragen (UC-006 A1; K02 Vorschlag, A-02: die UE erfasst ihn): erst nach dem Schliessen der
 * Sitzung, einmal. Jetzt läuft die Folge der Art (z. B. Phasenwechsel), PL und SP werden informiert.
 */
export async function snsNachtragen(tx: Tx, s: store.SitzungRow, t: store.TraktandumRow, e: { ergebnis: string; begruendung: string }, version: number, u?: FolgeUmgebung): Promise<es.EntscheidRow> {
  const ent = await es.entscheidVon(tx, t.id);
  if (!ent || !ent.stellungnahme) throw conflict('Das Traktandum läuft nicht über den SNS-VR.');
  if (ent.sns_ergebnis) throw conflict('Der Entscheid des SNS-VR ist bereits erfasst.');
  if (s.stand !== 'geschlossen' && s.stand !== 'protokoll_versendet') throw conflict('Schliesse zuerst die Sitzung; danach erfasst du den Entscheid des SNS-VR.');
  await pruefeEingabe(tx, t.art, { ergebnis: e.ergebnis, begruendung: e.begruendung });
  if (!(await es.snsEintragen(tx, ent.id, version, e))) throw conflict('Der Entscheid wurde inzwischen geändert. Lade ihn neu.');
  await folge(tx, t, e.ergebnis, e.begruendung, true, u && { ...u, sitzungId: s.id, vorher: null });
  if (t.projekt_id) {
    const text = `${t.titel}: Entscheid SNS-VR ${ergebnisLabel(t.art, e.ergebnis)}.`;
    for (const p of await store.projektleitung(tx, t.projekt_id)) {
      await mitteilung.senden(tx, { an: p.person_id, bezug: { typ: 'traktandum', id: t.id }, text, link: sitzungLink(s.gremium_kuerzel, s.datum) });
    }
  }
  return (await es.getEntscheid(tx, ent.id))!;
}

export interface Schliessen {
  /** Traktanden ohne Entscheid, für die nächste Sitzung vorgeschlagen (UC-006 Schritt 9) */
  nichtBehandelt: number;
  /** zurückgestellte Geschäfte, für eine Folgesitzung vorgeschlagen (A3) */
  zurueckgestellt: number;
  /** Auflagen, die jetzt Aufgaben im Eingang werden (A3) */
  auflagen: number;
  /** Personen, die eine gebündelte Mitteilung erhalten (I-B3) */
  benachrichtigt: number;
}

/** Vorschau «Sitzung schliessen» (K3 Schritt 9): Traktanden ohne Entscheid. */
export async function ohneEntscheid(tx: Tx, s: store.SitzungRow): Promise<store.TraktandumRow[]> {
  const ent = await es.entscheideDerSitzung(tx, s.id);
  return (await store.traktanden(tx, s.id)).filter(t => optionen(t.art).length > 0 && !ent.has(t.id));
}

/**
 * Sitzung schliessen (UC-006 Schritt 8, K3 Schritt 9): Traktanden ohne Entscheid und zurückgestellte Geschäfte werden
 * Vorschläge für die nächste Sitzung, der Protokollentwurf entsteht, Auflagen werden Aufgaben der Verantwortlichen,
 * «Protokoll versenden» geht an `sitzung:write` mit Frist (3 Arbeitstage, Q8 Kap. 8.1), und PL, SP sowie Verantwortliche
 * von Auflagen erhalten je Person eine Mitteilung (I-B3). Danach ist jeder Entscheid fest (A-30).
 */
export async function schliessen(tx: Tx, s: store.SitzungRow, version: number): Promise<Schliessen> {
  if (s.stand !== 'laufend') throw conflict(s.stand === 'versendet' ? 'Die Sitzung ist nicht gestartet.' : 'Die Sitzung läuft nicht.');
  const ts = await store.traktanden(tx, s.id);
  const ent = await es.entscheideDerSitzung(tx, s.id);
  const auflagen = await es.auflagen(tx, [...ent.values()].map(e => e.id));
  const g = s.gremium_kuerzel.toUpperCase();
  const datum = kurzDatum(s.datum);
  const link = sitzungLink(s.gremium_kuerzel, s.datum);
  const zeilen = new Map<string, string[]>();
  const melde = (person: string, zeile: string) => zeilen.set(person, [...(zeilen.get(person) ?? []), zeile]);
  const leitung = async (t: store.TraktandumRow) => t.projekt_id ? await store.projektleitung(tx, t.projekt_id) : [];

  // Protokollentwurf vor dem Umhängen der nicht behandelten Traktanden (sie erscheinen darin als «nicht behandelt»)
  await protokollErzeugen(tx, s, ts, ent, auflagen, { hatOptionen: art => optionen(art).length > 0, label: ergebnisLabel });

  let nichtBehandelt = 0;
  let zurueck = 0;
  for (const t of ts) {
    if (!optionen(t.art).length) continue;
    const e = ent.get(t.id);
    if (!e) {
      await es.nichtBehandeltVorschlagen(tx, t.id, s.id);
      nichtBehandelt += 1;
      for (const p of await leitung(t)) melde(p.person_id, `${t.titel}: nicht behandelt, für die nächste Sitzung vorgeschlagen`);
      continue;
    }
    if (e.ergebnis === ZURUECKGESTELLT && await es.folgeVorschlagen(tx, t, s.id)) zurueck += 1;
    const was = e.stellungnahme ? `Stellungnahme ${ergebnisLabel(t.art, e.ergebnis)}, Entscheid SNS-VR ausstehend` : ergebnisLabel(t.art, e.ergebnis);
    for (const p of await leitung(t)) melde(p.person_id, `${t.titel}: ${was}`);
  }
  if (nichtBehandelt) await store.positionenSchliessen(tx, s.id);
  if (!(await es.sitzungSchliessen(tx, s.id, version))) throw conflict('Die Sitzung wurde inzwischen geändert. Lade sie neu.');

  // Auflagen als Aufgaben (A3, fachmodell.md 4.2 `auflage.erfuellen`)
  const traktandumVon = new Map([...ent.values()].map(e => [e.id, ts.find(t => t.id === e.traktandum_id)!]));
  for (const a of auflagen) {
    const t = traktandumVon.get(a.entscheid_id)!;
    await aufgabe.oeffnen(tx, {
      art: 'auflage.erfuellen', bezug: { typ: 'auflage', id: a.id }, empfaenger: { person: a.verantwortlich },
      titel: `Auflage erfüllen: ${a.text.length > 120 ? `${a.text.slice(0, 119)}…` : a.text}`,
      kontext: `${t.projekt_nummer ? `${t.projekt_nummer} ${t.projekt_name}` : t.titel} · ${g} ${datum}`,
      link: `${entscheideLink}?auflage=${a.id}`, frist: { datum: a.termin, art: 'kalendertage' },
    });
    melde(a.verantwortlich, `Auflage bis ${kurzDatum(a.termin)}: ${a.text}`);
  }

  // «Protokoll versenden» (fachmodell.md 4.2), Frist aus dem Phasenmodell (`protokoll`, Q8 Kap. 8.1)
  const frist = await fristDatum(tx, 'protokoll', s.datum);
  await aufgabe.oeffnen(tx, {
    art: 'protokoll.versenden', bezug: { typ: 'sitzung', id: s.id },
    empfaenger: { recht: 'sitzung:write', ort: { typ: 'portfolio', id: s.portfolio_id } },
    titel: `Protokoll ${g} ${datum} versenden`, kontext: frist ? `Versand bis ${kurzDatum(frist.datum)}` : null,
    link: `${link}/protokoll`, frist: frist ? { datum: frist.datum, art: frist.frist.einheit === 'arbeitstage' ? 'arbeitstage' : 'kalendertage' } : null,
  });
  // «Unterlagen lesen» endet mit der Sitzung (fachmodell.md 4.2 `sitzung.lesen`)
  await aufgabe.erledigen(tx, { art: 'sitzung.lesen', bezug: { typ: 'sitzung', id: s.id } });

  for (const [person, z] of zeilen) {
    await mitteilung.senden(tx, { an: person, bezug: { typ: 'sitzung', id: s.id }, text: `${g} ${datum}: ${z.join('; ')}.`, link });
  }
  return { nichtBehandelt, zurueckgestellt: zurueck, auflagen: auflagen.length, benachrichtigt: zeilen.size };
}

/** Auflage erledigt melden (fachmodell.md 4.2): verantwortliche Person, ihre Vertretung oder `sitzung:write`. */
export async function auflageErfuellen(tx: Tx, a: es.AuflageRow): Promise<void> {
  if (a.stand === 'erfuellt') return;
  if (!(await es.auflageErfuellen(tx, a.id))) throw conflict('Die Auflage wurde inzwischen geändert. Lade sie neu.');
  await aufgabe.erledigen(tx, { art: 'auflage.erfuellen', bezug: { typ: 'auflage', id: a.id } });
}
