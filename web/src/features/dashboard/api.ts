/** Abfrage des Dashboards (TanStack Query über den typisierten Client); BC PC.04.01, UC-014 Schritt 1. */
import { useQuery } from '@tanstack/react-query';
import { api, type Schemas } from '../../api/index.ts';
import type { paths } from '../../api/schema.d.ts';

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

/**
 * Export des Dashboards als CSV (UI-17, Seitentyp Bericht): die Projekte mit Phase und Auswahl wie in der Liste, über den
 * typisierten Client (gleiche Herkunft, Organisation im Kopf), im Browser gespeichert; liefert den Dateinamen.
 */
export async function dashboardExportieren(q: Omit<NonNullable<paths['/v1/dashboard']['get']['parameters']['query']>, 'format' | 'ansicht'> & { periode: string }): Promise<string> {
  const { data, response } = await api.GET('/v1/dashboard', { params: { query: { ...q, format: 'csv' } }, parseAs: 'blob' });
  const name = /filename="([^"]+)"/.exec(response.headers.get('content-disposition') ?? '')?.[1] ?? `dashboard-${q.periode}.csv`;
  const url = URL.createObjectURL(data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return name;
}
