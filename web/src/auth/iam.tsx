/**
 * Anmeldung, Organisation je Tab und Rechte über `@vollholz/iam-web`: Produktname, Pfade und Schalter der App an
 * einer Stelle, Router-Adapter für TanStack Router, Farben über `--iam-*` (styles/tokens.css), Meldungen über die
 * Toasts der App.
 */
import { IamProvider, makeIamRoutes, tanstackParam, type IamFeatures, type IamPaths, type IamResources, type IamRouter } from '@vollholz/iam-web';
import '@vollholz/iam-web/styles.css';
import type { QueryClient } from '@tanstack/react-query';
import { useRouterState, type AnyRouter, type RouterHistory } from '@tanstack/react-router';
import type { MouseEvent, ReactNode } from 'react';
import { useToast } from '../ui/Toasts.tsx';

export const PRODUCT = 'PPM';

/** Pfade der Seiten von iam-web; `entra` passt zu `ENTRA_UI_PATH` des Servers (Standard). */
export const IAM_PATHS: Partial<IamPaths> = {
  home: '/',
  loggedOut: '/abgemeldet',
  members: '/verwalten/mitglieder',
  entra: '/verwalten/anmeldung',
  organizations: '/verwalten/organisationen',
};

/** Zugriff an Orten (Projekte), Anmeldung über Microsoft Entra ID und Plattform-Administration. */
export const IAM_FEATURES: IamFeatures = { access: true, entra: true, platform: true };

/** Verwalten-Seiten von iam-web mit Parametern in der Schreibweise von TanStack Router (`$alias`). */
export const iamRoutes = () => makeIamRoutes(IAM_PATHS, IAM_FEATURES, { param: tanstackParam });

/** Router-Adapter: iam-web navigiert mit vollständigen Pfaden und liest den unverarbeiteten Suchtext. */
export function tanstackIamRouter(router: AnyRouter): IamRouter {
  const history = router.history as RouterHistory;
  return {
    // Eigener Link statt <Link> des Routers: Seiten von iam-web zeichnen auch ausserhalb des RouterProvider (Konto, Plattform)
    Link: ({ to, children, ...p }) => {
      const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        history.push(to);
      };
      return <a href={to} onClick={onClick} {...p}>{children}</a>;
    },
    navigate: (to, o) => { if (o?.replace) history.replace(to); else history.push(to); },
    useSearch: () => useRouterState({ router, select: s => s.location.searchStr }),
    usePathname: () => useRouterState({ router, select: s => s.location.pathname }),
  };
}

export function AppIamProvider({ router, queryClient, resources, children }: {
  router: IamRouter; queryClient: QueryClient; resources?: IamResources; children: ReactNode;
}) {
  const toast = useToast();
  return (
    <IamProvider product={PRODUCT} router={router} queryClient={queryClient} paths={IAM_PATHS} features={IAM_FEATURES}
      resources={resources} components={{ toast }} onLogout={forgetLocal}>
      {children}
    </IamProvider>
  );
}

/** Persönliche Einstellungen im Browser beim Abmelden entfernen (das Thema bleibt: es ist keine Personenangabe). */
function forgetLocal() {
  try {
    for (const k of Object.keys(window.localStorage)) if (k.startsWith('ppm.') && k !== 'ppm.theme') window.localStorage.removeItem(k);
  } catch { /* Speicher gesperrt */ }
}
