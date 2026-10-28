/** Schemas des Statusberichts (OpenAPI, Prüfung der Eingaben); BC PS.01.01, UC-004, Kernablauf K1. */
import { Type, type Static } from '@sinclair/typebox';
import { DateTime, Nullable, Uuid } from '@vollholz/platform';

/** Periode des Monatszyklus «YYYY-MM» (I-N5, docs/fachmodell.md 2.14). */
export const PERIODE_MUSTER = '^[0-9]{4}-(0[1-9]|1[0-2])$';
export const Periode = Type.String({ pattern: PERIODE_MUSTER, description: 'Periode des Monatszyklus.', examples: ['2026-10'] });

export const STAENDE = ['entwurf', 'eingereicht', 'zurueckgegeben', 'geprueft'] as const;
export type Stand = (typeof STAENDE)[number];

/** Dimensionen der Abweichung (UC-004 Schritt 7) und Skala (A-38, UX-OF-17: Codetabelle `abweichung`). */
export const DIMENSIONEN = ['inhalt', 'termin', 'ressourcen', 'budget'] as const;
export type Dimension = (typeof DIMENSIONEN)[number];

const Codewert = (description: string) => Type.String({ pattern: '^[a-z0-9_]{1,40}$', description });

const Beurteilung = Type.Object({
  stufe: Nullable(Codewert('Schlüssel aus der Codetabelle `abweichung` (Vorgabe keine, gering, wesentlich; A-38).')),
  kommentar: Type.String({ maxLength: 2000 }),
}, { additionalProperties: false });

export const Abweichung = Type.Object(
  Object.fromEntries(DIMENSIONEN.map(d => [d, Beurteilung])) as Record<Dimension, typeof Beurteilung>,
  { $id: 'StatusberichtAbweichung', additionalProperties: false, description: 'Beurteilung der Abweichung je Dimension.' },
);
export type AbweichungIn = Static<typeof Abweichung>;

const Status = Type.Union([Type.Literal('im_plan'), Type.Literal('kritisch')], { description: 'Projektstatus (Codetabelle `projektstatus`, zweistufig, Q8 Kap. 9).' });
const Anlass = Type.Union([Type.Literal('monatlich'), Type.Literal('ausserordentlich')], { description: 'Monatlich oder ausserhalb des Rhythmus (UC-004 Ausgangslage).' });

/** Felder des Entwurfs (alle beim Speichern optional; Pflichtangaben prüft erst das Einreichen). */
const Felder = {
  anlass: Anlass,
  status: Nullable(Status),
  trend: Nullable(Codewert('Schlüssel aus der Codetabelle `trend` (Vorgabe aufwaerts, gleichbleibend, abwaerts).')),
  abschlussPer: Nullable(Type.String({ format: 'date', description: 'Geplanter Abschluss des Projekts.' })),
  naechsterMeilenstein: Type.String({ maxLength: 500 }),
  abweichung: Type.Unsafe<AbweichungIn>(Type.Ref('StatusberichtAbweichung')),
  abhaengigkeiten: Type.String({ maxLength: 4000 }),
  entscheide: Type.String({ maxLength: 4000, description: 'Anstehende Entscheide.' }),
  begruendung: Type.String({ maxLength: 4000, description: 'Pflicht bei «kritisch» (UC-004 A2).' }),
  massnahme: Type.String({ maxLength: 4000, description: 'Pflicht bei «kritisch» (UC-004 A2).' }),
  entscheidNoetig: Type.Boolean({ description: 'Entscheid des PRAT nötig (UC-004 A2.2); nur bei «kritisch».' }),
};

export const StatusberichtPut = Type.Partial(Type.Object(Felder), { $id: 'StatusberichtPut', additionalProperties: false });
export type StatusberichtPutIn = Static<typeof StatusberichtPut>;

/** Vorperiode neben Status und Trend (K1 Schritt 7: Wert der Vorperiode steht daneben). */
const Vorperiode = Type.Object({
  periode: Type.String(), status: Nullable(Status), trend: Nullable(Type.String()), stand: Type.String(),
}, { additionalProperties: false });

/** Eskalation zum Bericht (PS.03.03; UC-004 A1.2 aus der Warnung «wesentliche Abweichung», A2.2 aus «kritisch»). */
const EskalationKurz = Type.Object({
  id: Uuid,
  anlass: Type.Union([Type.Literal('kritisch'), Type.Literal('abweichung')], { description: '`kritisch`: beim Einreichen; `abweichung`: von der PL aus der Warnung gestartet.' }),
  stand: Type.Union([Type.Literal('offen'), Type.Literal('traktandiert'), Type.Literal('erledigt')]),
  vorgeschlagen: Type.Boolean({ description: 'Beim Anlegen dem entscheidenden Gremium vorgeschlagen; false: das Portfolio hat keines, die Unternehmensentwicklung traktandiert von Hand.' }),
  angelegtAt: DateTime,
}, { additionalProperties: false });

export const EskalationNeu = Type.Object({
  grund: Type.String({ minLength: 1, maxLength: 4000, description: 'Worum es geht, z. B. die wesentliche Abweichung zur Baseline.' }),
  massnahme: Type.Optional(Type.String({ maxLength: 4000, description: 'Vorgeschlagene Massnahme; leer: das Gremium entscheidet über das weitere Vorgehen.' })),
}, { $id: 'StatusberichtEskalationNeu', additionalProperties: false });
export type EskalationNeuIn = Static<typeof EskalationNeu>;

export const Fehlend = Type.Object({
  feld: Type.String({ description: 'Feld im Bericht, z. B. `status` oder `abweichung.budget`.' }),
  text: Type.String(),
}, { $id: 'StatusberichtFehlend', additionalProperties: false });

export const Statusbericht = Type.Object({
  id: Nullable(Uuid),
  projektId: Uuid,
  projektNummer: Type.String(),
  projektName: Type.String(),
  periode: Type.String(),
  periodeStand: Type.Union([Type.Literal('offen'), Type.Literal('abgeschlossen')]),
  stand: Type.Union(STAENDE.map(s => Type.Literal(s))),
  phase: Type.String(),
  ...Felder,
  vorperiode: Nullable(Vorperiode),
  fehlend: Type.Array(Type.Ref('StatusberichtFehlend'), { description: 'Fehlende Pflichtangaben für das Einreichen (Seitenpanel «Bereit zum Einreichen», I-P4).' }),
  eingereichtAt: Nullable(DateTime),
  eingereichtBy: Nullable(Uuid),
  geprueftAt: Nullable(DateTime),
  version: Type.Integer({ minimum: 0, description: '0: noch nicht gespeichert; mit `If-Match: W/"0"` anlegen.' }),
  updatedAt: Nullable(DateTime),
  eskalation: Nullable(EskalationKurz),
  can: Type.Object({
    write: Type.Boolean({ description: 'Entwurf speichern.' }),
    einreichen: Type.Boolean(),
    zurueckziehen: Type.Boolean({ description: 'Rückgängig innert 10 s nach dem Einreichen.' }),
    eskalieren: Type.Boolean({ description: 'Eskalation aus der Warnung «wesentliche Abweichung» starten (UC-004 A1.2): bearbeitbar und noch ohne Eskalation.' }),
  }),
}, { $id: 'Statusbericht', additionalProperties: false });
export type StatusberichtOut = Static<typeof Statusbericht>;

export const StatusberichtKurz = Type.Object({
  id: Uuid, periode: Type.String(), anlass: Anlass, stand: Type.Union(STAENDE.map(s => Type.Literal(s))),
  status: Nullable(Status), trend: Nullable(Type.String()), phase: Type.String(),
  eingereichtAt: Nullable(DateTime), version: Type.Integer(),
}, { $id: 'StatusberichtKurz', additionalProperties: false });

export const StatusberichtList = Type.Object({ items: Type.Array(Type.Ref('StatusberichtKurz')) }, { $id: 'StatusberichtList', additionalProperties: false });

export const BerichtParams = Type.Object({ id: Type.String({ format: 'uuid' }), periode: Periode }, { additionalProperties: false });
