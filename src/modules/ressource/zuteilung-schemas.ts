/** Schemas der Bedarfsliste, Zuteilung und Konflikte (OpenAPI, Prüfung der Eingaben); BC RK.02.02, RK.02.03, UC-009. */
import { Type, type Static } from '@sinclair/typebox';
import { Cursor, DateTime, Limit, NextCursor, Nullable, Uuid } from '@vollholz/platform';
import { Monat } from './schemas.ts';

const StandT = Type.Unsafe<'offen' | 'teilweise' | 'gedeckt' | 'ungedeckt'>({
  type: 'string', enum: ['offen', 'teilweise', 'gedeckt', 'ungedeckt'],
  description: '`offen`: nichts zugeteilt; `teilweise`: nicht in jedem Monat gedeckt; `gedeckt`: in jedem Monat voll zugeteilt; `ungedeckt`: Lücke gemeldet (UC-009 A2).',
});
const Prioritaet = Nullable(Type.Object({
  rang: Type.Integer({ minimum: 1, description: '1 = höchste Priorität.' }),
  quelle: Type.String({ description: 'Herkunft der Rangfolge (Priorisierung).' }),
}, { additionalProperties: false, description: 'Priorität des Projekts aus der Priorisierung; null, solange keine Rangfolge besteht.' }));
const ProjektKurz = Nullable(Type.Object({ nummer: Type.String(), name: Type.String() }, { additionalProperties: false }));

export const Zuteilung = Type.Object({
  id: Uuid,
  bedarfId: Uuid,
  projektId: Uuid,
  personId: Uuid,
  personName: Nullable(Type.String()),
  monat: Type.String(),
  fte: Type.Number(),
  version: Type.Integer({ minimum: 1 }),
  updatedAt: DateTime,
  can: Type.Object({ write: Type.Boolean() }, { description: 'Was die anfragende Person damit darf (ändern, entfernen).' }),
}, { $id: 'Zuteilung', additionalProperties: false });

export const Luecke = Type.Object({
  text: Type.String(),
  gemeldetAt: DateTime,
  gemeldetBy: Nullable(Uuid),
}, { $id: 'Luecke', additionalProperties: false });

export const Bedarf = Type.Object({
  id: Uuid,
  projektId: Uuid,
  projekt: ProjektKurz,
  phase: Type.String(),
  rolle: Type.String({ description: 'Rolle = Pool (A-20).' }),
  fte: Type.Number({ description: 'Bedarf in FTE je Monat.' }),
  vonMonat: Type.String(),
  bisMonat: Type.String(),
  bemerkung: Type.String(),
  benoetigt: Type.Number({ description: 'Bedarf in FTE-Monaten.' }),
  zugeteilt: Type.Number({ description: 'Zugeteilt in FTE-Monaten (je Monat höchstens bis zum Bedarf gezählt).' }),
  stand: StandT,
  prioritaet: Prioritaet,
  luecke: Nullable(Type.Ref('Luecke')),
}, { $id: 'Bedarf', additionalProperties: false });

export const BedarfList = Type.Object({
  items: Type.Array(Type.Ref('Bedarf')),
  nextCursor: NextCursor,
  anzahl: Type.Object({ offen: Type.Integer(), teilweise: Type.Integer(), gedeckt: Type.Integer(), ungedeckt: Type.Integer() }, { additionalProperties: false, description: 'Anzahl je Stand (ohne Filter nach Stand).' }),
  can: Type.Object({ write: Type.Boolean() }, { description: 'Ob die anfragende Person zuteilen darf (ressource:write).' }),
}, { $id: 'BedarfList', additionalProperties: false });

export const BedarfQuery = Type.Object({
  stand: Type.Optional(Type.Array(StandT, { maxItems: 4, description: 'Nur Bedarfe in diesen Ständen.' })),
  rolle: Type.Optional(Type.String({ pattern: '^[A-Za-z0-9_]{1,40}$' })),
  projekt: Type.Optional(Type.String({ format: 'uuid' })),
  von: Type.Optional(Monat),
  bis: Type.Optional(Monat),
  cursor: Type.Optional(Cursor),
  limit: Type.Optional(Limit),
}, { additionalProperties: false });

export const MonatDeckung = Type.Object({
  monat: Type.String(),
  bedarf: Type.Number(),
  zugeteilt: Type.Number(),
}, { additionalProperties: false });

export const BedarfDetail = Type.Object({
  bedarf: Type.Ref('Bedarf'),
  monate: Type.Array(MonatDeckung, { description: 'Je Monat des Bedarfs: Bedarf und Summe der Zuteilungen in FTE.' }),
  zuteilungen: Type.Array(Type.Ref('Zuteilung'), { description: 'Nach Person und Monat.' }),
  can: Type.Object({ write: Type.Boolean() }),
}, { $id: 'BedarfDetail', additionalProperties: false });

export const ZuteilungCreate = Type.Object({
  personId: Uuid,
  fte: Type.Number({ exclusiveMinimum: 0, maximum: 1, multipleOf: 0.05, description: 'Anteil der Person je Monat (höchstens eine Stelle).' }),
  vonMonat: Type.Optional(Monat),
  bisMonat: Type.Optional(Monat),
}, { $id: 'ZuteilungCreate', additionalProperties: false, description: 'Ohne Zeitraum der ganze Zeitraum des Bedarfs.' });
export type ZuteilungCreateIn = Static<typeof ZuteilungCreate>;

export const ZuteilungPatch = Type.Object({
  fte: Type.Number({ exclusiveMinimum: 0, maximum: 1, multipleOf: 0.05 }),
}, { $id: 'ZuteilungPatch', additionalProperties: false });

export const Beteiligt = Type.Object({
  zuteilungId: Uuid, projektId: Uuid, projekt: ProjektKurz, personId: Uuid, personName: Nullable(Type.String()), rolle: Type.String(),
  fte: Type.Number(), version: Type.Integer(), prioritaet: Prioritaet,
}, { $id: 'KonfliktBeteiligt', additionalProperties: false });

export const Konflikt = Type.Object({
  art: Type.Unsafe<'person' | 'pool'>({ type: 'string', enum: ['person', 'pool'], description: '`person`: mehr als eine Stelle zugeteilt; `pool`: Rolle mit mehr Zuteilung als Angebot.' }),
  monat: Type.String(),
  personId: Nullable(Uuid),
  personName: Nullable(Type.String()),
  rolle: Nullable(Type.String()),
  summe: Type.Number({ description: 'Zugeteilt in FTE.' }),
  grenze: Type.Number({ description: 'Höchstens: eine Stelle bzw. das Angebot der Rolle.' }),
  beteiligte: Type.Array(Type.Ref('KonfliktBeteiligt'), { description: 'Nach Priorität, höchste zuerst (UC-009 A1.1).' }),
}, { $id: 'Konflikt', additionalProperties: false });

export const ZuteilungErgebnis = Type.Object({
  bedarf: Type.Ref('Bedarf'),
  zuteilungen: Type.Array(Type.Ref('Zuteilung'), { description: 'Die angelegten bzw. die geänderte Zuteilung.' }),
  konflikte: Type.Array(Type.Ref('Konflikt'), { description: 'Überbuchungen, die die Änderung berührt (Warnung, UC-009 A1).' }),
}, { $id: 'ZuteilungErgebnis', additionalProperties: false });

export const KonfliktList = Type.Object({
  von: Type.String(), bis: Type.String(),
  items: Type.Array(Type.Ref('Konflikt')),
  prioritaetVorhanden: Type.Boolean({ description: 'false: keine Rangfolge; Beteiligte nach Projektnummer.' }),
  can: Type.Object({ write: Type.Boolean() }),
}, { $id: 'KonfliktList', additionalProperties: false });

export const ZuteilungList = Type.Object({
  items: Type.Array(Type.Ref('Zuteilung')),
}, { $id: 'ZuteilungList', additionalProperties: false });

export const ZuteilungQuery = Type.Object({
  person: Type.Optional(Type.Union([Type.Literal('ich'), Type.String({ format: 'uuid' })], { description: '`ich` für die eigenen Zuteilungen.' })),
  projekt: Type.Optional(Type.String({ format: 'uuid' })),
  von: Type.Optional(Monat),
  bis: Type.Optional(Monat),
}, { additionalProperties: false });

export const LueckeMelden = Type.Object({
  text: Type.String({ maxLength: 1000, description: 'Warum der Bedarf nicht gedeckt werden kann.' }),
}, { $id: 'LueckeMelden', additionalProperties: false });

export const PersonBelegung = Type.Object({
  id: Uuid,
  name: Type.String(),
  monate: Type.Array(Type.Object({ monat: Type.String(), zugeteilt: Type.Number(), frei: Type.Number() }, { additionalProperties: false }), { description: 'Je Monat des Bedarfs: bereits zugeteilt und frei (eine Stelle minus Zuteilung).' }),
}, { $id: 'PersonBelegung', additionalProperties: false });

export const PersonenQuery = Type.Object({
  q: Type.Optional(Type.String({ maxLength: 200, description: 'Suche in Name und E-Mail.' })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
}, { additionalProperties: false });

export const PersonenList = Type.Object({ items: Type.Array(Type.Ref('PersonBelegung')) }, { $id: 'PersonBelegungList', additionalProperties: false });
