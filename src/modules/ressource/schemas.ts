/** Schemas des Kapazitätsangebots und der Auslastung (OpenAPI, Prüfung der Eingaben); BC RK.01.01, RK.02.04, UC-009. */
import { Type, type Static } from '@sinclair/typebox';
import { Nullable, Uuid } from '@vollholz/platform';

const MONAT = '^[0-9]{4}-(0[1-9]|1[0-2])$';
export const Monat = Type.String({ pattern: MONAT, description: 'Monat «JJJJ-MM».', examples: ['2027-04'] });
const Rolle = Type.String({ pattern: '^[A-Za-z0-9_]{1,40}$', description: 'Rolle = Pool (A-20): Schlüssel eines Codewerts der Codetabelle `ressourcenrolle`.', examples: ['projektleitung'] });

/** Zeitraum: beides optional; ohne Angabe der laufende Monat und die elf folgenden. */
export const ZeitraumQuery = Type.Object({
  von: Type.Optional(Monat),
  bis: Type.Optional(Monat),
}, { additionalProperties: false });

export const AuslastungQuery = Type.Object({
  von: Type.Optional(Monat),
  bis: Type.Optional(Monat),
  szenario: Type.Optional(Type.String({ format: 'uuid', description: 'Auslastung für ein Portfolioszenario (UC-008 Schritt 5): Projekte ausserhalb des Szenarios bzw. inaktive fallen weg, der Start verschiebt den Bedarf.' })),
}, { additionalProperties: false });

export const KapazitaetZelle = Type.Object({
  rolle: Type.String(),
  monat: Type.String(),
  fte: Nullable(Type.Number({ description: 'Angebot in FTE; null = kein Angebot erfasst (bzw. eben entfernt).' })),
  version: Nullable(Type.Integer({ minimum: 1, description: 'Version der Zelle für `version` beim Ändern; null ohne Angebot.' })),
}, { $id: 'KapazitaetZelle', additionalProperties: false });
export type KapazitaetZelleOut = Static<typeof KapazitaetZelle>;

export const Kapazitaet = Type.Object({
  von: Type.String(),
  bis: Type.String(),
  zellen: Type.Array(Type.Ref('KapazitaetZelle'), { description: 'Erfasstes Angebot im Zeitraum, nach Rolle und Monat; Zellen ohne Angebot fehlen.' }),
  can: Type.Object({ write: Type.Boolean() }, { description: 'Was die anfragende Person darf (Angebot pflegen).' }),
}, { $id: 'Kapazitaet', additionalProperties: false });

export const KapazitaetPut = Type.Object({
  zellen: Type.Array(Type.Object({
    rolle: Rolle,
    monat: Monat,
    // null zuerst: mit der Typumwandlung der Prüfung würde null sonst zur Zahl 0
    fte: Type.Union([Type.Null(), Type.Number({ minimum: 0, maximum: 1000, description: 'Neues Angebot in FTE (gespeichert mit zwei Nachkommastellen).' })], { description: 'null entfernt das Angebot der Zelle.' }),
    version: Type.Optional(Type.Integer({ minimum: 1, description: 'Gelesene Version der Zelle; Pflicht, wenn die Zelle schon ein Angebot hat (sonst 412).' })),
  }, { additionalProperties: false }), { minItems: 1, maxItems: 2000 }),
}, { $id: 'KapazitaetPut', additionalProperties: false });
export type KapazitaetPutIn = Static<typeof KapazitaetPut>;

export const KapazitaetGespeichert = Type.Object({
  zellen: Type.Array(Type.Ref('KapazitaetZelle'), { description: 'Die geänderten Zellen mit neuer Version (entfernte mit fte und version null).' }),
}, { $id: 'KapazitaetGespeichert', additionalProperties: false });

const Lage = Type.Union([Type.Literal('ueberbucht'), Type.Literal('ohne_angebot'), Type.Literal('ausgelastet'), Type.Literal('frei'), Type.Literal('leer')], {
  description: '`ueberbucht`: Bedarf über dem Angebot (Warnung, UC-009 A1); `ohne_angebot`: Bedarf ohne erfasstes Angebot; `ausgelastet`: Bedarf = Angebot; `frei`: Angebot über dem Bedarf (Unterauslastung); `leer`: weder Angebot noch Bedarf.',
});

export const AuslastungZelle = Type.Object({
  monat: Type.String(),
  angebot: Nullable(Type.Number({ description: 'Angebot in FTE; null ohne Erfassung.' })),
  bedarf: Type.Number({ description: 'Summe des Bedarfs in FTE der sichtbaren Projekte.' }),
  frei: Type.Number({ description: 'Angebot minus Bedarf (negativ = überbucht).' }),
  lage: Lage,
  beitraege: Type.Array(Type.Object({
    projektId: Uuid,
    phase: Type.String(),
    fte: Type.Number(),
    gedeckt: Type.Boolean(),
  }, { additionalProperties: false }), { description: 'Einzelwerte der Summe je Projekt und Phase (Bericht: jede Zahl führt zu ihren Einzelwerten).' }),
}, { $id: 'AuslastungZelle', additionalProperties: false });

export const Auslastung = Type.Object({
  von: Type.String(),
  bis: Type.String(),
  monate: Type.Array(Type.String()),
  szenario: Nullable(Type.Object({ id: Uuid, name: Type.String() }, { additionalProperties: false })),
  rollen: Type.Array(Type.Object({
    rolle: Type.String(),
    zellen: Type.Array(Type.Ref('AuslastungZelle'), { description: 'Je Monat des Zeitraums eine Zelle, in der Reihenfolge von `monate`.' }),
  }, { additionalProperties: false }), { description: 'Rollen mit Angebot oder Bedarf im Zeitraum, nach Schlüssel.' }),
  projekte: Type.Array(Type.Object({ id: Uuid, nummer: Type.String(), name: Type.String() }, { additionalProperties: false }), { description: 'Projekte der Beiträge (Nummer und Name für die Anzeige).' }),
  engpaesse: Type.Array(Type.Object({
    rolle: Type.String(),
    quartal: Type.String({ description: '«JJJJ-Qn».' }),
    monat: Type.String({ description: 'Monat mit der grössten Überbuchung im Quartal.' }),
    bedarf: Type.Number(),
    angebot: Type.Number({ description: '0 ohne erfasstes Angebot.' }),
    projekte: Type.Integer({ description: 'Anzahl betroffener Projekte in diesem Monat.' }),
  }, { additionalProperties: false }), { description: 'Engpässe je Rolle und Quartal (darstellung.md: «Kapazität Q2 2027: 7,5 FTE Projektleitung statt höchstens 5,0»), nach Quartal und Rolle.' }),
}, { $id: 'Auslastung', additionalProperties: false });
export type AuslastungOut = Static<typeof Auslastung>;
