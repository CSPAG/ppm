/**
 * Schemas der API des Abschlusses (OpenAPI, Prüfung der Eingaben; docs/fachmodell.md 2.13, 5): Abschlussbericht mit
 * Grundlagen aus Vertrag und Register (UC-015 Schritte 1–4, A1), Beurteilung der Nutzenrealisierung (Schritt 3),
 * Wiederaufnahme (A-09) und Lessons Learned (PS.04.03).
 */
import { Type, type Static } from '@sinclair/typebox';
import { DateTime, Nullable, Uuid } from '@vollholz/platform';
import { ARTEN, STAENDE } from './store.ts';

const enumOf = <T extends string>(values: readonly T[], description: string) => Type.Unsafe<T>({ type: 'string', enum: [...values], description });

export const ERGEBNISSE = ['abgeschlossen', 'nacharbeiten', 'sistiert', 'abgebrochen', 'weiterfuehren'] as const;
const LEBENSZYKLEN = ['aktiv', 'sistiert', 'abgebrochen', 'abgeschlossen', 'zurueckgezogen'] as const;

const Text = (max: number, description: string) => Type.String({ maxLength: max, description });

const KpiWert = Type.Object({
  kpiId: Uuid,
  wert: Text(200, 'Erreichter Wert am Abschluss, z. B. «62 %».'),
  bemerkung: Text(1000, 'Bemerkung zum Wert.'),
}, { $id: 'AbschlussKpiWert', additionalProperties: false });

const OffenerPunkt = Type.Object({
  text: Type.String({ minLength: 1, maxLength: 2000, description: 'Offener Punkt.' }),
  verantwortlich: Text(200, 'Verantwortliche Person oder Stelle in der Linie.'),
  termin: Nullable(Type.String({ format: 'date', description: 'Termin (JJJJ-MM-TT).' })),
}, { $id: 'AbschlussOffenerPunkt', additionalProperties: false });

export const AbschlussIn = Type.Object({
  projektstand: Text(10000, 'Stand des Vorhabens bei Sistierung oder Abbruch (UC-015 A1.1).'),
  zielerreichung: Text(10000, 'Zielerreichung (UC-015 Schritt 2).'),
  kpiWerte: Type.Array(Type.Ref('AbschlussKpiWert'), { maxItems: 200, description: 'Erreichte Werte je KPI des Registers.' }),
  businessCase: Text(10000, 'Business Case Abschluss P4 mit Kosten und Nutzen (UC-015 Schritt 2, PC.03.04).'),
  uebergabe: Text(10000, 'Übergabe an Betrieb und Linie (UC-015 Schritt 4).'),
  offenePunkte: Type.Array(Type.Ref('AbschlussOffenerPunkt'), { maxItems: 200, description: 'Offene Punkte mit Verantwortlichen.' }),
}, { $id: 'AbschlussIn', additionalProperties: false });
type KpiWertT = Static<typeof KpiWert>;
type OffenerPunktT = Static<typeof OffenerPunkt>;
export type AbschlussInT = Omit<Static<typeof AbschlussIn>, 'kpiWerte' | 'offenePunkte'> & { kpiWerte: KpiWertT[]; offenePunkte: OffenerPunktT[] };

export const NutzenIn = Type.Object({
  rolle: enumOf(['sp', 'ue'] as const, 'Beurteilung als Sponsor (`vertrag:decide` am Projekt) oder als UE (`vertrag:review`).'),
  beurteilung: Text(5000, 'Beurteilung der Nutzenrealisierung (UC-015 Schritt 3, PC.03.02); leer entfernt sie.'),
}, { $id: 'AbschlussNutzenIn', additionalProperties: false });
export type NutzenInT = Static<typeof NutzenIn>;

export const WiederaufnahmeIn = Type.Object({
  begruendung: Type.String({ minLength: 1, maxLength: 2000, description: 'Antrag an das Gremium: warum das Vorhaben weitergeführt werden soll.' }),
}, { $id: 'AbschlussWiederaufnahmeIn', additionalProperties: false });
export type WiederaufnahmeInT = Static<typeof WiederaufnahmeIn>;

const Beurteilung = Nullable(Type.Object({ text: Type.String(), at: DateTime, von: Type.String({ description: 'Name der Person.' }) }));

export const Bericht = Type.Object({
  id: Uuid,
  art: enumOf(ARTEN, 'Abschluss am Exit-Gate P4, Sistierung oder Abbruch.'),
  stand: enumOf(STAENDE, 'Bearbeitungsstand (fachmodell.md 2.13).'),
  projektstand: Type.String(),
  zielerreichung: Type.String(),
  kpiWerte: Type.Array(Type.Ref('AbschlussKpiWert')),
  businessCase: Type.String(),
  uebergabe: Type.String(),
  offenePunkte: Type.Array(Type.Ref('AbschlussOffenerPunkt')),
  nutzen: Type.Object({ sp: Beurteilung, ue: Beurteilung }, { description: 'Beurteilung der Nutzenrealisierung (nur Abschluss).' }),
  eingereichtAt: Nullable(DateTime),
  abgenommenAt: Nullable(DateTime),
  version: Type.Integer({ minimum: 1 }),
  updatedAt: DateTime,
}, { $id: 'AbschlussBericht', additionalProperties: false });

const Kpi = Type.Object({
  id: Uuid, art: Type.String(), text: Type.String(), einheit: Type.String(), zielwert: Nullable(Type.String()),
  ist: Nullable(Type.Object({ periode: Type.String(), wert: Type.Number() }, { description: 'Letzter nachgeführter Wert (PC.03.03).' })),
});

const Meilenstein = Type.Object({
  id: Uuid, phase: Type.String(), art: Type.String(), text: Type.String(),
  terminBaseline: Nullable(Type.String({ format: 'date' })), terminAktuell: Nullable(Type.String({ format: 'date' })),
});

export const LessonLearned = Type.Object({
  id: Uuid,
  projekt: Type.Object({ id: Uuid, nummer: Type.String(), name: Type.String() }),
  text: Type.String(),
  kategorie: Type.String({ description: 'Freier Begriff zur Gruppierung; leer = ohne Kategorie.' }),
  jahr: Type.Integer({ description: 'Jahr der Erfassung (Jahresrückblick, UC-013).' }),
  version: Type.Integer({ minimum: 1 }),
  createdAt: DateTime,
  von: Type.String({ description: 'Name der erfassenden Person.' }),
  can: Type.Object({ write: Type.Boolean({ description: 'Ändern und löschen (projekt:write am Projekt).' }) }),
}, { $id: 'AbschlussLessonLearned', additionalProperties: false });
export type LessonOut = Static<typeof LessonLearned>;

export const Abschluss = Type.Object({
  projekt: Type.Object({
    id: Uuid, nummer: Type.String(), name: Type.String(), phase: Type.String(),
    lebenszyklus: enumOf(LEBENSZYKLEN, 'Lebenszyklus des Projekts (fachmodell.md 2.5).'),
  }),
  lage: enumOf(['abschluss', 'sistierung', 'abbruch', 'abgeschlossen', 'keine'] as const,
    'Was die Projektakte zeigt: Abschluss in P4, Bericht nach Sistierung bzw. Abbruch, abgeschlossenes Projekt (lesend) oder noch kein Abschluss.'),
  // offener Bericht, sonst der letzte; null, solange keiner angelegt ist
  bericht: Nullable(Type.Ref('AbschlussBericht')),
  berichte: Type.Array(Type.Object({
    id: Uuid, art: enumOf(ARTEN, 'Art.'), stand: enumOf(STAENDE, 'Stand.'), eingereichtAt: Nullable(DateTime), abgenommenAt: Nullable(DateTime),
  }), { description: 'Alle Berichte des Projekts, neueste zuerst.' }),
  grundlagen: Type.Object({
    baseline: Nullable(Type.String({ description: 'Nummer der Baseline des Projektvertrags.' })),
    ziele: Type.String({ description: 'Ziele aus Kap. 3 der Baseline.' }),
    nutzen: Type.String({ description: 'Nutzenbeitrag aus Kap. 3 der Baseline.' }),
    businessCase: Type.String({ description: 'Business Case aus Kap. 3 der Baseline.' }),
    kpis: Type.Array(Kpi, { description: 'KPIs des Registers mit Zielwert und letztem Ist-Wert.' }),
    kosten: Nullable(Type.Object({ budgetBaseline: Type.Number(), prognose: Type.Number(), ist: Type.Number() }, {
      description: 'Summen der Kostenpositionen; null ohne Recht auf Beträge (A-33, «nicht verfügbar»).',
    })),
    offeneMeilensteine: Type.Array(Meilenstein, { description: 'Meilensteine und Lieferergebnisse ohne «erreicht am».' }),
    nutzenpruefung: Nullable(Type.Object({
      version: Type.String({ description: 'Vertragsversion des Gates.' }),
      beurteilung: Type.String(),
      werte: Type.Array(Type.Ref('AbschlussKpiWert')),
    }, { description: 'Letzte Nutzenprüfung aus dem Gate-Modus (UC-003 A2), Grundlage der Beurteilung am Abschluss; null ohne.' })),
  }, { description: 'Was das System zum Abschluss zeigt (UC-015 Schritt 1).' }),
  lessonsLearned: Type.Array(Type.Ref('AbschlussLessonLearned')),
  entscheid: Nullable(Type.Object({
    ergebnis: enumOf(ERGEBNISSE, 'Letzter Entscheid des Gremiums zu Abschluss, Sistierung, Abbruch oder Wiederaufnahme.'),
    at: DateTime,
  })),
  can: Type.Object({
    bearbeiten: Type.Boolean({ description: 'Bericht erfassen (PL, Entwurf oder Nacharbeit).' }),
    einreichen: Type.Boolean({ description: 'Bericht einreichen (PL); Pflichtangaben prüft die Route.' }),
    nutzenSp: Type.Boolean({ description: 'Nutzenrealisierung als Sponsor beurteilen.' }),
    nutzenUe: Type.Boolean({ description: 'Nutzenrealisierung als UE beurteilen.' }),
    wiederaufnahme: Type.Boolean({ description: 'Wiederaufnahme beim Gremium beantragen (sistiertes Projekt).' }),
    lessons: Type.Boolean({ description: 'Lessons Learned erfassen (projekt:write am Projekt).' }),
    dokument: Type.Boolean({ description: 'Bericht als Dokument herunterladen.' }),
  }),
}, { $id: 'Abschluss', additionalProperties: false });
type BerichtT = Omit<Static<typeof Bericht>, 'kpiWerte' | 'offenePunkte'> & { kpiWerte: KpiWertT[]; offenePunkte: OffenerPunktT[] };
type Grundlagen = Static<typeof Abschluss>['grundlagen'];
export type AbschlussOut = Omit<Static<typeof Abschluss>, 'bericht' | 'lessonsLearned' | 'grundlagen'> & {
  bericht: BerichtT | null; lessonsLearned: LessonOut[];
  grundlagen: Omit<Grundlagen, 'nutzenpruefung'> & { nutzenpruefung: { version: string; beurteilung: string; werte: KpiWertT[] } | null };
};

export const LessonIn = Type.Object({
  text: Type.String({ minLength: 1, maxLength: 5000, description: 'Erkenntnis für künftige Vorhaben.' }),
  kategorie: Type.Optional(Text(100, 'Freier Begriff zur Gruppierung, z. B. «Beschaffung».')),
}, { $id: 'AbschlussLessonIn', additionalProperties: false });
export type LessonInT = Static<typeof LessonIn>;

export const LessonPatch = Type.Object({
  text: Type.Optional(Type.String({ minLength: 1, maxLength: 5000 })),
  kategorie: Type.Optional(Text(100, 'Kategorie.')),
}, { $id: 'AbschlussLessonPatch', additionalProperties: false });
export type LessonPatchT = Static<typeof LessonPatch>;

export const LessonQuery = Type.Object({
  jahr: Type.Optional(Type.Integer({ minimum: 2000, maximum: 2100, description: 'Jahr der Erfassung.' })),
  projekt: Type.Optional(Type.String({ maxLength: 20, description: 'Projektnummer, z. B. «2026-014».' })),
  kategorie: Type.Optional(Type.String({ maxLength: 100, description: 'Kategorie; leer = ohne Kategorie.' })),
  q: Type.Optional(Type.String({ maxLength: 200, description: 'Suche in Text, Projektname und -nummer.' })),
  cursor: Type.Optional(Type.String({ maxLength: 500 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 50 })),
}, { additionalProperties: false });

export const LessonList = Type.Object({
  items: Type.Array(Type.Ref('AbschlussLessonLearned')),
  nextCursor: Nullable(Type.String()),
  kategorien: Type.Array(Type.String(), { description: 'Kategorien in Gebrauch (Filter).' }),
}, { $id: 'AbschlussLessonList', additionalProperties: false });

export const DokumentQuery = Type.Object({
  format: Type.Optional(Type.Union([Type.Literal('pdf'), Type.Literal('docx')], { description: 'Dateiformat: `pdf` (Standard) oder `docx` (Word).' })),
}, { additionalProperties: false });

export const SCHEMAS = [KpiWert, OffenerPunkt, AbschlussIn, NutzenIn, WiederaufnahmeIn, Bericht, LessonLearned, Abschluss, LessonIn, LessonPatch, LessonList];
