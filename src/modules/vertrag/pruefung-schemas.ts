/** Schemas für Quality-Check und Unterschriften (AP-E3-2; DM.02.05, DM.02.06; fachmodell.md 2.10, 5). */
import { Type, type Static } from '@sinclair/typebox';
import { DateTime, Nullable, Uuid } from '@vollholz/platform';
import { FUNKTIONEN } from './pruefung.ts';
import { STAENDE } from './store.ts';

const enumOf = <T extends string>(values: readonly T[], description: string) => Type.Unsafe<T>({ type: 'string', enum: [...values], description });
const Funktion = enumOf(FUNKTIONEN, 'Funktion der Unterschrift: Sponsor, Projektleitung, CTL (UC-002 Schritt 10).');

const Kommentar = Type.Object({
  kapitel: Type.Integer({ minimum: 1, maximum: 13, description: 'Kapitel des Projektvertrags (Q7).' }),
  text: Type.String({ minLength: 1, maxLength: 2000, pattern: '\\S', description: 'Rückmeldung zum Kapitel.' }),
}, { additionalProperties: false });

export const QualityCheckIn = Type.Object({
  ergebnis: enumOf(['bestaetigt', 'rueckmeldung'] as const, '`bestaetigt`: weiter zur Unterzeichnung (UC-002 Schritt 9). `rueckmeldung`: zurück an die Projektleitung (UC-002 A5), mindestens ein Kommentar.'),
  kommentare: Type.Optional(Type.Array(Kommentar, { maxItems: 13, description: 'Höchstens ein Kommentar je Kapitel.' })),
}, { $id: 'VertragQualityCheckIn', additionalProperties: false });
export type QualityCheckInT = Static<typeof QualityCheckIn>;

export const UnterschriftIn = Type.Object({
  ergebnis: enumOf(['unterzeichnet', 'verweigert'] as const, '`unterzeichnet` (protokollierter Klick, A-31) oder `verweigert` mit Begründung (UC-003 A5).'),
  begruendung: Type.Optional(Type.String({ maxLength: 2000, description: 'Pflicht beim Verweigern: Die Projektleitung erfährt sonst nicht, was zu ändern ist.' })),
}, { $id: 'VertragUnterschriftIn', additionalProperties: false });
export type UnterschriftInT = Static<typeof UnterschriftIn>;

const QualityCheck = Type.Object({
  id: Uuid,
  ergebnis: enumOf(['bestaetigt', 'rueckmeldung'] as const, 'Ergebnis.'),
  kommentare: Type.Array(Kommentar),
  at: DateTime,
  personId: Uuid,
}, { additionalProperties: false });

const Unterschrift = Type.Object({
  personId: Uuid,
  inVertretungVon: Nullable(Uuid),
  ergebnis: enumOf(['unterzeichnet', 'verweigert'] as const, 'Ergebnis.'),
  begruendung: Type.String(),
  at: DateTime,
}, { additionalProperties: false });

const Offen = Type.Object({ funktion: Funktion, inVertretungVon: Nullable(Uuid) }, { additionalProperties: false });

export const Pruefung = Type.Object({
  versionId: Uuid,
  nummer: Type.String(),
  stand: enumOf(STAENDE, 'Bearbeitungsstand der Version.'),
  version: Type.Integer({ minimum: 1, description: 'Version der Vertragsversion (ETag für die Übergänge).' }),
  qualityChecks: Type.Array(QualityCheck, { description: 'Quality-Checks, neueste zuerst.' }),
  unterzeichnung: Nullable(Type.Object({
    qualityCheckId: Uuid,
    anzahl: Type.Integer({ minimum: 0, description: 'Unterzeichnete Funktionen («2 von 3»).' }),
    vollstaendig: Type.Boolean(),
    funktionen: Type.Array(Type.Object({
      funktion: Funktion,
      personen: Type.Array(Uuid, { description: 'Inhaber der Funktion in der Projektorganisation.' }),
      unterschrift: Nullable(Unterschrift),
    }, { additionalProperties: false })),
  }, { additionalProperties: false, description: 'Laufender bzw. letzter Durchgang der Unterschriften nach einem bestätigten Quality-Check; null ohne Durchgang.' })),
  can: Type.Object({
    qualityCheck: Type.Boolean({ description: 'Quality-Check erfassen (in Prüfung, vertrag:review).' }),
    unterzeichnen: Type.Array(Offen, { description: 'Funktionen, die die Person jetzt unterzeichnen kann (eigene oder in Vertretung, A-31).' }),
  }, { additionalProperties: false }),
}, { $id: 'VertragPruefung', additionalProperties: false });
export type PruefungOut = Static<typeof Pruefung>;
