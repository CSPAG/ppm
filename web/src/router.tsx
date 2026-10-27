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
import { EntscheidePage, ProtokollPage, SitzungenPage, SitzungPage, SitzungsmodusPage, type SetEntscheideSearch, type SetSitzungSearch } from './features/sitzung/index.ts';
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

const routeTree = rootRoute.addChildren([indexRoute, zieleRoute, handlungsfelderRoute, strategischeZieleRoute, gremienRoute, sitzungenRoute, sitzungRoute, sitzungsmodusRoute, protokollRoute, entscheideRoute, phasenmodellRoute, ...iamRoutes, ...devRoutes]);

export const router = createRouter({ routeTree, defaultPreload: 'intent', scrollRestoration: true });

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}
