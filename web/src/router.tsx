/**
 * Routen (TanStack Router, code-basiert): Seiten der App mit typisierten Suchparametern (`search.ts`) und die
 * Verwalten-Seiten des Baukastens (`makeIamRoutes`, per `load()` erst bei Bedarf geladen).
 */
import { createRootRoute, createRoute, createRouter, lazyRouteComponent, notFound, redirect, useNavigate } from '@tanstack/react-router';
import { makeIamRoutes, tanstackParam } from '@vollholz/iam-web';
import { Suspense, useCallback } from 'react';
import { Root } from './app.tsx';
import { features, paths } from './auth/index.ts';
import { projekteRoutes } from './routes/projekte.tsx';
import { EingangPage, type SetEingangSearch } from './features/eingang/index.ts';
import { HandlungsfeldPage, type SetHandlungsfeldSearch } from './features/handlungsfeld/index.ts';
import { IdeeNeuPage, IdeenPage, IdeePage, nummerAusPfad, type SetIdeeSearch } from './features/idee/index.ts';
import { AuslastungPage, KapazitaetPage, ressourcenPfad, type SetAuslastungSearch, type SetKapazitaetSearch } from './features/ressourcen/index.ts';
import { DashboardPage, type SetDashboardSearch } from './features/dashboard/index.ts';
import { MonatsabschlussPage, type SetMonatsabschlussSearch } from './features/monatsabschluss/index.ts';
import { PhasenmodellPage, type SetPhasenmodellSearch } from './features/phasenmodell/index.ts';
import { PortfoliosPage, type SetPortfoliosSearch } from './features/portfolios/index.ts';
import { type SetSitzungSearch, SitzungenPage, SitzungPage } from './features/sitzung/index.ts';
import { CodetabellenPage, OrganisationPage, type SetCodetabellenSearch, type SetOrganisationSearch } from './features/stammdaten/index.ts';
import { type SetKontoSearch, StellvertretungPage } from './features/konto/index.ts';
import { abgeschlossenesQuartal, type QuartalNr, type SetZielSearch, type SetZielzyklusSearch, ZielePage, ZielerreichungPage, ZIELJAHR, ZielzyklusPage } from './features/ziele/index.ts';
import { searchOf } from './search.ts';
import { NotFound } from './shell/index.ts';

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
  return <EingangPage search={search} setSearch={setSearch} gehe={gehe} />;
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
      strategischeZiele={() => void navigate({ to: '/ziele/strategische-ziele', search: {} })} />
  );
}

// Arbeitsraum «Portfolio» › Ideen (K4, AP-E4-1): Meine Ideen, Assistent für eine neue Idee, Idee über ihre Nummer
const ideenRoute = createRoute({ getParentRoute: () => rootRoute, path: '/portfolio/ideen', component: IdeenRoute });

function IdeenRoute() {
  const navigate = useNavigate();
  const gehe = useCallback((pfad: string) => { void navigate({ href: pfad }); }, [navigate]);
  return <IdeenPage gehe={gehe} />;
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
  return <Suspense fallback={null}><DashboardPage search={search} setSearch={setSearch} /></Suspense>;
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
  return <SitzungPage key={`${kuerzel}/${datum}`} kuerzel={kuerzel} datum={datum} search={search} setSearch={setSearch} />;
}

const iamRoutes = makeIamRoutes(paths, features, { param: tanstackParam }).map(r =>
  createRoute({ getParentRoute: () => rootRoute, path: r.path, component: lazyRouteComponent(r.load) }));

// Galerie der Bausteine nur im Entwicklungsbuild; im Produktionsbuild entfällt sie samt Chunk (Q-L6)
const devRoutes = import.meta.env.DEV
  ? [createRoute({ getParentRoute: () => rootRoute, path: '/dev/galerie', component: lazyRouteComponent(() => import('./dev/Galerie.tsx'), 'Galerie') })]
  : [];

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
  zielzyklusRoute,
  ideenRoute,
  ideeNeuRoute,
  ideeRoute,
  zielerreichungStartRoute,
  zielerreichungRoute,
  dashboardRoute,
  monatsabschlussRoute,
  organisationRoute,
  codetabellenRoute,
  phasenmodellRoute,
  portfoliosRoute,
  ressourcenRoute,
  auslastungRoute,
  kapazitaetRoute,
  ...iamRoutes,
  ...devRoutes,
]);

export const router = createRouter({ routeTree, defaultPreload: 'intent', scrollRestoration: true });

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}
