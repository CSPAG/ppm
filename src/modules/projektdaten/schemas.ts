/**
 * Schemas der Register je Projekt (OpenAPI, Prüfung der Eingaben); docs/fachmodell.md 2.6, Felder nach der Vorlage
 * Projektvertrag (Q7 Kap. 6, 7, 9, 10, 11). Baseline-Werte, Ist-Kosten, Abnahme und «gedeckt» sind nur lesend: Sie
 * schreiben die oberen Module (vertrag, finanzen, sitzung, ressource) über `index.ts`.
 */
import { Type, type Static, type TSchema } from '@sinclair/typebox';
import { Cursor, DateTime, Limit, NextCursor, Nullable, Uuid } from '@vollholz/platform';

export const PHASEN = ['P0', 'P1', 'P2', 'P3', 'P4'] as const;
export type Phase = (typeof PHASEN)[number];

const enumOf = <T extends string>(values: readonly T[], description: string) => Type.Unsafe<T>({ type: 'string', enum: [...values], description });

const PhaseT = enumOf(PHASEN, 'Phase (P0 Initialisierung bis P4 Abschluss).');
const Stufe = (description: string) => enumOf(['hoch', 'mittel', 'tief'] as const, description);
const Datum = Type.String({ format: 'date', description: 'Datum (JJJJ-MM-TT).' });
const Monat = Type.String({ pattern: '^[0-9]{4}-(0[1-9]|1[0-2])$', description: 'Monat «JJJJ-MM».', examples: ['2026-11'] });
const Betrag = Type.Number({ minimum: 0, maximum: 999999999999.99, multipleOf: 0.01, description: 'Betrag in CHF inkl. MwSt.' });
const text = (max: number, description: string, min = 0) => Type.String({ minLength: min, maxLength: max, description });

/** Gemeinsame Felder jedes Eintrags. */
const Kopf = {
  id: Uuid,
  projektId: Uuid,
  version: Type.Integer({ minimum: 1 }),
  createdAt: DateTime,
  updatedAt: DateTime,
  can: Type.Object({ write: Type.Boolean() }, { description: 'Was die anfragende Person damit darf (ändern und löschen).' }),
};

/**
 * Ausgabe, Anlegen (Pflichtfelder), Ändern (alles optional ausser `fest`, mindestens ein Feld) und Liste eines Registers.
 * `fest`: nur beim Anlegen wählbar.
 */
function register<O extends Record<string, TSchema>, C extends Record<string, TSchema>>(
  name: string, ausgabe: O, eingabe: C, pflicht: readonly (keyof C & string)[], fest: readonly (keyof C & string)[] = [],
) {
  const create = Object.fromEntries(Object.entries(eingabe).map(([k, s]) => [k, pflicht.includes(k) ? s : Type.Optional(s)]));
  const patch = Object.fromEntries(Object.entries(eingabe).filter(([k]) => !fest.includes(k)).map(([k, s]) => [k, Type.Optional(s)]));
  return {
    Out: Type.Object({ ...Kopf, ...ausgabe }, { $id: name, additionalProperties: false }),
    List: Type.Object({
      items: Type.Array(Type.Ref(name)), nextCursor: NextCursor,
      can: Type.Object({ write: Type.Boolean() }, { description: 'Ob die anfragende Person Einträge anlegen darf.' }),
    }, { $id: `${name}List`, additionalProperties: false }),
    Create: Type.Object(create, { $id: `${name}Create`, additionalProperties: false }),
    Patch: Type.Object(patch, { $id: `${name}Patch`, additionalProperties: false, minProperties: 1 }),
  };
}

// ---------------------------------------------------------------- Meilensteine (PS.02.04, PS.05.02, PS.05.03)

export const MEILENSTEIN_ARTEN = ['meilenstein', 'lieferergebnis', 'kommunikation'] as const;
const MeilensteinArt = enumOf(MEILENSTEIN_ARTEN, '`meilenstein`, `lieferergebnis` oder `kommunikation` (Kommunikationsmassnahme, PS.05.02).');
const meilensteinFelder = {
  phase: PhaseT,
  art: MeilensteinArt,
  text: text(500, 'Tätigkeit, Lieferergebnis, Meilenstein bzw. Kommunikationsmassnahme.', 1),
  adressat: text(200, 'Adressat einer Kommunikationsmassnahme (Q7 Kap. 11.2).'),
  ziel: text(500, 'Ziel einer Kommunikationsmassnahme (Q7 Kap. 11.2).'),
  terminAktuell: Nullable(Datum),
  erreichtAm: Nullable(Datum),
  abnahme: enumOf(['keine', 'gremium'] as const, '`gremium`: Abnahme durch das Gremium (PS.02.03).'),
};
export const Meilenstein = register('Meilenstein', {
  ...meilensteinFelder,
  terminBaseline: Nullable({ ...Datum, description: 'Termin der Baseline (aus dem abgenommenen Projektvertrag).' }),
  abgenommenAm: Nullable({ ...Datum, description: 'Abnahme durch das Gremium (PS.02.03).' }),
}, meilensteinFelder, ['phase', 'art', 'text']);

// ---------------------------------------------------------------- Kosten (PC.01.01, PC.01.03)

const kostenFelder = {
  phase: PhaseT,
  art: enumOf(['capex', 'opex'] as const, 'CAPEX oder OPEX.'),
  text: text(500, 'Position.', 1),
  lieferant: text(200, 'Lieferant.'),
  offerte: text(200, 'Verweis auf Offerte bzw. Kostenkalkulation.'),
  // Typliste statt anyOf: AJV wandelt mit coerceTypes in anyOf null in 0 (Zahl zuerst) bzw. 0 in null (null zuerst) um
  prognose: Type.Unsafe<number | null>({ ...Betrag, type: ['number', 'null'], description: 'Erwartete Kosten (aufdatiert, PC.01.03), CHF inkl. MwSt.' }),
};
export const Kosten = register('Kosten', {
  ...kostenFelder,
  budgetBaseline: Nullable({ ...Betrag, description: 'Budget der Baseline (aus dem abgenommenen Projektvertrag).' }),
  ist: Nullable({ ...Betrag, description: 'Ist-Kosten (Modul finanzen, A-16); null = noch nicht verfügbar.' }),
}, kostenFelder, ['phase', 'art', 'text']);

// ---------------------------------------------------------------- Risiken (PC.02.01, PC.02.03, PC.02.04)

const risikoFelder = {
  text: text(1000, 'Risiko.', 1),
  wahrscheinlichkeit: Stufe('Eintrittswahrscheinlichkeit (EW).'),
  auswirkung: Stufe('Auswirkung (AW).'),
  massnahme: text(1000, 'Massnahme.'),
  massnahmeStand: enumOf(['offen', 'umgesetzt'] as const, 'Stand der Massnahme (PC.02.03).'),
  verantwortlich: text(200, 'Verantwortlich für die Massnahme.'),
};
export const Risiko = register('Risiko', {
  ...risikoFelder,
  projektId: Nullable(Uuid),
  portfolioId: Nullable({ ...Uuid, description: 'Portfoliorisiko (PC.02.01): Portfolio statt Projekt.' }),
}, risikoFelder, ['text', 'wahrscheinlichkeit', 'auswirkung']);

// ---------------------------------------------------------------- KPIs (PC.03.01) und Werte (PC.03.03)

const kpiFelder = {
  art: enumOf(['klinisch', 'nicht_klinisch', 'projekt'] as const, 'Klinischer, nicht-klinischer oder Projekt-KPI.'),
  text: text(500, 'Bezeichnung des KPI.', 1),
  einheit: text(50, 'Einheit.'),
  zielwert: text(200, 'Zielwert.'),
};
export const Kpi = register('Kpi', kpiFelder, kpiFelder, ['art', 'text']);

export const KpiWert = Type.Object({
  kpiId: Uuid,
  periode: Monat,
  wert: Type.Number(),
  kommentar: Type.String(),
  version: Type.Integer({ minimum: 1 }),
  updatedAt: DateTime,
  can: Type.Object({ write: Type.Boolean() }, { description: 'Was die anfragende Person damit darf.' }),
}, { $id: 'KpiWert', additionalProperties: false });
export const KpiWertList = Type.Object({
  items: Type.Array(Type.Ref('KpiWert'), { description: 'Werte des KPI, neueste Periode zuerst.' }),
  nextCursor: NextCursor,
  can: Type.Object({ write: Type.Boolean() }, { description: 'Ob die anfragende Person Werte erfassen darf (kpi:write, ab P2).' }),
}, { $id: 'KpiWertList', additionalProperties: false });
export const KpiWertPut = Type.Object({
  wert: Type.Number({ minimum: -1e14, maximum: 1e14 }),
  kommentar: Type.Optional(text(1000, 'Kommentar.')),
}, { $id: 'KpiWertPut', additionalProperties: false });
export type KpiWertPutIn = Static<typeof KpiWertPut>;

// ---------------------------------------------------------------- Stakeholder (PS.05.01)

const stakeholderFelder = {
  gruppe: text(200, 'Stakeholder bzw. betroffene Gruppe.', 1),
  interesse: text(1000, 'Interesse.'),
  einfluss: text(1000, 'Einfluss auf den Projekterfolg.'),
  massnahmen: text(2000, 'Geplante Massnahmen.'),
};
export const Stakeholder = register('Stakeholder', stakeholderFelder, stakeholderFelder, ['gruppe']);

// ---------------------------------------------------------------- Abhängigkeiten (PP.02.03)

const abhaengigkeitFelder = {
  text: text(1000, 'Art der Abhängigkeit.', 1),
  ansprechperson: text(200, 'Ansprechperson bzw. Projektleitung, mit der zu koordinieren ist.'),
};
const Richtung = enumOf(['ausgehend', 'eingehend'] as const,
  '`ausgehend`: bei diesem Projekt erfasst; `eingehend`: beim anderen Projekt erfasst und hier sichtbar (UC-002 Schritt 5).');
export const Abhaengigkeit = register('Abhaengigkeit', {
  ...abhaengigkeitFelder,
  zuProjektId: Uuid,
  richtung: Richtung,
  anderesProjekt: Nullable(Type.Object({ id: Uuid, nummer: Type.String(), name: Type.String() }, {
    additionalProperties: false, description: 'Das andere Projekt, falls die anfragende Person es sehen darf.',
  })),
}, { ...abhaengigkeitFelder, zuProjektId: Uuid }, ['zuProjektId', 'text'], ['zuProjektId']);

// ---------------------------------------------------------------- Ressourcenbedarf (RK.02.01, RK.02.05, A-20)

const ressourcenbedarfFelder = {
  phase: PhaseT,
  rolle: Type.String({ pattern: '^[A-Za-z0-9_]{1,40}$', description: 'Schlüssel der Rolle (Codetabelle `ressourcenrolle`, A-20: Pool = Rolle).' }),
  groesse: Nullable(enumOf(['S', 'M', 'L'] as const, 'Grösse S/M/L bis Gate P1–P2 (RK.02.01).')),
  fte: Nullable(Type.Number({ exclusiveMinimum: 0, maximum: 1000, multipleOf: 0.01, description: 'FTE je Monat ab Gate P1–P2 (RK.02.05).' })),
  vonMonat: Nullable(Monat),
  bisMonat: Nullable(Monat),
  bemerkung: text(1000, 'Benötigte Ressourcen inkl. Zeitraum (Q7 Kap. 9.2).'),
};
export const Ressourcenbedarf = register('Ressourcenbedarf', {
  ...ressourcenbedarfFelder,
  monate: Nullable(Type.Integer({ minimum: 1, description: 'Anzahl Monate von bis (einschliesslich).' })),
  gedeckt: Type.Boolean({ description: 'Durch Zuteilung gedeckt (Modul ressource, RK.02.04).' }),
}, ressourcenbedarfFelder, ['phase', 'rolle']);

// ---------------------------------------------------------------- Meldung ICT/Infrastruktur (RK.02.06, A-22)

export const STELLEN = ['dti', 'dbi'] as const;
export const Meldung = Type.Object({
  id: Uuid,
  projektId: Uuid,
  stelle: enumOf(STELLEN, '`dti` ICT, `dbi` Infrastruktur.'),
  text: Type.String(),
  gemeldetAt: DateTime,
  gemeldetBy: Nullable(Uuid),
}, { $id: 'Meldung', additionalProperties: false });
export const MeldungList = Type.Object({
  items: Type.Array(Type.Ref('Meldung'), { description: 'Neueste zuerst.' }), nextCursor: NextCursor,
  can: Type.Object({ write: Type.Boolean() }, { description: 'Ob die anfragende Person melden darf.' }),
}, { $id: 'MeldungList', additionalProperties: false });
export const MeldungCreate = Type.Object({
  stelle: enumOf(STELLEN, '`dti` ICT-Bedarf, `dbi` Infrastrukturbedarf.'),
  text: text(2000, 'Bedarf.', 1),
}, { $id: 'MeldungCreate', additionalProperties: false });
export type MeldungCreateIn = Static<typeof MeldungCreate>;

// ---------------------------------------------------------------- Abfragen

export const ListQuery = Type.Object({
  phase: Type.Optional(PhaseT),
  cursor: Type.Optional(Cursor),
  limit: Type.Optional(Limit),
}, { additionalProperties: false });
export const MeilensteinQuery = Type.Object({
  phase: Type.Optional(PhaseT),
  art: Type.Optional(MeilensteinArt),
  cursor: Type.Optional(Cursor),
  limit: Type.Optional(Limit),
}, { additionalProperties: false });
export const SeiteQuery = Type.Object({ cursor: Type.Optional(Cursor), limit: Type.Optional(Limit) }, { additionalProperties: false });

export const EintragParams = Type.Object({ id: Uuid, eintragId: Uuid }, { additionalProperties: false });
export const KpiParams = Type.Object({ id: Uuid, kpiId: Uuid }, { additionalProperties: false });
export const KpiWertParams = Type.Object({ id: Uuid, kpiId: Uuid, periode: Monat }, { additionalProperties: false });
