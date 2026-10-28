/** Schemas der Schnittstellen und des Änderungsprotokolls (OpenAPI, Prüfung der Eingaben); BC AM.03.02, AM.03.03, UC-018. */
import { Type } from '@sinclair/typebox';
import { Cursor, DateTime, Limit, NextCursor, Nullable, Uuid } from '@vollholz/platform';

const Schluessel = Type.String({ pattern: '^[a-z][a-z0-9_]{0,39}$' });
const RichtungT = Type.Unsafe<'eingehend' | 'ausgehend'>({ type: 'string', enum: ['eingehend', 'ausgehend'], description: '`eingehend`: Daten vom Umsystem abholen; `ausgehend`: an das Umsystem liefern.' });
const RhythmusT = Type.Unsafe<'manuell' | 'taeglich' | 'woechentlich' | 'monatlich'>({
  type: 'string', enum: ['manuell', 'taeglich', 'woechentlich', 'monatlich'],
  description: 'Geplanter Lauf einmal je Tag, Woche bzw. Monat (Europe/Zurich); `manuell`: nur von Hand.',
});
const Adresse = Type.String({ format: 'uri', pattern: '^https?://', maxLength: 2000, description: 'Adresse des Umsystems (HTTPS; Abruf mit SSRF-Schutz).' });

export const Katalogeintrag = Type.Object({
  umsystem: Type.String(),
  umsystemLabel: Type.String(),
  daten: Type.String(),
  datenLabel: Type.String(),
  richtung: RichtungT,
  quelle: Type.String({ description: 'Herkunft im Bauplan (Annahme, Klärung, BC).' }),
  verfuegbar: Type.Boolean({ description: 'Verarbeitung der Daten vorhanden; sonst schlägt ein Lauf mit «noch nicht verfügbar» fehl (der Testlauf prüft nur die Verbindung).' }),
}, { $id: 'SchnittstelleKatalogeintrag', additionalProperties: false });

export const Lauf = Type.Object({
  id: Uuid,
  schnittstelleId: Uuid,
  art: Type.Unsafe<'test' | 'geplant' | 'manuell'>({ type: 'string', enum: ['test', 'geplant', 'manuell'], description: '`test`: beim Einrichten (nur Verbindung); `geplant`: nach Rhythmus; `manuell`: von Hand gestartet.' }),
  stand: Type.Unsafe<'laeuft' | 'erfolgreich' | 'fehlgeschlagen'>({ type: 'string', enum: ['laeuft', 'erfolgreich', 'fehlgeschlagen'] }),
  start: DateTime,
  ende: Nullable(DateTime),
  umfang: Nullable(Type.Integer({ minimum: 0, description: 'Übertragene Datensätze.' })),
  fehler: Nullable(Type.String()),
  gestartetVon: Nullable(Type.Object({ id: Uuid, name: Nullable(Type.String()) }, { additionalProperties: false, description: 'Person; null bei geplanten Läufen.' })),
}, { $id: 'SchnittstelleLauf', additionalProperties: false });

export const Schnittstelle = Type.Object({
  id: Uuid,
  umsystem: Type.String(),
  daten: Type.String(),
  name: Type.String({ description: 'Umsystem und Daten, z. B. «ERP · Ist-Kosten je Kostenträger und Monat».' }),
  richtung: RichtungT,
  rhythmus: RhythmusT,
  adresse: Type.String(),
  aktiv: Type.Boolean(),
  verfuegbar: Type.Boolean({ description: 'Verarbeitung der Daten vorhanden.' }),
  letzterLauf: Nullable(Type.Ref('SchnittstelleLauf')),
  version: Type.Integer({ minimum: 1 }),
  updatedAt: DateTime,
}, { $id: 'Schnittstelle', additionalProperties: false });

export const SchnittstelleList = Type.Object({
  items: Type.Array(Type.Ref('Schnittstelle')),
  katalog: Type.Array(Type.Ref('SchnittstelleKatalogeintrag'), { description: 'Umsysteme und Daten, die sich einrichten lassen.' }),
}, { $id: 'SchnittstelleList', additionalProperties: false });

export const SchnittstelleErgebnis = Type.Object({
  schnittstelle: Type.Ref('Schnittstelle'),
  // Testlauf nach Einrichten oder neuer Adresse (nur aktive Schnittstellen)
  testlauf: Nullable(Type.Ref('SchnittstelleLauf')),
}, { $id: 'SchnittstelleErgebnis', additionalProperties: false });

export const SchnittstelleCreate = Type.Object({
  umsystem: Schluessel,
  daten: Schluessel,
  rhythmus: RhythmusT,
  adresse: Adresse,
  aktiv: Type.Optional(Type.Boolean({ default: true })),
}, { $id: 'SchnittstelleCreate', additionalProperties: false });

export const SchnittstellePatch = Type.Object({
  rhythmus: Type.Optional(RhythmusT),
  adresse: Type.Optional(Adresse),
  aktiv: Type.Optional(Type.Boolean()),
}, { $id: 'SchnittstellePatch', additionalProperties: false, minProperties: 1 });

export const LaufList = Type.Object({ items: Type.Array(Type.Ref('SchnittstelleLauf')), nextCursor: NextCursor }, { $id: 'SchnittstelleLaufList', additionalProperties: false });
export const LaufQuery = Type.Object({ cursor: Type.Optional(Cursor), limit: Type.Optional(Limit) }, { additionalProperties: false });

export const ProtokollEintrag = Type.Object({
  id: Type.String({ description: 'Folge im Audit (aufsteigend).' }),
  zeit: DateTime,
  person: Nullable(Type.Object({
    id: Nullable(Uuid), name: Nullable(Type.String()), art: Type.String({ description: '`user` oder `client` (Maschinen-Client).' }),
  }, { additionalProperties: false })),
  quelle: Type.String({ description: '`ui`, `api`, `mcp`, `worker`, `webhook` oder `system`.' }),
  aktion: Type.String({ description: 'Aktion im Audit, z. B. `org_einheit.updated`.' }),
  art: Type.Unsafe<'angelegt' | 'geaendert' | 'geloescht' | 'sonstig'>({ type: 'string', enum: ['angelegt', 'geaendert', 'geloescht', 'sonstig'] }),
  objekt: Type.Object({ typ: Nullable(Type.String()), id: Nullable(Uuid) }, { additionalProperties: false }),
  aenderungen: Type.Array(Type.Object({
    feld: Type.String(), vorher: Type.Unknown(), nachher: Type.Unknown(),
  }, { additionalProperties: false }), { description: 'Alter und neuer Wert je Feld (beim Anlegen nur neu, beim Löschen nur alt).' }),
}, { $id: 'AenderungsprotokollEintrag', additionalProperties: false });

export const ProtokollList = Type.Object({ items: Type.Array(Type.Ref('AenderungsprotokollEintrag')), nextCursor: NextCursor }, { $id: 'AenderungsprotokollList', additionalProperties: false });
export const ProtokollObjekte = Type.Object({ items: Type.Array(Type.String()) }, { $id: 'AenderungsprotokollObjekte', additionalProperties: false });

const Datum = Type.String({ format: 'date' });
export const ProtokollQuery = Type.Object({
  objekt: Type.Optional(Type.String({ pattern: '^[a-z][a-z0-9_.-]{0,79}$', description: 'Objekttyp, z. B. `projekt`.' })),
  objektId: Type.Optional(Uuid),
  von: Type.Optional(Datum),
  bis: Type.Optional(Datum),
  cursor: Type.Optional(Cursor),
  limit: Type.Optional(Limit),
  format: Type.Optional(Type.Literal('csv', { description: 'Export als CSV: alle Einträge zum Filter, eine Zeile je geändertes Feld.' })),
}, { additionalProperties: false });
