/** Schemas der Risikolage (OpenAPI, Prüfung der Eingaben); BC PC.02.02, UC-014 Schritt 2 (AP-E2-3). */
import { Type, type Static } from '@sinclair/typebox';
import { DateTime, Nullable, Uuid } from '@vollholz/platform';

const Stufe = Type.Union([Type.Literal('hoch'), Type.Literal('mittel'), Type.Literal('tief')]);
const Projekt = Type.Object({ id: Uuid, nummer: Type.String(), name: Type.String() }, { additionalProperties: false });

export const RisikolageRisiko = Type.Object({
  id: Uuid,
  ebene: Type.Union([Type.Literal('projekt'), Type.Literal('portfolio')], { description: 'Projektrisiko (PC.02.04) oder Portfoliorisiko (PC.02.01).' }),
  projekt: Nullable(Projekt),
  portfolioId: Uuid,
  text: Type.String(),
  wahrscheinlichkeit: Stufe,
  auswirkung: Stufe,
  massnahme: Type.String(),
  massnahmeStand: Type.Union([Type.Literal('offen'), Type.Literal('umgesetzt')]),
  verantwortlich: Type.String(),
}, { $id: 'RisikolageRisiko', additionalProperties: false });
export type RisikolageRisikoOut = Static<typeof RisikolageRisiko>;

export const Risikolage = Type.Object({
  portfolios: Type.Array(Type.Object({ id: Uuid, schluessel: Type.String(), name: Type.String(), kategorie: Type.String() }, { additionalProperties: false }), { description: 'Portfolios, deren Risikolage die Person sieht (`auswertung:read`).' }),
  portfolio: Nullable(Type.String({ description: 'Gewähltes Portfolio (Schlüssel) oder null für alle sichtbaren.' })),
  stand: DateTime,
  risiken: Type.Array(Type.Ref('RisikolageRisiko'), { description: 'Projekt- und Portfoliorisiken der aktiven Projekte bzw. der Portfolios; höchste Auswirkung und Wahrscheinlichkeit zuerst, offene Massnahmen vor umgesetzten.' }),
  matrix: Type.Array(Type.Object({ wahrscheinlichkeit: Stufe, auswirkung: Stufe, anzahl: Type.Integer() }, { additionalProperties: false }), { description: 'Anzahl Risiken je Feld (Wahrscheinlichkeit × Auswirkung), alle neun Felder.' }),
  abhaengigkeiten: Type.Array(Type.Object({ id: Uuid, von: Projekt, zu: Projekt, text: Type.String() }, { additionalProperties: false }), { description: 'Abhängigkeiten zwischen den aktiven Projekten (PP.02.03); «von» hängt von «zu» ab.' }),
  eskalationen: Type.Array(Type.Object({
    id: Uuid, projekt: Projekt, periode: Type.String(), grund: Type.String(), massnahme: Type.String(),
    stand: Type.Union([Type.Literal('offen'), Type.Literal('traktandiert')]),
  }, { additionalProperties: false }), { description: 'Offene Eskalationen aus dem Statusbericht (UC-004 A2, AP-E2-4).' }),
}, { $id: 'Risikolage', additionalProperties: false });
export type RisikolageOut = Static<typeof Risikolage>;

const StufeFilter = (d: string) => Type.Optional(Type.Union([Type.Literal('hoch'), Type.Literal('mittel'), Type.Literal('tief')], { description: d }));
export const RisikolageQuery = Type.Object({
  portfolio: Type.Optional(Type.String({ pattern: '^[a-z0-9_-]{1,40}$', description: 'Schlüssel des Portfolios (I-N5), z. B. `transformation`.' })),
  w: StufeFilter('Nur für den Export: Wahrscheinlichkeit (Feld der Matrix).'),
  a: StufeFilter('Nur für den Export: Auswirkung (Feld der Matrix).'),
  massnahme: Type.Optional(Type.Literal('offen', { description: 'Nur für den Export: Risiken mit offener Massnahme.' })),
  format: Type.Optional(Type.Literal('csv', { description: 'Export der Risiken als CSV (mit `w`, `a`, `massnahme` wie die Tabelle der Oberfläche).' })),
}, { additionalProperties: false });
export type RisikolageQueryIn = Static<typeof RisikolageQuery>;
