/**
 * Routen (TanStack Router, code-basiert): Seiten der App mit typisierten Suchparametern (`search.ts`) und die
 * Verwalten-Seiten des Baukastens (`makeIamRoutes`, per `load()` erst bei Bedarf geladen).
 */
import { createRootRoute, createRoute, createRouter, lazyRouteComponent, redirect, useNavigate } from '@tanstack/react-router';
import { makeIamRoutes, tanstackParam } from '@vollholz/iam-web';
import { useCallback } from 'react';
import { Root } from './app.tsx';
import { features, paths } from './auth/index.ts';
import { EingangPage, type SetEingangSearch } from './features/eingang/index.ts';
import { HandlungsfeldPage, type SetHandlungsfeldSearch } from './features/handlungsfeld/index.ts';
import { StellvertretungPage, type SetKontoSearch } from './features/konto/index.ts';
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

const iamRoutes = makeIamRoutes(paths, features, { param: tanstackParam }).map(r =>
  createRoute({ getParentRoute: () => rootRoute, path: r.path, component: lazyRouteComponent(r.load) }));

// Galerie der Bausteine nur im Entwicklungsbuild; im Produktionsbuild entfällt sie samt Chunk (Q-L6)
const devRoutes = import.meta.env.DEV
  ? [createRoute({ getParentRoute: () => rootRoute, path: '/dev/galerie', component: lazyRouteComponent(() => import('./dev/Galerie.tsx'), 'Galerie') })]
  : [];

const routeTree = rootRoute.addChildren([indexRoute, eingangRoute, kontoRoute, stellvertretungRoute, zieleRoute, handlungsfelderRoute, ...iamRoutes, ...devRoutes]);

export const router = createRouter({ routeTree, defaultPreload: 'intent', scrollRestoration: true });

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}
