/** Schemas des Eingangs: Aufgaben, Mitteilungen, Stellvertretungen (OpenAPI, Prüfung der Eingaben). */
import { Type, type Static } from '@sinclair/typebox';
import { Cursor, DateTime, Limit, NextCursor, Nullable, Uuid } from '@vollholz/platform';

const Datum = Type.String({ format: 'date', description: 'Kalendertag (YYYY-MM-DD).', examples: ['2026-10-25'] });
const Person = Type.Object({ id: Uuid, name: Type.String() }, { additionalProperties: false });

export const Aufgabe = Type.Object({
  id: Uuid,
  art: Type.String({ description: 'Art der Aufgabe `<modul>.<verb>` (Fachmodell 4.2), z. B. `statusbericht.erstellen`.' }),
  titel: Type.String(),
  kontext: Nullable(Type.String({ description: 'Projekt und Rolle, z. B. «2026-014 · als PL».' })),
  link: Type.String({ description: 'Adresse in der Oberfläche, die direkt zur Aktion führt (I-B1).' }),
  frist: Nullable(Datum),
  fristArt: Nullable(Type.Union([Type.Literal('kalendertage'), Type.Literal('arbeitstage')], { description: 'UX-E11: Art der Frist steht immer dabei.' })),
  bezug: Type.Object({ typ: Type.String(), id: Type.String() }, { additionalProperties: false }),
  empfaenger: Type.Union([Type.Literal('person'), Type.Literal('recht')], { description: '`person`: an Sie persönlich (oder die vertretene Person); `recht`: an alle mit dem Recht am Ort.' }),
  vertretung: Nullable(Type.Object({ person: Person, bis: Datum }, { additionalProperties: false, description: 'Gesetzt, wenn die Aufgabe einer Person gehört, die Sie heute vertreten (UC-016 Schritt 4).' })),
  createdAt: DateTime,
  can: Type.Object({ erledigen: Type.Boolean({ description: 'Nur Aufgaben ohne fachlichen Übergang sind von Hand erledigbar.' }) }, { additionalProperties: false }),
}, { $id: 'Aufgabe', additionalProperties: false });
export type AufgabeOut = Static<typeof Aufgabe>;

export const AufgabeList = Type.Object({ items: Type.Array(Type.Ref('Aufgabe')), nextCursor: NextCursor }, { $id: 'AufgabeList', additionalProperties: false });

export const AufgabeQuery = Type.Object({
  filter: Type.Optional(Type.Literal('frist', { description: '`frist`: nur Aufgaben mit Frist.' })),
  cursor: Type.Optional(Cursor),
  limit: Type.Optional(Limit),
}, { additionalProperties: false });

export const AufgabeAnzahl = Type.Object({
  offen: Type.Integer({ minimum: 0, description: 'Offene Aufgaben der Person (Zähler an «Eingang», I-N3).' }),
  ueberfaellig: Type.Integer({ minimum: 0 }),
  naechsteFrist: Nullable(Datum),
}, { $id: 'AufgabeAnzahl', additionalProperties: false });

export const Mitteilung = Type.Object({
  id: Uuid,
  text: Type.String(),
  link: Nullable(Type.String()),
  bezug: Type.Object({ typ: Type.String(), id: Type.String() }, { additionalProperties: false }),
  gelesenAt: Nullable(DateTime),
  createdAt: DateTime,
}, { $id: 'Mitteilung', additionalProperties: false });
export type MitteilungOut = Static<typeof Mitteilung>;

export const MitteilungList = Type.Object({
  items: Type.Array(Type.Ref('Mitteilung')),
  nextCursor: NextCursor,
  ungelesen: Type.Integer({ minimum: 0 }),
}, { $id: 'MitteilungList', additionalProperties: false });

export const MitteilungQuery = Type.Object({
  ungelesen: Type.Optional(Type.Boolean({ description: 'Nur ungelesene.' })),
  cursor: Type.Optional(Cursor),
  limit: Type.Optional(Limit),
}, { additionalProperties: false });

export const Stellvertretung = Type.Object({
  id: Uuid,
  vertretene: Person,
  vertreter: Person,
  von: Datum,
  bis: Datum,
  unterschriften: Type.Boolean({ description: 'Die Vertretung darf in Vertretung unterzeichnen (UX-OF-10, A-31).' }),
  aktiv: Type.Boolean({ description: 'Heute im Zeitraum.' }),
  richtung: Type.Union([Type.Literal('eigene'), Type.Literal('fuer_andere')], { description: '`eigene`: Sie werden vertreten; `fuer_andere`: Sie vertreten.' }),
  createdAt: DateTime,
  can: Type.Object({ beenden: Type.Boolean() }, { additionalProperties: false }),
}, { $id: 'Stellvertretung', additionalProperties: false });
export type StellvertretungOut = Static<typeof Stellvertretung>;

export const StellvertretungList = Type.Object({ items: Type.Array(Type.Ref('Stellvertretung')) }, { $id: 'StellvertretungList', additionalProperties: false });

export const StellvertretungCreate = Type.Object({
  vertreter: Type.String({ format: 'uuid', description: 'Person, die vertritt (aus dem Personenverzeichnis).' }),
  von: Datum,
  bis: Datum,
  unterschriften: Type.Optional(Type.Boolean({ default: false, description: 'Unterschriften ausdrücklich erteilen (A-31).' })),
}, { $id: 'StellvertretungCreate', additionalProperties: false });
export type StellvertretungCreateIn = Static<typeof StellvertretungCreate>;
