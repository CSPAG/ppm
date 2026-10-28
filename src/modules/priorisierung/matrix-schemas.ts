/** Schemas der Matrix und der Rangfolge (OpenAPI, Prüfung der Eingaben); BC PP.03.04, PP.02.02, PP.02.03. */
import { Type, type Static } from '@sinclair/typebox';
import { DateTime, Nullable, Uuid } from '@vollholz/platform';

const Stufe = Nullable(Type.Union([Type.Literal('hoch'), Type.Literal('tief'), Type.Literal('grenze')]));
const Achse = Type.Object({
  wert: Nullable(Type.Number({ description: 'Durchschnitt der Einschätzungen der zugeordneten Kriterien (tief 1, mittel 2, hoch 3).' })),
  stufe: Stufe,
  bewertet: Type.Integer({ description: 'Bewertete Kriterien dieser Achse.' }),
  von: Type.Integer({ description: 'Kriterien, die dieser Achse zugeordnet sind.' }),
}, { additionalProperties: false });

export const Matrix = Type.Object({
  portfolio: Type.Object({ id: Uuid, schluessel: Type.String(), name: Type.String(), kategorie: Type.String() }, { additionalProperties: false }),
  modell: Nullable(Type.Object({
    id: Uuid, nummer: Type.Integer(), inKraftAt: Nullable(DateTime),
    kriterien: Type.Array(Type.Object({ schluessel: Type.String(), text: Type.String(), dimension: Nullable(Type.Union([Type.Literal('nutzen'), Type.Literal('risiko')])) }, { additionalProperties: false })),
  }, { additionalProperties: false })),
  kostenSichtbar: Type.Boolean({ description: 'Beträge nur mit finanzen:read (A-33); sonst ist `kosten` null.' }),
  projekte: Type.Array(Type.Object({
    id: Uuid, nummer: Type.String(), name: Type.String(), phase: Type.String(),
    nutzen: Achse, risiko: Achse,
    feld: Nullable(Type.Union([Type.Literal('priorisieren'), Type.Literal('rasch_umsetzen'), Type.Literal('opportunistisch'), Type.Literal('hinterfragen')])),
    ressourcen: Type.Object({
      fteMonate: Nullable(Type.Number({ description: 'Summe FTE × Monate des Ressourcenbedarfs (RK.02.05).' })),
      groesse: Nullable(Type.Union([Type.Literal('S'), Type.Literal('M'), Type.Literal('L')], { description: 'Grösste gemeldete Grösse (RK.02.01).' })),
    }, { additionalProperties: false }),
    kosten: Nullable(Type.Number({ description: 'Summe der Prognose (sonst Baseline) der Kostenpositionen in CHF; null ohne finanzen:read.' })),
    rang: Nullable(Type.Integer({ description: 'Entschiedener Rang (bisherige Rangfolge, UC-008 Schritt 1).' })),
    rangEntwurf: Nullable(Type.Integer()),
    abhaengigVon: Type.Array(Uuid, { description: 'Projekte dieses Portfolios, die das Projekt braucht (PP.02.03, Linien in der Matrix).' }),
  }, { additionalProperties: false }), { description: 'Aktive Projekte des Portfolios, die die Person sieht, nach Nummer.' }),
}, { $id: 'Matrix', additionalProperties: false });
export type MatrixOut = Static<typeof Matrix>;

const RangEintrag = Type.Object({ projektId: Uuid, rang: Type.Integer({ minimum: 1 }), begruendung: Type.String() }, { additionalProperties: false });

export const Rangfolge = Type.Object({
  entschieden: Type.Array(RangEintrag, { description: 'Vom Gremium entschiedene Rangfolge (AP-E5-5).' }),
  entwurf: Type.Array(RangEintrag, { description: 'Entwurf der UE, nach Rang.' }),
  version: Type.Integer({ minimum: 0, description: 'Fassung des Entwurfs für If-Match (0 ohne Entwurf).' }),
  geaendertAt: Nullable(DateTime),
  can: Type.Object({ write: Type.Boolean() }, { additionalProperties: false }),
}, { $id: 'Rangfolge', additionalProperties: false });
export type RangfolgeOut = Static<typeof Rangfolge>;

export const RangfolgePut = Type.Object({
  projekte: Type.Array(Type.Object({
    projektId: Uuid,
    begruendung: Type.Optional(Type.String({ maxLength: 1000, description: 'Begründung des Rangs (PP.02.02 «begründete Rangfolge»).' })),
  }, { additionalProperties: false }), { maxItems: 500, description: 'Alle Projekte des Entwurfs in der Reihenfolge Rang 1, 2, …; leer entfernt den Entwurf.' }),
}, { $id: 'RangfolgePut', additionalProperties: false });
export type RangfolgePutIn = Static<typeof RangfolgePut>;
