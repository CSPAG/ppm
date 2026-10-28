/**
 * Typisierte Suchparameter je Seite (TanStack Router `validateSearch`). Jede Seite beschreibt ihre Parameter in ihrem
 * Feature; hier werden sie den Routen zugeordnet.
 */
import { validateBerichtSearch } from './features/bericht/index.ts';
import { validateEingangSearch } from './features/eingang/index.ts';
import { type HandlungsfeldSearch, validateHandlungsfeldSearch } from './features/handlungsfeld/index.ts';
import { type ProjekteSearch, validateProjekteSearch } from './features/projekt/index.ts';
import { validateIdeeNeuSearch, validateIdeenSearch, validateIdeeSearch } from './features/idee/index.ts';
import { type AuslastungSearch, type KapazitaetSearch, validateAuslastungSearch, validateBedarfSearch, validateKapazitaetSearch } from './features/ressourcen/index.ts';
import { validateDashboardSearch } from './features/dashboard/index.ts';
import { validateMonatsabschlussSearch } from './features/monatsabschluss/index.ts';
import { type PhasenmodellSearch, validatePhasenmodellSearch } from './features/phasenmodell/index.ts';
import { type PortfoliosSearch, validatePortfoliosSearch } from './features/portfolios/index.ts';
import { type BewertungSearch, type MatrixSearch, type ModellSearch, validateBewertungSearch, validateMatrixSearch, validateModellSearch } from './features/priorisierung/index.ts';
import { type EntscheideSearch, type SitzungSearch, validateEntscheideSearch, validateSitzungSearch } from './features/sitzung/index.ts';
import { validateCodetabellenSearch, validateOrganisationSearch } from './features/stammdaten/index.ts';
import { validateKontoSearch } from './features/konto/index.ts';
import { validateProtokollSearch, validateSchnittstellenSearch } from './features/schnittstellen/index.ts';
import { validateZugaengeSearch } from './features/zugang/index.ts';
import { validateVertragSearch, type VertragSearch } from './features/vertrag/index.ts';
import { validateVorlagenSearch } from './features/vorlagen/index.ts';
import { type RoadmapSearch, validateRoadmapSearch, validateZielerreichungSearch, validateZielSearch, validateZielzyklusSearch, type ZielerreichungSearch, type ZielSearch, type ZielzyklusSearch } from './features/ziele/index.ts';

export const searchOf = {
  bewertung: validateBewertungSearch,
  bewertungsmodell: validateModellSearch,
  matrix: validateMatrixSearch,
  eingang: validateEingangSearch,
  stellvertretung: validateKontoSearch,
  handlungsfelder: validateHandlungsfeldSearch,
  projekte: validateProjekteSearch,
  bericht: validateBerichtSearch,
  strategischeZiele: validateZielSearch,
  zielzyklus: validateZielzyklusSearch,
  roadmap: validateRoadmapSearch,
  ideen: validateIdeenSearch,
  ideeNeu: validateIdeeNeuSearch,
  idee: validateIdeeSearch,
  zielerreichung: validateZielerreichungSearch,
  auslastung: validateAuslastungSearch,
  kapazitaet: validateKapazitaetSearch,
  bedarf: validateBedarfSearch,
  dashboard: validateDashboardSearch,
  monatsabschluss: validateMonatsabschlussSearch,
  organisation: validateOrganisationSearch,
  codetabellen: validateCodetabellenSearch,
  vorlagen: validateVorlagenSearch,
  phasenmodell: validatePhasenmodellSearch,
  portfolios: validatePortfoliosSearch,
  schnittstellen: validateSchnittstellenSearch,
  aenderungsprotokoll: validateProtokollSearch,
  sitzung: validateSitzungSearch,
  entscheide: validateEntscheideSearch,
  vertrag: validateVertragSearch,
  zugaenge: validateZugaengeSearch,
} satisfies Record<string, (raw: Record<string, unknown>) => object>;

export type { AuslastungSearch, BewertungSearch, MatrixSearch, EntscheideSearch, HandlungsfeldSearch, KapazitaetSearch, ModellSearch, PhasenmodellSearch, PortfoliosSearch, ProjekteSearch, RoadmapSearch, SitzungSearch, VertragSearch, ZielSearch, ZielerreichungSearch, ZielzyklusSearch };
