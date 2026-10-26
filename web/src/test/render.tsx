/**
 * App mit fester Sitzung (StaticIam), echtem Router auf einer Speicher-Historie und nachgebildeter API
 * (mockIamApi): Tests sehen dieselben Routen, Suchparameter und Bausteine wie im Browser.
 */
import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_PATHS, type Me } from '@vollholz/iam-web';
import { mockIamApi, StaticIam, type MockHandler } from '@vollholz/iam-web/testing';
import { vi } from 'vitest';
import { IAM_FEATURES, IAM_PATHS, tanstackIamRouter } from '../auth/iam.tsx';
import { createAppRouter } from '../router.tsx';
import { ToastProvider } from '../ui/Toasts.tsx';
import { EDITOR, PPM_CATALOG } from './fixtures.ts';

export function renderApp(url: string, { me = EDITOR, routes = {} }: { me?: Partial<Me>; routes?: Record<string, MockHandler> } = {}) {
  const api = mockIamApi(routes, { catalog: PPM_CATALOG });
  vi.stubGlobal('fetch', api.fetch);
  const router = createAppRouter(createMemoryHistory({ initialEntries: [url] }));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const config = { router: tanstackIamRouter(router), features: IAM_FEATURES, paths: { ...DEFAULT_PATHS, ...IAM_PATHS }, product: 'PPM' };
  const view = render(
    <ToastProvider>
      <StaticIam me={me} queryClient={queryClient} config={config}>
        <RouterProvider router={router} />
      </StaticIam>
    </ToastProvider>,
  );
  /** Aufrufe an einen Pfad (ohne Suchtext), z. B. `calls('GET /v1/projekte')`. */
  const calls = (key: string) => api.calls.filter(r => `${r.method} ${new URL(r.url).pathname}` === key);
  return { ...view, api, router, calls, user: userEvent.setup() };
}
