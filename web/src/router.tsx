/**
 * Routen (code-basiert, TanStack Router). Hier registrieren die Features ihre Seiten und Einträge in Navigation und
 * Befehlspalette; Suchparameter prüft `search.ts`. Die Verwalten-Seiten kommen aus iam-web (`makeIamRoutes`) und
 * laden erst bei Bedarf.
 */
import { createBrowserHistory, createRootRoute, createRoute, createRouter, redirect, type RouterHistory } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { iamRoutes } from './auth/iam.tsx';
import { ProjektePage } from './features/projekt/index.ts';
import { projekteSearch } from './search.ts';
import { AppShell } from './shell/AppShell.tsx';
import { ShellContext, type ShellConfig } from './shell/context.ts';
import { NotFound } from './shell/NotFound.tsx';
import { Loading } from './ui/states.tsx';

/** Navigation und Befehle der Features. */
export const SHELL: ShellConfig = {
  nav: [{ to: '/projekte', label: 'Projekte', icon: 'folder', perm: 'projekt:read' }],
  actions: [{ id: 'projekt:neu', label: 'Neues Projekt', group: 'Aktionen', keywords: 'anlegen erstellen', to: '/projekte?neu=true', perm: 'projekt:write' }],
};

const rootRoute = createRootRoute({
  component: () => <ShellContext.Provider value={SHELL}><AppShell /></ShellContext.Provider>,
  notFoundComponent: NotFound,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  // Umleitung nach Art des Routers: `redirect()` wird geworfen
  // eslint-disable-next-line @typescript-eslint/only-throw-error
  beforeLoad: () => { throw redirect({ to: '/projekte', replace: true }); },
});

const projekteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projekte',
  validateSearch: projekteSearch,
  component: function ProjekteRoute() {
    const search = projekteRoute.useSearch();
    const navigate = projekteRoute.useNavigate();
    return <ProjektePage search={search} onSearch={(next, o) => void navigate({ search: next, replace: o?.replace })} />;
  },
});

/** Verwalten › Mitglieder, Anmeldung (Entra ID), Organisationen (Plattform) – mit Guard aus iam-web. */
const iamChildren = iamRoutes().map(r => {
  const Page = lazy(r.load);
  return createRoute({
    getParentRoute: () => rootRoute,
    path: r.path,
    component: () => <Suspense fallback={<Loading />}><div className="page page-iam"><Page /></div></Suspense>,
  });
});

const routeTree = rootRoute.addChildren([indexRoute, projekteRoute, ...iamChildren]);

export function createAppRouter(history: RouterHistory = createBrowserHistory()) {
  return createRouter({ routeTree, history, defaultNotFoundComponent: NotFound, scrollRestoration: true });
}

export type AppRouter = ReturnType<typeof createAppRouter>;

declare module '@tanstack/react-router' {
  interface Register { router: AppRouter }
}
