/**
 * Schemas des Quartalsreportings an den VR (OpenAPI, Prüfung der Eingaben; BC ZM.03.02, PC.04.02; UC-012 Schritte 3–6,
 * A1; UC-006 A4; Kernablauf K6 Schritte 11–14; AP-E6-4).
 */
import { Type, type Static } from '@sinclair/typebox';
import { DateTime, Nullable, Uuid } from '@vollholz/platform';

const Quartal = Type.String({ pattern: '^[0-9]{4}-Q[1-4]$', description: 'Quartal «JJJJ-Qn» (docs/fachmodell.md 2.14).', examples: ['2026-Q3'] });
export const QuartalsberichtParams = Type.Object({ quartal: Quartal });

const Stand = Type.Union([Type.Literal('in_arbeit'), Type.Literal('traktandiert'), Type.Literal('verabschiedet')], {
  description: '«in Arbeit» (die UE ergänzt Kommentare, erzeugt neu), «traktandiert» (dem PRAT vorgelegt), «verabschiedet» (dem VR bereitgestellt).',
});
const Projekt = Type.Object({ nummer: Type.String(), name: Type.String() }, { additionalProperties: false });

/** Abschnitte mit Kommentar der UE (UC-012 Schritte 3–4). */
export const ABSCHNITTE = ['gesamtstatus', 'entwicklungen', 'risiken', 'abhaengigkeiten', 'auswirkungen', 'weiterleitungen'] as const;
const Kommentare = Type.Object(Object.fromEntries(ABSCHNITTE.map(a => [a, Type.String({ maxLength: 4000 })])) as Record<(typeof ABSCHNITTE)[number], ReturnType<typeof Type.String>>, {
  additionalProperties: false,
  description: 'Kommentar der UE je Abschnitt: Gesamtstatus, wesentliche Entwicklungen, Risiken, Abhängigkeiten und Eskalationen, finanzielle und organisatorische Auswirkungen, Weiterleitungen.',
});
export type KommentareOut = Static<typeof Kommentare>;

export const QuartalsInhalt = Type.Object({
  hinweise: Type.Array(Type.String(), { description: 'Hinweise bei Erzeugung, z. B. unvollständige Zielerreichung oder fehlender Portfoliobericht (K6 Z4).' }),
  zielerreichung: Type.Object({
    nachgefuehrt: Type.Integer({ minimum: 0 }),
    gesamt: Type.Integer({ minimum: 0 }),
    ziele: Type.Array(Type.Object({
      typ: Type.Union([Type.Literal('strategisch'), Type.Literal('jahresziel')]),
      id: Uuid,
      nummer: Type.String(),
      text: Type.String(),
      metrik: Type.String(),
      zielwert: Type.String(),
      stand: Nullable(Type.String()),
      beurteilung: Type.String(),
      quartal: Nullable(Type.String({ description: 'Quartal des Stands; ein früheres, wenn im Quartal nicht nachgeführt.' })),
    }, { additionalProperties: false })),
  }, { additionalProperties: false }),
  portfolios: Type.Array(Type.Object({
    id: Uuid,
    name: Type.String(),
    periode: Type.String({ description: 'Letzter Monat des Quartals.' }),
    berichtId: Nullable(Uuid),
    bereitgestellt: Type.Boolean(),
    projekte: Type.Integer({ minimum: 0 }),
    imPlan: Type.Integer({ minimum: 0 }),
    kritisch: Type.Integer({ minimum: 0 }),
    nichtGemeldet: Type.Integer({ minimum: 0 }),
    kritischeProjekte: Type.Array(Type.Object({ nummer: Type.String(), name: Type.String(), phase: Type.String(), trend: Nullable(Type.String()) }, { additionalProperties: false })),
    meilensteine: Type.Array(Type.Object({ projekt: Projekt, text: Type.String(), termin: Nullable(Type.String()) }, { additionalProperties: false })),
    risiken: Type.Array(Type.Object({
      projekt: Nullable(Projekt), text: Type.String(), wahrscheinlichkeit: Type.String(), auswirkung: Type.String(), massnahme: Type.String(),
    }, { additionalProperties: false })),
    abhaengigkeiten: Type.Array(Type.Object({ von: Projekt, zu: Projekt, text: Type.String() }, { additionalProperties: false })),
    eskalationen: Type.Array(Type.Object({ projekt: Projekt, periode: Type.String(), grund: Type.String(), massnahme: Type.String() }, { additionalProperties: false })),
  }, { additionalProperties: false }), { description: 'Je Portfolio mit Berichtspflicht der Portfoliobericht des letzten Quartalsmonats (Herkunft der Zahlen, G11).' }),
  weiterleitungen: Type.Array(Type.Object({
    entscheidId: Uuid,
    datum: Type.String({ format: 'date', description: 'Datum der Sitzung.' }),
    gremium: Type.String(),
    titel: Type.String(),
    ergebnis: Type.String(),
    begruendung: Type.String(),
    ausserordentlichAm: Nullable(Type.String({ format: 'date', description: 'Schon ausserhalb des Quartalsreportings an den VR weitergeleitet (A-03).' })),
  }, { additionalProperties: false }), { description: 'Im Gremium zur Weiterleitung an den VR markierte Geschäfte des Quartals (UC-006 A4).' }),
}, { $id: 'QuartalsInhalt', additionalProperties: false });
export type QuartalsInhaltOut = Static<typeof QuartalsInhalt>;

export const VrAuftrag = Type.Object({
  id: Uuid,
  text: Type.String(),
  verantwortlich: Uuid,
  termin: Nullable(Type.String({ format: 'date' })),
  erledigtAt: Nullable(DateTime),
}, { $id: 'VrAuftrag', additionalProperties: false });
export type VrAuftragOut = Static<typeof VrAuftrag>;

export const Quartalsbericht = Type.Object({
  id: Uuid,
  quartal: Type.String(),
  stand: Stand,
  erzeugtAt: DateTime,
  traktandiertAt: Nullable(DateTime),
  verabschiedetAt: Nullable(DateTime),
  version: Type.Integer({ minimum: 1 }),
  inhalt: Type.Ref('QuartalsInhalt'),
  kommentare: Kommentare,
  rueckmeldungPrat: Type.String({ description: 'Rückmeldungen des PRAT bei «Anpassungen verlangt» (UC-012 A1).' }),
  vrRueckmeldung: Type.String(),
  vrRueckmeldungAt: Nullable(DateTime),
  auftraege: Type.Array(Type.Ref('VrAuftrag')),
  can: Type.Object({
    erzeugen: Type.Boolean(), bearbeiten: Type.Boolean(), traktandieren: Type.Boolean(), rueckmeldung: Type.Boolean(),
  }, { additionalProperties: false }),
}, { $id: 'Quartalsbericht', additionalProperties: false });
export type QuartalsberichtOut = Static<typeof Quartalsbericht>;

export const QuartalsberichtListe = Type.Object({
  items: Type.Array(Type.Object({
    id: Uuid, quartal: Type.String(), stand: Stand, erzeugtAt: DateTime, verabschiedetAt: Nullable(DateTime),
  }, { additionalProperties: false }), { description: 'Neuestes Quartal zuerst.' }),
}, { $id: 'QuartalsberichtListe', additionalProperties: false });

export const QuartalsberichtPatch = Type.Object({
  kommentare: Type.Partial(Kommentare),
}, { $id: 'QuartalsberichtPatch', additionalProperties: false });

export const VrRueckmeldungIn = Type.Object({
  vrRueckmeldung: Type.String({ maxLength: 8000 }),
}, { $id: 'VrRueckmeldungIn', additionalProperties: false });

export const VrAuftragIn = Type.Object({
  text: Type.String({ minLength: 1, maxLength: 2000 }),
  verantwortlich: Uuid,
  termin: Type.Optional(Nullable(Type.String({ format: 'date' }))),
}, { $id: 'VrAuftragIn', additionalProperties: false });

export const VrWeiterleitung = Type.Object({
  entscheidId: Uuid,
  datum: Type.String({ format: 'date' }),
  gremium: Type.String(),
  titel: Type.String(),
  ergebnis: Type.String(),
  ausserordentlichAm: Nullable(Type.String({ format: 'date' })),
  bemerkung: Type.String(),
}, { $id: 'VrWeiterleitung', additionalProperties: false });

export const VrWeiterleitungListe = Type.Object({ items: Type.Array(Type.Ref('VrWeiterleitung')) }, { $id: 'VrWeiterleitungListe', additionalProperties: false });

export const VrWeiterleitungQuery = Type.Object({ quartal: Quartal }, { additionalProperties: false });

export const VrWeiterleitungIn = Type.Object({
  entscheidId: Uuid,
  weitergeleitetAm: Type.Optional(Type.String({ format: 'date', description: 'Ohne Angabe heute.' })),
  bemerkung: Type.Optional(Type.String({ maxLength: 2000 })),
}, { $id: 'VrWeiterleitungIn', additionalProperties: false });

export const DokumentQuery = Type.Object({
  format: Type.Optional(Type.Union([Type.Literal('pdf'), Type.Literal('docx')], { description: 'Standard PDF.' })),
}, { additionalProperties: false });
