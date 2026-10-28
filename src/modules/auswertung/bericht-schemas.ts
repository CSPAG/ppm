/** Schemas des Portfolioberichts (OpenAPI, Prüfung der Eingaben); BC PC.04.02, UC-014 Schritt 3 (AP-E2-3). */
import { Type, type Static } from '@sinclair/typebox';
import { DateTime, Nullable, Uuid } from '@vollholz/platform';

const Stand = Type.Union([Type.Literal('entwurf'), Type.Literal('bereitgestellt')], { description: '«Entwurf» (die UE ergänzt den Kommentar, erzeugt neu) oder «bereitgestellt» (fest, Unterlage des Gremiums).' });
const PortfolioKurz = Type.Object({ id: Uuid, schluessel: Type.String(), name: Type.String() }, { additionalProperties: false });

export const PortfolioberichtKurz = Type.Object({
  id: Uuid,
  portfolio: PortfolioKurz,
  periode: Type.String(),
  stand: Stand,
  erzeugtAt: DateTime,
  bereitgestelltAt: Nullable(DateTime),
  version: Type.Integer(),
}, { $id: 'PortfolioberichtKurz', additionalProperties: false });
export type PortfolioberichtKurzOut = Static<typeof PortfolioberichtKurz>;

export const Portfoliobericht = Type.Object({
  ...PortfolioberichtKurz.properties,
  kommentar: Type.String({ description: 'Kommentar der UE («Bericht der Programmleitung», K3 Schritt 4).' }),
  dashboard: Type.Object({
    abgeschlossenAt: Nullable(DateTime),
    items: Type.Array(Type.Ref('DashboardZeile')),
    funnel: Type.Array(Type.Ref('FunnelStufe')),
  }, { additionalProperties: false, description: 'Abgeschlossenes Dashboard der Periode bei Erzeugung.' }),
  risikolage: Type.Object({
    risiken: Type.Array(Type.Ref('RisikolageRisiko')),
    matrix: Type.Array(Type.Object({ wahrscheinlichkeit: Type.String(), auswirkung: Type.String(), anzahl: Type.Integer() }, { additionalProperties: false })),
    abhaengigkeiten: Type.Array(Type.Object({
      id: Uuid, von: Type.Object({ id: Uuid, nummer: Type.String(), name: Type.String() }), zu: Type.Object({ id: Uuid, nummer: Type.String(), name: Type.String() }), text: Type.String(),
    })),
    eskalationen: Type.Array(Type.Object({
      id: Uuid, projekt: Type.Object({ id: Uuid, nummer: Type.String(), name: Type.String() }), periode: Type.String(), grund: Type.String(), massnahme: Type.String(), stand: Type.String(),
    })),
  }, { additionalProperties: false, description: 'Risikolage bei Erzeugung.' }),
  can: Type.Object({ bearbeiten: Type.Boolean(), bereitstellen: Type.Boolean() }, { additionalProperties: false }),
}, { $id: 'Portfoliobericht', additionalProperties: false });
export type PortfolioberichtOut = Static<typeof Portfoliobericht>;

export const PortfolioberichtListe = Type.Object({
  items: Type.Array(Type.Ref('PortfolioberichtKurz'), { description: 'Neueste Periode zuerst.' }),
}, { $id: 'PortfolioberichtListe', additionalProperties: false });

export const PortfolioberichtCreate = Type.Object({
  portfolio: Type.String({ pattern: '^[a-z0-9_-]{1,40}$', description: 'Schlüssel des Portfolios.' }),
  periode: Type.String({ pattern: '^[0-9]{4}-(0[1-9]|1[0-2])$', description: 'Abgeschlossene Periode.' }),
}, { $id: 'PortfolioberichtCreate', additionalProperties: false });
export type PortfolioberichtCreateIn = Static<typeof PortfolioberichtCreate>;

export const PortfolioberichtPatch = Type.Object({
  kommentar: Type.String({ maxLength: 8000 }),
}, { $id: 'PortfolioberichtPatch', additionalProperties: false });
export type PortfolioberichtPatchIn = Static<typeof PortfolioberichtPatch>;

export const PortfolioberichtQuery = Type.Object({
  portfolio: Type.Optional(Type.String({ pattern: '^[a-z0-9_-]{1,40}$', description: 'Schlüssel des Portfolios.' })),
}, { additionalProperties: false });
export type PortfolioberichtQueryIn = Static<typeof PortfolioberichtQuery>;
