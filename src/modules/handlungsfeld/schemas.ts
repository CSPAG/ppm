/** Schemas der Handlungsfelder (OpenAPI, Prüfung der Eingaben). */
import { Type, type Static } from '@sinclair/typebox';
import { Cursor, DateTime, Limit, NextCursor, Nullable, Uuid } from '@vollholz/platform';

const Label = Type.String({ minLength: 1, maxLength: 200, description: 'Name, eindeutig in der Organisation (ohne Gross/klein).', examples: ['Patientenorientierung'] });
const Leitsatz = Type.String({ maxLength: 2000, description: 'Leitsatz des Handlungsfelds.' });
const Stossrichtungen = Type.Array(Type.String({ minLength: 1, maxLength: 500 }), { maxItems: 20, description: 'Stossrichtungen in ihrer Reihenfolge.' });
const Position = Type.Integer({ minimum: 0, maximum: 999, description: 'Reihenfolge in Listen (aufsteigend, danach Name).' });

export const Handlungsfeld = Type.Object({
  id: Uuid,
  label: Type.String(),
  leitsatz: Type.String(),
  stossrichtungen: Type.Array(Type.String()),
  position: Type.Integer(),
  version: Type.Integer({ minimum: 1 }),
  createdAt: DateTime,
  createdBy: Nullable(Uuid),
  updatedAt: DateTime,
  updatedBy: Nullable(Uuid),
  can: Type.Object({ write: Type.Boolean(), delete: Type.Boolean() }, { description: 'Was die anfragende Person damit darf.' }),
}, { $id: 'Handlungsfeld', additionalProperties: false });
export type HandlungsfeldOut = Static<typeof Handlungsfeld>;

export const HandlungsfeldCreate = Type.Object({
  label: Label,
  leitsatz: Type.Optional(Leitsatz),
  stossrichtungen: Type.Optional(Stossrichtungen),
  position: Type.Optional(Position),
}, { $id: 'HandlungsfeldCreate', additionalProperties: false });
export type HandlungsfeldCreateIn = Static<typeof HandlungsfeldCreate>;

export const HandlungsfeldPatch = Type.Object({
  label: Type.Optional(Label),
  leitsatz: Type.Optional(Leitsatz),
  stossrichtungen: Type.Optional(Stossrichtungen),
  position: Type.Optional(Position),
}, { $id: 'HandlungsfeldPatch', additionalProperties: false, minProperties: 1 });
export type HandlungsfeldPatchIn = Static<typeof HandlungsfeldPatch>;

export const HandlungsfeldList = Type.Object({ items: Type.Array(Type.Ref('Handlungsfeld')), nextCursor: NextCursor }, { $id: 'HandlungsfeldList', additionalProperties: false });

export const ListQuery = Type.Object({
  q: Type.Optional(Type.String({ maxLength: 200, description: 'Suche im Namen (Teilstring).' })),
  cursor: Type.Optional(Cursor),
  limit: Type.Optional(Limit),
}, { additionalProperties: false });

export const HandlungsfeldVersion = Type.Object({
  version: Type.Integer(),
  action: Type.Union([Type.Literal('created'), Type.Literal('updated'), Type.Literal('deleted')]),
  label: Type.String(), leitsatz: Type.String(), stossrichtungen: Type.Array(Type.String()), position: Type.Integer(),
  changedAt: DateTime, changedBy: Nullable(Uuid),
}, { $id: 'HandlungsfeldVersion', additionalProperties: false });
export const HandlungsfeldHistory = Type.Object({ items: Type.Array(Type.Ref('HandlungsfeldVersion')) }, { $id: 'HandlungsfeldHistory', additionalProperties: false });
