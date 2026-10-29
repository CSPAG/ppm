/** Schemas der Sitzungsvorbereitung (OpenAPI, Prüfung der Eingaben; BC PP.04.01, PP.04.05; UC-006 Schritte 1–5). */
import { Type, type Static, type TSchema } from '@sinclair/typebox';
import { Cursor, DateTime, Limit, NextCursor, Nullable, Uuid } from '@vollholz/platform';
import { ARTEN } from './arten.ts';

/** Nullable mit Beschreibung */
const Beschrieben = <T extends TSchema>(t: T, description: string) => Type.Union([t, Type.Null()], { description });
const enumOf = <T extends string>(values: readonly T[], description: string) => Type.Unsafe<T>({ type: 'string', enum: [...values], description });

export const Datum = Type.String({ pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$', description: 'Datum (JJJJ-MM-TT).', examples: ['2026-11-12'] });
const Zeit = Type.String({ pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$', description: 'Uhrzeit (HH:MM).', examples: ['14:00'] });
export const ArtT = enumOf(ARTEN, 'Art des Traktandums (fachmodell.md 2.9).');
const SitzungStandT = enumOf(['geplant', 'in_vorbereitung', 'versendet', 'laufend', 'geschlossen', 'protokoll_versendet'] as const,
  'Bearbeitungsstand: geplant, in Vorbereitung, Unterlagen versendet, laufend, geschlossen, Protokoll versendet.');
const TraktandumStandT = enumOf(['vorgeschlagen', 'traktandiert', 'verschoben', 'entschieden'] as const, 'Stand des Traktandums.');
const UnterlagenStandT = enumOf(['bereit', 'quality_check_offen', 'fehlt', 'keine'] as const,
  'Stand der Unterlagen (UC-006 Schritt 3): bereit, Quality-Check offen, Unterlagen fehlen, keine Unterlagen nötig.');
const FunktionT = enumOf(['sp', 'pl', 'weitere'] as const, 'Funktion im Projekt: `sp` Projektauftraggeber:in, `pl` Projektleitung oder `weitere` Person.');

const SitzungCan = Type.Object({ write: Type.Boolean({ description: 'Traktandenliste bearbeiten und versenden (sitzung:write, nur bis zum Versand).' }) },
  { description: 'Was die anfragende Person damit darf.' });

export const Versandfrist = Type.Object({
  bis: Beschrieben(Datum, 'Versand spätestens (Q8 Kap. 8.1); ohne Phasenmodell in Kraft null.'),
  arbeitstage: Beschrieben(Type.Integer(), 'Verlangte Arbeitstage zwischen Versand und Sitzung.'),
  restArbeitstage: Beschrieben(Type.Integer(), 'Arbeitstage bis zur Frist, negativ wenn überschritten.'),
  vorlauf: Type.Integer({ description: 'Arbeitstage zwischen heute bzw. dem Versand und der Sitzung (K3-1).' }),
  eingehalten: Type.Boolean(),
}, { $id: 'Versandfrist', additionalProperties: false });

export const Unterlage = Type.Object({
  art: enumOf(['packet', 'bericht', 'beilage'] as const, 'Gate Review Packet, Bericht oder Beilage.'),
  titel: Type.String(),
  bereit: Type.Boolean(),
  hinweis: Type.Optional(Type.String()),
  qualityCheck: Type.Optional(enumOf(['bestanden', 'offen'] as const, 'Quality-Check der Unterlage.')),
}, { $id: 'Unterlage', additionalProperties: false });

export const Einladung = Type.Object({
  personId: Uuid,
  name: Nullable(Type.String()),
  funktion: FunktionT,
}, { $id: 'Einladung', additionalProperties: false });

export const Traktandum = Type.Object({
  id: Uuid,
  sitzungId: Nullable(Uuid),
  art: ArtT,
  artLabel: Type.String({ description: 'Bezeichnung der Art, z. B. «Gate-Review».' }),
  bezug: Type.Object({ typ: Type.String(), id: Type.String() }, { additionalProperties: false, description: 'Fachlicher Bezug des Geschäfts.' }),
  projekt: Nullable(Type.Object({ id: Uuid, nummer: Type.String(), name: Type.String(), phase: Type.String() }, { additionalProperties: false })),
  titel: Type.String(),
  antrag: Type.String({ description: 'Antrag in einem Satz (K3 Schritt 6).' }),
  position: Nullable(Type.Integer()),
  dauerMin: Nullable(Type.Integer({ description: 'Zeitbedarf in Minuten.' })),
  zeit: Beschrieben(Zeit, 'Beginn des Traktandums, gerechnet ab Beginn der Sitzung.'),
  stand: TraktandumStandT,
  viaSns: Type.Boolean({ description: '«via SNS-VR»: Der Entscheid des Gremiums ist eine Stellungnahme (UC-006 A1).' }),
  vertraulich: Type.Boolean(),
  fest: Type.Boolean({ description: 'Festes Traktandum 1 «Bericht der Programmleitung» (K3 Schritt 4): weder entfernen noch verschieben, bleibt an Position 1.' }),
  verschobenVon: Beschrieben(Datum, 'Datum der Sitzung, von der das Traktandum verschoben wurde (UC-006 A2).'),
  unterlagen: Type.Object({ stand: UnterlagenStandT, liste: Type.Array(Type.Ref('Unterlage')) }, { additionalProperties: false }),
  vermerke: Type.Array(Type.Object({ art: Type.String(), text: Type.String() }, { additionalProperties: false }),
    { description: 'Offene Vermerke (A-74): «Unterlagen fehlen», «Quality-Check offen»; das Traktandum bleibt stehen (UC-006 A2.2).' }),
  einladungen: Type.Array(Type.Ref('Einladung')),
  version: Type.Integer({ minimum: 1 }),
}, { $id: 'Traktandum', additionalProperties: false });
export type TraktandumOut = Static<typeof Traktandum>;

const GremiumKurz = Type.Object({ id: Uuid, kuerzel: Type.String(), name: Type.String() }, { additionalProperties: false });

export const Sitzung = Type.Object({
  id: Uuid,
  gremium: GremiumKurz,
  portfolioId: Uuid,
  datum: Datum,
  beginn: Nullable(Zeit),
  dauerMin: Nullable(Type.Integer({ description: 'Sitzungsdauer in Minuten.' })),
  ort: Type.String(),
  stand: SitzungStandT,
  versendetAt: Nullable(DateTime),
  versandVorlauf: Nullable(Type.Integer({ description: 'Arbeitstage zwischen Versand und Sitzung (Versandprotokoll, K3-1).' })),
  frist: Type.Ref('Versandfrist'),
  zeitbedarfMin: Type.Integer({ description: 'Summe des Zeitbedarfs der Traktanden.' }),
  traktanden: Type.Array(Type.Ref('Traktandum')),
  version: Type.Integer({ minimum: 1 }),
  createdAt: DateTime,
  updatedAt: DateTime,
  can: SitzungCan,
}, { $id: 'Sitzung', additionalProperties: false });
export type SitzungOut = Static<typeof Sitzung>;

export const SitzungPatch = Type.Object({
  beginn: Type.Optional(Nullable(Zeit)),
  dauerMin: Type.Optional(Nullable(Type.Integer({ minimum: 15, maximum: 720 }))),
  ort: Type.Optional(Type.String({ maxLength: 200 })),
}, { $id: 'SitzungPatch', additionalProperties: false, minProperties: 1 });
export type SitzungPatchIn = Static<typeof SitzungPatch>;

export const SitzungEintrag = Type.Object({
  datum: Datum,
  id: Beschrieben(Uuid, 'Sitzung; null, solange zum Termin noch keine Sitzung besteht.'),
  stand: SitzungStandT,
  traktanden: Type.Integer(),
  versendetAt: Nullable(DateTime),
}, { $id: 'SitzungEintrag', additionalProperties: false });

export const SitzungList = Type.Object({
  gremium: GremiumKurz,
  items: Type.Array(Type.Ref('SitzungEintrag')),
  nextCursor: NextCursor,
  can: SitzungCan,
}, { $id: 'SitzungList', additionalProperties: false });

export const SitzungCreate = Type.Object({ datum: Datum }, { $id: 'SitzungCreate', additionalProperties: false });

export const SitzungenQuery = Type.Object({
  von: Type.Optional(Datum),
  bis: Type.Optional(Datum),
  cursor: Type.Optional(Cursor),
  limit: Type.Optional(Limit),
}, { additionalProperties: false });

export const KuerzelParams = Type.Object({ kuerzel: Type.String({ pattern: '^[a-z0-9][a-z0-9-]{0,39}$' }) }, { additionalProperties: false });
export const KuerzelDatumParams = Type.Object({ kuerzel: Type.String({ pattern: '^[a-z0-9][a-z0-9-]{0,39}$' }), datum: Datum }, { additionalProperties: false });

export const Vorschlaege = Type.Object({
  gruppen: Type.Array(Type.Object({
    art: ArtT,
    label: Type.String(),
    traktanden: Type.Array(Type.Ref('Traktandum')),
  }, { additionalProperties: false }), { description: 'Vorschläge je Art in der Reihenfolge von K3 Schritt 1; verschobene Traktanden der letzten Sitzung zuerst in ihrer Art.' }),
}, { $id: 'Vorschlaege', additionalProperties: false });

export const TraktandumCreate = Type.Union([
  Type.Object({ vorschlagId: Uuid }, { additionalProperties: false, description: 'Vorschlag aufnehmen (UC-006 Schritt 2).' }),
  Type.Object({
    art: ArtT,
    projektId: Type.Optional(Nullable(Uuid)),
    titel: Type.Optional(Type.String({ minLength: 1, maxLength: 300, pattern: '\\S' })),
    antrag: Type.Optional(Type.String({ maxLength: 1000 })),
  }, { additionalProperties: false, description: 'Geschäft einplanen (PP.04.05), z. B. das Gate-Review eines Projekts.' }),
], { $id: 'TraktandumCreate' });
export type TraktandumCreateIn = Static<typeof TraktandumCreate>;

export const Reihenfolge = Type.Object({
  reihenfolge: Type.Array(Uuid, { minItems: 1, maxItems: 999, description: 'Alle Traktanden der Sitzung in der neuen Reihenfolge.' }),
}, { $id: 'Reihenfolge', additionalProperties: false });

export const TraktandumPatch = Type.Object({
  titel: Type.Optional(Type.String({ minLength: 1, maxLength: 300, pattern: '\\S' })),
  antrag: Type.Optional(Type.String({ maxLength: 1000 })),
  dauerMin: Type.Optional(Nullable(Type.Integer({ minimum: 1, maximum: 480 }))),
}, { $id: 'TraktandumPatch', additionalProperties: false, minProperties: 1 });
export type TraktandumPatchIn = Static<typeof TraktandumPatch>;

export const EinladungenPut = Type.Object({
  einladungen: Type.Array(Type.Object({ personId: Uuid, funktion: FunktionT }, { additionalProperties: false }), { maxItems: 50 }),
}, { $id: 'EinladungenPut', additionalProperties: false });
export type EinladungenPutIn = Static<typeof EinladungenPut>;

export const Verschoben = Type.Object({
  traktandum: Type.Ref('Traktandum'),
  nach: Type.Object({ id: Uuid, datum: Datum }, { additionalProperties: false, description: 'Sitzung, auf die das Traktandum verschoben wurde.' }),
}, { $id: 'Verschoben', additionalProperties: false });

export const Versandvorschau = Type.Object({
  frist: Type.Ref('Versandfrist'),
  traktanden: Type.Integer(),
  unterlagen: Type.Object({ packet: Type.Integer(), bericht: Type.Integer(), beilage: Type.Integer() }, { additionalProperties: false }),
  eingeladene: Type.Integer({ description: 'Eingeladene Personen (je Person einmal).' }),
  warnungen: Type.Array(Type.Object({ traktandumId: Uuid, titel: Type.String(), stand: UnterlagenStandT }, { additionalProperties: false })),
  verschoben: Type.Integer({ description: 'Verschobene Traktanden, deren PL und SP informiert werden.' }),
}, { $id: 'Versandvorschau', additionalProperties: false, description: 'Wirkung des Versands (I-R1 Stufe 3): Empfänger sind die Mitglieder des Gremiums (Recht sitzung:read am Portfolio) und die Eingeladenen.' });

export const Kopf = Type.Object({
  sitzungen: Type.Array(Type.Object({
    id: Uuid, gremium: GremiumKurz, datum: Datum, stand: SitzungStandT, traktanden: Type.Integer(), versandBis: Nullable(Datum),
    // Kopfkarte im Eingang (informationsarchitektur.md «Startseite je Rolle»: «4 von 6 Traktanden mit Unterlagen»)
    unterlagenBereit: Type.Integer({ description: 'Traktanden mit vollständigen Unterlagen (oder ohne nötige Unterlagen), Stand wie in der Traktandenliste.' }),
  }, { additionalProperties: false })),
}, { $id: 'SitzungKopf', additionalProperties: false });

/** Nächstes Traktandum je Projekt für die Kopfkarte «Meine Projekte» (informationsarchitektur.md «Startseite je Rolle»). */
export const NaechsteQuery = Type.Object({
  projektId: Type.Array(Uuid, { minItems: 1, maxItems: 20, description: 'Projekte (mehrfach, höchstens 20).' }),
}, { additionalProperties: false });

export const NaechsteTraktanden = Type.Object({
  items: Type.Array(Type.Object({
    projektId: Uuid, traktandumId: Uuid, art: ArtT, artLabel: Type.String(), titel: Type.String(),
    eingeladen: Type.Boolean({ description: 'Die anfragende Person ist zu diesem Traktandum eingeladen (stellt vor, K3 Schritt 2).' }),
    sitzung: Type.Object({ id: Uuid, datum: Datum, gremium: GremiumKurz }, { additionalProperties: false }),
  }, { additionalProperties: false })),
}, { $id: 'NaechsteTraktanden', additionalProperties: false, description: 'Je Projekt das nächste traktandierte Geschäft in einer Sitzung ab heute («Gate P1–P2 im PRAT Mi 10.12.»).' });

export const TraktandumParams = Type.Object({ id: Uuid }, { additionalProperties: false });
