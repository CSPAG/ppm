/** Schemas des Änderungsantrags (AP-E3-4; fachmodell.md 5: `POST …/aenderung/entscheiden`; UC-007). */
import { Type, type Static } from '@sinclair/typebox';
import { DateTime, Nullable, Uuid } from '@vollholz/platform';
import { DIMENSIONEN, ENTSCHEIDE } from './aenderung.ts';
import { STAENDE } from './store.ts';

const enumOf = <T extends string>(values: readonly T[], description: string) => Type.Unsafe<T>({ type: 'string', enum: [...values], description });
const Entscheid = enumOf(ENTSCHEIDE, 'Entscheid des Sponsors: freigeben (Schritt 4), ablehnen (A2) oder Antrag an den PRAT unterstützen (A1).');

export const Aenderung = Type.Object({
  versionId: Uuid,
  projektId: Uuid,
  nummer: Type.String(),
  basisVersionId: Nullable(Uuid),
  basisNummer: Nullable(Type.String({ description: 'Nummer der Baseline, aus der der Antrag entstand.' })),
  stand: enumOf(STAENDE, 'Bearbeitungsstand; «in_pruefung» heisst hier: beim Sponsor zum Entscheid.'),
  begruendung: Type.String({ description: 'Begründung der Projektleitung (UC-007 Schritt 2).' }),
  eingereichtAt: Nullable(DateTime),
  wirkung: Type.Object({
    prat: Type.Boolean({ description: 'Freigabe durch den PRAT nötig (UC-007 A1): ein geändertes Kapitel wirkt auf Scope, Budget oder Ressourcen.' }),
    dimensionen: Type.Array(enumOf(DIMENSIONEN, 'Dimension nach der Kapitelwirkung im Phasenmodell.')),
    kapitel: Type.Array(Type.Integer({ minimum: 1, maximum: 13 }), { description: 'Geänderte Kapitel mit dieser Wirkung.' }),
    hinweis: Nullable(Type.String({ description: 'Hinweis für den Sponsor (K2 Regel «Änderung an Scope, Budget oder Ressourcen»).' })),
  }, { additionalProperties: false }),
  entscheid: Nullable(Type.Object({
    ergebnis: Entscheid,
    begruendung: Type.String(),
    at: DateTime,
    personId: Nullable(Uuid),
  }, { additionalProperties: false })),
  version: Type.Integer({ minimum: 1, description: 'Version der Vertragsversion (ETag).' }),
  can: Type.Object({
    einreichen: Type.Boolean({ description: '«Änderung einreichen» (Entwurf in Arbeit, vertrag:write).' }),
    freigeben: Type.Boolean({ description: '«Änderung freigeben» (eingereicht, vertrag:decide, ohne Wirkung auf Scope, Budget, Ressourcen).' }),
    ablehnen: Type.Boolean({ description: '«Ablehnen» mit Begründung (eingereicht, vertrag:decide).' }),
    anPrat: Type.Boolean({ description: '«Antrag an den PRAT unterstützen» (eingereicht, vertrag:decide, mit Wirkung).' }),
  }, { additionalProperties: false }),
}, { $id: 'VertragAenderung', additionalProperties: false });
export type AenderungOut = Static<typeof Aenderung>;

export const AenderungEntscheid = Type.Object({
  ergebnis: Entscheid,
  begruendung: Type.Optional(Type.String({ maxLength: 5000, description: 'Begründung (Pflicht beim Ablehnen, UC-007 A2).' })),
}, { $id: 'VertragAenderungEntscheid', additionalProperties: false });
export type AenderungEntscheidIn = { ergebnis: (typeof ENTSCHEIDE)[number]; begruendung?: string };
