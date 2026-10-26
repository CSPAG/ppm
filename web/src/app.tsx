/**
 * Zusammensetzung: Server-Zustand, Meldungen, Sitzung (iam-web) und Router. Hier treffen Features und Basis
 * aufeinander (Namen der Projekte für «Zugriff», Sprung zu einem Projekt).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { ApiError, type IamResources } from '@vollholz/iam-web';
import { useMemo } from 'react';
import { AppIamProvider, tanstackIamRouter } from './auth/iam.tsx';
import { useProjektNames } from './features/projekt/index.ts';
import type { AppRouter } from './router.tsx';
import { ToastProvider } from './ui/Toasts.tsx';

/** Abfragen: Fehler 4xx nicht wiederholen (Rechte, Nicht gefunden, Konflikt), sonst bis zweimal. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: (n, e) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && n < 2 },
      mutations: { retry: false },
    },
  });
}

export function App({ router, queryClient }: { router: AppRouter; queryClient: QueryClient }) {
  const iamRouter = useMemo(() => tanstackIamRouter(router), [router]);
  const resources = useMemo<IamResources>(() => ({
    useResolver: useProjektNames,
    open: ref => { if (ref.type === 'projekt' && ref.id) router.history.push(`/projekte?o=${encodeURIComponent(ref.id)}`); },
  }), [router]);
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AppIamProvider router={iamRouter} queryClient={queryClient} resources={resources}>
          <RouterProvider router={router} />
        </AppIamProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
