/**
 * Anbindung an den Baukasten: `IamProvider` mit Router-Adapter (TanStack Router), Pfaden der Verwalten-Seiten,
 * Microsoft Entra ID und dem Adapter der Orte (Namen und Sprung, von der App übergeben). Ohne Sitzung zeigt der Provider
 * Anmeldung, Auswahl der Organisation und «Sitzung abgelaufen»; die App rendert erst danach.
 */
import { QueryClient } from '@tanstack/react-query';
import { useRouter, useRouterState } from '@tanstack/react-router';
import { ApiError, IamProvider, type IamFeatures, type IamLinkProps, type IamResources, type IamRouter } from '@vollholz/iam-web';
import { useMemo, type ReactNode } from 'react';
import './permissions.ts';

export const features: IamFeatures = { entra: true, platform: true };
export const paths = { home: '/ziele/handlungsfelder' };

/** Wiederholen nur bei Netz- und Serverfehlern; 4xx (z. B. 404 «gibt es nicht mehr») sofort anzeigen statt nach drei Versuchen. */
export function retryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 3;
}

export const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: retryQuery } } });

/** Router-Adapter: Pfad mit Suchtext wie die Seiten des Baukastens ihn liefern. */
export function useIamRouter(): IamRouter {
  const router = useRouter();
  return useMemo<IamRouter>(() => ({
    Link: ({ to, children, ...rest }: IamLinkProps) => (
      <a href={to} {...rest} onClick={e => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        router.history.push(to);
      }}>{children}</a>
    ),
    navigate: (to, o) => (o?.replace ? router.history.replace(to) : router.history.push(to)),
    useSearch: () => useRouterState({ select: s => s.location.searchStr }),
    usePathname: () => useRouterState({ select: s => s.location.pathname }),
  }), [router]);
}

export function AppIam({ resources, children }: { resources?: IamResources; children: ReactNode }) {
  const router = useIamRouter();
  return (
    <IamProvider product="PPM" router={router} paths={paths} features={features} resources={resources} queryClient={queryClient}>
      {children}
    </IamProvider>
  );
}
