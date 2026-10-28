/** Abfragen und Änderungen für Ideenpool und Prüfung (AP-E4-2; BC DM.01.02–04, PP.02.04). */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Schemas } from '../../api/index.ts';
import { ideeKeys } from './api.ts';

export type PoolZeile = Schemas['IdeePoolZeile'];
export type Pruefung = Schemas['IdeePruefung'];
export type Funnel = Schemas['IdeeFunnel'];
export type Aehnlich = Schemas['IdeeAehnliche']['items'][number];
export type Kategorie = 'A' | 'B' | 'C';
export interface PoolFilter { stand?: string; handlungsfeld?: string; herkunft?: string }

export const pruefKeys = {
  pool: (f: PoolFilter) => ['idee', 'pool', f] as const,
  funnel: ['idee', 'funnel'] as const,
  pruefung: (id: string) => ['idee', 'pruefung', id] as const,
  aehnliche: (id: string) => ['idee', 'aehnliche', id] as const,
  portfolios: ['idee', 'portfolios'] as const,
};

/** Prüfung mit ETag der Idee für `If-Match`. */
export interface PruefungLoaded { item: Pruefung; etag: string }

export function usePool(f: PoolFilter) {
  return useInfiniteQuery({
    queryKey: pruefKeys.pool(f),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => (await api.GET('/v1/ideen/pool', {
      params: { query: { stand: f.stand ? [f.stand as PoolZeile['stand']] : undefined, handlungsfeld: f.handlungsfeld, herkunft: f.herkunft, sort: 'wartet', cursor: pageParam, limit: 50 } }, signal,
    })).data!,
    getNextPageParam: last => last.nextCursor ?? undefined,
  });
}

export function useFunnel() {
  return useQuery({ queryKey: pruefKeys.funnel, queryFn: async ({ signal }) => (await api.GET('/v1/ideen/pool/funnel', { signal })).data! });
}

export function usePruefung(id: string) {
  return useQuery({
    queryKey: pruefKeys.pruefung(id),
    queryFn: async ({ signal }): Promise<PruefungLoaded> => {
      const { data, response } = await api.GET('/v1/ideen/{id}/pruefung', { params: { path: { id } }, signal });
      return { item: data!, etag: response.headers.get('ETag') ?? '' };
    },
  });
}

export function useAehnliche(id: string, enabled: boolean) {
  return useQuery({
    queryKey: pruefKeys.aehnliche(id),
    enabled,
    queryFn: async ({ signal }) => (await api.GET('/v1/ideen/{id}/aehnliche', { params: { path: { id } }, signal })).data!.items,
  });
}

/** Portfolios für die Wahl bei Kategorie C (Direktion); `portfolio:read` hat jede Rolle. */
export function usePortfolios(enabled: boolean) {
  return useQuery({
    queryKey: pruefKeys.portfolios,
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) => (await api.GET('/v1/portfolios', { params: { query: { limit: 200 } }, signal })).data!.items,
  });
}

/** Nummer einer Idee über ihre ID (Verweis auf die führende Idee); null, wenn nicht sichtbar. */
export function useIdeeNummer(id: string | null) {
  return useQuery({
    queryKey: ['idee', 'nummer-von', id],
    enabled: !!id,
    queryFn: async ({ signal }) => (await api.GET('/v1/ideen/{id}', { params: { path: { id: id! } }, signal })).data?.nummer ?? null,
  });
}

export function usePruefungMutations(id: string) {
  const qc = useQueryClient();
  const nach = (l: PruefungLoaded) => {
    qc.setQueryData(pruefKeys.pruefung(id), l);
    // Listen, Kopf und Idee neu laden; die Prüfung selbst kommt mit der Antwort
    void qc.invalidateQueries({ queryKey: ideeKeys.all, predicate: q => q.queryKey[1] !== 'pruefung' });
    return l;
  };
  const geladen = (data: Pruefung | undefined, response: Response): PruefungLoaded => nach({ item: data!, etag: response.headers.get('ETag') ?? '' });
  const header = (etag: string) => ({ 'if-match': etag });
  return {
    leitfragen: useMutation({
      mutationFn: async ({ etag, body }: { etag: string; body: Schemas['IdeeLeitfragenIn'] }) => {
        const r = await api.PUT('/v1/ideen/{id}/leitfragen', { params: { path: { id }, header: header(etag) }, body });
        return geladen(r.data, r.response);
      },
    }),
    raster: useMutation({
      mutationFn: async ({ etag, body }: { etag: string; body: Schemas['IdeeRasterIn'] }) => {
        const r = await api.PUT('/v1/ideen/{id}/raster', { params: { path: { id }, header: header(etag) }, body });
        return geladen(r.data, r.response);
      },
    }),
    kategorie: useMutation({
      mutationFn: async ({ etag, body }: { etag: string; body: Schemas['IdeeKategorieIn'] }) => {
        const r = await api.POST('/v1/ideen/{id}/kategorie', { params: { path: { id }, header: header(etag) }, body });
        return geladen(r.data, r.response);
      },
    }),
    rueckfragen: useMutation({
      mutationFn: async ({ etag, body }: { etag: string; body: Schemas['IdeeRueckfragenIn'] }) => {
        const r = await api.POST('/v1/ideen/{id}/rueckfragen', { params: { path: { id }, header: header(etag) }, body });
        return geladen(r.data, r.response);
      },
    }),
    zurueckweisen: useMutation({
      mutationFn: async ({ etag, begruendung }: { etag: string; begruendung: string }) => {
        const r = await api.POST('/v1/ideen/{id}/zurueckweisen', { params: { path: { id }, header: header(etag) }, body: { begruendung } });
        return geladen(r.data, r.response);
      },
    }),
    /** Schliesst `schliessen` (diese oder die ähnliche Idee) als zusammengeführt; `etag` der zu schliessenden Idee. */
    zusammenfuehren: useMutation({
      mutationFn: async ({ schliessen, etag, fuehrendeIdeeId }: { schliessen: string; etag?: string; fuehrendeIdeeId: string }) => {
        const tag = etag ?? (await api.GET('/v1/ideen/{id}/pruefung', { params: { path: { id: schliessen } } })).response.headers.get('ETag') ?? '';
        await api.POST('/v1/ideen/{id}/zusammenfuehren', { params: { path: { id: schliessen }, header: header(tag) }, body: { fuehrendeIdeeId } });
        await qc.invalidateQueries({ queryKey: ['idee'] });
      },
    }),
  };
}
