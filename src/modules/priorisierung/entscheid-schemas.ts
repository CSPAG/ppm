/** Schemas des Priorisierungsentscheids (OpenAPI, Prüfung der Eingaben); UC-008 Schritte 7–8, A2. */
import { Type, type Static } from '@sinclair/typebox';
import { Nullable, Uuid } from '@vollholz/platform';

const Folge = Type.Union([Type.Literal('zurueckstellen'), Type.Literal('sistieren'), Type.Literal('abbrechen')], { description: 'Folgeentscheid (UC-008 A2); Sistieren und Abbrechen leiten UC-015 ein.' });

export const SzenarioEntscheid = Type.Object({
  szenarioId: Uuid,
  stand: Type.String(),
  unterWasserlinie: Type.Array(Type.Object({
    projektId: Uuid, nummer: Type.String(), name: Type.String(), phase: Type.String(),
    folge: Nullable(Folge), begruendung: Type.String(),
  }, { additionalProperties: false }), { description: 'Laufende Projekte (ab Phase P1) unter der Wasserlinie mit dem beantragten Folgeentscheid.' }),
  traktandierbar: Type.Boolean({ description: 'Antrag gewählt und Folgeentscheid für jedes laufende Projekt unter der Wasserlinie beantragt.' }),
  pruefung: Type.Array(Type.String({ description: 'Sperre mit Regel, Ist-Wert und Ausweg (I-P2).' })),
  can: Type.Object({ write: Type.Boolean() }, { additionalProperties: false }),
}, { $id: 'SzenarioEntscheid', additionalProperties: false });
export type SzenarioEntscheidOut = Static<typeof SzenarioEntscheid>;

export const SzenarioFolgenPut = Type.Object({
  folgen: Type.Array(Type.Object({
    projektId: Uuid, folge: Folge,
    begruendung: Type.Optional(Type.String({ maxLength: 1000 })),
  }, { additionalProperties: false }), { maxItems: 500, description: 'Folgeentscheid je laufendem Projekt unter der Wasserlinie (ersetzt die bisherigen).' }),
}, { $id: 'SzenarioFolgenPut', additionalProperties: false });
export type SzenarioFolgenPutIn = Static<typeof SzenarioFolgenPut>;

export const SzenarioTraktandiert = Type.Object({
  traktandumId: Uuid,
  titel: Type.String(), antrag: Type.String(),
}, { $id: 'SzenarioTraktandiert', additionalProperties: false });
