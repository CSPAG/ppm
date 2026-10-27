/**
 * Routen (TanStack Router, code-basiert): Seiten der App mit typisierten Suchparametern (`search.ts`) und die
 * Verwalten-Seiten des Baukastens (`makeIamRoutes`, per `load()` erst bei Bedarf geladen).
 */
import { createRootRoute, createRoute, createRouter, lazyRouteComponent, notFound, redirect, useNavigate } from '@tanstack/react-router';
import { makeIamRoutes, tanstackParam } from '@vollholz/iam-web';
import { useCallback } from 'react';
import { Root } from './app.tsx';
import { features, paths } from './auth/index.ts';
import { EingangPage, type SetEingangSearch } from './features/eingang/index.ts';
import { HandlungsfeldPage, type SetHandlungsfeldSearch } from './features/handlungsfeld/index.ts';
import { PhasenmodellPage, type SetPhasenmodellSearch } from './features/phasenmodell/index.ts';
import { CodetabellenPage, OrganisationPage, type SetCodetabellenSearch, type SetOrganisationSearch } from './features/stammdaten/index.ts';
import { StellvertretungPage, type SetKontoSearch } from './features/konto/index.ts';
import { abgeschlossenesQuartal, ZielePage, ZielerreichungPage, type QuartalNr, type SetZielSearch } from './features/ziele/index.ts';
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
  zieleRoute,
  handlungsfelderRoute,
  strategischeZieleRoute,
  zielerreichungStartRoute,
  zielerreichungRoute,
  organisationRoute,
  codetabellenRoute,
  phasenmodellRoute,
  ...iamRoutes,
  ...devRoutes,
]);

export const router = createRouter({ routeTree, defaultPreload: 'intent', scrollRestoration: true });

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}
