/** Abfragen des Profils: Stellvertretungen (UC-016 Schritt 4) und Personen aus dem Verzeichnis zur Auswahl. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, newIdempotencyKey, type Schemas } from '../../api/index.ts';

export type Stellvertretung = Schemas['Stellvertretung'];
export type StellvertretungInput = Schemas['StellvertretungCreate'];

export const kontoKeys = {
  stellvertretungen: ['stellvertretung'] as const,
  personen: (q: string) => ['stellvertretung', 'personen', q] as const,
};

export function useStellvertretungen() {
  return useQuery({ queryKey: kontoKeys.stellvertretungen, queryFn: async ({ signal }) => (await api.GET('/v1/stellvertretungen', { signal })).data!.items });
}

/** Personen der Organisation zum Suchtext (höchstens 8), ohne die angemeldete Person. */
export function usePersonen(q: string) {
  return useQuery({
    queryKey: kontoKeys.personen(q),
    enabled: q.trim().length >= 2,
    queryFn: async ({ signal }) => (await api.GET('/v1/people', { params: { query: { q: q.trim(), limit: 8 } }, signal })).data!.items,
  });
}

export function useStellvertretungMutations() {
  const qc = useQueryClient();
  // Eingang zeigt Vertretungen im Kopf: dort auch neu laden
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: kontoKeys.stellvertretungen }), qc.invalidateQueries({ queryKey: ['eingang'] })]);
  const create = useMutation({
    mutationFn: async ({ body, key }: { body: StellvertretungInput; key: string }) =>
      (await api.POST('/v1/stellvertretungen', { body, params: { header: { 'idempotency-key': key } } })).data!,
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { await api.DELETE('/v1/stellvertretungen/{id}', { params: { path: { id } } }); },
    onSuccess: refresh,
  });
  return { create, remove, newKey: newIdempotencyKey };
}
