/** Schemas für Sitzungsmodus, Entscheide, Auflagen und Protokoll (OpenAPI; BC PP.04.02, PS.02.02; UC-006 Schritte 6–9). */
import { Type, type Static, type TSchema } from '@sinclair/typebox';
import { Cursor, DateTime, Limit, NextCursor, Nullable, Uuid } from '@vollholz/platform';
import { ArtT, Datum } from './schemas.ts';

const Beschrieben = <T extends TSchema>(t: T, description: string) => Type.Union([t, Type.Null()], { description });
const enumOf = <T extends string>(values: readonly T[], description: string) => Type.Unsafe<T>({ type: 'string', enum: [...values], description });

const Schluessel = Type.String({ pattern: '^[a-z_]{1,40}$', description: 'Schlüssel des Ergebnisses aus den Optionen der Art (K3 Schritt 8).', examples: ['freigegeben'] });
const Begruendung = Type.String({ maxLength: 4000, description: 'Begründung (Pflicht, UC-006 Schritt 7); erscheint im Protokoll und beim Projekt.' });

export const Ergebnis = Type.Object({ schluessel: Type.String(), label: Type.String() }, { $id: 'EntscheidErgebnis', additionalProperties: false });

export const Auflage = Type.Object({
  id: Uuid,
  entscheidId: Uuid,
  text: Type.String(),
  verantwortlich: Type.Object({ id: Uuid, name: Nullable(Type.String()) }, { additionalProperties: false }),
  termin: Datum,
  stand: enumOf(['offen', 'erfuellt'] as const, 'Offen oder erfüllt (von der verantwortlichen Person gemeldet).'),
  erfuelltAt: Nullable(DateTime),
  can: Type.Object({ erfuellen: Type.Boolean({ description: 'Erledigt melden (verantwortliche Person, Vertretung oder sitzung:write).' }) }, { additionalProperties: false }),
}, { $id: 'Auflage', additionalProperties: false });
export type AuflageOut = Static<typeof Auflage>;

const EntscheidFelder = {
  id: Uuid,
  traktandumId: Uuid,
  sitzungId: Uuid,
  ergebnis: Type.String(),
  label: Type.String({ description: 'Bezeichnung des Ergebnisses, z. B. «Mit Auflagen freigegeben».' }),
  begruendung: Type.String(),
  stellungnahme: Type.Boolean({ description: '«via SNS-VR»: Der Entscheid des Gremiums ist eine Stellungnahme; er gilt erst mit dem SNS-VR (UC-006 A1).' }),
  anVr: Type.Boolean({ description: 'An den VR weitergeleitet: im nächsten Quartalsreporting (UC-006 A4).' }),
  sns: Beschrieben(Type.Object({ ergebnis: Type.String(), label: Type.String(), begruendung: Type.String(), erfasstAt: DateTime }, { additionalProperties: false }),
    'Entscheid des SNS-VR; null, solange ausstehend oder nicht nötig.'),
  erfasstAt: DateTime,
  erfasstVon: Nullable(Type.String()),
  auflagen: Type.Array(Type.Ref('Auflage')),
  version: Type.Integer({ minimum: 1 }),
};

export const Entscheid = Type.Object({
  ...EntscheidFelder,
  verlauf: Type.Array(Type.Object({
    version: Type.Integer(), ergebnis: Type.String(), label: Type.String(), begruendung: Type.String(), anVr: Type.Boolean(),
    snsErgebnis: Nullable(Type.String()), at: DateTime, von: Nullable(Type.String()),
  }, { additionalProperties: false }), { description: 'Erfassung und Korrekturen (A-30).' }),
  can: Type.Object({
    korrigieren: Type.Boolean({ description: 'Korrektur bis zum Schliessen der Sitzung (A-30).' }),
    snsErfassen: Type.Boolean({ description: 'Entscheid des SNS-VR nachtragen (nach dem Schliessen, A-02).' }),
  }, { additionalProperties: false }),
}, { $id: 'Entscheid', additionalProperties: false });
export type EntscheidOut = Static<typeof Entscheid>;

export const EntscheidPut = Type.Object({
  ergebnis: Schluessel,
  begruendung: Begruendung,
  anVr: Type.Optional(Type.Boolean({ description: 'An den VR weiterleiten (UC-006 A4).' })),
  auflagen: Type.Optional(Type.Array(Type.Object({
    text: Type.String({ maxLength: 1000 }),
    verantwortlich: Uuid,
    termin: Datum,
  }, { additionalProperties: false }), { maxItems: 20, description: 'Auflagen mit Text, Termin und Verantwortlichen (A3); ersetzt die bisherigen.' })),
}, { $id: 'EntscheidPut', additionalProperties: false });
export type EntscheidPutIn = Static<typeof EntscheidPut>;

export const SnsPut = Type.Object({ ergebnis: Schluessel, begruendung: Begruendung }, { $id: 'SnsEntscheidPut', additionalProperties: false });

export const Sitzungsmodus = Type.Object({
  sitzungId: Uuid,
  gremium: Type.Object({ kuerzel: Type.String(), name: Type.String() }, { additionalProperties: false }),
  datum: Datum,
  stand: enumOf(['geplant', 'in_vorbereitung', 'versendet', 'laufend', 'geschlossen', 'protokoll_versendet'] as const, 'Bearbeitungsstand der Sitzung.'),
  geschlossenAt: Nullable(DateTime),
  version: Type.Integer({ minimum: 1, description: 'Version der Sitzung (If-Match für Starten und Schliessen).' }),
  traktanden: Type.Array(Type.Object({
    traktandumId: Uuid,
    position: Nullable(Type.Integer()),
    art: ArtT,
    artLabel: Type.String(),
    titel: Type.String(),
    antrag: Type.String(),
    projekt: Nullable(Type.Object({ id: Uuid, nummer: Type.String(), name: Type.String() }, { additionalProperties: false })),
    viaSns: Type.Boolean(),
    vertraulich: Type.Boolean(),
    optionen: Type.Array(Type.Ref('EntscheidErgebnis'), { description: 'Ergebnisse der Art; leer = Kenntnisnahme ohne Entscheid.' }),
    entscheid: Nullable(Type.Ref('Entscheid')),
  }, { additionalProperties: false })),
  ohneEntscheid: Type.Integer({ description: 'Traktanden ohne Entscheid: werden beim Schliessen für die nächste Sitzung vorgeschlagen (K3 Schritt 9).' }),
  can: Type.Object({
    starten: Type.Boolean(), erfassen: Type.Boolean(), schliessen: Type.Boolean(),
  }, { additionalProperties: false, description: 'Was die Person jetzt darf (sitzung:write und Stand).' }),
}, { $id: 'Sitzungsmodus', additionalProperties: false });
export type SitzungsmodusOut = Static<typeof Sitzungsmodus>;

export const Geschlossen = Type.Object({
  nichtBehandelt: Type.Integer({ description: 'Traktanden ohne Entscheid, für die nächste Sitzung vorgeschlagen.' }),
  zurueckgestellt: Type.Integer({ description: 'Zurückgestellte Geschäfte, für eine Folgesitzung vorgeschlagen (A3).' }),
  auflagen: Type.Integer({ description: 'Auflagen, die Aufgaben im Eingang wurden.' }),
  benachrichtigt: Type.Integer({ description: 'Personen mit gebündelter Mitteilung (I-B3).' }),
  sitzung: Type.Ref('Sitzungsmodus'),
}, { $id: 'SitzungGeschlossen', additionalProperties: false });

export const EntscheidEintrag = Type.Object({
  ...EntscheidFelder,
  traktandum: Type.Object({ id: Uuid, art: ArtT, artLabel: Type.String(), titel: Type.String(), antrag: Type.String(), viaSns: Type.Boolean() }, { additionalProperties: false }),
  projekt: Nullable(Type.Object({ id: Uuid, nummer: Type.String(), name: Type.String() }, { additionalProperties: false })),
  sitzung: Type.Object({ id: Uuid, datum: Datum, gremium: Type.Object({ kuerzel: Type.String(), name: Type.String() }, { additionalProperties: false }) }, { additionalProperties: false }),
}, { $id: 'EntscheidEintrag', additionalProperties: false });
export type EntscheidEintragOut = Static<typeof EntscheidEintrag>;

export const EntscheidList = Type.Object({ items: Type.Array(Type.Ref('EntscheidEintrag')), nextCursor: NextCursor }, { $id: 'EntscheidList', additionalProperties: false });

export const EntscheidQuery = Type.Object({
  projektId: Type.Optional(Uuid),
  gremium: Type.Optional(Type.String({ pattern: '^[a-z0-9][a-z0-9-]{0,39}$', description: 'Kürzel des Gremiums.' })),
  anVr: Type.Optional(Type.Boolean({ description: 'Nur an den VR weitergeleitete (UC-006 A4) bzw. nicht weitergeleitete.' })),
  auflagen: Type.Optional(enumOf(['offen'] as const, 'Nur Entscheide mit offenen Auflagen.')),
  cursor: Type.Optional(Cursor),
  limit: Type.Optional(Limit),
}, { additionalProperties: false });

// --- Protokoll ----------------------------------------------------------------------------------------------------

const ProtokollTraktandum = Type.Object({
  traktandumId: Uuid,
  position: Nullable(Type.Integer()),
  art: ArtT,
  artLabel: Type.String(),
  titel: Type.String(),
  antrag: Type.String(),
  projekt: Nullable(Type.Object({ nummer: Type.String(), name: Type.String() }, { additionalProperties: false })),
  vertraulich: Type.Boolean(),
  viaSns: Type.Boolean(),
  behandlung: enumOf(['entschieden', 'kenntnisnahme', 'nicht_behandelt'] as const, 'Entschieden, zur Kenntnis genommen oder nicht behandelt (für die nächste Sitzung vorgeschlagen).'),
  entscheid: Nullable(Type.Object({
    ergebnis: Type.String(), label: Type.String(), begruendung: Type.String(), stellungnahme: Type.Boolean(), anVr: Type.Boolean(),
    auflagen: Type.Array(Type.Object({ text: Type.String(), verantwortlich: Nullable(Type.String()), termin: Datum }, { additionalProperties: false })),
  }, { additionalProperties: false })),
  notiz: Type.String({ description: 'Diskussion in Kürze, von der UE ergänzt.' }),
}, { additionalProperties: false });

export const Protokollfrist = Type.Object({
  bis: Beschrieben(Datum, 'Versand spätestens (Q8 Kap. 8.1, A-27); ohne Phasenmodell in Kraft null.'),
  restArbeitstage: Beschrieben(Type.Integer(), 'Arbeitstage bis zur Frist, negativ wenn überschritten.'),
  nachSitzung: Type.Integer({ description: 'Arbeitstage zwischen Sitzung und Versand bzw. heute (K3-4).' }),
  eingehalten: Type.Boolean(),
}, { $id: 'Protokollfrist', additionalProperties: false });

export const Protokoll = Type.Object({
  sitzungId: Uuid,
  stand: enumOf(['entwurf', 'versendet'] as const, 'Entwurf oder versendet.'),
  inhalt: Type.Object({
    kopf: Type.Object({
      gremium: Type.Object({ kuerzel: Type.String(), name: Type.String() }, { additionalProperties: false }), datum: Datum, beginn: Nullable(Type.String()), ort: Type.String(),
    }, { additionalProperties: false }),
    anwesende: Type.String(),
    traktanden: Type.Array(ProtokollTraktandum),
    bemerkungen: Type.String(),
  }, { additionalProperties: false }),
  frist: Type.Ref('Protokollfrist'),
  versendetAt: Nullable(DateTime),
  version: Type.Integer({ minimum: 1 }),
  updatedAt: DateTime,
  can: Type.Object({ write: Type.Boolean({ description: 'Bereinigen und versenden (sitzung:write, solange Entwurf).' }) }, { additionalProperties: false }),
}, { $id: 'Protokoll', additionalProperties: false });
export type ProtokollOut = Static<typeof Protokoll>;

export const ProtokollPut = Type.Object({
  anwesende: Type.Optional(Type.String({ maxLength: 4000 })),
  bemerkungen: Type.Optional(Type.String({ maxLength: 8000 })),
  notizen: Type.Optional(Type.Array(Type.Object({ traktandumId: Uuid, notiz: Type.String({ maxLength: 8000 }) }, { additionalProperties: false }), { maxItems: 999 })),
}, { $id: 'ProtokollPut', additionalProperties: false, minProperties: 1 });
export type ProtokollPutIn = Static<typeof ProtokollPut>;

export const Protokollversand = Type.Object({
  frist: Type.Ref('Protokollfrist'),
  beteiligte: Type.Array(Type.Object({ personId: Uuid, name: Nullable(Type.String()) }, { additionalProperties: false }),
    { description: 'Erhalten eine Mitteilung: Eingeladene, PL und SP der entschiedenen Geschäfte, Verantwortliche von Auflagen.' }),
}, { $id: 'Protokollversand', additionalProperties: false, description: 'Vorschau der Empfänger (K3 Schritt 10): Mitglieder des Gremiums (sitzung:read am Portfolio) sehen das Protokoll ab Versand, Beteiligte erhalten eine Mitteilung.' });

export const AuflageParams = Type.Object({ id: Uuid }, { additionalProperties: false });
