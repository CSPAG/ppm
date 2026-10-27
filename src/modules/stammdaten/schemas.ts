/** Schemas der Stammdaten (OpenAPI, Prüfung der Eingaben): Organisationseinheiten, Codetabellen, Feiertage. */
import { Type, type Static } from '@sinclair/typebox';
import { Cursor, DateTime, Limit, NextCursor, Nullable, Uuid } from '@vollholz/platform';
import { CODETABELLE_KEYS } from './codetabellen.ts';

const Meta = {
  version: Type.Integer({ minimum: 1 }),
  createdAt: DateTime,
  createdBy: Nullable(Uuid),
  updatedAt: DateTime,
  updatedBy: Nullable(Uuid),
};
const Can = Type.Object({ write: Type.Boolean() }, { description: 'Was die anfragende Person damit darf.' });

// --- Organisationseinheiten (BC AM.02.01, A-23)

const Kuerzel = Type.String({ pattern: '^[\\p{L}\\p{N}][\\p{L}\\p{N}._-]{0,19}$', description: 'Kürzel, eindeutig in der Organisation (ohne Gross/klein).', examples: ['DTI'] });
const OrgName = Type.String({ minLength: 1, maxLength: 200, description: 'Ausgeschriebener Name.', examples: ['Direktion Technologie und Innovation'] });
const OrgArt = Type.Union([Type.Literal('direktion'), Type.Literal('bereich')], { description: 'Art der Einheit.' });
const ParentId = Nullable(Type.String({ format: 'uuid', description: 'Übergeordnete Einheit; null = oberste Ebene.' }));

export const OrgEinheit = Type.Object({
  id: Uuid,
  parentId: Nullable(Uuid),
  kuerzel: Type.String(),
  name: Type.String(),
  art: OrgArt,
  aktiv: Type.Boolean(),
  ...Meta,
  can: Type.Object({ write: Type.Boolean(), delete: Type.Boolean() }, { description: 'Was die anfragende Person damit darf; löschen nur ohne untergeordnete Einheiten.' }),
}, { $id: 'OrgEinheit', additionalProperties: false });
export type OrgEinheitOut = Static<typeof OrgEinheit>;

export const OrgEinheitCreate = Type.Object({
  kuerzel: Kuerzel,
  name: OrgName,
  art: Type.Optional(OrgArt),
  parentId: Type.Optional(ParentId),
  aktiv: Type.Optional(Type.Boolean()),
}, { $id: 'OrgEinheitCreate', additionalProperties: false });
export type OrgEinheitCreateIn = Static<typeof OrgEinheitCreate>;

export const OrgEinheitPatch = Type.Object({
  kuerzel: Type.Optional(Kuerzel),
  name: Type.Optional(OrgName),
  art: Type.Optional(OrgArt),
  parentId: Type.Optional(ParentId),
  aktiv: Type.Optional(Type.Boolean()),
}, { $id: 'OrgEinheitPatch', additionalProperties: false, minProperties: 1 });
export type OrgEinheitPatchIn = Static<typeof OrgEinheitPatch>;

export const OrgEinheitList = Type.Object({ items: Type.Array(Type.Ref('OrgEinheit')), nextCursor: NextCursor, can: Can }, { $id: 'OrgEinheitList', additionalProperties: false });

export const OrgEinheitQuery = Type.Object({
  q: Type.Optional(Type.String({ maxLength: 200, description: 'Suche in Kürzel und Name (Teilstring).' })),
  art: Type.Optional(OrgArt),
  aktiv: Type.Optional(Type.Boolean({ description: 'Nur aktive (true) bzw. nur inaktive (false); ohne Angabe alle.' })),
  cursor: Type.Optional(Cursor),
  limit: Type.Optional(Limit),
}, { additionalProperties: false });

// --- Codetabellen (BC AM.02.02)

const TabelleKey = Type.Union(CODETABELLE_KEYS.map(k => Type.Literal(k)), { description: 'Schlüssel der Codetabelle (fest im System).' });
export const TabelleParams = Type.Object({ schluessel: TabelleKey }, { additionalProperties: false });
export const WertParams = Type.Object({ schluessel: TabelleKey, id: Type.String({ format: 'uuid' }) }, { additionalProperties: false });

export const Codetabelle = Type.Object({
  schluessel: Type.String(),
  label: Type.String(),
  beschreibung: Type.String(),
  anzahl: Type.Integer({ description: 'Anzahl Werte' }),
  anzahlAktiv: Type.Integer({ description: 'davon aktiv' }),
}, { $id: 'Codetabelle', additionalProperties: false });
export const CodetabelleList = Type.Object({ items: Type.Array(Type.Ref('Codetabelle')), can: Can }, { $id: 'CodetabelleList', additionalProperties: false });

export const VorgabeErgebnis = Type.Object({
  angelegt: Type.Integer({ description: 'Anzahl neu angelegter Werte; vorhandene Schlüssel bleiben unverändert.' }),
}, { $id: 'VorgabeErgebnis', additionalProperties: false });

const WertLabel = Type.String({ minLength: 1, maxLength: 100, description: 'Text in der Oberfläche.', examples: ['Im Plan'] });
const Position = Type.Integer({ minimum: 0, maximum: 999, description: 'Reihenfolge in Auswahllisten (aufsteigend, danach Schlüssel).' });

export const Codewert = Type.Object({
  id: Uuid,
  codetabelle: Type.String(),
  schluessel: Type.String(),
  label: Type.String(),
  position: Type.Integer(),
  aktiv: Type.Boolean(),
  ...Meta,
  can: Can,
}, { $id: 'Codewert', additionalProperties: false });
export type CodewertOut = Static<typeof Codewert>;

export const CodewertCreate = Type.Object({
  schluessel: Type.String({ pattern: '^[A-Za-z0-9_]{1,40}$', description: 'Fester Schlüssel, den andere Daten speichern; nach dem Anlegen unveränderlich.', examples: ['im_plan'] }),
  label: WertLabel,
  position: Type.Optional(Position),
}, { $id: 'CodewertCreate', additionalProperties: false });
export type CodewertCreateIn = Static<typeof CodewertCreate>;

export const CodewertPatch = Type.Object({
  label: Type.Optional(WertLabel),
  position: Type.Optional(Position),
}, { $id: 'CodewertPatch', additionalProperties: false, minProperties: 1 });
export type CodewertPatchIn = Static<typeof CodewertPatch>;

export const CodewertList = Type.Object({ items: Type.Array(Type.Ref('Codewert')), nextCursor: NextCursor, can: Can }, { $id: 'CodewertList', additionalProperties: false });

export const CodewertQuery = Type.Object({
  aktiv: Type.Optional(Type.Boolean({ description: 'Nur aktive (true) bzw. nur deaktivierte (false); ohne Angabe alle.' })),
  cursor: Type.Optional(Cursor),
  limit: Type.Optional(Limit),
}, { additionalProperties: false });

// --- Feiertage (A-43)

const Datum = Type.String({ format: 'date', description: 'Datum (JJJJ-MM-TT).', examples: ['2026-12-25'] });
const FeiertagLabel = Type.String({ minLength: 1, maxLength: 100, description: 'Bezeichnung.', examples: ['Weihnachten'] });

export const Feiertag = Type.Object({
  id: Uuid,
  datum: Type.String({ format: 'date' }),
  label: Type.String(),
  ...Meta,
  can: Type.Object({ write: Type.Boolean(), delete: Type.Boolean() }, { description: 'Was die anfragende Person damit darf.' }),
}, { $id: 'Feiertag', additionalProperties: false });
export type FeiertagOut = Static<typeof Feiertag>;

export const FeiertagCreate = Type.Object({ datum: Datum, label: FeiertagLabel }, { $id: 'FeiertagCreate', additionalProperties: false });
export type FeiertagCreateIn = Static<typeof FeiertagCreate>;
export const FeiertagPatch = Type.Object({ datum: Type.Optional(Datum), label: Type.Optional(FeiertagLabel) }, { $id: 'FeiertagPatch', additionalProperties: false, minProperties: 1 });
export type FeiertagPatchIn = Static<typeof FeiertagPatch>;

export const FeiertagList = Type.Object({ items: Type.Array(Type.Ref('Feiertag')), nextCursor: NextCursor, can: Can }, { $id: 'FeiertagList', additionalProperties: false });

export const FeiertagQuery = Type.Object({
  jahr: Type.Optional(Type.Integer({ minimum: 2000, maximum: 2100, description: 'Nur Feiertage dieses Jahres.' })),
  cursor: Type.Optional(Cursor),
  limit: Type.Optional(Limit),
}, { additionalProperties: false });
