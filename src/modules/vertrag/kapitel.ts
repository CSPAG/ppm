/**
 * Kapitel 1–13 des Projektvertrags nach der Vorlage (Q7) mit ihren Schemas (DM.02.01). Die Kapitel sind die Daten;
 * Listen (Meilensteine, Kosten, Personal, Risiken, Stakeholder, Kommunikation, KPIs, Abhängigkeiten) stehen im Kapitel
 * und gehen bei der Baseline ins Register des Projekts (`baseline.ts`). `registerId` verbindet einen Listeneintrag mit
 * seinem Eintrag im Register; neue Einträge haben `null`.
 *
 * Die Felder der Kapitel sind die Schlüssel der Pflichtangaben im Phasenmodell (`pflichtangabe.feld`, K13, A-12), dort
 * klein mit Unterstrich geschrieben (`strategisches_ziel_id` für `strategischesZielId`).
 */
import { FormatRegistry, Type, type Static, type TLiteral, type TProperties, type TSchema, type TUnion } from '@sinclair/typebox';
import { Nullable, Uuid } from '@vollholz/platform';

// Formate für die Prüfung der Inhalte mit TypeBox (`Value`), wie AJV sie in den Routen prüft
if (!FormatRegistry.Has('uuid')) FormatRegistry.Set('uuid', v => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v));
if (!FormatRegistry.Has('date')) FormatRegistry.Set('date', v => /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)));

/** Aufzählung als Union von Literalen (prüfbar mit TypeBox `Value`, anders als `Type.Unsafe`). */
const enumOf = <const T extends readonly string[]>(values: T, description: string) =>
  Type.Union(values.map(v => Type.Literal(v)), { description }) as unknown as TUnion<{ -readonly [K in keyof T]: TLiteral<T[K]> }>;

export const PHASEN = ['P0', 'P1', 'P2', 'P3', 'P4'] as const;
export type Phase = (typeof PHASEN)[number];

const text = (max: number, description: string) => Type.String({ maxLength: max, description });
const pflichttext = (max: number, description: string) => Type.String({ minLength: 1, maxLength: max, description });
const Lang = (description: string) => text(20000, description);
const Datum = Nullable(Type.String({ format: 'date', description: 'Datum (JJJJ-MM-TT).' }));
const Monat = Nullable(Type.String({ pattern: '^[0-9]{4}-(0[1-9]|1[0-2])$', description: 'Monat «JJJJ-MM».' }));
const PhaseT = enumOf(PHASEN, 'Phase (P0 Initialisierung bis P4 Abschluss).');
const Stufe = (description: string) => enumOf(['hoch', 'mittel', 'tief'] as const, description);
const RegisterId = Nullable({ ...Uuid, description: 'Eintrag im Register des Projekts (nach der ersten Baseline); neu: null.' });
const liste = <T extends TSchema>(item: T, description: string, max = 200) => Type.Array(item, { maxItems: max, description });
const objekt = <P extends TProperties>(id: string, titel: string, p: P) => Type.Object(p, { $id: id, title: titel, additionalProperties: false });

/** 1 Ausgangslage / Problembeschreibung */
export const Kapitel1 = objekt('Kapitel1', 'Ausgangslage / Problembeschreibung', {
  ausgangslage: Lang('Beschreibung der Ausgangslage.'),
  problemstellung: Lang('Welche Problemstellung das Projekt adressiert.'),
  ohneProjekt: Lang('Was geschieht, wenn das Projekt nicht durchgeführt wird.'),
  vorprojekte: Lang('Vorprojekte und Initiativen in derselben Thematik.'),
  rahmenbedingungen: Lang('Einzuhaltende Vorgaben und Rahmenbedingungen.'),
});

/** 2 Strategiebezug (PP.02.05): Handlungsfeld, strategisches Ziel und allenfalls Jahresziel. */
export const Kapitel2 = objekt('Kapitel2', 'Strategiebezug', {
  handlungsfeldId: Nullable({ ...Uuid, description: 'Strategisches Handlungsfeld.' }),
  strategischesZielId: Nullable({ ...Uuid, description: 'Strategisches Ziel, zu dessen Erfüllung das Projekt beiträgt (nur Ziele in Kraft).' }),
  jahreszielId: Nullable({ ...Uuid, description: 'Jahresziel (optional) zum gewählten strategischen Ziel.' }),
  beitrag: Lang('Wie das Projekt zum Ziel beiträgt.'),
});

/** 3 Ziele und Nutzenbeitrag mit Business Case (PC.03.04, A-19) und KPIs (PC.03.01). */
export const KpiPlan = Type.Object({
  registerId: RegisterId,
  art: enumOf(['klinisch', 'nicht_klinisch', 'projekt'] as const, 'Klinischer, nicht-klinischer oder Projekt-KPI.'),
  text: pflichttext(500, 'Bezeichnung des KPI.'),
  einheit: text(50, 'Einheit.'),
  zielwert: text(200, 'Zielwert.'),
}, { $id: 'KpiPlan', additionalProperties: false });
export const Kapitel3 = objekt('Kapitel3', 'Ziele und Nutzenbeitrag', {
  ziele: Lang('Ziele des Projekts.'),
  nutzen: Lang('Nutzenbeitrag, qualitativ und quantitativ.'),
  businessCase: Lang('Business Case: Nutzen als Text mit Verweis auf Beilagen; Kosten je Phase aus Kapitel 9 (A-19, K21 offen).'),
  kpis: liste(Type.Ref('KpiPlan'), 'Projekt-KPIs mit Zielwert (PC.03.01).'),
});

/** 4 Lösungsansatz */
export const Kapitel4 = objekt('Kapitel4', 'Lösungsansatz', {
  loesungsansatz: Lang('Wie der Lösungsansatz aussieht.'),
  annahmen: Lang('Annahmen, die dem Lösungsansatz zugrunde liegen.'),
});

/** 5 Abgrenzung */
export const Kapitel5 = objekt('Kapitel5', 'Abgrenzung', {
  bearbeitet: Lang('Im Projekt bearbeitete Themen.'),
  nichtBearbeitet: Lang('Nicht bearbeitete Themen.'),
});

/** 6 Abhängigkeiten von anderen Projekten / Schnittstellen (PP.02.03, UC-002 Schritt 5). */
export const AbhaengigkeitPlan = Type.Object({
  registerId: RegisterId,
  zuProjektId: { ...Uuid, description: 'Anderes Projekt (muss sichtbar sein).' },
  text: pflichttext(1000, 'Abhängigkeit.'),
  ansprechperson: text(200, 'Ansprechperson bzw. Projektleitung.'),
}, { $id: 'AbhaengigkeitPlan', additionalProperties: false });
export const Kapitel6 = objekt('Kapitel6', 'Abhängigkeiten von anderen Projekten / Schnittstellen', {
  abhaengigkeiten: liste(Type.Ref('AbhaengigkeitPlan'), 'Abhängigkeiten mit Ansprechperson; erscheinen auch beim anderen Projekt.'),
  schnittstellen: Lang('Weitere Schnittstellen und mit wem sie zu koordinieren sind.'),
});

/** 7 Projektplanung und Lieferergebnisse (PS.02.04): 7.1 je Phase, 7.2 Zusammenfassung. */
export const MeilensteinPlan = Type.Object({
  registerId: RegisterId,
  phase: PhaseT,
  art: enumOf(['meilenstein', 'lieferergebnis'] as const, 'Meilenstein oder Lieferergebnis.'),
  text: pflichttext(500, 'Tätigkeit, Lieferergebnis bzw. Meilenstein.'),
  termin: Datum,
}, { $id: 'MeilensteinPlan', additionalProperties: false });
/**
 * Toleranz des Projekts je Dimension (A-10, K11; fachmodell.md 2.x `toleranz`: «Vertrag kann übersteuern»): übersteuert
 * den Standard des Phasenmodells ab der Baseline. Q7 hat kein Kapitel dafür; bis zur Klärung steht sie bei der
 * Zusammenfassung der Projektplanung (7.2, Annahme). Dimensionen und Einheiten wie im Phasenmodell.
 */
export const DIMENSIONEN_TOLERANZ = ['termin', 'kosten', 'umfang'] as const;
export const EINHEITEN_TOLERANZ = ['prozent', 'kalendertage', 'arbeitstage'] as const;
export const ToleranzPlan = Type.Object({
  dimension: enumOf(DIMENSIONEN_TOLERANZ, 'Termin, Kosten oder Umfang.'),
  wert: Type.Number({ minimum: 0, maximum: 9_999_999, description: 'Ab dieser Abweichung gilt sie als wesentlich.' }),
  einheit: enumOf(EINHEITEN_TOLERANZ, 'Prozent, Kalendertage oder Arbeitstage.'),
}, { $id: 'ToleranzPlan', additionalProperties: false });
export const Kapitel7 = objekt('Kapitel7', 'Projektplanung und Lieferergebnisse', {
  vorgehen: Lang('Tätigkeiten je Phase (7.1).'),
  meilensteine: liste(Type.Ref('MeilensteinPlan'), 'Lieferergebnisse und Meilensteine je Phase mit Termin (7.1).', 500),
  termine: Type.Object({
    projektStart: Datum,
    phasenStart: Datum,
    phasenExit: Datum,
    projektabschluss: { ...Datum, description: 'Erwarteter Projektabschluss (ab Phase 2).' },
  }, { additionalProperties: false, description: 'Zusammenfassung Projektplanung (7.2).' }),
  // Optional: Kapitel, die vor der Übersteuerung gespeichert wurden, haben das Feld nicht
  toleranzen: Type.Optional(liste(Type.Ref('ToleranzPlan'), 'Toleranzen des Projekts je Dimension; übersteuern ab der Baseline den Standard des Phasenmodells (A-10).', DIMENSIONEN_TOLERANZ.length)),
});

/**
 * 8 Projektstruktur und Organisation (PP.04.04, UC-002 Schritt 2): Funktionen mit AKV; fest sind Projektauftraggeber:in
 * und Projektleitung, weitere mit freiem Text (A-72).
 */
export const FUNKTIONEN = ['sp', 'pl', 'weitere'] as const;
export const MitgliedPlan = Type.Object({
  personId: { ...Uuid, description: 'Person aus dem Verzeichnis.' },
  funktion: enumOf(FUNKTIONEN, '`sp` Projektauftraggeber:in, `pl` Projektleitung, `weitere` mit Text in `funktionText`.'),
  funktionText: Type.Optional(text(100, 'Bezeichnung der weiteren Funktion (z. B. Kernteam); nur bei `weitere`, dort Pflicht.')),
  akv: text(2000, 'Aufgaben, Kompetenzen, Verantwortung und Verpflichtung.'),
}, { $id: 'MitgliedPlan', additionalProperties: false });
export const Kapitel8 = objekt('Kapitel8', 'Projektstruktur und Organisation', {
  mitglieder: liste(Type.Ref('MitgliedPlan'), 'Wer welche Funktion im Projekt übernimmt.'),
});

/** 9 Ressourcen: 9.1 Kosten je Phase CAPEX/OPEX (PC.01.01), 9.2 Personal (RK.02.01; Grösse S/M/L oder FTE, A-20). */
export const KostenPlan = Type.Object({
  registerId: RegisterId,
  phase: PhaseT,
  art: enumOf(['capex', 'opex'] as const, 'CAPEX oder OPEX.'),
  text: pflichttext(500, 'Position.'),
  lieferant: text(200, 'Lieferant.'),
  offerte: text(200, 'Verweis auf Offerte bzw. Kostenkalkulation.'),
  betrag: Nullable(Type.Number({ minimum: 0, maximum: 999999999999.99, description: 'Betrag in CHF inkl. MwSt.; nur mit Recht auf Beträge sichtbar (A-33).' })),
}, { $id: 'KostenPlan', additionalProperties: false });
export const PersonalPlan = Type.Object({
  registerId: RegisterId,
  phase: PhaseT,
  rolle: Type.String({ pattern: '^[a-z][a-z0-9_]{0,39}$', description: 'Rolle (Codetabelle «Rollen des Ressourcenbedarfs»).' }),
  groesse: Nullable(enumOf(['S', 'M', 'L'] as const, 'Grösse statt FTE, bis zum Gate P1–P2 (UC-002 A1).')),
  fte: Nullable(Type.Number({ exclusiveMinimum: 0, maximum: 1000, description: 'FTE (auf zwei Stellen gerundet).' })),
  vonMonat: Monat,
  bisMonat: Monat,
  bemerkung: text(500, 'Benötigte Ressourcen inkl. Zeitraum.'),
}, { $id: 'PersonalPlan', additionalProperties: false });
export const Kapitel9 = objekt('Kapitel9', 'Ressourcen', {
  kosten: liste(Type.Ref('KostenPlan'), 'Kosten je Phase (9.1).'),
  personal: liste(Type.Ref('PersonalPlan'), 'Personal je Phase und Rolle (9.2).'),
});

/** 10 Risiko-Management (PC.02.04): Eintrittswahrscheinlichkeit und Auswirkung hoch/mittel/tief. */
export const RisikoPlan = Type.Object({
  registerId: RegisterId,
  text: pflichttext(1000, 'Risiko.'),
  wahrscheinlichkeit: Stufe('Eintrittswahrscheinlichkeit (EW).'),
  auswirkung: Stufe('Auswirkung (AW).'),
  massnahme: text(1000, 'Massnahme.'),
  verantwortlich: text(200, 'Verantwortlich für die Massnahme.'),
}, { $id: 'RisikoPlan', additionalProperties: false });
export const Kapitel10 = objekt('Kapitel10', 'Risiko-Management', {
  risiken: liste(Type.Ref('RisikoPlan'), 'Risiken mit Massnahme.'),
});

/** 11 Change Management: 11.1 Stakeholder (PS.05.01), 11.2 Kommunikation (PS.05.02). */
export const StakeholderPlan = Type.Object({
  registerId: RegisterId,
  gruppe: pflichttext(200, 'Stakeholder.'),
  interesse: text(1000, 'Interesse.'),
  einfluss: text(1000, 'Einfluss auf den Projekterfolg.'),
  massnahmen: text(2000, 'Geplante Massnahmen.'),
}, { $id: 'StakeholderPlan', additionalProperties: false });
export const KommunikationPlan = Type.Object({
  registerId: RegisterId,
  phase: PhaseT,
  text: pflichttext(500, 'Massnahme.'),
  adressat: text(200, 'Adressat.'),
  ziel: text(500, 'Ziel.'),
  termin: Datum,
}, { $id: 'KommunikationPlan', additionalProperties: false });
export const Kapitel11 = objekt('Kapitel11', 'Change Management', {
  stakeholder: liste(Type.Ref('StakeholderPlan'), 'Stakeholder-Management (11.1).'),
  kommunikation: liste(Type.Ref('KommunikationPlan'), 'Kommunikationsmassnahmen mit Adressat und Ziel (11.2).'),
});

/** 12 Freigabe: Quality Review, Unterschriften und Freigabe erzeugt das System (AP-E3-2, AP-E3-3); hier nur Bemerkungen. */
export const Kapitel12 = objekt('Kapitel12', 'Freigabe', {
  bemerkung: Lang('Bemerkungen zur Freigabe.'),
});

/** 13 Beilagen (UC-002 Schritt 4: Vorstudie): Bezeichnung, Version/Datum, Inhalt. Dateien folgen (Folgearbeit). */
export const BeilagePlan = Type.Object({
  bezeichnung: pflichttext(200, 'Bezeichnung.'),
  version: text(100, 'Version bzw. Datum.'),
  inhalt: text(1000, 'Inhalt.'),
}, { $id: 'BeilagePlan', additionalProperties: false });
export const Kapitel13 = objekt('Kapitel13', 'Beilagen', {
  beilagen: liste(Type.Ref('BeilagePlan'), 'Beilagen zum Vertrag.'),
});

export const LISTEN_SCHEMAS = [KpiPlan, AbhaengigkeitPlan, MeilensteinPlan, ToleranzPlan, MitgliedPlan, KostenPlan, PersonalPlan, RisikoPlan, StakeholderPlan, KommunikationPlan, BeilagePlan];

/** Schema, Titel und leerer Inhalt je Kapitel (Reihenfolge = Nummer). */
export const KAPITEL = [Kapitel1, Kapitel2, Kapitel3, Kapitel4, Kapitel5, Kapitel6, Kapitel7, Kapitel8, Kapitel9, Kapitel10, Kapitel11, Kapitel12, Kapitel13] as const;
export const ANZAHL_KAPITEL = KAPITEL.length;

export type Inhalt = {
  1: Static<typeof Kapitel1>; 2: Static<typeof Kapitel2>; 3: Static<typeof Kapitel3> & { kpis: Static<typeof KpiPlan>[] };
  4: Static<typeof Kapitel4>; 5: Static<typeof Kapitel5>; 6: Static<typeof Kapitel6> & { abhaengigkeiten: Static<typeof AbhaengigkeitPlan>[] };
  7: Static<typeof Kapitel7> & { meilensteine: Static<typeof MeilensteinPlan>[]; toleranzen?: Static<typeof ToleranzPlan>[] }; 8: Static<typeof Kapitel8> & { mitglieder: Static<typeof MitgliedPlan>[] };
  9: { kosten: Static<typeof KostenPlan>[]; personal: Static<typeof PersonalPlan>[] }; 10: { risiken: Static<typeof RisikoPlan>[] };
  11: { stakeholder: Static<typeof StakeholderPlan>[]; kommunikation: Static<typeof KommunikationPlan>[] }; 12: Static<typeof Kapitel12>;
  13: { beilagen: Static<typeof BeilagePlan>[] };
};
export type Nr = keyof Inhalt;

export const titel = (nr: number): string => KAPITEL[nr - 1]!.title!;

/** Felder eines Kapitels (Schlüssel der Pflichtangaben). */
export const felder = (nr: number): string[] => Object.keys(KAPITEL[nr - 1]!.properties);

/** Leerer Inhalt eines Kapitels: Texte leer, Listen leer, Verweise und Daten null. */
export function leer(nr: number): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, s] of Object.entries(KAPITEL[nr - 1]!.properties) as [string, { type?: string; anyOf?: unknown; properties?: Record<string, unknown> }][]) {
    if (s.type === 'string') out[k] = '';
    else if (s.type === 'array') out[k] = [];
    else if (s.type === 'object') out[k] = Object.fromEntries(Object.keys(s.properties ?? {}).map(f => [f, null]));
    else out[k] = null;
  }
  return out;
}

/** Ein Feld gilt als ausgefüllt: Text nicht leer, Liste nicht leer, Wert gesetzt, Objekt mit mindestens einem Wert. */
export function ausgefuellt(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.values(v).some(ausgefuellt);
  return true;
}

/** Kapitel mit Beträgen (A-33): ohne Recht auf Beträge werden sie als null ausgegeben und beim Speichern abgewiesen. */
export const KAPITEL_MIT_BETRAEGEN: readonly number[] = [9];

/** Beträge entfernen (Ausgabe ohne `finanzen:read`). */
export function ohneBetraege(nr: number, inhalt: Record<string, unknown>): Record<string, unknown> {
  if (nr !== 9) return inhalt;
  const k = inhalt as { kosten?: { betrag: number | null }[] };
  return { ...inhalt, kosten: (k.kosten ?? []).map(x => ({ ...x, betrag: null })) };
}
