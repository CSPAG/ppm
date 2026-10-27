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
import { AuslastungPage, KapazitaetPage, ressourcenPfad, type SetAuslastungSearch, type SetKapazitaetSearch } from './features/ressourcen/index.ts';
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

const iamRoutes = makeIamRoutes(paths, features, { param: tanstackParam }).map(r =>
  createRoute({ getParentRoute: () => rootRoute, path: r.path, component: lazyRouteComponent(r.load) }));

// Galerie der Bausteine nur im Entwicklungsbuild; im Produktionsbuild entfällt sie samt Chunk (Q-L6)
const devRoutes = import.meta.env.DEV
  ? [createRoute({ getParentRoute: () => rootRoute, path: '/dev/galerie', component: lazyRouteComponent(() => import('./dev/Galerie.tsx'), 'Galerie') })]
  : [];

const routeTree = rootRoute.addChildren([indexRoute, zieleRoute, handlungsfelderRoute, strategischeZieleRoute, ressourcenRoute, auslastungRoute, kapazitaetRoute, ...iamRoutes, ...devRoutes]);

export const router = createRouter({ routeTree, defaultPreload: 'intent', scrollRestoration: true });

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}
