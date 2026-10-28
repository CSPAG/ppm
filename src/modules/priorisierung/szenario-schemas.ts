/** Schemas der Szenarien mit Wasserlinie (OpenAPI, Prüfung der Eingaben); BC PP.03.01–03, UC-008 Schritte 5–6. */
import { Type, type Static } from '@sinclair/typebox';
import { DateTime, Nullable, Uuid } from '@vollholz/platform';

const monat = (description = 'Monat «JJJJ-MM».') => Type.String({ pattern: '^[0-9]{4}-(0[1-9]|1[0-2])$', description });
const Monat = monat();
const Stand = Type.Union([Type.Literal('entwurf'), Type.Literal('beantragt'), Type.Literal('entschieden'), Type.Literal('verworfen')]);
const Stufe = Nullable(Type.Union([Type.Literal('hoch'), Type.Literal('tief'), Type.Literal('grenze')]));
const Einschaetzung = Nullable(Type.Union([Type.Literal('hoch'), Type.Literal('mittel'), Type.Literal('tief')]));

const Engpass = Type.Object({
  rolle: Type.String(), quartal: Type.String({ description: '«JJJJ-Qn»' }), monat: Monat,
  bedarf: Type.Number({ description: 'FTE im Monat der grössten Überbuchung.' }), angebot: Type.Number(), projekte: Type.Integer(),
}, { additionalProperties: false });

const Warnung = Type.Object({
  art: Type.Union([Type.Literal('abhaengigkeit'), Type.Literal('bedarf_geaendert'), Type.Literal('nur_groesse')]),
  text: Type.String(),
}, { additionalProperties: false });

export const SzenarioPosition = Type.Object({
  projektId: Uuid, nummer: Type.String(), name: Type.String(), phase: Type.String(),
  rang: Type.Integer({ minimum: 1 }),
  aktiv: Type.Boolean({ description: 'Im Szenario enthalten (sonst zählt das Projekt nicht und liegt ausserhalb der Wasserlinie).' }),
  startMonat: Nullable(monat('Start im Szenario (JJJJ-MM); null = wie geplant.')),
  startGeplant: Nullable(monat('Frühester Monat des Ressourcenbedarfs (geplanter Start).')),
  kosten: Nullable(Type.Number({ description: 'Summe der Prognose (sonst Baseline) in CHF; null ohne finanzen:read.' })),
  kostenKumuliert: Nullable(Type.Number()),
  fteMonate: Nullable(Type.Number()),
  groesse: Nullable(Type.Union([Type.Literal('S'), Type.Literal('M'), Type.Literal('L')])),
  nutzen: Stufe, risiko: Stufe, strategiebeitrag: Einschaetzung,
  bewertet: Type.Boolean({ description: 'Mindestens ein Kriterium nach dem Modell in Kraft bewertet.' }),
  ueberWasserlinie: Nullable(Type.Boolean({ description: 'null, wenn das Projekt nicht enthalten ist.' })),
  neu: Type.Boolean({ description: 'Aktives Projekt des Portfolios, das seit Anlage des Szenarios dazugekommen ist (am Ende eingereiht).' }),
  warnungen: Type.Array(Warnung),
}, { additionalProperties: false });

export const Rechnung = Type.Object({
  wasserlinie: Type.Object({
    beiRang: Nullable(Type.Integer({ description: 'Rang des ersten Projekts unter der Wasserlinie; null = alle darüber.' })),
    grund: Nullable(Type.Union([Type.Literal('budget'), Type.Literal('kapazitaet')])),
    text: Nullable(Type.String({ description: 'Regel mit Ist-Wert (K5 Regeln), z. B. «Budget: CHF 14,2 Mio. statt höchstens 12,0 Mio. …».' })),
    kapazitaet: Nullable(Type.Object({
      rolle: Type.String(), monat: Monat, bedarf: Type.Number(), angebot: Type.Number(), projekte: Type.Integer({ description: 'Projekte mit Bedarf in diesem Monat und dieser Rolle.' }),
    }, { additionalProperties: false, description: 'Rolle und Monat, in denen das Projekt an der Wasserlinie die Kapazität übersteigt.' })),
  }, { additionalProperties: false }),
  budget: Type.Object({
    rahmen: Nullable(Type.Number({ description: 'Budgetrahmen des Portfolios nach dem Modell in Kraft (A-18); null = keiner.' })),
    bedarf: Nullable(Type.Number({ description: 'Summe der Kosten der enthaltenen Projekte; null ohne finanzen:read oder bei fehlenden Kosten.' })),
  }, { additionalProperties: false }),
  engpaesse: Type.Array(Engpass, { description: 'Engpässe je Quartal und Rolle aus der Auslastung nach Szenario (UC-009 Schritt 5).' }),
  unter: Type.Integer({ description: 'Enthaltene Projekte unter der Wasserlinie.' }),
  hinweise: Type.Array(Type.String({ description: 'Zustand Z4 (teilweise), z. B. ohne Budgetrahmen.' })),
}, { additionalProperties: false });

export const Szenario = Type.Object({
  id: Uuid, portfolioId: Uuid, name: Type.String(), stand: Stand,
  version: Type.Integer({ minimum: 1 }), createdAt: DateTime, updatedAt: DateTime, beantragtAt: Nullable(DateTime),
  modell: Nullable(Type.Object({ id: Uuid, nummer: Type.Integer() }, { additionalProperties: false })),
  kostenSichtbar: Type.Boolean(),
  positionen: Type.Array(SzenarioPosition, { description: 'Nach Rang.' }),
  rechnung: Rechnung,
  vorlage: Nullable(Type.Object({
    erstelltAt: DateTime,
    vergleich: Type.Ref('SzenarioVergleich', { description: 'Alle verglichenen Szenarien, das gewählte zuerst.' }),
    nichtBewertet: Type.Array(Type.String(), { description: 'Nummern der Projekte ohne Bewertung; in der Vorlage «nicht bewertet».' }),
  }, { additionalProperties: false, description: 'Entscheidungsvorlage, Stand bei «Als Antrag wählen» (K5 Schritt 6).' })),
  can: Type.Object({ write: Type.Boolean() }, { additionalProperties: false }),
}, { $id: 'Szenario', additionalProperties: false });
export type SzenarioOut = Static<typeof Szenario>;

export const SzenarioKurz = Type.Object({
  id: Uuid, name: Type.String(), stand: Stand, version: Type.Integer(), createdAt: DateTime, updatedAt: DateTime, beantragtAt: Nullable(DateTime),
}, { additionalProperties: false });

export const SzenarioListe = Type.Object({
  items: Type.Array(SzenarioKurz, { description: 'Ohne verworfene, nach Anlage.' }),
  can: Type.Object({ write: Type.Boolean() }, { additionalProperties: false }),
}, { $id: 'SzenarioListe', additionalProperties: false });
export type SzenarioListeOut = Static<typeof SzenarioListe>;

export const SzenarioCreate = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100, description: 'z. B. «B: Plattform vorziehen».' }),
}, { $id: 'SzenarioCreate', additionalProperties: false });

export const SzenarioPatch = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
}, { $id: 'SzenarioPatch', additionalProperties: false });

export const SzenarioPositionenPut = Type.Object({
  positionen: Type.Array(Type.Object({
    projektId: Uuid,
    aktiv: Type.Optional(Type.Boolean({ default: true })),
    startMonat: Type.Optional(Nullable(Monat)),
  }, { additionalProperties: false }), { maxItems: 500, description: 'Alle Projekte in der Reihenfolge Rang 1, 2, … (aktive Projekte des Portfolios, jedes einmal).' }),
}, { $id: 'SzenarioPositionenPut', additionalProperties: false });
export type SzenarioPositionenPutIn = Static<typeof SzenarioPositionenPut>;

export const SzenarioBeantragen = Type.Object({
  vergleich: Type.Optional(Type.Array(Uuid, { maxItems: 2, uniqueItems: true, description: 'Weitere verglichene Szenarien desselben Portfolios (bis drei mit diesem).' })),
}, { $id: 'SzenarioBeantragen', additionalProperties: false });
export type SzenarioBeantragenIn = Static<typeof SzenarioBeantragen>;

const VergleichSpalte = Type.Object({
  id: Uuid, name: Type.String(), stand: Stand,
  kosten: Nullable(Type.Number({ description: 'Kosten der Projekte über der Wasserlinie.' })),
  budget: Type.Object({ rahmen: Nullable(Type.Number()), bedarf: Nullable(Type.Number()) }, { additionalProperties: false }),
  nutzen: Type.Object({ hoch: Type.Integer(), tief: Type.Integer(), grenze: Type.Integer(), offen: Type.Integer() }, { additionalProperties: false, description: 'Projekte über der Wasserlinie nach Nutzen (Matrix, A-39; ohne Score, A-01).' }),
  risiko: Type.Object({ hoch: Type.Integer(), tief: Type.Integer(), grenze: Type.Integer(), offen: Type.Integer() }, { additionalProperties: false }),
  strategiebeitrag: Type.Object({ hoch: Type.Integer(), mittel: Type.Integer(), tief: Type.Integer(), offen: Type.Integer() }, { additionalProperties: false, description: 'Einschätzung «Strategiebeitrag» der Projekte über der Wasserlinie.' }),
  ueber: Type.Array(Uuid), unter: Type.Array(Uuid),
  wasserlinie: Type.Object({
    beiRang: Nullable(Type.Integer()), grund: Nullable(Type.Union([Type.Literal('budget'), Type.Literal('kapazitaet')])), text: Nullable(Type.String()),
    kapazitaet: Nullable(Type.Object({ rolle: Type.String(), monat: Monat, bedarf: Type.Number(), angebot: Type.Number(), projekte: Type.Integer() }, { additionalProperties: false })),
  }, { additionalProperties: false }),
  engpaesse: Type.Array(Engpass),
}, { additionalProperties: false });

export const SzenarioVergleich = Type.Object({
  portfolioId: Uuid,
  projekte: Type.Array(Type.Object({ id: Uuid, nummer: Type.String(), name: Type.String(), unterschiedlich: Type.Boolean({ description: 'Liegt nicht in allen Szenarien auf derselben Seite der Wasserlinie.' }) }, { additionalProperties: false })),
  szenarien: Type.Array(VergleichSpalte),
  hinweise: Type.Array(Type.String()),
}, { $id: 'SzenarioVergleich', additionalProperties: false });
export type SzenarioVergleichOut = Static<typeof SzenarioVergleich>;
