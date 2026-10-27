/** Schemas von Portfolios, Gremien, Gremienweg und Sitzungsterminen (OpenAPI, Prüfung der Eingaben; BC AM.02.04). */
import { Type, type Static } from '@sinclair/typebox';
import { Cursor, DateTime, Limit, NextCursor, Nullable, Uuid } from '@vollholz/platform';
import { GATES } from './store.ts';

const Schluessel = Type.String({ pattern: '^[a-z0-9][a-z0-9-]{0,39}$', description: 'Schlüssel in Kleinbuchstaben, Ziffern und Bindestrichen; eindeutig in der Organisation, fest nach dem Anlegen.' });
const Name = Type.String({ minLength: 1, maxLength: 200, pattern: '\\S', description: 'Bezeichnung.' });
const Kategorie = Type.Union([Type.Literal('A'), Type.Literal('B'), Type.Literal('C')], { description: 'A Transformationsprogramm, B Geschäftsleitung, C Direktion.' });
const GremiumArt = Type.Union([Type.Literal('entscheidend'), Type.Literal('extern')], {
  description: '`entscheidend`: entscheidet am Gate, Mitglieder mit der Rolle «Gremium» am Portfolio (genau eines je Portfolio, A-45). `extern`: ohne Benutzer, die UE erfasst Vorlage und Entscheid (SNS-VR, A-02).',
});
export const GateCode = Type.Union(GATES.map(g => Type.Literal(g)), { description: 'Gate des Phasenmodells.' });
export const Datum = Type.String({ pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$', description: 'Datum (JJJJ-MM-TT).', examples: ['2026-11-18'] });

const PortfolioCan = Type.Object({ admin: Type.Boolean() }, { description: 'Was die anfragende Person damit darf.' });

export const Portfolio = Type.Object({
  id: Uuid,
  kategorie: Kategorie,
  schluessel: Type.String(),
  name: Type.String(),
  pflichten: Type.Boolean({ description: 'Vertrag, Quality-Check, Gates und Monatsbericht sind Pflicht (A und B, A-07); bei C freiwillig (A-08).' }),
  orgEinheitId: Nullable(Uuid),
  version: Type.Integer({ minimum: 1 }),
  createdAt: DateTime,
  createdBy: Nullable(Uuid),
  updatedAt: DateTime,
  updatedBy: Nullable(Uuid),
  can: PortfolioCan,
}, { $id: 'Portfolio', additionalProperties: false });
export type PortfolioOut = Static<typeof Portfolio>;

export const PortfolioCreate = Type.Object({
  kategorie: Kategorie,
  schluessel: Schluessel,
  name: Name,
  orgEinheitId: Type.Optional(Nullable(Uuid)),
}, { $id: 'PortfolioCreate', additionalProperties: false });
export type PortfolioCreateIn = Static<typeof PortfolioCreate>;

export const PortfolioPatch = Type.Object({
  name: Type.Optional(Name),
  orgEinheitId: Type.Optional(Nullable(Uuid)),
}, { $id: 'PortfolioPatch', additionalProperties: false, minProperties: 1 });
export type PortfolioPatchIn = Static<typeof PortfolioPatch>;

export const PortfolioList = Type.Object({ items: Type.Array(Type.Ref('Portfolio')), nextCursor: NextCursor }, { $id: 'PortfolioList', additionalProperties: false });

export const Gremium = Type.Object({
  id: Uuid,
  portfolioId: Uuid,
  kuerzel: Type.String(),
  name: Type.String(),
  art: GremiumArt,
  rhythmus: Type.String({ description: 'Sitzungsrhythmus als Text, z. B. «monatlich».' }),
  version: Type.Integer({ minimum: 1 }),
  createdAt: DateTime,
  createdBy: Nullable(Uuid),
  updatedAt: DateTime,
  updatedBy: Nullable(Uuid),
  can: PortfolioCan,
}, { $id: 'Gremium', additionalProperties: false });
export type GremiumOut = Static<typeof Gremium>;

export const GremiumCreate = Type.Object({
  portfolioId: Uuid,
  kuerzel: Schluessel,
  name: Name,
  art: GremiumArt,
  rhythmus: Type.Optional(Type.String({ maxLength: 200 })),
}, { $id: 'GremiumCreate', additionalProperties: false });
export type GremiumCreateIn = Static<typeof GremiumCreate>;

export const GremiumPatch = Type.Object({
  name: Type.Optional(Name),
  art: Type.Optional(GremiumArt),
  rhythmus: Type.Optional(Type.String({ maxLength: 200 })),
}, { $id: 'GremiumPatch', additionalProperties: false, minProperties: 1 });
export type GremiumPatchIn = Static<typeof GremiumPatch>;

export const GremiumList = Type.Object({ items: Type.Array(Type.Ref('Gremium')), nextCursor: NextCursor }, { $id: 'GremiumList', additionalProperties: false });

export const ListQuery = Type.Object({
  cursor: Type.Optional(Cursor),
  limit: Type.Optional(Limit),
}, { additionalProperties: false });

export const GremienQuery = Type.Object({
  portfolio: Type.Optional(Uuid),
  cursor: Type.Optional(Cursor),
  limit: Type.Optional(Limit),
}, { additionalProperties: false });

const GremiumKurz = Type.Object({ id: Uuid, kuerzel: Type.String(), name: Type.String(), art: GremiumArt }, { additionalProperties: false });

export const Gremienschritt = Type.Object({
  gate: GateCode,
  gremium: GremiumKurz,
  zusaetzlich: Nullable(GremiumKurz),
  viaSns: Type.Boolean({ description: 'Geschäfte an diesem Gate laufen zusätzlich über das externe Gremium (SNS-VR, UC-006 A1).' }),
}, { $id: 'Gremienschritt', additionalProperties: false });

export const Gremienweg = Type.Object({
  portfolioId: Uuid,
  version: Type.Integer({ minimum: 1, description: 'Version des Portfolios (ETag für `PUT`).' }),
  schritte: Type.Array(Type.Ref('Gremienschritt'), { description: 'Gates mit zuständigem Gremium in der Reihenfolge des Phasenmodells; Gates ohne Eintrag fehlen.' }),
  can: PortfolioCan,
}, { $id: 'Gremienweg', additionalProperties: false });

export const GremienwegPut = Type.Object({
  schritte: Type.Array(Type.Object({
    gate: GateCode,
    gremiumId: Uuid,
    zusaetzlichGremiumId: Type.Optional(Nullable(Uuid)),
  }, { additionalProperties: false }), { maxItems: GATES.length }),
}, { $id: 'GremienwegPut', additionalProperties: false });
export type GremienwegPutIn = Static<typeof GremienwegPut>;

export const Sitzungstermin = Type.Object({
  id: Uuid,
  gremiumId: Uuid,
  datum: Datum,
  createdAt: DateTime,
  createdBy: Nullable(Uuid),
}, { $id: 'Sitzungstermin', additionalProperties: false });

export const SitzungsterminList = Type.Object({ items: Type.Array(Type.Ref('Sitzungstermin')), can: PortfolioCan }, { $id: 'SitzungsterminList', additionalProperties: false });

export const SitzungsterminCreate = Type.Object({ datum: Datum }, { $id: 'SitzungsterminCreate', additionalProperties: false });

export const TermineQuery = Type.Object({ von: Type.Optional(Datum), bis: Type.Optional(Datum) }, { additionalProperties: false });
export const TerminParams = Type.Object({ id: Uuid, datum: Datum }, { additionalProperties: false });
