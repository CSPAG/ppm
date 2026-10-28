/** Schemas für Zugang entziehen und Neubesetzung (UC-016 A1; OpenAPI, Prüfung der Eingaben). */
import { Type, type Static } from '@sinclair/typebox';
import { Cursor, DateTime, Limit, NextCursor, Nullable, Uuid } from '@vollholz/platform';

const Person = Type.Object({ id: Uuid, name: Type.String() }, { additionalProperties: false });

const rolleFelder = {
  ort: Type.Object({
    typ: Type.String({ description: 'Typ des Orts aus dem Modell, z. B. `projekt` oder `portfolio`.' }),
    id: Uuid,
  }, { additionalProperties: false, description: 'Den Namen des Orts löst die Oberfläche auf (wie im Baukasten).' }),
  rolle: Type.String({ description: 'Rolle des Modells, z. B. `pl`.' }),
  rolleName: Type.String({ description: 'Name der Rolle, z. B. «Projektleitung».' }),
};
const Rolle = Type.Object(rolleFelder, { additionalProperties: false });
const RolleMitStand = Type.Object({ ...rolleFelder, besetzt: Type.Boolean({ description: 'Jemand hat die Rolle am Ort wieder.' }) }, { additionalProperties: false });

const OffeneAufgabe = Type.Object({
  id: Uuid,
  art: Type.String(),
  titel: Type.String(),
  kontext: Nullable(Type.String()),
  link: Type.String({ description: 'Adresse der Aufgabe in der Oberfläche.' }),
  frist: Nullable(Type.String({ format: 'date' })),
  fristArt: Nullable(Type.Union([Type.Literal('kalendertage'), Type.Literal('arbeitstage')])),
}, { additionalProperties: false });

export const ZugangVorschau = Type.Object({
  person: Person,
  orgRollen: Type.Array(Type.Object({ rolle: Type.String(), rolleName: Type.String() }, { additionalProperties: false }), {
    description: 'Rollen an der Organisation (Programmrollen, Administration); entfallen mit dem Zugang.',
  }),
  rollen: Type.Array(Rolle, { description: 'Rollen an Projekten, Portfolios und anderen Orten, die neu zu besetzen sind.' }),
  aufgaben: Type.Array(OffeneAufgabe, { description: 'Offene Aufgaben an die Person persönlich.' }),
  can: Type.Object({ entziehen: Type.Boolean({ description: 'Nicht für sich selbst.' }) }, { additionalProperties: false }),
}, { $id: 'ZugangVorschau', additionalProperties: false });
export type ZugangVorschauOut = Static<typeof ZugangVorschau>;

export const ZugangEntzogen = Type.Object({
  neubesetzung: Uuid,
  rollen: Type.Integer({ minimum: 0 }),
  aufgaben: Type.Integer({ minimum: 0, description: 'Offene Aufgaben der Person beim Entziehen.' }),
}, { $id: 'ZugangEntzogen', additionalProperties: false });

export const Neubesetzung = Type.Object({
  id: Uuid,
  person: Person,
  entzogenAt: DateTime,
  entzogenVon: Nullable(Person),
  rollen: Type.Integer({ minimum: 0 }),
  offeneRollen: Type.Integer({ minimum: 0, description: 'Rollen, die am Ort noch niemand wieder hat.' }),
  erledigt: Type.Boolean({ description: 'Keine offene Aufgabe «neu besetzen» (nichts zu tun oder von Hand erledigt).' }),
}, { $id: 'Neubesetzung', additionalProperties: false });
export type NeubesetzungOut = Static<typeof Neubesetzung>;

export const NeubesetzungList = Type.Object({ items: Type.Array(Type.Ref('Neubesetzung')), nextCursor: NextCursor }, { $id: 'NeubesetzungList', additionalProperties: false });

export const NeubesetzungQuery = Type.Object({
  offen: Type.Optional(Type.Boolean({ description: 'Nur mit offener Aufgabe «neu besetzen».' })),
  cursor: Type.Optional(Cursor),
  limit: Type.Optional(Limit),
}, { additionalProperties: false });

export const NeubesetzungDetail = Type.Object({
  neubesetzung: Type.Ref('Neubesetzung'),
  rollen: Type.Array(RolleMitStand),
  aufgaben: Type.Array(OffeneAufgabe, { description: 'Offene Aufgaben, die noch an die Person gehen.' }),
}, { $id: 'NeubesetzungDetail', additionalProperties: false });
export type NeubesetzungDetailOut = Static<typeof NeubesetzungDetail>;

export type OffeneAufgabeOut = Static<typeof OffeneAufgabe>;
