/** Schemas für Versionsvergleich und Hauptänderungen (AP-E3-4; fachmodell.md 5: `GET …/vergleich?mit=`, `GET …/hauptaenderungen`). */
import { Type, type Static } from '@sinclair/typebox';
import { Nullable, Uuid } from '@vollholz/platform';
import { RUBRIKEN } from './vergleich.ts';

const enumOf = <T extends string>(values: readonly T[], description: string) => Type.Unsafe<T>({ type: 'string', enum: [...values], description });

export const Unterschied = Type.Object({
  feld: Type.String({ description: 'Feld im Kapitel (z. B. `kosten`, `termine.projektabschluss`).' }),
  label: Type.String({ description: 'Bezeichnung des Felds bzw. der Liste.' }),
  eintrag: Nullable(Type.String({ description: 'Listeneintrag (Bezeichnung); null bei einem Feld des Kapitels.' })),
  eintragFeld: Nullable(Type.String({ description: 'Geändertes Feld im Listeneintrag (z. B. `termin`).' })),
  art: enumOf(['neu', 'entfernt', 'geaendert'] as const, 'Kennzeichnung zusätzlich zur Farbe (Q-B5).'),
  alt: Type.Unknown({ description: 'Wert in der verglichenen (älteren) Version; bei «neu» null.' }),
  neu: Type.Unknown({ description: 'Wert in dieser Version; bei «entfernt» null.' }),
  differenz: Nullable(Type.Number({ description: 'neu − alt bei Zahlen (Beträge, FTE).' })),
}, { $id: 'VertragUnterschied', additionalProperties: false });

export const Vergleich = Type.Object({
  versionId: Uuid,
  nummer: Type.String(),
  mitVersionId: Uuid,
  mitNummer: Type.String(),
  betraege: Type.Boolean({ description: 'Beträge verglichen (Recht auf Beträge, A-33); sonst ohne Beträge.' }),
  kapitel: Type.Array(Type.Object({
    kapitel: Type.Integer({ minimum: 1, maximum: 13 }),
    titel: Type.String(),
    geaendert: Type.Boolean(),
    unterschiede: Type.Array(Type.Ref('VertragUnterschied')),
  }, { additionalProperties: false })),
}, { $id: 'VertragVergleich', additionalProperties: false });

export const VergleichQuery = Type.Object({
  mit: Type.Optional({ ...Uuid, description: 'Version zum Vergleich (Standard: Basisversion, aus der der Entwurf entstand).' }),
}, { additionalProperties: false });

const Rubrik = enumOf(RUBRIKEN, 'Rubrik der Hauptänderungen (Q7 Kopf).');

export const Hauptaenderungen = Type.Object({
  versionId: Uuid,
  basisVersionId: Nullable(Uuid),
  rubriken: Type.Array(Type.Object({
    rubrik: Rubrik,
    label: Type.String(),
    erzeugt: Type.Array(Type.String(), { description: 'Vom System aus dem Vergleich zur Basis erzeugte Sätze.' }),
    text: Nullable(Type.String({ description: 'Umformulierung der Projektleitung; ersetzt die erzeugten Sätze in der Anzeige.' })),
  }, { additionalProperties: false })),
  andere: Type.String({ description: 'Weitere Hauptänderungen («Andere»), von der Projektleitung erfasst.' }),
  version: Type.Integer({ minimum: 1, description: 'Version der Vertragsversion (ETag).' }),
  can: Type.Object({ write: Type.Boolean({ description: 'Umformulieren (Entwurf in Arbeit, vertrag:write).' }) }),
}, { $id: 'VertragHauptaenderungen', additionalProperties: false });
export type HauptaenderungenOut = Static<typeof Hauptaenderungen>;

const Text = Nullable(Type.String({ maxLength: 5000 }));
export const HauptaenderungenPut = Type.Object({
  rubriken: Type.Object(Object.fromEntries(RUBRIKEN.map(r => [r, Type.Optional(Text)])), {
    additionalProperties: false, description: 'Umformulierung je Rubrik; null oder leer übernimmt wieder die erzeugten Sätze.',
  }),
  andere: Type.String({ maxLength: 5000 }),
}, { $id: 'VertragHauptaenderungenPut', additionalProperties: false });
export type HauptaenderungenPutIn = { rubriken: Partial<Record<(typeof RUBRIKEN)[number], string | null>>; andere: string };
