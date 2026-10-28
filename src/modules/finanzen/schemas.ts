/** Schemas der Finanzen (OpenAPI, Prüfung der Eingaben); BC PC.01.02, PC.01.04, PC.01.05; UC-010. */
import { Type, type Static } from '@sinclair/typebox';
import { DateTime, Nullable, Uuid } from '@vollholz/platform';

const Art = Type.Union([Type.Literal('capex'), Type.Literal('opex')]);
const Betrag = (description?: string) => Nullable(Type.Number(description ? { description } : {}));
const Monat = Type.String({ pattern: '^[0-9]{4}-(0[1-9]|1[0-2])$', description: 'Monat «JJJJ-MM».' });
export const KostentraegerNummer = Type.String({ pattern: '^[A-Za-z0-9][A-Za-z0-9._/-]{0,39}$', description: 'Kostenträger im ERP (A-16).' });

const Abweichung = Type.Object({
  betrag: Betrag('Prognose minus Budget in CHF; null ohne Budget.'),
  prozent: Betrag('Abweichung in Prozent des Budgets.'),
  wesentlich: Type.Boolean({ description: 'Über der Toleranz «Kosten» des Phasenmodells (A-10); ohne Toleranz nie.' }),
}, { additionalProperties: false });

const Begruendung = Type.Object({ periode: Monat, text: Type.String(), version: Type.Integer({ minimum: 1 }), geaendertAt: DateTime }, { additionalProperties: false });

export const FinanzProjekt = Type.Object({
  id: Uuid, nummer: Type.String(), name: Type.String(), phase: Type.String(), portfolioId: Uuid,
  kostentraeger: Nullable(KostentraegerNummer),
  budget: Betrag('Summe der Budget-Baseline (CHF).'),
  prognose: Betrag('Summe der Prognose, ohne Prognose das Budget (CHF).'),
  ist: Betrag('Summe der Ist-Kosten aus dem ERP; null, solange keine geliefert sind («noch nicht verfügbar»).'),
  istBis: Nullable(Monat),
  istJeArt: Type.Object({ capex: Betrag(), opex: Betrag() }, { additionalProperties: false }),
  abweichung: Abweichung,
  toleranzProzent: Betrag('Toleranz «Kosten» in Prozent (A-10); null ohne Wert.'),
  phasen: Type.Array(Type.Object({ phase: Type.String(), art: Art, budget: Betrag(), prognose: Betrag() }, { additionalProperties: false })),
  verlauf: Type.Array(Type.Object({ monat: Monat, capex: Type.Number(), opex: Type.Number() }, { additionalProperties: false }), { description: 'Ist-Kosten je Monat (UC-010 Schritt 3).' }),
  begruendung: Nullable(Begruendung),
}, { $id: 'FinanzProjekt', additionalProperties: false });
export type FinanzProjektOut = Static<typeof FinanzProjekt>;

const Summe = Type.Object({ budget: Type.Number(), prognose: Type.Number(), ist: Betrag(), abweichung: Type.Number() }, { additionalProperties: false });

export const Finanzuebersicht = Type.Object({
  portfolio: Nullable(Type.Object({ id: Uuid, schluessel: Type.String(), name: Type.String(), kategorie: Type.String() }, { additionalProperties: false })),
  projekte: Type.Array(Type.Ref('FinanzProjekt')),
  summe: Summe,
  istStand: Nullable(Monat),
  ohneProjekt: Type.Array(Type.Object({ kostentraeger: Type.String(), betrag: Type.Number(), bis: Monat }, { additionalProperties: false }), {
    description: 'Ist-Kosten von Kostenträgern ohne zugeordnetes Projekt (UC-010 A1); nur mit finanzen:write.',
  }),
  can: Type.Object({ write: Type.Boolean({ description: 'finanzen:write: Kostenträger zuordnen, Budgetübergabe.' }) }, { additionalProperties: false }),
}, { $id: 'Finanzuebersicht', additionalProperties: false });
export type FinanzuebersichtOut = Static<typeof Finanzuebersicht>;

export const FinanzQuery = Type.Object({
  portfolio: Type.Optional(Uuid),
  alle: Type.Optional(Type.Boolean({ description: 'Auch nicht aktive Projekte (abgeschlossen, sistiert …).' })),
}, { additionalProperties: false });

export const KostentraegerPut = Type.Object({ nummer: Type.Union([Type.Null(), KostentraegerNummer]) }, { $id: 'KostentraegerPut', additionalProperties: false });

export const BegruendungOut = Type.Object({ periode: Monat, text: Type.String(), version: Type.Integer({ minimum: 1 }), geaendertAt: DateTime }, { $id: 'Begruendung', additionalProperties: false });
export const BegruendungList = Type.Object({
  items: Type.Array(Type.Ref('Begruendung')),
  can: Type.Object({ write: Type.Boolean() }, { additionalProperties: false }),
}, { $id: 'BegruendungList', additionalProperties: false });
export const BegruendungPut = Type.Object({ text: Type.String({ minLength: 1, maxLength: 2000 }) }, { $id: 'BegruendungPut', additionalProperties: false });
export const BegruendungParams = Type.Object({ id: Uuid, periode: Monat }, { additionalProperties: false });

const Wert = Type.Object({ capex: Type.Number(), opex: Type.Number() }, { additionalProperties: false });

export const Budgetuebergabe = Type.Object({
  jahr: Type.Integer(),
  stand: Type.Union([Type.Literal('neu'), Type.Literal('entwurf'), Type.Literal('uebergeben')]),
  version: Type.Integer({ minimum: 0, description: '0, solange nichts gespeichert ist (If-Match W/"0").' }),
  uebergebenAt: Nullable(DateTime),
  positionen: Type.Array(Type.Object({
    projektId: Uuid, nummer: Type.String(), name: Type.String(), portfolioId: Uuid,
    berechnet: Wert,
    korrektur: Nullable(Type.Object({ capex: Betrag(), opex: Betrag(), bemerkung: Type.String() }, { additionalProperties: false })),
    wert: Wert,
    ohneTermine: Type.Array(Type.String(), { description: 'Phasen mit Kosten, aber ohne Termine (zählen nicht, A-17).' }),
  }, { additionalProperties: false })),
  vertraulich: Nullable(Type.Object({ anzahl: Type.Integer({ minimum: 1 }), capex: Type.Number(), opex: Type.Number() }, {
    additionalProperties: false, description: 'Vertrauliche Projekte, die die Person nicht sieht, als Summe ohne Namen (in `summe` enthalten, nicht korrigierbar).',
  })),
  summe: Wert,
  can: Type.Object({ write: Type.Boolean() }, { additionalProperties: false }),
}, { $id: 'Budgetuebergabe', additionalProperties: false });
export type BudgetuebergabeOut = Static<typeof Budgetuebergabe>;

export const BudgetuebergabePut = Type.Object({
  korrekturen: Type.Array(Type.Object({
    projektId: Uuid,
    capex: Type.Union([Type.Null(), Type.Number({ minimum: 0, maximum: 1e11 })]),
    opex: Type.Union([Type.Null(), Type.Number({ minimum: 0, maximum: 1e11 })]),
    bemerkung: Type.Optional(Type.String({ maxLength: 500 })),
  }, { additionalProperties: false }), { maxItems: 1000 }),
}, { $id: 'BudgetuebergabePut', additionalProperties: false });
export type BudgetuebergabePutIn = Static<typeof BudgetuebergabePut>;
export const JahrParams = Type.Object({ jahr: Type.Integer({ minimum: 2000, maximum: 2100 }) }, { additionalProperties: false });
