/** Schemas des Bewertungsmodells, der Budgetrahmen und der Bewertung (OpenAPI, Prüfung der Eingaben); BC PP.01.02, PP.01.03, PP.02.01. */
import { Type, type Static } from '@sinclair/typebox';
import { DateTime, Nullable, Uuid } from '@vollholz/platform';

const Schluessel = Type.String({ pattern: '^[a-z0-9_]{1,40}$', description: 'Fester Schlüssel des Kriteriums (Kleinbuchstaben, Ziffern, Unterstrich); bleibt über Modellversionen gleich.' });
const Dimension = Nullable(Type.Union([Type.Literal('nutzen'), Type.Literal('risiko')], { description: 'Feste Zuordnung zur Achse der Matrix (A-39); null = keine.' }));
export const Einschaetzung = Type.Union([Type.Literal('hoch'), Type.Literal('mittel'), Type.Literal('tief')], { description: 'Einschätzung je Kriterium ohne Score (A-01).' });
export type EinschaetzungT = Static<typeof Einschaetzung>;

export const Kriterium = Type.Object({
  schluessel: Type.String(), text: Type.String(), beschreibung: Type.String(), dimension: Dimension, position: Type.Integer(),
}, { $id: 'Kriterium', additionalProperties: false });

export const Budgetrahmen = Type.Object({
  portfolioId: Uuid,
  kategorie: Type.String({ description: 'Kategorie des Portfolios (A, B, C).' }),
  betrag: Type.Number({ description: 'Budgetrahmen in CHF.' }),
}, { $id: 'Budgetrahmen', additionalProperties: false });

const Pruefpunkt = Type.Object({
  stufe: Type.Union([Type.Literal('sperre'), Type.Literal('hinweis')]),
  text: Type.String(),
  pfad: Type.String({ description: 'JSON-Pointer auf die betroffene Angabe.' }),
}, { additionalProperties: false });

const kurz = {
  id: Uuid,
  nummer: Type.Integer({ description: 'Laufende Nummer der Modellversion in der Organisation.' }),
  stand: Type.Union([Type.Literal('entwurf'), Type.Literal('in_kraft')]),
  aktuell: Type.Boolean({ description: 'Das zuletzt in Kraft gesetzte Modell; nach ihm wird bewertet.' }),
  beschreibung: Type.String(),
  beschluss: Type.String({ description: 'Entscheid des Gremiums, mit dem das Modell in Kraft gesetzt wurde (UC-008 A1.2).' }),
  inKraftAt: Nullable(DateTime),
  inKraftBy: Nullable(Uuid),
  version: Type.Integer({ minimum: 1 }),
  createdAt: DateTime,
  updatedAt: DateTime,
};

export const BewertungsmodellKurz = Type.Object(kurz, { $id: 'BewertungsmodellKurz', additionalProperties: false });
export type BewertungsmodellKurzOut = Static<typeof BewertungsmodellKurz>;

export const Bewertungsmodell = Type.Object({
  ...kurz,
  kriterien: Type.Array(Type.Ref('Kriterium')),
  budgetrahmen: Type.Array(Type.Ref('Budgetrahmen'), { description: 'Nur die Rahmen der Portfolios, die die Person sieht.' }),
  pruefung: Type.Array(Pruefpunkt, { description: 'Prüfbericht (I-P1): Sperren verhindern das In-Kraft-Setzen, Hinweise nicht.' }),
  can: Type.Object({ write: Type.Boolean({ description: 'Entwurf ändern, verwerfen und in Kraft setzen.' }) }),
}, { $id: 'Bewertungsmodell', additionalProperties: false });
export type BewertungsmodellOut = Static<typeof Bewertungsmodell>;

export const BewertungsmodellList = Type.Object({
  items: Type.Array(Type.Ref('BewertungsmodellKurz'), { description: 'Neueste zuerst.' }),
  can: Type.Object({ create: Type.Boolean({ description: 'Entwurf anlegen (priorisierung:write und noch kein Entwurf).' }) }),
}, { $id: 'BewertungsmodellList', additionalProperties: false });

export const BewertungsmodellPatch = Type.Object({
  beschreibung: Type.Optional(Type.String({ maxLength: 2000 })),
  kriterien: Type.Optional(Type.Array(Type.Object({
    schluessel: Type.Optional(Schluessel),
    text: Type.String({ minLength: 1, maxLength: 200 }),
    beschreibung: Type.Optional(Type.String({ maxLength: 1000 })),
    dimension: Type.Optional(Dimension),
  }, { additionalProperties: false }), { maxItems: 30, description: 'Alle Kriterien in ihrer Reihenfolge (ersetzt die bisherigen); ohne Schlüssel wird er aus dem Text gebildet.' })),
  budgetrahmen: Type.Optional(Type.Array(Type.Object({
    portfolioId: Uuid,
    betrag: Type.Number({ minimum: 0, maximum: 1e12 }),
  }, { additionalProperties: false }), { maxItems: 100, description: 'Alle Budgetrahmen (ersetzt die bisherigen); je Portfolio höchstens einer.' })),
}, { $id: 'BewertungsmodellPatch', additionalProperties: false, minProperties: 1 });
export type BewertungsmodellPatchIn = Static<typeof BewertungsmodellPatch>;

export const BewertungsmodellCreate = Type.Object({
  beschreibung: Type.Optional(Type.String({ maxLength: 2000 })),
}, { $id: 'BewertungsmodellCreate', additionalProperties: false });

export const InKraftSetzen = Type.Object({
  beschluss: Type.String({ minLength: 1, maxLength: 500, description: 'Entscheid des Gremiums, z. B. «PRAT 12.11.2026, Traktandum 4».' }),
}, { $id: 'InKraftSetzen', additionalProperties: false });

export const BewertungenQuery = Type.Object({
  modell: Type.Optional(Type.String({ format: 'uuid', description: 'Frühere Modellversion (G11); ohne Angabe das Modell in Kraft.' })),
}, { additionalProperties: false });

const BewertungZelle = Type.Object({
  projektId: Uuid, kriterium: Type.String(),
  einschaetzung: Nullable(Einschaetzung),
  kommentar: Type.String(),
  version: Nullable(Type.Integer({ minimum: 1 })),
}, { additionalProperties: false });

export const Bewertungsraster = Type.Object({
  portfolio: Type.Object({ id: Uuid, schluessel: Type.String(), name: Type.String(), kategorie: Type.String() }, { additionalProperties: false }),
  // null, solange kein Modell in Kraft ist
  modell: Nullable(Type.Object({ ...kurz, kriterien: Type.Array(Type.Ref('Kriterium')) }, { additionalProperties: false })),
  projekte: Type.Array(Type.Object({
    id: Uuid, nummer: Type.String(), name: Type.String(), phase: Type.String(), lebenszyklus: Type.String(),
    bewertet: Type.Integer({ description: 'Anzahl bewerteter Kriterien.' }),
  }, { additionalProperties: false }), { description: 'Aktive Projekte des Portfolios, die die Person sieht (bei einem früheren Modell auch die damals bewerteten), nach Nummer.' }),
  bewertungen: Type.Array(BewertungZelle),
  fortschritt: Type.Object({ bewertet: Type.Integer({ description: 'Projekte mit allen Kriterien bewertet.' }), gesamt: Type.Integer() }, { additionalProperties: false }),
  can: Type.Object({ write: Type.Boolean({ description: 'Bewerten (nur nach dem Modell in Kraft).' }) }),
}, { $id: 'Bewertungsraster', additionalProperties: false });
export type BewertungsrasterOut = Static<typeof Bewertungsraster>;

export const BewertungenPut = Type.Object({
  zellen: Type.Array(Type.Object({
    projektId: Uuid,
    kriterium: Schluessel,
    // null zuerst: mit der Typumwandlung der Prüfung würde null sonst zu einer Zeichenkette
    einschaetzung: Type.Union([Type.Null(), Einschaetzung], { description: 'null entfernt die Bewertung des Kriteriums.' }),
    kommentar: Type.Optional(Type.String({ maxLength: 1000 })),
    version: Type.Optional(Type.Integer({ minimum: 1, description: 'Gelesene Version; Pflicht, wenn die Zelle schon bewertet ist (sonst 412).' })),
  }, { additionalProperties: false }), { minItems: 1, maxItems: 2000 }),
}, { $id: 'BewertungenPut', additionalProperties: false });
export type BewertungenPutIn = Static<typeof BewertungenPut>;

export const BewertungenGespeichert = Type.Object({ zellen: Type.Array(BewertungZelle) }, { $id: 'BewertungenGespeichert', additionalProperties: false });
