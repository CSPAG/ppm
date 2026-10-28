/** Schemas der Projektideen (OpenAPI, Prüfung der Eingaben); BC DM.01.01, UC-001 Schritte 1–2, A2.2. */
import { Type, type Static } from '@sinclair/typebox';
import { Cursor, DateTime, Limit, NextCursor, Nullable, Uuid } from '@vollholz/platform';

export const STAENDE = ['entwurf', 'eingereicht', 'in_pruefung', 'in_ergaenzung', 'traktandiert', 'freigegeben', 'zurueckgestellt', 'zurueckgewiesen', 'zusammengefuehrt'] as const;
export type Stand = (typeof STAENDE)[number];
const StandT = Type.Union(STAENDE.map(s => Type.Literal(s)), { description: 'Bearbeitungsstand der Idee (fachmodell.md 2.11).' });

/** Erste Einschätzung «hoch / mittel / tief» (K4 Schritt 3; Skala Vorschlag K01). */
const Stufe = Type.Union([Type.Literal('hoch'), Type.Literal('mittel'), Type.Literal('tief')]);

/** Felder der Idee, auf die sich eine Rückfrage beziehen kann (Assistent zeigt sie über dem Feld). */
export const FELDER = ['titel', 'ausgangslage', 'zielsetzung', 'handlungsfeld', 'strategischesZiel', 'bereiche', 'nutzen', 'aufwand', 'relevanz', 'herkunft'] as const;
const FeldT = Type.Union(FELDER.map(f => Type.Literal(f)));

const felder = {
  titel: Type.String({ maxLength: 200, description: 'Kurzer Titel der Idee.' }),
  ausgangslage: Type.String({ maxLength: 4000, description: 'Ausgangslage: was heute ist und stört.' }),
  zielsetzung: Type.String({ maxLength: 4000, description: 'Zielsetzung: was erreicht werden soll.' }),
  handlungsfeldId: Nullable(Uuid),
  strategischesZielId: Nullable(Uuid),
  bereiche: Type.Array(Uuid, { maxItems: 50, uniqueItems: true, description: 'Betroffene Bereiche (Organisationseinheiten).' }),
  nutzen: Nullable(Stufe),
  nutzenText: Type.String({ maxLength: 1000 }),
  aufwand: Nullable(Stufe),
  aufwandText: Type.String({ maxLength: 1000 }),
  relevanz: Nullable(Stufe),
  relevanzText: Type.String({ maxLength: 1000 }),
  herkunft: Nullable(Type.String({ maxLength: 100, description: 'Schlüssel der Codetabelle «Herkunft der Idee».' })),
};
export type Felder = { [K in keyof typeof felder]: Static<(typeof felder)[K]> };

export const Rueckfrage = Type.Object({
  id: Uuid,
  feld: Nullable(FeldT),
  text: Type.String(),
  antwort: Nullable(Type.String()),
  gestelltAt: DateTime,
  beantwortetAt: Nullable(DateTime),
}, { $id: 'IdeeRueckfrage', additionalProperties: false });

const Can = Type.Object({
  bearbeiten: Type.Boolean({ description: 'Angaben ändern (eigene Idee im Entwurf oder in Ergänzung).' }),
  einreichen: Type.Boolean({ description: 'Einreichen bzw. erneut einreichen.' }),
  loeschen: Type.Boolean({ description: 'Entwurf verwerfen.' }),
}, { description: 'Was die anfragende Person mit der Idee darf.' });
export type CanOut = Static<typeof Can>;

export const Idee = Type.Object({
  id: Uuid,
  nummer: Type.Integer({ minimum: 1, description: 'Laufende Nummer in der Organisation (Schlüssel der Oberfläche).' }),
  stand: StandT,
  standAt: DateTime,
  eingereichtAt: Nullable(DateTime),
  erfasstVon: Uuid,
  eigene: Type.Boolean({ description: 'Von der anfragenden Person erfasst.' }),
  ...felder,
  fuehrendeIdeeId: Nullable(Uuid),
  begruendung: Type.String({ description: 'Begründung der Zurückweisung (nur für Betroffene, UE und Gremium).' }),
  rueckfragen: Type.Array(Type.Ref('IdeeRueckfrage')),
  version: Type.Integer({ minimum: 1 }),
  createdAt: DateTime,
  updatedAt: DateTime,
  can: Can,
}, { $id: 'Idee', additionalProperties: false });
export type IdeeOut = Static<typeof Idee>;

export const IdeeZeile = Type.Object({
  id: Uuid,
  nummer: Type.Integer({ minimum: 1 }),
  titel: Type.String(),
  stand: StandT,
  standAt: DateTime,
  eingereichtAt: Nullable(DateTime),
  eigene: Type.Boolean(),
  handlungsfeldId: Nullable(Uuid),
  rueckfragenOffen: Type.Integer({ minimum: 0, description: 'Rückfragen ohne Antwort.' }),
  updatedAt: DateTime,
}, { $id: 'IdeeZeile', additionalProperties: false });
export type IdeeZeileOut = Static<typeof IdeeZeile>;

export const IdeeList = Type.Object({ items: Type.Array(Type.Ref('IdeeZeile')), nextCursor: NextCursor }, { $id: 'IdeeList', additionalProperties: false });

export const IdeeCreate = Type.Partial(Type.Object(felder), { $id: 'IdeeCreate', additionalProperties: false, description: 'Neuer Entwurf; alle Angaben optional (Vorbelegung z. B. aus einer Hauptaktivität, Herkunft aus dem Direktlink).' });
export type IdeeCreateIn = Static<typeof IdeeCreate>;
export const IdeePatch = Type.Partial(Type.Object(felder), { $id: 'IdeePatch', additionalProperties: false, minProperties: 1 });
export type IdeePatchIn = Static<typeof IdeePatch>;

export const RueckfrageAntwort = Type.Object({
  antwort: Type.String({ minLength: 1, maxLength: 4000 }),
}, { $id: 'IdeeRueckfrageAntwort', additionalProperties: false });

export const ListQuery = Type.Object({
  stand: Type.Optional(Type.Array(StandT, { description: 'Nur diese Stände (mehrfach).' })),
  eigene: Type.Optional(Type.Boolean({ description: 'Nur selbst erfasste Ideen («Meine Ideen»).' })),
  nummer: Type.Optional(Type.Integer({ minimum: 1, description: 'Genau diese Nummer (Schlüssel in der Oberfläche, I-N5).' })),
  q: Type.Optional(Type.String({ minLength: 1, maxLength: 200, description: 'Suche im Titel (Teilstring) oder nach der Nummer (Befehlspalette, I-N4).' })),
  cursor: Type.Optional(Cursor),
  limit: Type.Optional(Limit),
}, { additionalProperties: false });

export const RueckfrageParams = Type.Object({ id: Uuid, rueckfrageId: Uuid }, { additionalProperties: false });

/** Auswahl für den Assistenten (Schritt 2): Strategiebezug, Bereiche und Herkunft – auch ohne Leserecht auf Ziele. */
export const IdeeAuswahl = Type.Object({
  handlungsfelder: Type.Array(Type.Object({
    id: Uuid, label: Type.String(), leitsatz: Type.String(),
    ziele: Type.Array(Type.Object({ id: Uuid, nummer: Type.String(), text: Type.String() }, { additionalProperties: false })),
  }, { additionalProperties: false })),
  bereiche: Type.Array(Type.Object({ id: Uuid, kuerzel: Type.String(), name: Type.String(), parentId: Nullable(Uuid) }, { additionalProperties: false })),
  herkunft: Type.Array(Type.Object({ schluessel: Type.String(), label: Type.String() }, { additionalProperties: false })),
}, { $id: 'IdeeAuswahl', additionalProperties: false });

export const IdeeKopf = Type.Object({
  eigene: Type.Object({
    entwurf: Type.Integer({ minimum: 0 }),
    inErgaenzung: Type.Integer({ minimum: 0, description: 'Mit Rückfragen der UE, zu ergänzen.' }),
    laufend: Type.Integer({ minimum: 0, description: 'Eingereicht, in Prüfung oder dem Gremium vorgelegt.' }),
  }, { additionalProperties: false }),
  zuPruefen: Nullable(Type.Integer({ minimum: 0, description: 'Eingereichte Ideen im Pool (nur mit `idee:write`).' })),
}, { $id: 'IdeeKopf', additionalProperties: false });
