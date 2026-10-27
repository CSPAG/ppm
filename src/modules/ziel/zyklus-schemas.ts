/**
 * Schemas des Zielzyklus (OpenAPI, Prüfung der Eingaben): Zieljahr, Jahresziele, Hauptaktivitäten, Zuordnung der
 * Projekte (BC ZM.02.01, ZM.02.03, ZM.02.04, PP.02.05; UC-011 Schritte 1–5; K6).
 */
import { Type, type Static } from '@sinclair/typebox';
import { Cursor, DateTime, Limit, NextCursor, Nullable, Uuid } from '@vollholz/platform';

const Datum = Type.String({ format: 'date', description: 'Datum (JJJJ-MM-TT).', examples: ['2026-11-30'] });
const Nummer = Type.String({ pattern: '^[0-9]{1,3}(\\.[0-9]{1,3}){0,4}$', description: 'Nummer, eindeutig im Jahr; Vorgabe: Nummer des strategischen Ziels und laufende Nummer («2.1.3»).', examples: ['2.1.3'] });
const Text = Type.String({ minLength: 1, maxLength: 1000, description: 'Formulierung.' });
const Metrik = Type.String({ maxLength: 500, description: 'Woran die Erreichung gemessen wird (ZM.02.04); leer = fehlt.' });
const Zielwert = Type.String({ maxLength: 200, description: 'Angestrebter Wert der Metrik.' });

export const JahrParams = Type.Object({ jahr: Type.Integer({ minimum: 2000, maximum: 2100, description: 'Jahr des Zielzyklus.' }) });

export const Zieljahr = Type.Object({
  jahr: Type.Integer(),
  stand: Type.Union([Type.Literal('in_arbeit'), Type.Literal('zur_freigabe'), Type.Literal('in_kraft')], { description: 'Bearbeitungsstand der Jahresziele; ab «zur_freigabe» gesperrt.' }),
  vorlageBis: Nullable(Type.String({ format: 'date', description: 'Geplante Vorlage an den VR.' })),
  freigabeAt: Nullable(DateTime),
  freigabeText: Type.String(),
  version: Type.Integer({ minimum: 1 }),
  createdAt: DateTime,
  updatedAt: DateTime,
  can: Type.Object({ write: Type.Boolean({ description: 'Jahresziele und Hauptaktivitäten bearbeiten (nur «in Arbeit»).' }) }),
}, { $id: 'Zieljahr', additionalProperties: false });
export type ZieljahrOut = Static<typeof Zieljahr>;

export const ZieljahrCreate = Type.Object({ vorlageBis: Type.Optional(Nullable(Datum)) }, { $id: 'ZieljahrCreate', additionalProperties: false });
export const ZieljahrPatch = Type.Object({ vorlageBis: Nullable(Datum) }, { $id: 'ZieljahrPatch', additionalProperties: false });

export const Person = Type.Object({ id: Uuid, name: Nullable(Type.String()) }, { $id: 'ZielPerson', additionalProperties: false, description: 'Person mit Anzeigename.' });

export const Hauptaktivitaet = Type.Object({
  id: Uuid,
  jahreszielId: Uuid,
  text: Type.String(),
  verantwortlich: Nullable(Type.Ref('ZielPerson')),
  position: Type.Integer(),
  version: Type.Integer({ minimum: 1 }),
  createdAt: DateTime,
  updatedAt: DateTime,
  can: Type.Object({ write: Type.Boolean() }),
}, { $id: 'Hauptaktivitaet', additionalProperties: false });
export type HauptaktivitaetOut = Static<typeof Hauptaktivitaet>;

export const HauptaktivitaetCreate = Type.Object({
  jahreszielId: Uuid,
  text: Text,
  verantwortlich: Type.Optional(Nullable(Uuid)),
  position: Type.Optional(Type.Integer({ minimum: 0, maximum: 10000 })),
}, { $id: 'HauptaktivitaetCreate', additionalProperties: false });
export type HauptaktivitaetCreateIn = Static<typeof HauptaktivitaetCreate>;

export const HauptaktivitaetPatch = Type.Object({
  text: Type.Optional(Text),
  verantwortlich: Type.Optional(Nullable(Uuid)),
  position: Type.Optional(Type.Integer({ minimum: 0, maximum: 10000 })),
}, { $id: 'HauptaktivitaetPatch', additionalProperties: false, minProperties: 1 });
export type HauptaktivitaetPatchIn = Static<typeof HauptaktivitaetPatch>;

export const HauptaktivitaetList = Type.Object({ items: Type.Array(Type.Ref('Hauptaktivitaet')) }, { $id: 'HauptaktivitaetList', additionalProperties: false });
export const HauptaktivitaetQuery = Type.Object({ jahresziel: Type.String({ format: 'uuid', description: 'Hauptaktivitäten dieses Jahresziels.' }) }, { additionalProperties: false });

/** Projekt in der Zielhierarchie; nur Projekte, die die Person sehen darf (Lesesicht). */
export const ZielProjekt = Type.Object({
  zuordnungId: Uuid,
  projektId: Uuid,
  nummer: Type.String({ description: 'Projektnummer, Schlüssel der Projektakte (/projekte/<nummer>).' }),
  name: Type.String(),
  phase: Type.String(),
  lebenszyklus: Type.String(),
}, { $id: 'ZielProjekt', additionalProperties: false });

export const Jahresziel = Type.Object({
  id: Uuid,
  jahr: Type.Integer(),
  strategischesZielId: Uuid,
  nummer: Type.String(),
  text: Type.String(),
  metrik: Type.String(),
  zielwert: Type.String(),
  version: Type.Integer({ minimum: 1 }),
  createdAt: DateTime,
  createdBy: Nullable(Uuid),
  updatedAt: DateTime,
  updatedBy: Nullable(Uuid),
  can: Type.Object({ write: Type.Boolean({ description: 'Ändern und löschen (nur solange das Jahr «in Arbeit» ist).' }) }),
}, { $id: 'Jahresziel', additionalProperties: false });
export type JahreszielOut = Static<typeof Jahresziel>;

export const JahreszielCreate = Type.Object({
  jahr: Type.Integer({ minimum: 2000, maximum: 2100 }),
  strategischesZielId: Uuid,
  nummer: Type.Optional(Nummer),
  text: Text,
  metrik: Type.Optional(Metrik),
  zielwert: Type.Optional(Zielwert),
}, { $id: 'JahreszielCreate', additionalProperties: false });
export type JahreszielCreateIn = Static<typeof JahreszielCreate>;

export const JahreszielPatch = Type.Object({
  nummer: Type.Optional(Nummer),
  text: Type.Optional(Text),
  metrik: Type.Optional(Metrik),
  zielwert: Type.Optional(Zielwert),
}, { $id: 'JahreszielPatch', additionalProperties: false, minProperties: 1 });
export type JahreszielPatchIn = Static<typeof JahreszielPatch>;

export const JahreszielList = Type.Object({ items: Type.Array(Type.Ref('Jahresziel')), nextCursor: NextCursor }, { $id: 'JahreszielList', additionalProperties: false });
export const JahreszielQuery = Type.Object({
  jahr: Type.Optional(Type.Integer({ minimum: 2000, maximum: 2100, description: 'Nur Jahresziele dieses Jahres.' })),
  strategischesZiel: Type.Optional(Type.String({ format: 'uuid', description: 'Nur Jahresziele unter diesem strategischen Ziel.' })),
  cursor: Type.Optional(Cursor),
  limit: Type.Optional(Limit),
}, { additionalProperties: false });

/** Zielzyklus eines Jahres als Baum (K6 Schritt 1): strategische Ziele › Jahresziele › Hauptaktivitäten › Projekte. */
export const Zielzyklus = Type.Object({
  jahr: Type.Integer(),
  // null: Zielzyklus noch nicht gestartet (K6 Z2 Leer)
  zieljahr: Nullable(Type.Ref('Zieljahr')),
  strategischeZiele: Type.Array(Type.Object({
    id: Uuid,
    handlungsfeldId: Uuid,
    nummer: Type.String(),
    text: Type.String(),
    metrik: Type.String(),
    zielwert: Type.String(),
    projekte: Type.Array(Type.Ref('ZielProjekt'), { description: 'Projekte, die dem strategischen Ziel ohne Jahresziel zugeordnet sind.' }),
    jahresziele: Type.Array(Type.Object({
      id: Uuid,
      nummer: Type.String(),
      text: Type.String(),
      metrik: Type.String(),
      zielwert: Type.String(),
      version: Type.Integer(),
      hauptaktivitaeten: Type.Array(Type.Object({
        id: Uuid, text: Type.String(), verantwortlich: Nullable(Type.Ref('ZielPerson')), position: Type.Integer(), version: Type.Integer(),
      }, { additionalProperties: false })),
      projekte: Type.Array(Type.Ref('ZielProjekt')),
    }, { additionalProperties: false })),
  }, { additionalProperties: false }), { description: 'Alle strategischen Ziele, sortiert nach Nummer; Handlungsfelder über /v1/handlungsfelder.' }),
  pruefung: Type.Object({
    ohneMetrik: Type.Array(Type.Object({ id: Uuid, nummer: Type.String() }, { additionalProperties: false }), { description: 'Jahresziele ohne Metrik oder Zielwert (sperrt die Vorlage, UC-011 Schritt 5).' }),
    ohneUmsetzung: Type.Array(Type.Object({ id: Uuid, nummer: Type.String() }, { additionalProperties: false }), { description: 'Jahresziele ohne Hauptaktivität und ohne Projekt (Hinweis).' }),
  }, { additionalProperties: false, description: 'Prüfbericht (K6 Regeln).' }),
  can: Type.Object({
    start: Type.Boolean({ description: 'Zielzyklus starten (noch nicht gestartet, ziel:write).' }),
    write: Type.Boolean({ description: 'Jahresziele und Hauptaktivitäten bearbeiten.' }),
    zuordnen: Type.Boolean({ description: 'Projekte zuordnen (ziel:write).' }),
  }),
}, { $id: 'Zielzyklus', additionalProperties: false });

/** Zuordnung eines Projekts zu einem Ziel (PP.02.05), aus Sicht des Projekts (K6-2: vom Projekt zum Ziel). */
export const ProjektZiel = Type.Object({
  id: Uuid,
  projektId: Uuid,
  strategischesZiel: Type.Object({ id: Uuid, nummer: Type.String(), text: Type.String() }, { additionalProperties: false }),
  jahresziel: Nullable(Type.Object({ id: Uuid, jahr: Type.Integer(), nummer: Type.String(), text: Type.String() }, { additionalProperties: false })),
  link: Type.String({ description: 'Adresse des Ziels im Arbeitsraum Ziele.' }),
  createdAt: DateTime,
}, { $id: 'ProjektZiel', additionalProperties: false });
export type ProjektZielOut = Static<typeof ProjektZiel>;

export const ProjektZielList = Type.Object({
  items: Type.Array(Type.Ref('ProjektZiel')),
  can: Type.Object({ write: Type.Boolean({ description: 'Zuordnungen ändern.' }) }),
}, { $id: 'ProjektZielList', additionalProperties: false });

export const ProjektZielCreate = Type.Object({
  strategischesZielId: Type.Optional(Uuid),
  jahreszielId: Type.Optional(Uuid),
}, { $id: 'ProjektZielCreate', additionalProperties: false, minProperties: 1, description: 'Strategisches Ziel oder Jahresziel (das strategische Ziel folgt daraus).' });
export type ProjektZielCreateIn = Static<typeof ProjektZielCreate>;

export const ProjektZielParams = Type.Object({ id: Uuid, zuordnungId: Uuid });
