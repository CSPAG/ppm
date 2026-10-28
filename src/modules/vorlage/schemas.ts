/**
 * Schemas der Vorlagen (OpenAPI, Prüfung der Eingaben; AM.03.01, UC-018 Schritte 1–2, AP-E7-7).
 */
import { Type, type Static } from '@sinclair/typebox';
import { DateTime, Nullable, Uuid } from '@vollholz/platform';
import { ARTEN } from './arten.ts';

export const ArtT = Type.Union(ARTEN.map(a => Type.Literal(a)), { description: 'Dokumentart (UC-018 Schritt 1).' });
export const ArtParams = Type.Object({ art: ArtT });
export const VersionParams = Type.Object({ art: ArtT, version: Type.Integer({ minimum: 1, description: 'Version der Vorlage (fortlaufend je Art).' }) });

const Platzhalter = Type.String({ minLength: 1, maxLength: 80, description: 'Platzhalter ohne Guillemets, z. B. «Projektname» → `Projektname`.' });
const FeldSchluessel = Type.String({ minLength: 1, maxLength: 100, description: 'Schlüssel eines Datenfelds aus dem Feldkatalog der Art.' });

export const Grundbestand = Type.Object({
  version: Type.String({ description: 'Fassung des mitgelieferten Grundbestands.' }),
  quelle: Type.String(),
}, { $id: 'VorlageGrundbestand', additionalProperties: false, description: 'Mitgelieferte Vorlage; gilt ohne aktive eigene Version.' });

export const Feld = Type.Object({
  schluessel: Type.String(), bezeichnung: Type.String(), gruppe: Type.String(),
}, { $id: 'VorlageFeld', additionalProperties: false });

export const Meldung = Type.Object({
  stufe: Type.Union([Type.Literal('sperre'), Type.Literal('warnung'), Type.Literal('hinweis')]),
  regel: Type.String({ description: '`datenquelle`, `platzhalter`, `zuordnung`, `feld` oder `personendaten`.' }),
  text: Type.String(),
  platzhalter: Type.Optional(Type.Array(Type.String(), { description: 'Betroffene Platzhalter (Sprung zur Zeile).' })),
}, { $id: 'VorlageMeldung', additionalProperties: false });

export const Pruefung = Type.Object({
  aktivierbar: Type.Boolean(),
  meldungen: Type.Array(Type.Ref('VorlageMeldung')),
}, { $id: 'VorlagePruefung', additionalProperties: false });

export const VorlageVersion = Type.Object({
  id: Uuid,
  art: ArtT,
  version: Type.Integer({ minimum: 1 }),
  stand: Type.Union([Type.Literal('entwurf'), Type.Literal('aktiv'), Type.Literal('abgeloest')], { description: 'Entwurf (Zuordnung bearbeitbar), aktiv (für künftige Ausgaben), abgelöst.' }),
  dateiname: Type.String(),
  groesse: Type.Integer({ description: 'Bytes.' }),
  sha256: Type.String(),
  platzhalter: Type.Array(Type.String(), { description: 'Platzhalter der Datei in der Reihenfolge des Vorkommens.' }),
  zuordnung: Type.Record(Type.String(), Nullable(Type.String()), { description: 'Platzhalter → Datenfeld (null = offen).' }),
  personendaten: Type.Boolean({ description: 'Die Vorlage nennt «Personendaten» (G12).' }),
  bemerkung: Type.String(),
  aktivAt: Nullable(DateTime),
  erstelltAt: DateTime,
  erstelltVon: Nullable(Type.Object({ id: Uuid, name: Nullable(Type.String()) }, { additionalProperties: false })),
  rev: Type.Integer({ minimum: 1, description: 'Stand der Zeile für `If-Match`.' }),
  pruefung: Type.Ref('VorlagePruefung'),
  can: Type.Object({
    zuordnen: Type.Boolean({ description: 'Zuordnung ändern (nur Entwurf).' }),
    aktivieren: Type.Boolean({ description: 'Aktiv setzen (Entwurf ohne Sperre).' }),
    entfernen: Type.Boolean({ description: 'Entwurf löschen.' }),
  }, { additionalProperties: false }),
}, { $id: 'VorlageVersion', additionalProperties: false });
export type VorlageVersionOut = Static<typeof VorlageVersion>;

export const VorlageArt = Type.Object({
  art: ArtT,
  name: Type.String(),
  grundbestand: Nullable(Type.Ref('VorlageGrundbestand')),
  aktiv: Nullable(Type.Integer({ description: 'Aktive eigene Version; null = Grundbestand bzw. keine Vorlage.' })),
  entwuerfe: Type.Integer({ minimum: 0 }),
  versionen: Type.Integer({ minimum: 0 }),
  datenquelle: Type.Boolean({ description: 'Ein Modul liefert Daten für diese Art (Feldkatalog registriert); sonst nur als Zuordnungsziel vorbereitet.' }),
}, { $id: 'VorlageArt', additionalProperties: false });

export const VorlageList = Type.Object({ items: Type.Array(Type.Ref('VorlageArt')) }, { $id: 'VorlageList', additionalProperties: false });

export const VorlageDetail = Type.Object({
  art: ArtT,
  name: Type.String(),
  grundbestand: Nullable(Type.Ref('VorlageGrundbestand')),
  felder: Nullable(Type.Array(Type.Ref('VorlageFeld'), { description: 'Feldkatalog; null = kein Modul liefert Daten.' })),
  versionen: Type.Array(Type.Ref('VorlageVersion'), { description: 'Neueste zuerst.' }),
}, { $id: 'VorlageDetail', additionalProperties: false });

export const VersionCreate = Type.Object({
  dateiname: Type.String({ minLength: 1, maxLength: 200, pattern: '\\.docx$', description: 'Name der Word-Datei (.docx).' }),
  inhalt: Type.String({ minLength: 4, maxLength: 7_000_000, contentEncoding: 'base64', description: 'Datei als Base64, höchstens 5 MB.' }),
  bemerkung: Type.Optional(Type.String({ maxLength: 1000, description: 'Was sich gegenüber der letzten Version ändert.' })),
}, { $id: 'VorlageVersionCreate', additionalProperties: false });
export type VersionCreateIn = Static<typeof VersionCreate>;

export const VersionPatch = Type.Object({
  zuordnung: Type.Optional(Type.Record(Platzhalter, Nullable(FeldSchluessel), { description: 'Ganze Zuordnung: Platzhalter → Feld oder null.' })),
  bemerkung: Type.Optional(Type.String({ maxLength: 1000 })),
}, { $id: 'VorlageVersionPatch', additionalProperties: false, minProperties: 1 });
export type VersionPatchIn = Static<typeof VersionPatch>;
