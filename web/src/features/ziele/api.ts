/** Abfragen und Änderungen der strategischen Ziele (TanStack Query über den typisierten Client); BC ZM.01.02. */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ifMatch, type Schemas } from '../../api/index.ts';

export type StrategischesZiel = Schemas['StrategischesZiel'];
export type StrategischesZielInput = Schemas['StrategischesZielCreate'];
export type ZielVersion = Schemas['StrategischesZielVersion'];
export interface HandlungsfeldKurz { id: string; label: string }

export const zielKeys = {
  all: ['strategisches-ziel'] as const,
  list: (q: string) => ['strategisches-ziel', 'list', q] as const,
  nummer: (nummer: string) => ['strategisches-ziel', 'nummer', nummer] as const,
  history: (id: string) => ['strategisches-ziel', 'history', id] as const,
  handlungsfelder: ['strategisches-ziel', 'handlungsfelder'] as const,
};

/** Aktuelle Fassung mit ETag für `If-Match` (Rückfall: Version). */
export interface Loaded { item: StrategischesZiel; etag: string }
const loaded = (item: StrategischesZiel, response?: Response): Loaded => ({ item, etag: response?.headers.get('ETag') ?? ifMatch(item.version)['If-Match']! });

export function useZielList(q: string) {
  return useInfiniteQuery({
    queryKey: zielKeys.list(q),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await api.GET('/v1/strategische-ziele', { params: { query: { q: q || undefined, cursor: pageParam, limit: 50 } }, signal });
      return data!;
    },
    getNextPageParam: last => last.nextCursor ?? undefined,
  });
}

/** Ziel über seine Nummer (Adresse `?o=2.1`); `null`, wenn es keines gibt oder die Person es nicht sieht. */
export function useZielNachNummer(nummer: string | null) {
  return useQuery({
    queryKey: zielKeys.nummer(nummer ?? ''),
    enabled: !!nummer,
    queryFn: async ({ signal }): Promise<Loaded | null> => {
      const { data } = await api.GET('/v1/strategische-ziele', { params: { query: { nummer: nummer!, limit: 1 } }, signal });
      const hit = data!.items[0];
      if (!hit) return null;
      const one = await api.GET('/v1/strategische-ziele/{id}', { params: { path: { id: hit.id } }, signal });
      return loaded(one.data!, one.response);
    },
  });
}

export function useZielHistory(id: string) {
  return useQuery({
    queryKey: zielKeys.history(id),
    queryFn: async ({ signal }) => (await api.GET('/v1/strategische-ziele/{id}/history', { params: { path: { id } }, signal })).data!.items,
  });
}

/**
 * Handlungsfelder für Auswahl und Anzeige: über die API der Handlungsfelder (das Feature «Handlungsfelder» bleibt
 * unberührt). Ohne `handlungsfeld:read` bleibt die Liste leer.
 */
export function useHandlungsfelder(enabled: boolean) {
  return useQuery({
    queryKey: zielKeys.handlungsfelder,
    enabled,
    staleTime: 60_000,
    queryFn: async ({ signal }): Promise<HandlungsfeldKurz[]> =>
      (await api.GET('/v1/handlungsfelder', { params: { query: { limit: 200 } }, signal })).data!.items.map(h => ({ id: h.id, label: h.label })),
  });
}

export function useZielMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: zielKeys.all });
  const create = useMutation({
    mutationFn: async ({ body, key }: { body: StrategischesZielInput; key: string }) => {
      const { data, response } = await api.POST('/v1/strategische-ziele', { body, params: { header: { 'idempotency-key': key } } });
      return loaded(data!, response);
    },
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: async ({ id, etag, body }: { id: string; etag: string; body: Schemas['StrategischesZielPatch'] }) => {
      const { data, response } = await api.PATCH('/v1/strategische-ziele/{id}', { params: { path: { id }, header: { 'if-match': etag } }, body });
      return loaded(data!, response);
    },
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: async ({ id, etag }: { id: string; etag: string }) => {
      await api.DELETE('/v1/strategische-ziele/{id}', { params: { path: { id }, header: { 'if-match': etag } } });
    },
    onSuccess: refresh,
  });
  return { create, update, remove };
}

/** Suche für die Befehlspalette (I-N4). */
export async function sucheZiele(q: string, signal: AbortSignal): Promise<StrategischesZiel[]> {
  const { data } = await api.GET('/v1/strategische-ziele', { params: { query: { q, limit: 5 } }, signal });
  return data!.items;
}
