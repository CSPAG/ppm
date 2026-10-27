/**
 * Schemas der Portfolio-Roadmap (BC PP.04.03; UC-011 Schritt 8; K6 Schritt 8; UI-31): Stand bei Publikation aus Zielen,
 * Hauptaktivitäten und Vorhaben, lesbar für alle angemeldeten Personen (A-35, UX-OF-14).
 */
import { Type, type Static } from '@sinclair/typebox';
import { DateTime, Nullable, Uuid } from '@vollholz/platform';

const Projekt = Type.Object({
  nummer: Type.String({ description: 'Projektnummer (Adresse der Projektakte).' }), name: Type.String(), phase: Type.String(), lebenszyklus: Type.String(),
}, { additionalProperties: false });

export const RoadmapInhalt = Type.Object({
  jahr: Type.Integer(),
  handlungsfelder: Type.Array(Type.Object({
    id: Uuid,
    label: Type.String(),
    ziele: Type.Array(Type.Object({
      nummer: Type.String(), text: Type.String(), metrik: Type.String(), zielwert: Type.String(),
      projekte: Type.Array(Projekt, { description: 'Projekte am strategischen Ziel ohne Jahresziel.' }),
      jahresziele: Type.Array(Type.Object({
        nummer: Type.String(), text: Type.String(), metrik: Type.String(), zielwert: Type.String(),
        hauptaktivitaeten: Type.Array(Type.Object({ text: Type.String(), verantwortlich: Nullable(Type.String({ description: 'Name der verantwortlichen Person.' })) }, { additionalProperties: false })),
        projekte: Type.Array(Projekt),
      }, { additionalProperties: false })),
    }, { additionalProperties: false })),
  }, { additionalProperties: false })),
}, { $id: 'RoadmapInhalt', additionalProperties: false, description: 'Vertrauliche Projekte (A-34) erscheinen nicht.' });
export type RoadmapInhaltOut = Static<typeof RoadmapInhalt>;

export const Roadmap = Type.Object({
  jahr: Type.Integer(),
  publiziertAt: DateTime,
  publiziertBy: Nullable(Uuid),
  version: Type.Integer({ minimum: 1 }),
  inhalt: Type.Ref('RoadmapInhalt'),
  can: Type.Object({ publizieren: Type.Boolean({ description: 'Neu publizieren (ziel:freigabe, Jahresziele in Kraft).' }) }),
}, { $id: 'Roadmap', additionalProperties: false });

export const RoadmapList = Type.Object({
  items: Type.Array(Type.Object({ jahr: Type.Integer(), publiziertAt: DateTime, version: Type.Integer() }, { additionalProperties: false })),
}, { $id: 'RoadmapList', additionalProperties: false });

export const RoadmapVorschau = Type.Object({
  jahr: Type.Integer(),
  // Stand der Jahresziele; null ohne Zielzyklus
  stand: Nullable(Type.Union([Type.Literal('in_arbeit'), Type.Literal('zur_freigabe'), Type.Literal('in_kraft')])),
  // letzte Publikation dieses Jahres; null, wenn noch nie publiziert
  publiziertAt: Nullable(DateTime),
  inhalt: Type.Ref('RoadmapInhalt'),
  can: Type.Object({ publizieren: Type.Boolean({ description: 'Publizieren möglich (Jahresziele in Kraft).' }) }),
}, { $id: 'RoadmapVorschau', additionalProperties: false });
