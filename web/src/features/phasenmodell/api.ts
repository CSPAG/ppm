/** Abfragen und Änderungen des Phasenmodells (TanStack Query über den typisierten Client). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ifMatch, type Schemas } from '../../api/index.ts';

export type Phasenmodell = Schemas['Phasenmodell'];
export type PhasenmodellKurz = Schemas['PhasenmodellKurz'];
export type Patch = Schemas['PhasenmodellPatch'];

export const phasenmodellKeys = {
  all: ['phasenmodell'] as const,
  list: ['phasenmodell', 'list'] as const,
  one: (id: string) => ['phasenmodell', 'one', id] as const,
};

/** Fassung mit ETag für `If-Match` (Rückfall: Version). */
export interface Loaded { item: Phasenmodell; etag: string }
const loaded = (item: Phasenmodell, response: Response): Loaded => ({ item, etag: response.headers.get('ETag') ?? ifMatch(item.version)['If-Match']! });

/** Alle Versionen (wenige; eine Seite mit 200 genügt). */
export function useVersionen() {
  return useQuery({
    queryKey: phasenmodellKeys.list,
    queryFn: async ({ signal }) => (await api.GET('/v1/phasenmodelle', { params: { query: { limit: 200 } }, signal })).data!,
  });
}

export function usePhasenmodell(id: string | null) {
  return useQuery({
    queryKey: phasenmodellKeys.one(id ?? ''),
    enabled: !!id,
    queryFn: async ({ signal }) => {
      const { data, response } = await api.GET('/v1/phasenmodelle/{id}', { params: { path: { id: id! } }, signal });
      return loaded(data!, response);
    },
  });
}

export function usePhasenmodellMutations() {
  const qc = useQueryClient();
  const setze = (l: Loaded) => qc.setQueryData(phasenmodellKeys.one(l.item.id), l);
  const liste = () => qc.invalidateQueries({ queryKey: phasenmodellKeys.list });
  const create = useMutation({
    mutationFn: async ({ quelle, key }: { quelle?: 'aktuell' | 'vorgabe'; key: string }) => {
      const { data, response } = await api.POST('/v1/phasenmodelle', { body: quelle ? { quelle } : {}, params: { header: { 'idempotency-key': key } } });
      return loaded(data!, response);
    },
    onSuccess: async l => { setze(l); await liste(); },
  });
  // Automatisches Speichern: der Zwischenstand gehört der Arbeitsfläche, hier nur die Antwort des Servers
  const update = useMutation({
    mutationFn: async ({ id, etag, body }: { id: string; etag: string; body: Patch }) => {
      const { data, response } = await api.PATCH('/v1/phasenmodelle/{id}', { params: { path: { id }, header: { 'if-match': etag } }, body });
      return loaded(data!, response);
    },
    onSuccess: l => { setze(l); },
  });
  const remove = useMutation({
    mutationFn: async ({ id, etag }: { id: string; etag: string }) => {
      await api.DELETE('/v1/phasenmodelle/{id}', { params: { path: { id }, header: { 'if-match': etag } } });
    },
    onSuccess: async (_r, { id }) => { qc.removeQueries({ queryKey: phasenmodellKeys.one(id) }); await liste(); },
  });
  const activate = useMutation({
    mutationFn: async ({ id, etag }: { id: string; etag: string }) => {
      const { data, response } = await api.POST('/v1/phasenmodelle/{id}/in-kraft-setzen', { params: { path: { id }, header: { 'if-match': etag } } });
      return loaded(data!, response);
    },
    // Die abgelöste Version ändert ihren Stand: alle Fassungen neu laden
    onSuccess: async l => { setze(l); await qc.invalidateQueries({ queryKey: phasenmodellKeys.all }); },
  });
  return { create, update, remove, activate };
}
