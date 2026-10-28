/**
 * Schemas des Monatsabschlusses (OpenAPI, Prüfung der Eingaben); BC PS.01.02–04, UC-005, Kernablauf K1 (AP-E1-2).
 */
import { Type, type Static } from '@sinclair/typebox';
import { DateTime, Nullable, Uuid } from '@vollholz/platform';
import { Periode } from './schemas.ts';

const Status = Nullable(Type.Union([Type.Literal('im_plan'), Type.Literal('kritisch')]));

/**
 * Stand eines Projekts in der Periode (K1 «Prüfen» Schritt 1): `ausstehend` = kein eingereichter Bericht (auch ein
 * Entwurf), `nicht_gemeldet` = Periode ohne geprüften Bericht abgeschlossen (UC-005 A3, A-11).
 */
export const ZEILEN_STAENDE = ['eingereicht', 'zurueckgegeben', 'geprueft', 'ausstehend', 'nicht_gemeldet'] as const;
export type ZeilenStand = (typeof ZEILEN_STAENDE)[number];
const ZeilenStand = Type.Union(ZEILEN_STAENDE.map(s => Type.Literal(s)));

/** Auffälligkeiten (UC-005 Schritt 2, K1-4): Status geändert, Termin verschoben, Prognose über Budget. */
export const Auffaelligkeit = Type.Union([
  Type.Object({
    art: Type.Literal('status'),
    von: Type.Union([Type.Literal('im_plan'), Type.Literal('kritisch')]),
    nach: Type.Union([Type.Literal('im_plan'), Type.Literal('kritisch')]),
  }, { additionalProperties: false, description: 'Status gegenüber der Vorperiode geändert.' }),
  Type.Object({
    art: Type.Literal('termin'),
    tage: Type.Integer({ minimum: 1, description: 'Grösste Verschiebung in Kalendertagen.' }),
    bezug: Type.Union([Type.Literal('baseline'), Type.Literal('vorperiode')], { description: 'Meilenstein gegenüber der Baseline oder «Abschluss per» gegenüber der Vorperiode.' }),
    text: Type.String({ description: 'Betroffener Meilenstein bzw. «Abschluss per».' }),
  }, { additionalProperties: false }),
  Type.Object({
    art: Type.Literal('budget'),
    prozent: Type.Number({ description: 'Prognose über dem Budget der Baseline, in Prozent (gerundet auf eine Stelle).' }),
    phase: Type.String(),
  }, { additionalProperties: false, description: 'Prognose einer Phase über dem Budget (nur mit `finanzen:read`).' }),
], { $id: 'Auffaelligkeit' });
export type AuffaelligkeitOut = Static<typeof Auffaelligkeit>;

export const PeriodeZeile = Type.Object({
  projektId: Uuid,
  projektNummer: Type.String(),
  projektName: Type.String(),
  portfolioId: Uuid,
  portfolioName: Type.String(),
  phase: Type.String(),
  stand: ZeilenStand,
  /** Entwurf der Projektleitung vorhanden (Stand bleibt «ausstehend»). */
  entwurf: Type.Boolean(),
  status: Status,
  trend: Nullable(Type.String()),
  abschlussPer: Nullable(Type.String({ format: 'date' })),
  naechsterMeilenstein: Type.String(),
  vorperiode: Nullable(Type.Object({ periode: Type.String(), status: Status, trend: Nullable(Type.String()) }, { additionalProperties: false })),
  auffaelligkeiten: Type.Array(Type.Ref('Auffaelligkeit')),
  /** Erneut eingereicht nach einer Rückfrage (K1 «nach Rückfrage»). */
  nachRueckfrage: Type.Boolean(),
  /** Offene Rückfrage (Stand «zurückgegeben»). */
  rueckfrage: Nullable(Type.Object({ text: Type.String(), gestelltAt: DateTime }, { additionalProperties: false })),
  eingereichtAt: Nullable(DateTime),
  geprueftAt: Nullable(DateTime),
  eingefordertAt: Nullable(DateTime),
  /** Version des Berichts für `If-Match` (0 ohne Bericht). */
  version: Type.Integer({ minimum: 0 }),
  can: Type.Object({
    bestaetigen: Type.Boolean(),
    rueckfrage: Type.Boolean(),
    einfordern: Type.Boolean(),
    zuruecknehmen: Type.Boolean({ description: 'Bestätigung rückgängig machen (Toast «Rückgängig»).' }),
  }, { additionalProperties: false }),
}, { $id: 'PeriodeZeile', additionalProperties: false });
export type PeriodeZeileOut = Static<typeof PeriodeZeile>;

/** Kopf und Wirkung des Abschlusses (K1 «Prüfen» Schritte 1 und 5, I-R1 Stufe 3). */
export const Periodenstand = Type.Object({
  periode: Type.String(),
  stand: Type.Union([Type.Literal('offen'), Type.Literal('abgeschlossen')]),
  abgeschlossenAt: Nullable(DateTime),
  abgeschlossenBy: Nullable(Type.Object({ id: Uuid, name: Type.String() }, { additionalProperties: false })),
  /** Version der Periode für `If-Match` beim Abschluss (0, solange es sie nicht gibt). */
  version: Type.Integer({ minimum: 0 }),
  anzahl: Type.Object({
    projekte: Type.Integer(), eingereicht: Type.Integer(), zurueckgegeben: Type.Integer(), geprueft: Type.Integer(),
    ausstehend: Type.Integer(), nichtGemeldet: Type.Integer(), auffaellig: Type.Integer(),
  }, { additionalProperties: false, description: 'Über alle berichtspflichtigen Projekte der Periode (ohne Filter).' }),
  fristen: Type.Object({
    berichtAufgabe: Nullable(Type.String({ format: 'date', description: 'Tag der Berichtsaufgabe (A-26); null ohne Phasenmodell in Kraft.' })),
    stichtag: Nullable(Type.String({ format: 'date', description: 'Stichtag der Berichte (Q8 Kap. 8.4); null ohne Phasenmodell in Kraft.' })),
    abschlussBis: Type.String({ format: 'date', description: 'Monatsende: Abschluss durch die Unternehmensentwicklung (UC-005 Schritt 5).' }),
  }, { additionalProperties: false }),
  vorperiode: Type.String(),
  abschluss: Type.Object({
    moeglich: Type.Boolean(),
    sperre: Nullable(Type.String({ description: 'Warum der Abschluss gesperrt ist (Text der Regel).' })),
    geprueft: Type.Integer(),
    nichtGemeldet: Type.Integer({ description: 'Projekte, für die die Werte der Vorperiode mit «nicht gemeldet» übernommen werden.' }),
  }, { additionalProperties: false }),
  can: Type.Object({ pruefen: Type.Boolean(), abschliessen: Type.Boolean() }, { additionalProperties: false }),
}, { $id: 'Periodenstand', additionalProperties: false });
export type PeriodenstandOut = Static<typeof Periodenstand>;

export const PeriodeUebersicht = Type.Object({
  kopf: Type.Ref('Periodenstand'),
  items: Type.Array(Type.Ref('PeriodeZeile')),
  nextCursor: Nullable(Type.String()),
}, { $id: 'PeriodeUebersicht', additionalProperties: false });

export const PeriodeParams = Type.Object({ periode: Periode }, { additionalProperties: false });

export const PeriodeQuery = Type.Object({
  stand: Type.Optional(ZeilenStand),
  portfolio: Type.Optional(Type.String({ format: 'uuid' })),
  auffaellig: Type.Optional(Type.Boolean({ description: 'Nur Berichte mit (true) bzw. ohne (false) Auffälligkeit.' })),
  sort: Type.Optional(Type.Union([Type.Literal('auffaellig'), Type.Literal('nummer')], { description: 'Standard `auffaellig`: auffällige zuerst, dann übrige eingereichte, zurückgegebene, ausstehende, geprüfte (I-L5).' })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000, default: 500 })),
  cursor: Type.Optional(Type.String()),
}, { additionalProperties: false });
export type PeriodeQueryIn = Static<typeof PeriodeQuery>;

export const Auswahl = Type.Object({
  projekte: Type.Array(Type.String({ format: 'uuid' }), { minItems: 1, maxItems: 1000, uniqueItems: true }),
}, { $id: 'PeriodeAuswahl', additionalProperties: false });
export type AuswahlIn = Static<typeof Auswahl>;

/** Ergebnis einer Sammelaktion je Projekt (I-L4: «12 bestätigt, 3 übersprungen»). */
export const Sammelergebnis = Type.Object({
  erledigt: Type.Array(Uuid),
  uebersprungen: Type.Array(Type.Object({
    projektId: Uuid,
    projektNummer: Type.String(),
    grund: Type.Union([Type.Literal('auffaellig'), Type.Literal('stand')], { description: '`auffaellig`: einzeln prüfen (A-28); `stand`: Aktion im Stand des Projekts nicht möglich.' }),
  }, { additionalProperties: false })),
  unbekannt: Type.Integer({ description: 'Projekte, die es nicht gibt oder die die Person nicht sieht (nicht genannt).' }),
  kopf: Type.Ref('Periodenstand'),
}, { $id: 'PeriodeSammelergebnis', additionalProperties: false });

export const RueckfrageCreate = Type.Object({
  text: Type.String({ minLength: 1, maxLength: 2000, description: 'Rückfrage im Wortlaut der Unternehmensentwicklung (UC-005 A2).' }),
}, { $id: 'RueckfrageCreate', additionalProperties: false });

export const Rueckfrage = Type.Object({
  id: Uuid,
  text: Type.String(),
  antwort: Nullable(Type.String()),
  gestelltBy: Nullable(Type.Object({ id: Uuid, name: Type.String() }, { additionalProperties: false })),
  gestelltAt: DateTime,
  beantwortetAt: Nullable(DateTime),
}, { $id: 'Rueckfrage', additionalProperties: false });
export type RueckfrageOut = Static<typeof Rueckfrage>;

export const RueckfrageList = Type.Object({ items: Type.Array(Type.Ref('Rueckfrage')) }, { $id: 'RueckfrageList', additionalProperties: false });

/** Termin der Baseline und aufdatiert (PS.01.04, UC-005 Schritt 4). */
const Termin = Type.Object({
  baseline: Type.String({ format: 'date' }),
  aktuell: Type.String({ format: 'date' }),
  tage: Type.Integer({ description: 'Abweichung in Kalendertagen (positiv = später).' }),
}, { additionalProperties: false });

export const Terminabweichung = Type.Object({
  projektId: Uuid,
  projektNummer: Type.String(),
  projektName: Type.String(),
  phase: Type.String(),
  phasen: Type.Array(Type.Composite([Type.Object({ phase: Type.String() }), Termin], { additionalProperties: false }), { description: 'Ende je Phase: letzter Meilenstein bzw. letztes Lieferergebnis der Phase.' }),
  abschluss: Nullable(Termin),
  /** Grösste Verschiebung über Phasen und Abschluss (Sortierung). */
  maxTage: Type.Integer(),
}, { $id: 'Terminabweichung', additionalProperties: false });
export type TerminabweichungOut = Static<typeof Terminabweichung>;

export const TerminabweichungList = Type.Object({
  items: Type.Array(Type.Ref('Terminabweichung')),
  ohneBaseline: Type.Array(Type.Object({ projektId: Uuid, projektNummer: Type.String(), projektName: Type.String() }, { additionalProperties: false }), { description: 'Projekte ohne Termine der Baseline (Z4).' }),
}, { $id: 'TerminabweichungList', additionalProperties: false });

export const StatusberichteKopf = Type.Object({
  pruefen: Nullable(Type.Object({
    periode: Type.String({ description: 'Periode, an der die Unternehmensentwicklung arbeitet: die Vorperiode, solange sie offen ist und Berichte hat, sonst die laufende.' }),
    eingereicht: Type.Integer(), ausstehend: Type.Integer(), auffaellig: Type.Integer(),
    abschlussBis: Type.String({ format: 'date' }),
    // Kopfkarte «Monatszyklus» im Eingang (informationsarchitektur.md «Startseite je Rolle»: «23 von 31 eingereicht, 15 geprüft · Stichtag …»)
    projekte: Type.Integer({ description: 'Berichtspflichtige Projekte der Periode.' }),
    zurueckgegeben: Type.Integer(), geprueft: Type.Integer(),
    stichtag: Nullable(Type.String({ format: 'date', description: 'Stichtag der Berichte; null ohne Phasenmodell in Kraft.' })),
  }, { additionalProperties: false, description: 'Nur mit `statusbericht:review`.' })),
}, { $id: 'StatusberichteKopf', additionalProperties: false });
