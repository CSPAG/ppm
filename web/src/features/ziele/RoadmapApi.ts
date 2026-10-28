/** Abfragen und Publizieren der Portfolio-Roadmap (UI-31; BC PP.04.03; UC-011 Schritt 8) über den typisierten Client. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, newIdempotencyKey, statusOf, type Schemas } from '../../api/index.ts';

export type Roadmap = Schemas['Roadmap'];
export type RoadmapInhalt = Schemas['RoadmapInhalt'];
export type RoadmapVorschau = Schemas['RoadmapVorschau'];

export const roadmapKeys = {
  liste: ['roadmap', 'liste'] as const,
  jahr: (jahr: number) => ['roadmap', 'jahr', jahr] as const,
  vorschau: (jahr: number) => ['roadmap', 'vorschau', jahr] as const,
};

export function useRoadmapListe() {
  return useQuery({
    queryKey: roadmapKeys.liste,
    queryFn: async ({ signal }) => (await api.GET('/v1/roadmap', { signal })).data!.items,
  });
}

/** Publizierte Roadmap; `null`, wenn das Jahr nicht publiziert ist (404). */
export function useRoadmap(jahr: number | undefined) {
  return useQuery({
    queryKey: roadmapKeys.jahr(jahr ?? 0),
    enabled: jahr !== undefined,
    queryFn: async ({ signal }): Promise<Roadmap | null> => {
      try {
        return (await api.GET('/v1/roadmap/{jahr}', { params: { path: { jahr: jahr! } }, signal })).data!;
      } catch (e) {
        if (statusOf(e) === 404) return null;
        throw e;
      }
    },
  });
}

export function useRoadmapVorschau(jahr: number, enabled: boolean) {
  return useQuery({
    queryKey: roadmapKeys.vorschau(jahr),
    enabled,
    queryFn: async ({ signal }) => (await api.GET('/v1/roadmap/{jahr}/vorschau', { params: { path: { jahr } }, signal })).data!,
  });
}

export function usePublizieren(jahr: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.POST('/v1/roadmap/{jahr}', { params: { path: { jahr }, header: { 'idempotency-key': newIdempotencyKey() } } })).data!,
    onSettled: () => qc.invalidateQueries({ queryKey: ['roadmap'] }),
  });
}
