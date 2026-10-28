/**
 * Routen (TanStack Router, code-basiert): Seiten der App mit typisierten Suchparametern (`search.ts`) und die
 * Verwalten-Seiten des Baukastens (`makeIamRoutes`, per `load()` erst bei Bedarf geladen). Die Seiten der Features lädt
 * der Router als eigene Chunks nach (`seite`, Q-L6); die `index.ts` der Features exportieren deshalb keine Seiten.
 */
import { createRootRoute, createRoute, createRouter, lazyRouteComponent, notFound, redirect, useNavigate } from '@tanstack/react-router';
import { makeIamRoutes, tanstackParam } from '@vollholz/iam-web';
import { useCallback } from 'react';
import { Root } from './app.tsx';
import { features, paths } from './auth/index.ts';
import { projekteRoutes } from './routes/projekte.tsx';
import type { SetEingangSearch } from './features/eingang/index.ts';
import type { SetHandlungsfeldSearch } from './features/handlungsfeld/index.ts';
import { nummerAusPfad, type SetIdeenSearch, type SetIdeeSearch } from './features/idee/index.ts';
import { ressourcenPfad, type SetAuslastungSearch, type SetBedarfSearch, type SetKapazitaetSearch } from './features/ressourcen/index.ts';
import { priorisierungPfad, type SetBewertungSearch, type SetMatrixSearch, type SetModellSearch } from './features/priorisierung/index.ts';
import type { SetDashboardSearch, SetPortfolioberichtSearch, SetRisikenSearch } from './features/dashboard/index.ts';
import type { SetMonatsabschlussSearch } from './features/monatsabschluss/index.ts';
import type { SetPhasenmodellSearch } from './features/phasenmodell/index.ts';
import type { SetPortfoliosSearch } from './features/portfolios/index.ts';
import type { SetEntscheideSearch, SetSitzungSearch } from './features/sitzung/index.ts';
import type { SetCodetabellenSearch, SetOrganisationSearch } from './features/stammdaten/index.ts';
import type { SetVorlagenSearch } from './features/vorlagen/index.ts';
import type { SetKontoSearch } from './features/konto/index.ts';
import type { SetZugaengeSearch } from './features/zugang/index.ts';
import { abgeschlossenesQuartal, type QuartalNr, type SetRoadmapSearch, type SetZielSearch, type SetZielzyklusSearch, ZIELJAHR } from './features/ziele/index.ts';
import { kopfkarten } from './kopfkarten.ts';
import { seite } from './routes/seite.ts';
import { searchOf } from './search.ts';
import { NotFound } from './shell/index.ts';

// Seiten der Features als eigene Chunks (Q-L6)
const EingangPage = seite(() => import('./features/eingang/EingangPage.tsx'), 'EingangPage');
const HandlungsfeldPage = seite(() => import('./features/handlungsfeld/HandlungsfeldPage.tsx'), 'HandlungsfeldPage');
const IdeenBereich = seite(() => import('./features/idee/PoolSeite.tsx'), 'IdeenBereich');
const IdeeNeuPage = seite(() => import('./features/idee/IdeeSeiten.tsx'), 'IdeeNeuPage');
const IdeePage = seite(() => import('./features/idee/IdeeSeiten.tsx'), 'IdeePage');
const AuslastungPage = seite(() => import('./features/ressourcen/AuslastungPage.tsx'), 'AuslastungPage');
const KapazitaetPage = seite(() => import('./features/ressourcen/KapazitaetPage.tsx'), 'KapazitaetPage');
const BedarfPage = seite(() => import('./features/ressourcen/BedarfPage.tsx'), 'BedarfPage');
const BewertungPage = seite(() => import('./features/priorisierung/BewertungPage.tsx'), 'BewertungPage');
const ModellPage = seite(() => import('./features/priorisierung/ModellPage.tsx'), 'ModellPage');
const MatrixPage = seite(() => import('./features/priorisierung/MatrixPage.tsx'), 'MatrixPage');
const DashboardPage = seite(() => import('./features/dashboard/DashboardPage.tsx'), 'DashboardPage');
const RisikenPage = seite(() => import('./features/dashboard/RisikenPage.tsx'), 'RisikenPage');
const PortfolioberichtPage = seite(() => import('./features/dashboard/PortfolioberichtPage.tsx'), 'PortfolioberichtPage');
const MonatsabschlussPage = seite(() => import('./features/monatsabschluss/MonatsabschlussPage.tsx'), 'MonatsabschlussPage');
const PhasenmodellPage = seite(() => import('./features/phasenmodell/PhasenmodellPage.tsx'), 'PhasenmodellPage');
const PortfoliosPage = seite(() => import('./features/portfolios/PortfoliosPage.tsx'), 'PortfoliosPage');
const SitzungenPage = seite(() => import('./features/sitzung/SitzungenPage.tsx'), 'SitzungenPage');
const SitzungPage = seite(() => import('./features/sitzung/SitzungPage.tsx'), 'SitzungPage');
const SitzungsmodusPage = seite(() => import('./features/sitzung/SitzungsmodusPage.tsx'), 'SitzungsmodusPage');
const ProtokollPage = seite(() => import('./features/sitzung/ProtokollPage.tsx'), 'ProtokollPage');
const EntscheidePage = seite(() => import('./features/sitzung/EntscheidePage.tsx'), 'EntscheidePage');
const OrganisationPage = seite(() => import('./features/stammdaten/OrganisationPage.tsx'), 'OrganisationPage');
const CodetabellenPage = seite(() => import('./features/stammdaten/CodetabellenPage.tsx'), 'CodetabellenPage');
const VorlagenPage = seite(() => import('./features/vorlagen/VorlagenPage.tsx'), 'VorlagenPage');
const StellvertretungPage = seite(() => import('./features/konto/StellvertretungPage.tsx'), 'StellvertretungPage');
const ZugaengePage = seite(() => import('./features/zugang/ZugaengePage.tsx'), 'ZugaengePage');
const NeubesetzungPage = seite(() => import('./features/zugang/NeubesetzungPage.tsx'), 'NeubesetzungPage');
const ZielePage = seite(() => import('./features/ziele/ZielePage.tsx'), 'ZielePage');
const ZielzyklusPage = seite(() => import('./features/ziele/ZielzyklusPage.tsx'), 'ZielzyklusPage');
const FreigabePage = seite(() => import('./features/ziele/FreigabePage.tsx'), 'FreigabePage');
const RoadmapPage = seite(() => import('./features/ziele/RoadmapPage.tsx'), 'RoadmapPage');
const ZielerreichungPage = seite(() => import('./features/ziele/ZielerreichungPage.tsx'), 'ZielerreichungPage');
const QuartalsreportingPage = seite(() => import('./features/ziele/QuartalsreportingPage.tsx'), 'QuartalsreportingPage');

const rootRoute = createRootRoute({ component: Root, notFoundComponent: NotFound });

// Startseite jeder Rolle ist der Eingang (UX-E3)
const indexRoute = createRoute({
  getParentRoute: () => rootRoute, path: '/',
  beforeLoad: () => { throw redirect({ to: '/eingang', replace: true }); },
});

// Arbeitsraum «Eingang» (UI-01)
const eingangRoute = createRoute({ getParentRoute: () => rootRoute, path: '/eingang', validateSearch: searchOf.eingang, component: EingangRoute });

function EingangRoute() {
  const search = eingangRoute.useSearch();
  const navigate = useNavigate({ from: eingangRoute.fullPath });
  const setSearch = useCallback<SetEingangSearch>((next, o) => {
    void navigate({ search: prev => ({ ...prev, ...next }), replace: o?.replace ?? false });
  }, [navigate]);
  const gehe = useCallback((pfad: string) => { void navigate({ href: pfad }); }, [navigate]);
  return <EingangPage search={search} setSearch={setSearch} gehe={gehe} kopfkarten={kopfkarten} />;
}

// Kontomenü › Profil mit Stellvertretung (UI-43, UC-016 Schritt 4)
const kontoRoute = createRoute({
  getParentRoute: () => rootRoute, path: '/konto',
  beforeLoad: () => { throw redirect({ to: '/konto/stellvertretung', replace: true }); },
});

const stellvertretungRoute = createRoute({
  getParentRoute: () => rootRoute, path: '/konto/stellvertretung', validateSearch: searchOf.stellvertretung, component: StellvertretungRoute,
});

function StellvertretungRoute() {
  const search = stellvertretungRoute.useSearch();
  const navigate = useNavigate({ from: stellvertretungRoute.fullPath });
  const setSearch = useCallback<SetKontoSearch>((next, o) => {
    void navigate({ search: prev => ({ ...prev, ...next }), replace: o?.replace ?? false });
  }, [navigate]);
  return <StellvertretungPage search={search} setSearch={setSearch} />;
}

// Arbeitsraum «Ziele»: bis zum Zielzyklus (Etappe E6) nur die Handlungsfelder
const zieleRoute = createRoute({
  getParentRoute: () => rootRoute, path: '/ziele',
  beforeLoad: () => { throw redirect({ to: '/ziele/handlungsfelder', replace: true }); },
});

const handlungsfelderRoute = createRoute({
  getParentRoute: () => rootRoute, path: '/ziele/handlungsfelder', validateSearch: searchOf.handlungsfelder, component: HandlungsfelderRoute,
});

function HandlungsfelderRoute() {
  const search = handlungsfelderRoute.useSearch();
  const navigate = useNavigate({ from: handlungsfelderRoute.fullPath });
  const setSearch = useCallback<SetHandlungsfeldSearch>((next, o) => {
    void navigate({ search: prev => ({ ...prev, ...next }), replace: o?.replace ?? false });
  }, [navigate]);
  return <HandlungsfeldPage search={search} setSearch={setSearch} />;
}

// Strategische Ziele je Handlungsfeld (BC ZM.01.02, AP-E0-9)
const strategischeZieleRoute = createRoute({
  getParentRoute: () => rootRoute, path: '/ziele/strategische-ziele', validateSearch: searchOf.strategischeZiele, component: StrategischeZieleRoute,
});

function StrategischeZieleRoute() {
  const search = strategischeZieleRoute.useSearch();
  const navigate = useNavigate({ from: strategischeZieleRoute.fullPath });
  const setSearch = useCallback<SetZielSearch>((next, o) => {
    void navigate({ search: prev => ({ ...prev, ...next }), replace: o?.replace ?? false });
  }, [navigate]);
  return <ZielePage search={search} setSearch={setSearch} />;
}

// Zielzyklus eines Jahres (UI-38, K6; AP-E6-1): `/ziele/2027?o=ziel:2.1`
const zielzyklusRoute = createRoute({
  getParentRoute: () => rootRoute, path: '/ziele/$jahr', validateSearch: searchOf.zielzyklus, component: ZielzyklusRoute,
  beforeLoad: ({ params }) => { if (!ZIELJAHR.test(params.jahr)) throw notFound(); },
});

function ZielzyklusRoute() {
  const { jahr } = zielzyklusRoute.useParams();
  const search = zielzyklusRoute.useSearch();
  const navigate = useNavigate({ from: zielzyklusRoute.fullPath });
  const setSearch = useCallback<SetZielzyklusSearch>((next, o) => {
    void navigate({ search: prev => ({ ...prev, ...next }), replace: o?.replace ?? false });
  }, [navigate]);
  return (
    <ZielzyklusPage jahr={Number(jahr)} search={search} setSearch={setSearch}
      jahrWechseln={j => void navigate({ to: '/ziele/$jahr', params: { jahr: String(j) }, search: {} })}
      projektOeffnen={nr => void navigate({ href: `/projekte/${nr}` })}
      strategischeZiele={() => void navigate({ to: '/ziele/strategische-ziele', search: {} })}
      freigabe={() => void navigate({ to: '/ziele/$jahr/freigabe', params: { jahr } })} />
  );
}

// Freigabe der Jahresziele (UI-39, K6 Schritte 6–7; AP-E6-2): Assistent `/ziele/2027/freigabe`
const freigabeRoute = createRoute({
  getParentRoute: () => rootRoute, path: '/ziele/$jahr/freigabe', component: FreigabeRoute,
  beforeLoad: ({ params }) => { if (!ZIELJAHR.test(params.jahr)) throw notFound(); },
});

function FreigabeRoute() {
  const { jahr } = freigabeRoute.useParams();
  const navigate = useNavigate({ from: freigabeRoute.fullPath });
  return <FreigabePage jahr={Number(jahr)} zumZyklus={nr => void navigate({ to: '/ziele/$jahr', params: { jahr }, search: nr ? { o: `ziel:${nr}` } : {} })} />;
}

// Portfolio › Auswertungen › Roadmap (UI-31, K6 Schritt 8; AP-E6-2): `/portfolio/roadmap?jahr=2027`
const roadmapRoute = createRoute({ getParentRoute: () => rootRoute, path: '/portfolio/roadmap', validateSearch: searchOf.roadmap, component: RoadmapRoute });

function RoadmapRoute() {
  const search = roadmapRoute.useSearch();
  const navigate = useNavigate({ from: roadmapRoute.fullPath });
  const setSearch = useCallback<SetRoadmapSearch>((next, o) => {
    void navigate({ search: prev => ({ ...prev, ...next }), replace: o?.replace ?? false });
  }, [navigate]);
  return <RoadmapPage search={search} setSearch={setSearch} projektOeffnen={nr => void navigate({ href: `/projekte/${nr}` })} />;
}

// Arbeitsraum «Portfolio» › Ideen (K4, AP-E4-1): Meine Ideen, Assistent für eine neue Idee, Idee über ihre Nummer
const ideenRoute = createRoute({ getParentRoute: () => rootRoute, path: '/portfolio/ideen', validateSearch: searchOf.ideen, component: IdeenRoute });

function IdeenRoute() {
  const search = ideenRoute.useSearch();
  const navigate = useNavigate({ from: ideenRoute.fullPath });
  const gehe = useCallback((pfad: string) => { void navigate({ href: pfad }); }, [navigate]);
  // Ideenpool und Funnel mit Ansicht und Filtern in der Adresse (AP-E4-2, K4 Prüfen 5)
  const setSearch = useCallback<SetIdeenSearch>((next, o) => {
    void navigate({ search: prev => ({ ...prev, ...next }) as typeof prev, replace: o?.replace ?? false });
  }, [navigate]);
  return <IdeenBereich search={search} setSearch={setSearch} gehe={gehe} />;
}

const ideeNeuRoute = createRoute({ getParentRoute: () => rootRoute, path: '/portfolio/ideen/neu', validateSearch: searchOf.ideeNeu, component: IdeeNeuRoute });

function IdeeNeuRoute() {
  const search = ideeNeuRoute.useSearch();
  const navigate = useNavigate();
  const gehe = useCallback((pfad: string) => { void navigate({ href: pfad }); }, [navigate]);
  return <IdeeNeuPage search={search} gehe={gehe} />;
}

const ideeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/portfolio/ideen/$nummer', validateSearch: searchOf.idee, component: IdeeRoute });

function IdeeRoute() {
  const { nummer } = ideeRoute.useParams();
  const search = ideeRoute.useSearch();
  const navigate = useNavigate({ from: ideeRoute.fullPath });
  const setSearch = useCallback<SetIdeeSearch>((next, o) => {
    void navigate({ search: prev => ({ ...prev, ...next }), replace: o?.replace ?? false });
  }, [navigate]);
  const gehe = useCallback((pfad: string) => { void navigate({ href: pfad }); }, [navigate]);
  return <IdeePage nummer={nummerAusPfad(nummer)} search={search} setSearch={setSearch} gehe={gehe} />;
}

// Zielerreichung je Quartal (UI-40, BC ZM.03.01, AP-E6-3): /ziele/2026/zielerreichung?quartal=q3; ohne Jahr und Quartal
// das zuletzt abgeschlossene Quartal
const zielerreichungStartRoute = createRoute({
  getParentRoute: () => rootRoute, path: '/ziele/zielerreichung',
  beforeLoad: () => {
    const q = abgeschlossenesQuartal();
    throw redirect({ to: '/ziele/$jahr/zielerreichung', params: { jahr: String(q.jahr) }, search: { quartal: `q${q.quartal}` }, replace: true });
  },
});

const zielerreichungRoute = createRoute({
  getParentRoute: () => rootRoute, path: '/ziele/$jahr/zielerreichung', validateSearch: searchOf.zielerreichung, component: ZielerreichungRoute,
  beforeLoad: ({ params }) => { if (!/^\d{4}$/.test(params.jahr) || Number(params.jahr) < 2000 || Number(params.jahr) > 2100) throw notFound(); },
});

function ZielerreichungRoute() {
  const { jahr } = zielerreichungRoute.useParams();
  const search = zielerreichungRoute.useSearch();
  const navigate = useNavigate({ from: zielerreichungRoute.fullPath });
  const quartal = Number((search.quartal ?? `q${abgeschlossenesQuartal().quartal}`).slice(1)) as QuartalNr;
  const setQuartal = useCallback((j: number, q: QuartalNr) => {
    void navigate({ to: '/ziele/$jahr/zielerreichung', params: { jahr: String(j) }, search: { quartal: `q${q}` } });
  }, [navigate]);
  const zuZielen = useCallback(() => { void navigate({ to: '/ziele/strategische-ziele' }); }, [navigate]);
  return <ZielerreichungPage jahr={Number(jahr)} quartal={quartal} setQuartal={setQuartal} zuZielen={zuZielen} />;
}

// Quartalsreporting an den VR (UI-41, BC ZM.03.02, AP-E6-4): /ziele/2026/quartalsreporting?quartal=q3; ohne Jahr und
// Quartal das zuletzt abgeschlossene
const quartalsreportingStartRoute = createRoute({
  getParentRoute: () => rootRoute, path: '/ziele/quartalsreporting',
  beforeLoad: () => {
    const q = abgeschlossenesQuartal();
    throw redirect({ to: '/ziele/$jahr/quartalsreporting', params: { jahr: String(q.jahr) }, search: { quartal: `q${q.quartal}` }, replace: true });
  },
});

const quartalsreportingRoute = createRoute({
  getParentRoute: () => rootRoute, path: '/ziele/$jahr/quartalsreporting', validateSearch: searchOf.zielerreichung, component: QuartalsreportingRoute,
  beforeLoad: ({ params }) => { if (!/^\d{4}$/.test(params.jahr) || Number(params.jahr) < 2000 || Number(params.jahr) > 2100) throw notFound(); },
});

function QuartalsreportingRoute() {
  const { jahr } = quartalsreportingRoute.useParams();
  const search = quartalsreportingRoute.useSearch();
  const navigate = useNavigate({ from: quartalsreportingRoute.fullPath });
  const quartal = Number((search.quartal ?? `q${abgeschlossenesQuartal().quartal}`).slice(1)) as QuartalNr;
  const setQuartal = useCallback((j: number, q: QuartalNr) => {
    void navigate({ to: '/ziele/$jahr/quartalsreporting', params: { jahr: String(j) }, search: { quartal: `q${q}` } });
  }, [navigate]);
  return <QuartalsreportingPage jahr={Number(jahr)} quartal={quartal} setQuartal={setQuartal} />;
}

// Arbeitsraum «Portfolio» › Ressourcen: Auslastung (UI-23) und Kapazität (UI-24) (BC RK.01.01, RK.02.04, AP-E5-4)
const ressourcenRoute = createRoute({
  getParentRoute: () => rootRoute, path: '/portfolio/ressourcen',
  beforeLoad: () => { throw redirect({ to: ressourcenPfad.auslastung, replace: true }); },
});

const auslastungRoute = createRoute({
  getParentRoute: () => rootRoute, path: ressourcenPfad.auslastung, validateSearch: searchOf.auslastung, component: AuslastungRoute,
});

function AuslastungRoute() {
  const search = auslastungRoute.useSearch();
  const navigate = useNavigate({ from: auslastungRoute.fullPath });
  const setSearch = useCallback<SetAuslastungSearch>((next, o) => {
    void navigate({ search: prev => ({ ...prev, ...next }), replace: o?.replace ?? false });
  }, [navigate]);
  return <AuslastungPage search={search} setSearch={setSearch} navigieren={href => void navigate({ href })} />;
}

const kapazitaetRoute = createRoute({
  getParentRoute: () => rootRoute, path: ressourcenPfad.kapazitaet, validateSearch: searchOf.kapazitaet, component: KapazitaetRoute,
});

function KapazitaetRoute() {
  const search = kapazitaetRoute.useSearch();
  const navigate = useNavigate({ from: kapazitaetRoute.fullPath });
  const setSearch = useCallback<SetKapazitaetSearch>((next, o) => {
    void navigate({ search: prev => ({ ...prev, ...next }), replace: o?.replace ?? false });
  }, [navigate]);
  return <KapazitaetPage search={search} setSearch={setSearch} navigieren={href => void navigate({ href })} />;
}

// Portfolio › Ressourcen › Bedarf (UI-25; BC RK.02.02, RK.02.03; AP-E7-2)
const bedarfRoute = createRoute({
  getParentRoute: () => rootRoute, path: ressourcenPfad.bedarf, validateSearch: searchOf.bedarf, component: BedarfRoute,
});

function BedarfRoute() {
  const search = bedarfRoute.useSearch();
  const navigate = useNavigate({ from: bedarfRoute.fullPath });
  const setSearch = useCallback<SetBedarfSearch>((next, o) => {
    void navigate({ search: prev => ({ ...prev, ...next }), replace: o?.replace ?? false });
  }, [navigate]);
  return <BedarfPage search={search} setSearch={setSearch} navigieren={href => void navigate({ href })} />;
}

// Arbeitsraum «Portfolio» › Priorisierung: Bewertung (UI-20) und Modell (UI-19) (BC PP.01.02, PP.01.03, PP.02.01, AP-E5-1)

const priorisierungRoute = createRoute({
  getParentRoute: () => rootRoute, path: '/portfolio/priorisierung',
  beforeLoad: () => { throw redirect({ to: priorisierungPfad.bewertung, replace: true }); },
});

const bewertungRoute = createRoute({
  getParentRoute: () => rootRoute, path: priorisierungPfad.bewertung, validateSearch: searchOf.bewertung, component: BewertungRoute,
});

function BewertungRoute() {
  const search = bewertungRoute.useSearch();
  const navigate = useNavigate({ from: bewertungRoute.fullPath });
  const setSearch = useCallback<SetBewertungSearch>((next, o) => {
    void navigate({ search: prev => ({ ...prev, ...next }), replace: o?.replace ?? false });
  }, [navigate]);
  return <BewertungPage search={search} setSearch={setSearch} navigieren={href => void navigate({ href })} />;
}

// Matrix (UI-21; BC PP.03.04, PP.02.02, PC.02.01, AP-E5-2)
const matrixRoute = createRoute({
  getParentRoute: () => rootRoute, path: priorisierungPfad.matrix, validateSearch: searchOf.matrix, component: MatrixRoute,
});

function MatrixRoute() {
  const search = matrixRoute.useSearch();
  const navigate = useNavigate({ from: matrixRoute.fullPath });
  const setSearch = useCallback<SetMatrixSearch>((next, o) => {
    void navigate({ search: prev => ({ ...prev, ...next }), replace: o?.replace ?? false });
  }, [navigate]);
  return <MatrixPage search={search} setSearch={setSearch} navigieren={href => void navigate({ href })} />;
}

const modellRoute = createRoute({
  getParentRoute: () => rootRoute, path: priorisierungPfad.modell, validateSearch: searchOf.bewertungsmodell, component: ModellRoute,
});

function ModellRoute() {
  const search = modellRoute.useSearch();
  const navigate = useNavigate({ from: modellRoute.fullPath });
  const setSearch = useCallback<SetModellSearch>((next, o) => {
    void navigate({ search: prev => ({ ...prev, ...next }), replace: o?.replace ?? false });
  }, [navigate]);
  return <ModellPage search={search} setSearch={setSearch} navigieren={href => void navigate({ href })} />;
}

// Arbeitsraum «Portfolio» › Dashboard (UI-17; PC.04.01, UC-014 Schritt 1; AP-E1-3)
const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute, path: '/portfolio/dashboard', validateSearch: searchOf.dashboard, component: DashboardRoute,
});

function DashboardRoute() {
  const search = dashboardRoute.useSearch();
  const navigate = useNavigate({ from: dashboardRoute.fullPath });
  const setSearch = useCallback<SetDashboardSearch>((next, o) => {
    void navigate({ search: prev => ({ ...prev, ...next }) as typeof prev, replace: o?.replace ?? false });
  }, [navigate]);
  return <DashboardPage search={search} setSearch={setSearch} />;
}

// Portfolio › Dashboard › Risiken (UI-18; PC.02.02, UC-014 Schritt 2; AP-E2-3)
const risikenRoute = createRoute({
  getParentRoute: () => rootRoute, path: '/portfolio/dashboard/risiken', validateSearch: searchOf.risiken, component: RisikenRoute,
});

function RisikenRoute() {
  const search = risikenRoute.useSearch();
  const navigate = useNavigate({ from: risikenRoute.fullPath });
  const setSearch = useCallback<SetRisikenSearch>((next, o) => {
    void navigate({ search: prev => ({ ...prev, ...next }) as typeof prev, replace: o?.replace ?? false });
  }, [navigate]);
  return <RisikenPage search={search} setSearch={setSearch} />;
}

// Portfolio › Auswertungen › Portfoliobericht (UI-29; PC.04.02, UC-014 Schritt 3, K3 Schritt 4; AP-E2-3)
const portfolioberichtRoute = createRoute({
  getParentRoute: () => rootRoute, path: '/portfolio/auswertungen/portfoliobericht', validateSearch: searchOf.portfoliobericht, component: PortfolioberichtRoute,
});

function PortfolioberichtRoute() {
  const search = portfolioberichtRoute.useSearch();
  const navigate = useNavigate({ from: portfolioberichtRoute.fullPath });
  const setSearch = useCallback<SetPortfolioberichtSearch>((next, o) => {
    void navigate({ search: prev => ({ ...prev, ...next }) as typeof prev, replace: o?.replace ?? false });
  }, [navigate]);
  return <PortfolioberichtPage search={search} setSearch={setSearch} />;
}

// Arbeitsraum «Portfolio» › Monatsabschluss (UI-15, UI-16; Kernablauf K1, UC-005; AP-E1-2)
const monatsabschlussRoute = createRoute({
  getParentRoute: () => rootRoute, path: '/portfolio/monatsabschluss', validateSearch: searchOf.monatsabschluss, component: MonatsabschlussRoute,
});

function MonatsabschlussRoute() {
  const search = monatsabschlussRoute.useSearch();
  const navigate = useNavigate({ from: monatsabschlussRoute.fullPath });
  const setSearch = useCallback<SetMonatsabschlussSearch>((next, o) => {
    void navigate({ search: prev => ({ ...prev, ...next }) as typeof prev, replace: o?.replace ?? false });
  }, [navigate]);
  return <MonatsabschlussPage search={search} setSearch={setSearch} />;
}

// Arbeitsraum «Administration»: Organisation und Codetabellen (UI-44, UI-45; UC-017 Schritte 1–2)
const organisationRoute = createRoute({
  getParentRoute: () => rootRoute, path: '/administration/organisation', validateSearch: searchOf.organisation, component: OrganisationRoute,
});

function OrganisationRoute() {
  const search = organisationRoute.useSearch();
  const navigate = useNavigate({ from: organisationRoute.fullPath });
  const setSearch = useCallback<SetOrganisationSearch>((next, o) => {
    void navigate({ search: prev => ({ ...prev, ...next }) as typeof prev, replace: o?.replace ?? false });
  }, [navigate]);
  return <OrganisationPage search={search} setSearch={setSearch} />;
}

const codetabellenRoute = createRoute({
  getParentRoute: () => rootRoute, path: '/administration/codetabellen', validateSearch: searchOf.codetabellen, component: CodetabellenRoute,
});

function CodetabellenRoute() {
  const search = codetabellenRoute.useSearch();
  const navigate = useNavigate({ from: codetabellenRoute.fullPath });
  const setSearch = useCallback<SetCodetabellenSearch>((next, o) => {
    void navigate({ search: prev => ({ ...prev, ...next }), replace: o?.replace ?? false });
  }, [navigate]);
  return <CodetabellenPage search={search} setSearch={setSearch} />;
}

// Arbeitsraum «Administration»: Vorlagen (UI-48; UC-018 Schritte 1–2, AP-E7-7)
const vorlagenRoute = createRoute({
  getParentRoute: () => rootRoute, path: '/administration/vorlagen', validateSearch: searchOf.vorlagen, component: VorlagenRoute,
});

function VorlagenRoute() {
  const search = vorlagenRoute.useSearch();
  const navigate = useNavigate({ from: vorlagenRoute.fullPath });
  const setSearch = useCallback<SetVorlagenSearch>((next, o) => {
    void navigate({ search: prev => ({ ...prev, ...next }) as typeof prev, replace: o?.replace ?? false });
  }, [navigate]);
  return <VorlagenPage search={search} setSearch={setSearch} />;
}

// Arbeitsraum «Administration»: Phasenmodell (UI-46, AM.02.03)
const phasenmodellRoute = createRoute({
  getParentRoute: () => rootRoute, path: '/administration/phasenmodell', validateSearch: searchOf.phasenmodell, component: PhasenmodellRoute,
});

function PhasenmodellRoute() {
  const search = phasenmodellRoute.useSearch();
  const navigate = useNavigate({ from: phasenmodellRoute.fullPath });
  const setSearch = useCallback<SetPhasenmodellSearch>((next, o) => {
    void navigate({ search: prev => ({ ...prev, ...next }), replace: o?.replace ?? false });
  }, [navigate]);
  return <PhasenmodellPage search={search} setSearch={setSearch} />;
}

// Arbeitsraum «Administration» › Portfolios und Gremien (UI-47, BC AM.02.04)
const portfoliosRoute = createRoute({
  getParentRoute: () => rootRoute, path: '/administration/portfolios', validateSearch: searchOf.portfolios, component: PortfoliosRoute,
});

function PortfoliosRoute() {
  const search = portfoliosRoute.useSearch();
  const navigate = useNavigate({ from: portfoliosRoute.fullPath });
  const setSearch = useCallback<SetPortfoliosSearch>((next, o) => {
    void navigate({ search: prev => ({ ...prev, ...next }), replace: o?.replace ?? false });
  }, [navigate]);
  return <PortfoliosPage search={search} setSearch={setSearch} />;
}

// Arbeitsraum «Gremien»: Sitzungen (UI-33, UC-006, K3); Adresse der Sitzung `/gremien/<kuerzel>/sitzungen/<datum>` (I-N5)
const gremienRoute = createRoute({
  getParentRoute: () => rootRoute, path: '/gremien',
  beforeLoad: () => { throw redirect({ to: '/gremien/sitzungen', replace: true }); },
});

const sitzungenRoute = createRoute({ getParentRoute: () => rootRoute, path: '/gremien/sitzungen', component: SitzungenRoute });

function SitzungenRoute() {
  const navigate = useNavigate();
  return <SitzungenPage gehe={pfad => void navigate({ to: pfad })} />;
}

const sitzungRoute = createRoute({
  getParentRoute: () => rootRoute, path: '/gremien/$kuerzel/sitzungen/$datum', validateSearch: searchOf.sitzung, component: SitzungRoute,
});

function SitzungRoute() {
  const { kuerzel, datum } = sitzungRoute.useParams();
  const search = sitzungRoute.useSearch();
  const navigate = useNavigate({ from: sitzungRoute.fullPath });
  const setSearch = useCallback<SetSitzungSearch>((next, o) => {
    void navigate({ search: prev => ({ ...prev, ...next }), replace: o?.replace ?? false });
  }, [navigate]);
  return <SitzungPage key={`${kuerzel}/${datum}`} kuerzel={kuerzel} datum={datum} search={search} setSearch={setSearch} gehe={pfad => void navigate({ to: pfad })} />;
}

// Sitzungsmodus (UI-34), Protokoll (UI-35) und Entscheide (UI-36), AP-E2-2
const sitzungsmodusRoute = createRoute({
  getParentRoute: () => rootRoute, path: '/gremien/$kuerzel/sitzungen/$datum/modus', validateSearch: searchOf.sitzung, component: SitzungsmodusRoute,
});

function SitzungsmodusRoute() {
  const { kuerzel, datum } = sitzungsmodusRoute.useParams();
  const search = sitzungsmodusRoute.useSearch();
  const navigate = useNavigate({ from: sitzungsmodusRoute.fullPath });
  const setSearch = useCallback<SetSitzungSearch>((next, o) => {
    void navigate({ search: prev => ({ ...prev, ...next }), replace: o?.replace ?? false });
  }, [navigate]);
  return <SitzungsmodusPage key={`${kuerzel}/${datum}`} kuerzel={kuerzel} datum={datum} search={search} setSearch={setSearch} gehe={pfad => void navigate({ to: pfad })} />;
}

const protokollRoute = createRoute({ getParentRoute: () => rootRoute, path: '/gremien/$kuerzel/sitzungen/$datum/protokoll', component: ProtokollRoute });

function ProtokollRoute() {
  const { kuerzel, datum } = protokollRoute.useParams();
  const navigate = useNavigate();
  return <ProtokollPage key={`${kuerzel}/${datum}`} kuerzel={kuerzel} datum={datum} gehe={pfad => void navigate({ to: pfad })} />;
}

const entscheideRoute = createRoute({ getParentRoute: () => rootRoute, path: '/gremien/entscheide', validateSearch: searchOf.entscheide, component: EntscheideRoute });

function EntscheideRoute() {
  const search = entscheideRoute.useSearch();
  const navigate = useNavigate({ from: entscheideRoute.fullPath });
  const setSearch = useCallback<SetEntscheideSearch>((next, o) => {
    void navigate({ search: prev => ({ ...prev, ...next }), replace: o?.replace ?? false });
  }, [navigate]);
  return <EntscheidePage search={search} setSearch={setSearch} />;
}

const iamRoutes = makeIamRoutes(paths, features, { param: tanstackParam }).map(r =>
  createRoute({ getParentRoute: () => rootRoute, path: r.path, component: lazyRouteComponent(r.load) }));

// Galerie der Bausteine nur im Entwicklungsbuild; im Produktionsbuild entfällt sie samt Chunk (Q-L6)
const devRoutes = import.meta.env.DEV
  ? [createRoute({ getParentRoute: () => rootRoute, path: '/dev/galerie', component: lazyRouteComponent(() => import('./dev/Galerie.tsx'), 'Galerie') })]
  : [];

// Arbeitsraum «Administration»: Zugänge entziehen mit Neubesetzung (UI-42, UC-016 A1)
const zugaengeRoute = createRoute({
  getParentRoute: () => rootRoute, path: '/administration/zugaenge', validateSearch: searchOf.zugaenge, component: ZugaengeRoute,
});

function ZugaengeRoute() {
  const search = zugaengeRoute.useSearch();
  const navigate = useNavigate({ from: zugaengeRoute.fullPath });
  const setSearch = useCallback<SetZugaengeSearch>((next, o) => {
    void navigate({ search: prev => ({ ...prev, ...next }), replace: o?.replace ?? false });
  }, [navigate]);
  const gehe = useCallback((pfad: string) => { void navigate({ href: pfad }); }, [navigate]);
  return <ZugaengePage search={search} setSearch={setSearch} gehe={gehe} />;
}

const neubesetzungRoute = createRoute({ getParentRoute: () => rootRoute, path: '/administration/neubesetzungen/$id', component: NeubesetzungRoute });

function NeubesetzungRoute() {
  const { id } = neubesetzungRoute.useParams();
  const navigate = useNavigate();
  const gehe = useCallback((pfad: string) => { void navigate({ href: pfad }); }, [navigate]);
  return <NeubesetzungPage id={id} gehe={gehe} />;
}

const routeTree = rootRoute.addChildren([
  indexRoute,
  eingangRoute,
  kontoRoute,
  stellvertretungRoute,
  ...projekteRoutes(rootRoute),
  zieleRoute,
  handlungsfelderRoute,
  strategischeZieleRoute,
  gremienRoute,
  sitzungenRoute,
  sitzungRoute,
  sitzungsmodusRoute,
  protokollRoute,
  entscheideRoute,
  zielzyklusRoute,
  freigabeRoute,
  roadmapRoute,
  ideenRoute,
  ideeNeuRoute,
  ideeRoute,
  zielerreichungStartRoute,
  zielerreichungRoute,
  quartalsreportingStartRoute,
  quartalsreportingRoute,
  dashboardRoute,
  risikenRoute,
  portfolioberichtRoute,
  monatsabschlussRoute,
  organisationRoute,
  codetabellenRoute,
  vorlagenRoute,
  phasenmodellRoute,
  portfoliosRoute,
  zugaengeRoute,
  neubesetzungRoute,
  ressourcenRoute,
  auslastungRoute,
  kapazitaetRoute,
  bedarfRoute,
  priorisierungRoute,
  bewertungRoute,
  matrixRoute,
  modellRoute,
  ...iamRoutes,
  ...devRoutes,
]);

export const router = createRouter({ routeTree, defaultPreload: 'intent', scrollRestoration: true });

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}
