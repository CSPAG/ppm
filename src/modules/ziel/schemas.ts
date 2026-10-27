/** Schemas der strategischen Ziele (OpenAPI, Prüfung der Eingaben); BC ZM.01.02. */
import { Type, type Static } from '@sinclair/typebox';
import { Cursor, DateTime, Limit, NextCursor, Nullable, Uuid } from '@vollholz/platform';

const Nummer = Type.String({ pattern: '^[0-9]{1,3}(\\.[0-9]{1,3}){0,3}$', description: 'Nummer, eindeutig in der Organisation (Ziffern mit Punkten).', examples: ['2.1'] });
const Text = Type.String({ minLength: 1, maxLength: 1000, description: 'Formulierung des Ziels.' });
const Horizont = Type.Integer({ minimum: 2000, maximum: 2100, description: 'Zieljahr; Vorgabe 2030 (A-15: strategische Ziele = Ziele 2030).' });
const Metrik = Type.String({ maxLength: 500, description: 'Woran die Erreichung gemessen wird.' });
const Zielwert = Type.String({ maxLength: 200, description: 'Angestrebter Wert der Metrik.' });

export const StrategischesZiel = Type.Object({
  id: Uuid,
  handlungsfeldId: Uuid,
  nummer: Type.String(),
  text: Type.String(),
  horizont: Type.Integer(),
  metrik: Type.String(),
  zielwert: Type.String(),
  version: Type.Integer({ minimum: 1 }),
  createdAt: DateTime,
  createdBy: Nullable(Uuid),
  updatedAt: DateTime,
  updatedBy: Nullable(Uuid),
  can: Type.Object({ write: Type.Boolean() }, { description: 'Was die anfragende Person damit darf (ändern und löschen).' }),
}, { $id: 'StrategischesZiel', additionalProperties: false });
export type StrategischesZielOut = Static<typeof StrategischesZiel>;

export const StrategischesZielCreate = Type.Object({
  handlungsfeldId: Uuid,
  nummer: Nummer,
  text: Text,
  horizont: Type.Optional(Horizont),
  metrik: Type.Optional(Metrik),
  zielwert: Type.Optional(Zielwert),
}, { $id: 'StrategischesZielCreate', additionalProperties: false });
export type StrategischesZielCreateIn = Static<typeof StrategischesZielCreate>;

export const StrategischesZielPatch = Type.Object({
  handlungsfeldId: Type.Optional(Uuid),
  nummer: Type.Optional(Nummer),
  text: Type.Optional(Text),
  horizont: Type.Optional(Horizont),
  metrik: Type.Optional(Metrik),
  zielwert: Type.Optional(Zielwert),
}, { $id: 'StrategischesZielPatch', additionalProperties: false, minProperties: 1 });
export type StrategischesZielPatchIn = Static<typeof StrategischesZielPatch>;

export const StrategischesZielList = Type.Object({ items: Type.Array(Type.Ref('StrategischesZiel')), nextCursor: NextCursor }, { $id: 'StrategischesZielList', additionalProperties: false });

export const ListQuery = Type.Object({
  handlungsfeld: Type.Optional(Type.String({ format: 'uuid', description: 'Nur Ziele dieses Handlungsfelds.' })),
  q: Type.Optional(Type.String({ maxLength: 200, description: 'Suche in Nummer und Text (Teilstring).' })),
  cursor: Type.Optional(Cursor),
  limit: Type.Optional(Limit),
}, { additionalProperties: false });

export const StrategischesZielVersion = Type.Object({
  version: Type.Integer(),
  action: Type.Union([Type.Literal('created'), Type.Literal('updated'), Type.Literal('deleted')]),
  handlungsfeldId: Uuid, nummer: Type.String(), text: Type.String(), horizont: Type.Integer(), metrik: Type.String(), zielwert: Type.String(),
  changedAt: DateTime, changedBy: Nullable(Uuid),
}, { $id: 'StrategischesZielVersion', additionalProperties: false });
export const StrategischesZielHistory = Type.Object({ items: Type.Array(Type.Ref('StrategischesZielVersion')) }, { $id: 'StrategischesZielHistory', additionalProperties: false });
