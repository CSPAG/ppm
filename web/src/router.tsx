/**
 * Routen (TanStack Router, code-basiert): Seiten der App mit typisierten Suchparametern (`search.ts`) und die
 * Verwalten-Seiten des Baukastens (`makeIamRoutes`, per `load()` erst bei Bedarf geladen).
 */
import { createRootRoute, createRoute, createRouter, lazyRouteComponent, redirect, useNavigate } from '@tanstack/react-router';
import { makeIamRoutes, tanstackParam } from '@vollholz/iam-web';
import { useCallback } from 'react';
import { Root } from './app.tsx';
import { features, paths } from './auth/index.ts';
import { HandlungsfeldPage, type SetHandlungsfeldSearch } from './features/handlungsfeld/index.ts';
import { PhasenmodellPage, type SetPhasenmodellSearch } from './features/phasenmodell/index.ts';
import { SitzungenPage, SitzungPage, type SetSitzungSearch } from './features/sitzung/index.ts';
import { CodetabellenPage, OrganisationPage, type SetCodetabellenSearch, type SetOrganisationSearch } from './features/stammdaten/index.ts';
import { ZielePage, type SetZielSearch } from './features/ziele/index.ts';
import { searchOf } from './search.ts';
import { NotFound } from './shell/index.ts';

const rootRoute = createRootRoute({ component: Root, notFoundComponent: NotFound });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute, path: '/',
  beforeLoad: () => { throw redirect({ to: '/ziele/handlungsfelder', replace: true }); },
});

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

const routeTree = rootRoute.addChildren([indexRoute, zieleRoute, handlungsfelderRoute, strategischeZieleRoute, gremienRoute, sitzungenRoute, sitzungRoute, organisationRoute, codetabellenRoute, phasenmodellRoute, ...iamRoutes, ...devRoutes]);

export const router = createRouter({ routeTree, defaultPreload: 'intent', scrollRestoration: true });

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}
