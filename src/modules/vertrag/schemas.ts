/**
 * Schemas der API des Projektvertrags (OpenAPI, Prüfung der Eingaben); docs/fachmodell.md 2.10 und 5. Die Inhalte der
 * Kapitel stehen in `kapitel.ts` (Komponenten `Kapitel1` … `Kapitel13`); die Route prüft den Inhalt gegen das Schema
 * des Kapitels.
 */
import { Type, type Static } from '@sinclair/typebox';
import { DateTime, Nullable, Uuid } from '@vollholz/platform';
import { PHASEN } from './kapitel.ts';
import { ANLAESSE, STAENDE } from './store.ts';

const enumOf = <T extends string>(values: readonly T[], description: string) => Type.Unsafe<T>({ type: 'string', enum: [...values], description });

const Stand = enumOf(STAENDE, 'Bearbeitungsstand (fachmodell.md 2.10).');
const Anlass = enumOf(ANLAESSE, 'Anlass: erster Vertrag (UC-002), Gate (UC-003) oder Änderung (UC-007).');
const PhaseT = enumOf(PHASEN, 'Phase.');

export const VertragVersion = Type.Object({
  id: Uuid,
  projektId: Uuid,
  nummer: Type.String({ description: 'Versionsnummer («0.1», «1.0», «1.1»).' }),
  anlass: Anlass,
  zielphase: { ...PhaseT, description: 'Phase, für die der Vertrag gilt.' },
  stand: Stand,
  baseline: Type.Boolean({ description: 'Verbindliche, abgenommene Version.' }),
  baselineAt: Nullable(DateTime),
  basisVersionId: Nullable({ ...Uuid, description: 'Version, aus der der Entwurf entstand (Baseline).' }),
  begruendung: Type.String({ description: 'Begründung einer Änderung (UC-007 Schritt 2).' }),
  eingereichtAt: Nullable(DateTime),
  version: Type.Integer({ minimum: 1 }),
  createdAt: DateTime,
  updatedAt: DateTime,
  can: Type.Object({
    write: Type.Boolean({ description: 'Kapitel bearbeiten (Entwurf in Arbeit, vertrag:write).' }),
    einreichen: Type.Boolean({ description: 'Zur Prüfung einreichen (Entwurf in Arbeit, vertrag:write); Pflichtangaben prüft die Route.' }),
  }),
}, { $id: 'VertragVersion', additionalProperties: false });
export type VertragVersionOut = Static<typeof VertragVersion>;

export const KapitelKopf = Type.Object({
  kapitel: Type.Integer({ minimum: 1, maximum: 13 }),
  titel: Type.String(),
  geaendert: Type.Boolean({ description: 'Geändert gegenüber der Basisversion (Punkt in der Kapitelnavigation, K2 Schritt 2).' }),
  fehlend: Type.Integer({ minimum: 0, description: 'Fehlende Pflichtangaben der Zielphase in diesem Kapitel (Symbol «Angaben fehlen»).' }),
  version: Type.Integer({ minimum: 1 }),
  updatedAt: DateTime,
}, { $id: 'VertragKapitelKopf', additionalProperties: false });

export const VertragVersionDetail = Type.Object({
  version: Type.Ref('VertragVersion'),
  kapitel: Type.Array(Type.Ref('VertragKapitelKopf')),
}, { $id: 'VertragVersionDetail', additionalProperties: false });

export const Vertrag = Type.Object({
  projektId: Uuid,
  versionen: Type.Array(Type.Ref('VertragVersion'), { description: 'Alle Versionen, neueste zuerst.' }),
  entwurf: Nullable({ ...Uuid, description: 'Entwurf (höchstens einer, UX-E5).' }),
  baseline: Nullable({ ...Uuid, description: 'Baseline (verbindliche Version).' }),
  can: Type.Object({
    entwerfen: Type.Array(Anlass, { description: 'Anlässe, für die die Person jetzt einen Entwurf anlegen kann.' }),
  }),
}, { $id: 'Vertrag', additionalProperties: false });

export const EntwurfCreate = Type.Object({
  anlass: Anlass,
  begruendung: Type.Optional(Type.String({ maxLength: 5000, description: 'Begründung (Pflicht bei einer Änderung, UC-007 Schritt 2).' })),
}, { $id: 'VertragEntwurfCreate', additionalProperties: false });
export type EntwurfCreateIn = Static<typeof EntwurfCreate>;

export const Kapitel = Type.Object({
  versionId: Uuid,
  kapitel: Type.Integer({ minimum: 1, maximum: 13 }),
  titel: Type.String(),
  inhalt: Type.Object({}, { additionalProperties: true, description: 'Inhalt nach dem Schema des Kapitels (Komponenten Kapitel1 … Kapitel13). Beträge ohne Recht auf Beträge als null (A-33).' }),
  basis: Nullable(Type.Object({}, { additionalProperties: true, description: 'Inhalt desselben Kapitels in der Basisversion (Abweichung zur Baseline am Feld, K2 Schritt 3).' })),
  geaendert: Type.Boolean(),
  version: Type.Integer({ minimum: 1 }),
  updatedAt: DateTime,
  can: Type.Object({ write: Type.Boolean() }),
}, { $id: 'VertragKapitel', additionalProperties: false });

export const KapitelPut = Type.Object({
  inhalt: Type.Object({}, { additionalProperties: true, description: 'Ganzer Inhalt nach dem Schema des Kapitels (Kapitel1 … Kapitel13).' }),
}, { $id: 'VertragKapitelPut', additionalProperties: false });

export const KapitelParams = Type.Object({
  id: Uuid,
  nr: Type.Integer({ minimum: 1, maximum: 13, description: 'Kapitel 1–13 (Q7).' }),
}, { additionalProperties: false });

export const Pflichtangaben = Type.Object({
  versionId: Uuid,
  zielphase: PhaseT,
  vollstaendig: Type.Boolean({ description: 'Alle verlangten Angaben sind erfasst; Einreichen ist möglich.' }),
  angaben: Type.Array(Type.Object({
    kapitel: Type.Integer({ minimum: 1, maximum: 13 }),
    feld: Type.String({ description: 'Feld im Kapitel (Sprungziel der Oberfläche).' }),
    text: Type.String({ description: 'Was verlangt ist (aus dem Phasenmodell).' }),
    quelle: Type.Object({ art: enumOf(['gate', 'phase'] as const, 'Gate in die Zielphase oder die Zielphase.'), code: Type.String() }),
    erfuellt: Type.Boolean(),
    grund: Nullable(Type.String({ description: 'Warum die Angabe fehlt.' })),
  }, { additionalProperties: false })),
}, { $id: 'VertragPflichtangaben', additionalProperties: false });
