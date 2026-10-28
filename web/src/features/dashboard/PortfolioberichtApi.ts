/**
 * Abfragen und Aktionen der Risikolage (UI-18) und des Portfolioberichts (UI-29); BC PC.02.02, PC.04.02, UC-014
 * Schritte 2–3. Erzeugen, Kommentar und Bereitstellen gelten erst nach der Antwort des Servers als erledigt (I-R2).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ifMatch, type Schemas } from '../../api/index.ts';

export type Risikolage = Schemas['Risikolage'];
export type RisikolageRisiko = Schemas['RisikolageRisiko'];
export type Portfoliobericht = Schemas['Portfoliobericht'];
export type PortfolioberichtKurz = Schemas['PortfolioberichtKurz'];

export const berichtKeys = {
  all: ['portfoliobericht'] as const,
  risiken: (portfolio: string) => ['risikolage', portfolio] as const,
  liste: (portfolio: string) => ['portfoliobericht', 'liste', portfolio] as const,
  bericht: (id: string) => ['portfoliobericht', id] as const,
};

export function useRisikolage(portfolio: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: berichtKeys.risiken(portfolio ?? ''),
    enabled,
    queryFn: async ({ signal }) => (await api.GET('/v1/dashboard/risiken', { params: { query: { portfolio } }, signal })).data!,
  });
}

export function useBerichte(portfolio: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: berichtKeys.liste(portfolio ?? ''),
    enabled,
    queryFn: async ({ signal }) => (await api.GET('/v1/portfolioberichte', { params: { query: { portfolio } }, signal })).data!.items,
  });
}

export function useBericht(id: string | undefined) {
  return useQuery({
    queryKey: berichtKeys.bericht(id ?? ''),
    enabled: !!id,
    queryFn: async ({ signal }) => (await api.GET('/v1/portfolioberichte/{id}', { params: { path: { id: id! } }, signal })).data!,
  });
}

/** Adresse des Dokuments (same-origin, Download über den Browser). */
export const dokumentUrl = (id: string, format: 'pdf' | 'docx') => `/v1/portfolioberichte/${id}/dokument?format=${format}`;

export function useBerichtAktionen() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: berichtKeys.all });
  const setzen = (b: Portfoliobericht) => qc.setQueryData(berichtKeys.bericht(b.id), b);
  const erzeugen = useMutation({
    mutationFn: async (v: { portfolio: string; periode: string }) => (await api.POST('/v1/portfolioberichte', { body: v })).data!,
    onSuccess: setzen, onSettled: refresh,
  });
  const kommentieren = useMutation({
    mutationFn: async ({ b, kommentar }: { b: Portfoliobericht; kommentar: string }) =>
      (await api.PATCH('/v1/portfolioberichte/{id}', { params: { path: { id: b.id }, header: lower(ifMatch(b.version)) }, body: { kommentar } })).data!,
    onSuccess: setzen, onSettled: refresh,
  });
  const bereitstellen = useMutation({
    mutationFn: async (b: Portfoliobericht) =>
      (await api.POST('/v1/portfolioberichte/{id}/bereitstellen', { params: { path: { id: b.id }, header: lower(ifMatch(b.version)) } })).data!,
    onSuccess: setzen, onSettled: refresh,
  });
  return { erzeugen, kommentieren, bereitstellen };
}

/** `If-Match` als Kopfzeile in Kleinbuchstaben (Schema der API). */
const lower = (h: Record<string, string | undefined>) => ({ 'if-match': h['If-Match']! });
