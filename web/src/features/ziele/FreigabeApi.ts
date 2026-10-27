/** Abfragen und Übergänge der Freigabe (UI-39; BC ZM.02.02; UC-011 Schritte 6–7, A2) über den typisierten Client. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ifMatch, type Schemas } from '../../api/index.ts';

export type Vorlage = Schemas['Vorlage'];
export type FreigabeErfassen = Schemas['FreigabeErfassen'];

export const freigabeKeys = { vorlage: (jahr: number) => ['zielzyklus', 'vorlage', jahr] as const };

export function useVorlage(jahr: number) {
  return useQuery({
    queryKey: freigabeKeys.vorlage(jahr),
    queryFn: async ({ signal }) => (await api.GET('/v1/ziele/{jahr}/vorlage', { params: { path: { jahr } }, signal })).data!,
  });
}

export function useFreigabeMutations(jahr: number) {
  const qc = useQueryClient();
  // Zielzyklus, Vorlage und Roadmap-Vorschau hängen am Stand des Zieljahrs
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['zielzyklus'] }), qc.invalidateQueries({ queryKey: ['roadmap'] })]);
  return {
    vorlegen: useMutation({
      mutationFn: async ({ version }: { version: number }) =>
        (await api.POST('/v1/ziele/{jahr}/vorlegen', { params: { path: { jahr }, header: { 'if-match': ifMatch(version)['If-Match']! } } })).data!,
      onSettled: refresh,
    }),
    erfassen: useMutation({
      mutationFn: async ({ version, body }: { version: number; body: FreigabeErfassen }) =>
        (await api.POST('/v1/ziele/{jahr}/freigabe', { params: { path: { jahr }, header: { 'if-match': ifMatch(version)['If-Match']! } }, body })).data!,
      onSettled: refresh,
    }),
  };
}
