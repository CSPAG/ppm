/** Abfrage des Dashboards (TanStack Query über den typisierten Client); BC PC.04.01, UC-014 Schritt 1. */
import { useQuery } from '@tanstack/react-query';
import { api, type Schemas } from '../../api/index.ts';

export type Dashboard = Schemas['Dashboard'];
export type DashboardZeile = Schemas['DashboardZeile'];
export type FunnelStufe = Schemas['FunnelStufe'];

export const dashboardKeys = {
  all: ['dashboard'] as const,
  periode: (portfolio: string, periode: string) => ['dashboard', portfolio, periode] as const,
};

export function useDashboard(portfolio: string | undefined, periode: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: dashboardKeys.periode(portfolio ?? '', periode ?? ''),
    enabled,
    queryFn: async ({ signal }) => (await api.GET('/v1/dashboard', { params: { query: { portfolio, periode } }, signal })).data!,
  });
}
