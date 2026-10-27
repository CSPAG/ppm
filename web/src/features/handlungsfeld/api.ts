/** Abfragen und Änderungen der Handlungsfelder (TanStack Query über den typisierten Client). */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ifMatch, type Schemas } from '../../api/index.ts';

export type Handlungsfeld = Schemas['Handlungsfeld'];
export type HandlungsfeldInput = Schemas['HandlungsfeldCreate'];

export const handlungsfeldKeys = {
  all: ['handlungsfeld'] as const,
  list: (q: string) => ['handlungsfeld', 'list', q] as const,
  one: (id: string) => ['handlungsfeld', 'one', id] as const,
  history: (id: string) => ['handlungsfeld', 'history', id] as const,
};

/** Aktuelle Fassung mit ETag für `If-Match` (Rückfall: Version). */
export interface Loaded { item: Handlungsfeld; etag: string }
const loaded = (item: Handlungsfeld, response: Response): Loaded => ({ item, etag: response.headers.get('ETag') ?? ifMatch(item.version)['If-Match']! });

export function useHandlungsfeldList(q: string) {
  return useInfiniteQuery({
    queryKey: handlungsfeldKeys.list(q),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await api.GET('/v1/handlungsfelder', { params: { query: { q: q || undefined, cursor: pageParam, limit: 50 } }, signal });
      return data!;
    },
    getNextPageParam: last => last.nextCursor ?? undefined,
  });
}

export function useHandlungsfeld(id: string | null) {
  return useQuery({
    queryKey: handlungsfeldKeys.one(id ?? ''),
    enabled: !!id,
    queryFn: async ({ signal }) => {
      const { data, response } = await api.GET('/v1/handlungsfelder/{id}', { params: { path: { id: id! } }, signal });
      return loaded(data!, response);
    },
  });
}

export function useHandlungsfeldHistory(id: string, enabled = true) {
  return useQuery({
    queryKey: handlungsfeldKeys.history(id),
    enabled,
    queryFn: async ({ signal }) => (await api.GET('/v1/handlungsfelder/{id}/history', { params: { path: { id } }, signal })).data!.items,
  });
}

export function useHandlungsfeldMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: handlungsfeldKeys.all });
  const create = useMutation({
    mutationFn: async ({ body, key }: { body: HandlungsfeldInput; key: string }) => {
      const { data, response } = await api.POST('/v1/handlungsfelder', { body, params: { header: { 'idempotency-key': key } } });
      return loaded(data!, response);
    },
    onSuccess: async l => { qc.setQueryData(handlungsfeldKeys.one(l.item.id), l); await refresh(); },
  });
  const update = useMutation({
    mutationFn: async ({ id, etag, body }: { id: string; etag: string; body: Schemas['HandlungsfeldPatch'] }) => {
      const { data, response } = await api.PATCH('/v1/handlungsfelder/{id}', { params: { path: { id }, header: { 'if-match': etag } }, body });
      return loaded(data!, response);
    },
    onSuccess: async l => { qc.setQueryData(handlungsfeldKeys.one(l.item.id), l); await refresh(); },
  });
  const remove = useMutation({
    mutationFn: async ({ id, etag }: { id: string; etag: string }) => {
      await api.DELETE('/v1/handlungsfelder/{id}', { params: { path: { id }, header: { 'if-match': etag } } });
    },
    onSuccess: async (_r, { id }) => { qc.removeQueries({ queryKey: handlungsfeldKeys.one(id) }); await refresh(); },
  });
  return { create, update, remove };
}

/** Suche für die Befehlspalette (I-N4): die ersten Handlungsfelder zum Suchtext, nur die sichtbaren (API). */
export async function sucheHandlungsfelder(q: string, signal: AbortSignal): Promise<Handlungsfeld[]> {
  const { data } = await api.GET('/v1/handlungsfelder', { params: { query: { q, limit: 5 } }, signal });
  return data!.items;
}
