/**
 * Abfragen und Änderungen der Matrix (AP-E5-2; BC PP.03.04, PP.02.02, PP.02.03, PC.02.01): Matrix und Rangfolge des
 * Portfolios, Abhängigkeiten des Projekts und Portfoliorisiken aus den Registern von `projektdaten`.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, newIdempotencyKey, type Schemas } from '../../api/index.ts';

export type Matrix = Schemas['Matrix'];
export type MatrixProjekt = Matrix['projekte'][number];
export type Rangfolge = Schemas['Rangfolge'];
export type RangEintrag = Schemas['RangfolgePut']['projekte'][number];
export type Abhaengigkeit = Schemas['Abhaengigkeit'];
export type Risiko = Schemas['Risiko'];
export type RisikoNeu = Schemas['RisikoCreate'];

export const matrixKeys = {
  matrix: (portfolioId: string) => ['priorisierung', 'matrix', portfolioId] as const,
  rangfolge: (portfolioId: string) => ['priorisierung', 'rangfolge', portfolioId] as const,
  abhaengigkeiten: (projektId: string) => ['priorisierung', 'abhaengigkeiten', projektId] as const,
  risiken: (portfolioId: string) => ['priorisierung', 'risiken', portfolioId] as const,
};

export function useMatrix(portfolioId: string | null) {
  return useQuery({
    queryKey: matrixKeys.matrix(portfolioId ?? ''),
    enabled: !!portfolioId,
    queryFn: async ({ signal }) => (await api.GET('/v1/portfolios/{id}/matrix', { params: { path: { id: portfolioId! } }, signal })).data!,
  });
}

/** Rangfolge mit ETag für `If-Match`. */
export function useRangfolge(portfolioId: string | null) {
  return useQuery({
    queryKey: matrixKeys.rangfolge(portfolioId ?? ''),
    enabled: !!portfolioId,
    queryFn: async ({ signal }) => {
      const r = await api.GET('/v1/portfolios/{id}/rangfolge', { params: { path: { id: portfolioId! } }, signal });
      return { item: r.data!, etag: r.response.headers.get('ETag') ?? `W/"${r.data!.version}"` };
    },
  });
}

export function useRangfolgeSpeichern(portfolioId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ etag, projekte }: { etag: string; projekte: RangEintrag[] }) => {
      const r = await api.PUT('/v1/portfolios/{id}/rangfolge', { params: { path: { id: portfolioId }, header: { 'if-match': etag } }, body: { projekte } });
      return { item: r.data!, etag: r.response.headers.get('ETag') ?? `W/"${r.data!.version}"` };
    },
    onSuccess: neu => {
      qc.setQueryData(matrixKeys.rangfolge(portfolioId), neu);
      void qc.invalidateQueries({ queryKey: matrixKeys.matrix(portfolioId) });
    },
  });
}

export function useAbhaengigkeiten(projektId: string | null) {
  return useQuery({
    queryKey: matrixKeys.abhaengigkeiten(projektId ?? ''),
    enabled: !!projektId,
    queryFn: async ({ signal }) => (await api.GET('/v1/projekte/{id}/abhaengigkeiten', { params: { path: { id: projektId! }, query: { limit: 200 } }, signal })).data!,
  });
}

export function useAbhaengigkeitAnlegen(projektId: string, portfolioId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { zuProjektId: string; text: string }) => (await api.POST('/v1/projekte/{id}/abhaengigkeiten', { params: { path: { id: projektId }, header: { 'idempotency-key': newIdempotencyKey() } }, body })).data!,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['priorisierung', 'abhaengigkeiten'] });
      void qc.invalidateQueries({ queryKey: matrixKeys.matrix(portfolioId) });
    },
  });
}

export function useRisiken(portfolioId: string | null) {
  return useQuery({
    queryKey: matrixKeys.risiken(portfolioId ?? ''),
    enabled: !!portfolioId,
    queryFn: async ({ signal }) => (await api.GET('/v1/portfolios/{id}/risiken', { params: { path: { id: portfolioId! }, query: { limit: 200 } }, signal })).data!,
  });
}

export function useRisikoErfassen(portfolioId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: RisikoNeu) => (await api.POST('/v1/portfolios/{id}/risiken', { params: { path: { id: portfolioId }, header: { 'idempotency-key': newIdempotencyKey() } }, body })).data!,
    onSuccess: () => void qc.invalidateQueries({ queryKey: matrixKeys.risiken(portfolioId) }),
  });
}
