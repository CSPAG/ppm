/** Schemas des Phasenmodells (OpenAPI, Prüfung der Eingaben); feste Struktur der Phasen und Gates (BC AM.02.03). */
import { Type, type Static, type TLiteral, type TUnion } from '@sinclair/typebox';
import { Cursor, DateTime, Limit, NextCursor, Nullable, Uuid } from '@vollholz/platform';

/** Phasen Pre-P0 (Ideen) bis P4 (Q8 Kap. 7, PPM-Master «Phasenmodell»); das System kennt ihr Verhalten. */
export const PHASEN = ['PRE_P0', 'P0', 'P1', 'P2', 'P3', 'P4'] as const;
export type PhaseCode = (typeof PHASEN)[number];

/** Gates zwischen den Phasen (Q6 F6, Q8 Abb. 4); Exit P4 schliesst ab. */
export const GATES = [
  { code: 'EINTRITT_P0', von: 'PRE_P0', nach: 'P0' },
  { code: 'P0_P1', von: 'P0', nach: 'P1' },
  { code: 'P1_P2', von: 'P1', nach: 'P2' },
  { code: 'P2_P3', von: 'P2', nach: 'P3' },
  { code: 'P3_P4', von: 'P3', nach: 'P4' },
  { code: 'EXIT_P4', von: 'P4', nach: null },
] as const satisfies readonly { code: string; von: PhaseCode; nach: PhaseCode | null }[];
export type GateCode = (typeof GATES)[number]['code'];
export const GATE_CODES = GATES.map(g => g.code) as unknown as readonly GateCode[];

export const FRISTEN = ['bericht_aufgabe', 'bericht_stichtag', 'gate_vorbereiten', 'sitzung_vorbereiten', 'versand', 'protokoll'] as const;
export type FristSchluessel = (typeof FRISTEN)[number];
export const EINHEITEN_FRIST = ['tag_im_monat', 'arbeitstage', 'kalendertage'] as const;
export const DIMENSIONEN_TOLERANZ = ['termin', 'kosten', 'umfang'] as const;
export const EINHEITEN_TOLERANZ = ['prozent', 'kalendertage', 'arbeitstage'] as const;
export const DIMENSIONEN_WIRKUNG = ['scope', 'budget', 'ressourcen'] as const;

type Lits<T extends readonly string[]> = { -readonly [K in keyof T]: TLiteral<T[K]> };
/** Aufzählung fester Werte als Union von Literalen (präziser Typ für `Static`). */
const lit = <const T extends readonly string[]>(v: T, o: { description?: string } = {}) =>
  Type.Union(v.map(x => Type.Literal(x)), o) as unknown as TUnion<Lits<T>>;

const PhaseCodeT = lit(PHASEN, { description: 'Code der Phase (fest).' });
const GateCodeT = lit(['EINTRITT_P0', 'P0_P1', 'P1_P2', 'P2_P3', 'P3_P4', 'EXIT_P4'] as const satisfies readonly GateCode[], { description: 'Code des Gates (fest).' });
const Name = Type.String({ minLength: 1, maxLength: 200, description: 'Bezeichnung in der Oberfläche.' });
const Kapitel = Type.Integer({ minimum: 1, maximum: 13, description: 'Kapitel der Vorlage Projektvertrag (Q7).' });
const Schluessel = (max: number, description: string) => Type.String({ pattern: `^[a-z][a-z0-9_]{0,${max - 1}}$`, description });

const Leitfrage = Type.Object({
  wertestrom: Schluessel(40, 'Schlüssel des Werts in der Codetabelle «Werteströme».'),
  text: Type.String({ minLength: 1, maxLength: 1000 }),
}, { additionalProperties: false });
const Ergebnis = Type.Object({
  art: lit(['lieferergebnis', 'meilenstein'] as const),
  text: Type.String({ minLength: 1, maxLength: 500 }),
}, { additionalProperties: false });
const Pflichtangabe = Type.Object({
  kapitel: Kapitel,
  feld: Schluessel(60, 'Feld im Schema des Kapitels (Modul vertrag).'),
  text: Type.String({ minLength: 1, maxLength: 500, description: 'Was verlangt ist, in Worten.' }),
}, { additionalProperties: false });
const Wirkung = Type.Object({ kapitel: Kapitel, dimension: lit(DIMENSIONEN_WIRKUNG) }, { additionalProperties: false });
const Frist = Type.Object({
  schluessel: lit(FRISTEN),
  wert: Type.Integer({ minimum: 0, maximum: 365 }),
  einheit: lit(EINHEITEN_FRIST, { description: 'Tag im Monat (Monatszyklus), Arbeitstage (Q8, UX-E11) oder Kalendertage.' }),
}, { additionalProperties: false });
const Toleranz = Type.Object({
  dimension: lit(DIMENSIONEN_TOLERANZ),
  wert: Nullable(Type.Number({ minimum: 0, maximum: 9_999_999 })),
  einheit: lit(EINHEITEN_TOLERANZ),
}, { additionalProperties: false, description: 'Standard für Projekte; ohne Wert keine Warnung «wesentlich» (A-10).' });

const Ergebnisse = Type.Array(Ergebnis, { maxItems: 100 });
const Pflichtangaben = Type.Array(Pflichtangabe, { maxItems: 100 });
const Leitfragen = Type.Array(Leitfrage, { maxItems: 100 });

/** Inhalt einer Version (Vorgabe, Kopie); Reihenfolge der Listen = Position. */
export const DokumentT = Type.Object({
  phasen: Type.Array(Type.Object({ code: PhaseCodeT, name: Name, ergebnisse: Ergebnisse, pflichtangaben: Pflichtangaben })),
  gates: Type.Array(Type.Object({ code: GateCodeT, name: Name, leitfragen: Leitfragen, pflichtangaben: Pflichtangaben })),
  kapitelWirkung: Type.Array(Wirkung),
  fristen: Type.Array(Frist),
  toleranzen: Type.Array(Toleranz),
});
export type Dokument = Static<typeof DokumentT>;

const Stand = lit(['entwurf', 'in_kraft', 'abgeloest'] as const, { description: 'Entwurf (bearbeitbar), in Kraft (gilt), abgelöst.' });

const Meta = {
  id: Uuid,
  nummer: Type.Integer({ minimum: 1, description: 'Laufende Nummer der Version.' }),
  stand: Stand,
  beschreibung: Type.String({ description: 'Was sich mit dieser Version ändert.' }),
  inKraftAb: Nullable(DateTime),
  inKraftVon: Nullable(Uuid),
  version: Type.Integer({ minimum: 1, description: 'Bearbeitungsstand (ETag).' }),
  createdAt: DateTime, createdBy: Nullable(Uuid), updatedAt: DateTime, updatedBy: Nullable(Uuid),
};

const Pruefpunkt = Type.Object({
  stufe: lit(['hinweis', 'warnung'] as const),
  regel: Type.String({ description: 'Schlüssel der Regel.' }),
  text: Type.String(),
  ort: Type.Object({ art: lit(['phase', 'gate', 'frist', 'toleranz', 'wirkung'] as const), code: Nullable(Type.String()) }, { additionalProperties: false }),
}, { additionalProperties: false });

export const Phasenmodell = Type.Object({
  ...Meta,
  phasen: Type.Array(Type.Object({ code: PhaseCodeT, name: Type.String(), position: Type.Integer(), ergebnisse: Ergebnisse, pflichtangaben: Pflichtangaben }, { additionalProperties: false })),
  gates: Type.Array(Type.Object({
    code: GateCodeT, name: Type.String(), vonPhase: PhaseCodeT, nachPhase: Nullable(PhaseCodeT), position: Type.Integer(), leitfragen: Leitfragen, pflichtangaben: Pflichtangaben,
  }, { additionalProperties: false })),
  kapitelWirkung: Type.Array(Wirkung),
  fristen: Type.Array(Frist),
  toleranzen: Type.Array(Toleranz),
  pruefung: Type.Array(Pruefpunkt, { description: 'Prüfbericht (I-P4): Hinweise und Warnungen vor dem In-Kraft-Setzen.' }),
  can: Type.Object({
    write: Type.Boolean({ description: 'Entwurf bearbeiten oder verwerfen.' }),
    activate: Type.Boolean({ description: 'Entwurf in Kraft setzen.' }),
  }, { additionalProperties: false, description: 'Was die anfragende Person damit darf (Recht und Stand).' }),
}, { $id: 'Phasenmodell', additionalProperties: false });
export type PhasenmodellOut = Static<typeof Phasenmodell>;
export type Pruefpunkt = Static<typeof Pruefpunkt>;

export const PhasenmodellKurz = Type.Object(Meta, { $id: 'PhasenmodellKurz', additionalProperties: false });
export type PhasenmodellKurzOut = Static<typeof PhasenmodellKurz>;

export const PhasenmodellList = Type.Object({
  items: Type.Array(Type.Ref('PhasenmodellKurz')),
  nextCursor: NextCursor,
  can: Type.Object({ create: Type.Boolean({ description: 'Entwurf anlegen.' }) }, { additionalProperties: false }),
}, { $id: 'PhasenmodellList', additionalProperties: false });

export const PhasenmodellCreate = Type.Object({
  quelle: Type.Optional(lit(['aktuell', 'vorgabe'] as const, {
    description: '`aktuell`: Kopie der Version in Kraft (Standard, sofern vorhanden); `vorgabe`: Vorgabe des PM-Handbuchs.',
  })),
  beschreibung: Type.Optional(Type.String({ maxLength: 2000 })),
}, { $id: 'PhasenmodellCreate', additionalProperties: false });
export type PhasenmodellCreateIn = Static<typeof PhasenmodellCreate>;

/** Änderung des Entwurfs: jede angegebene Liste ersetzt die bisherige (je Phase bzw. Gate nur die genannten Teile). */
export const PhasenmodellPatch = Type.Object({
  beschreibung: Type.Optional(Type.String({ maxLength: 2000 })),
  phasen: Type.Optional(Type.Array(Type.Object({
    code: PhaseCodeT, name: Type.Optional(Name), ergebnisse: Type.Optional(Ergebnisse), pflichtangaben: Type.Optional(Pflichtangaben),
  }, { additionalProperties: false }), { maxItems: PHASEN.length })),
  gates: Type.Optional(Type.Array(Type.Object({
    code: GateCodeT, name: Type.Optional(Name), leitfragen: Type.Optional(Leitfragen), pflichtangaben: Type.Optional(Pflichtangaben),
  }, { additionalProperties: false }), { maxItems: GATES.length })),
  kapitelWirkung: Type.Optional(Type.Array(Wirkung, { maxItems: 39 })),
  fristen: Type.Optional(Type.Array(Frist, { maxItems: FRISTEN.length })),
  toleranzen: Type.Optional(Type.Array(Toleranz, { maxItems: DIMENSIONEN_TOLERANZ.length })),
}, { $id: 'PhasenmodellPatch', additionalProperties: false, minProperties: 1 });
export type PhasenmodellPatchIn = Static<typeof PhasenmodellPatch>;

export const ListQuery = Type.Object({ cursor: Type.Optional(Cursor), limit: Type.Optional(Limit) }, { additionalProperties: false });
