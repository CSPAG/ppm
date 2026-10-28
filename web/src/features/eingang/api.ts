/** Abfragen des Eingangs (TanStack Query über den typisierten Client): Aufgaben, Anzahl, Mitteilungen, Vertretungen. */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, newIdempotencyKey, type Schemas } from '../../api/index.ts';

export type Aufgabe = Schemas['Aufgabe'];
export type Mitteilung = Schemas['Mitteilung'];
export type Stellvertretung = Schemas['Stellvertretung'];

export const eingangKeys = {
  all: ['eingang'] as const,
  aufgaben: (filter: string) => ['eingang', 'aufgaben', filter] as const,
  anzahl: ['eingang', 'anzahl'] as const,
  mitteilungen: ['eingang', 'mitteilungen'] as const,
  vertretungen: ['eingang', 'vertretungen'] as const,
};

export function useAufgaben(filter: 'frist' | undefined) {
  return useInfiniteQuery({
    queryKey: eingangKeys.aufgaben(filter ?? ''),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) =>
      (await api.GET('/v1/eingang', { params: { query: { filter, cursor: pageParam, limit: 50 } }, signal })).data!,
    getNextPageParam: last => last.nextCursor ?? undefined,
  });
}

export function useAnzahl() {
  return useQuery({ queryKey: eingangKeys.anzahl, queryFn: async ({ signal }) => (await api.GET('/v1/eingang/anzahl', { signal })).data! });
}

export function useMitteilungen() {
  return useInfiniteQuery({
    queryKey: eingangKeys.mitteilungen,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) =>
      (await api.GET('/v1/mitteilungen', { params: { query: { cursor: pageParam, limit: 20 } }, signal })).data!,
    getNextPageParam: last => last.nextCursor ?? undefined,
  });
}

/** Laufende Stellvertretungen für den Kopf (Banner «Du vertrittst …», I-Z2). */
export function useVertretungen() {
  return useQuery({ queryKey: eingangKeys.vertretungen, queryFn: async ({ signal }) => (await api.GET('/v1/stellvertretungen', { signal })).data!.items });
}

export function useEingangMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: eingangKeys.all });
  const erledigen = useMutation({
    mutationFn: async (id: string) =>
      (await api.POST('/v1/eingang/aufgaben/{id}/erledigen', { params: { path: { id }, header: { 'idempotency-key': newIdempotencyKey() } } })).data!,
    onSuccess: refresh,
  });
  const gelesen = useMutation({
    mutationFn: async (id: string) => {
      await api.POST('/v1/mitteilungen/{id}/gelesen', { params: { path: { id }, header: { 'idempotency-key': newIdempotencyKey() } } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: eingangKeys.mitteilungen }),
  });
  return { erledigen, gelesen };
}

/**
 * Zähler offener Aufgaben für die Navigation (I-N3). Eigener Schlüssel unter `eingang`, damit jede Änderung im Eingang
 * (Erledigen, Stellvertretung) ihn mit neu lädt.
 */
export const anzahlOffen = {
  queryKey: [...eingangKeys.all, 'zaehler'] as const,
  laden: async (signal: AbortSignal) => (await api.GET('/v1/eingang/anzahl', { signal })).data!.offen,
};
