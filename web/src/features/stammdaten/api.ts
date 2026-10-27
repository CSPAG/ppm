/** Abfragen und Änderungen der Stammdaten (TanStack Query über den typisierten Client): Einheiten, Feiertage, Codewerte. */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ifMatch, type Schemas } from '../../api/index.ts';
import type { paths } from '../../api/schema.d.ts';

export type OrgEinheit = Schemas['OrgEinheit'];
export type Feiertag = Schemas['Feiertag'];
export type Codetabelle = Schemas['Codetabelle'];
export type Codewert = Schemas['Codewert'];
export type TabelleKey = paths['/v1/codetabellen/{schluessel}/werte']['get']['parameters']['path']['schluessel'];

export const stammdatenKeys = {
  all: ['stammdaten'] as const,
  org: ['stammdaten', 'org'] as const,
  orgList: (q: string, nurAktive: boolean) => ['stammdaten', 'org', 'list', q, nurAktive] as const,
  orgAlle: ['stammdaten', 'org', 'alle'] as const,
  orgOne: (id: string) => ['stammdaten', 'org', 'one', id] as const,
  ft: ['stammdaten', 'ft'] as const,
  ftList: (jahr: number) => ['stammdaten', 'ft', 'list', jahr] as const,
  ftOne: (id: string) => ['stammdaten', 'ft', 'one', id] as const,
  code: ['stammdaten', 'code'] as const,
  werte: (t: string) => ['stammdaten', 'code', 'werte', t] as const,
};

/** Aktuelle Fassung mit ETag für `If-Match` (Rückfall: Version). */
export interface Loaded<T> { item: T; etag: string }
const loaded = <T extends { version: number }>(item: T, response: Response): Loaded<T> => ({ item, etag: response.headers.get('ETag') ?? ifMatch(item.version)['If-Match']! });

// --- Organisationseinheiten

export function useOrgList(q: string, nurAktive: boolean) {
  return useInfiniteQuery({
    queryKey: stammdatenKeys.orgList(q, nurAktive),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => (await api.GET('/v1/org-einheiten', { params: { query: { q: q || undefined, aktiv: nurAktive ? true : undefined, cursor: pageParam, limit: 100 } }, signal })).data!,
    getNextPageParam: last => last.nextCursor ?? undefined,
  });
}

/** Alle Einheiten (für Namen der übergeordneten Einheit und die Auswahl); Organisationen haben wenige hundert. */
export function useOrgAlle() {
  return useQuery({
    queryKey: stammdatenKeys.orgAlle,
    queryFn: async ({ signal }) => {
      const out: OrgEinheit[] = [];
      let cursor: string | undefined;
      do {
        const data = (await api.GET('/v1/org-einheiten', { params: { query: { cursor, limit: 200 } }, signal })).data!;
        out.push(...data.items);
        cursor = data.nextCursor ?? undefined;
      } while (cursor);
      return out;
    },
  });
}

export function useOrg(id: string | null) {
  return useQuery({
    queryKey: stammdatenKeys.orgOne(id ?? ''),
    enabled: !!id,
    queryFn: async ({ signal }) => {
      const { data, response } = await api.GET('/v1/org-einheiten/{id}', { params: { path: { id: id! } }, signal });
      return loaded(data!, response);
    },
  });
}

export function useOrgMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: stammdatenKeys.org });
  const create = useMutation({
    mutationFn: async ({ body, key }: { body: Schemas['OrgEinheitCreate']; key: string }) => {
      const { data, response } = await api.POST('/v1/org-einheiten', { body, params: { header: { 'idempotency-key': key } } });
      return loaded(data!, response);
    },
    onSuccess: async l => { qc.setQueryData(stammdatenKeys.orgOne(l.item.id), l); await refresh(); },
  });
  const update = useMutation({
    mutationFn: async ({ id, etag, body }: { id: string; etag: string; body: Schemas['OrgEinheitPatch'] }) => {
      const { data, response } = await api.PATCH('/v1/org-einheiten/{id}', { params: { path: { id }, header: { 'if-match': etag } }, body });
      return loaded(data!, response);
    },
    onSuccess: async l => { qc.setQueryData(stammdatenKeys.orgOne(l.item.id), l); await refresh(); },
  });
  const remove = useMutation({
    mutationFn: async ({ id, etag }: { id: string; etag: string }) => {
      await api.DELETE('/v1/org-einheiten/{id}', { params: { path: { id }, header: { 'if-match': etag } } });
    },
    onSuccess: async (_r, { id }) => { qc.removeQueries({ queryKey: stammdatenKeys.orgOne(id) }); await refresh(); },
  });
  return { create, update, remove };
}

/** Suche für die Befehlspalette (I-N4). */
export async function sucheOrgEinheiten(q: string, signal: AbortSignal): Promise<OrgEinheit[]> {
  return (await api.GET('/v1/org-einheiten', { params: { query: { q, limit: 5 } }, signal })).data!.items;
}

// --- Feiertage

export function useFeiertage(jahr: number) {
  return useInfiniteQuery({
    queryKey: stammdatenKeys.ftList(jahr),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => (await api.GET('/v1/feiertage', { params: { query: { jahr, cursor: pageParam, limit: 100 } }, signal })).data!,
    getNextPageParam: last => last.nextCursor ?? undefined,
  });
}

export function useFeiertag(id: string | null) {
  return useQuery({
    queryKey: stammdatenKeys.ftOne(id ?? ''),
    enabled: !!id,
    queryFn: async ({ signal }) => {
      const { data, response } = await api.GET('/v1/feiertage/{id}', { params: { path: { id: id! } }, signal });
      return loaded(data!, response);
    },
  });
}

export function useFeiertagMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: stammdatenKeys.ft });
  const create = useMutation({
    mutationFn: async ({ body, key }: { body: Schemas['FeiertagCreate']; key: string }) => {
      const { data, response } = await api.POST('/v1/feiertage', { body, params: { header: { 'idempotency-key': key } } });
      return loaded(data!, response);
    },
    onSuccess: async l => { qc.setQueryData(stammdatenKeys.ftOne(l.item.id), l); await refresh(); },
  });
  const update = useMutation({
    mutationFn: async ({ id, etag, body }: { id: string; etag: string; body: Schemas['FeiertagPatch'] }) => {
      const { data, response } = await api.PATCH('/v1/feiertage/{id}', { params: { path: { id }, header: { 'if-match': etag } }, body });
      return loaded(data!, response);
    },
    onSuccess: async l => { qc.setQueryData(stammdatenKeys.ftOne(l.item.id), l); await refresh(); },
  });
  const remove = useMutation({
    mutationFn: async ({ id, etag }: { id: string; etag: string }) => {
      await api.DELETE('/v1/feiertage/{id}', { params: { path: { id }, header: { 'if-match': etag } } });
    },
    onSuccess: async (_r, { id }) => { qc.removeQueries({ queryKey: stammdatenKeys.ftOne(id) }); await refresh(); },
  });
  return { create, update, remove };
}

// --- Codetabellen

export function useCodetabellen() {
  return useQuery({ queryKey: stammdatenKeys.code, queryFn: async ({ signal }) => (await api.GET('/v1/codetabellen', { signal })).data! });
}

/** Alle Werte einer Codetabelle, auch deaktivierte (wenige Dutzend). */
export function useWerte(tabelle: TabelleKey | null) {
  return useQuery({
    queryKey: stammdatenKeys.werte(tabelle ?? ''),
    enabled: !!tabelle,
    queryFn: async ({ signal }) => {
      const out: Codewert[] = [];
      let cursor: string | undefined;
      do {
        const data = (await api.GET('/v1/codetabellen/{schluessel}/werte', { params: { path: { schluessel: tabelle! }, query: { cursor, limit: 200 } }, signal })).data!;
        out.push(...data.items);
        cursor = data.nextCursor ?? undefined;
      } while (cursor);
      return out;
    },
  });
}

const etagOf = (w: Codewert) => ifMatch(w.version)['If-Match']!;

export function useCodeMutations(tabelle: TabelleKey) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: stammdatenKeys.code });
  const path = (id: string) => ({ schluessel: tabelle, id });
  const vorgabe = useMutation({
    mutationFn: async ({ key }: { key: string }) => (await api.POST('/v1/codetabellen/vorgabe', { params: { header: { 'idempotency-key': key } } })).data!,
    onSuccess: refresh,
  });
  const create = useMutation({
    mutationFn: async ({ body, key }: { body: Schemas['CodewertCreate']; key: string }) =>
      (await api.POST('/v1/codetabellen/{schluessel}/werte', { params: { path: { schluessel: tabelle }, header: { 'idempotency-key': key } }, body })).data!,
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: async ({ wert, body }: { wert: Codewert; body: Schemas['CodewertPatch'] }) =>
      (await api.PATCH('/v1/codetabellen/{schluessel}/werte/{id}', { params: { path: path(wert.id), header: { 'if-match': etagOf(wert) } }, body })).data!,
    onSuccess: refresh,
  });
  const umschalten = useMutation({
    mutationFn: async ({ wert, aktiv }: { wert: Codewert; aktiv: boolean }) => {
      const p = { params: { path: path(wert.id), header: { 'if-match': etagOf(wert) } } };
      return (aktiv ? await api.POST('/v1/codetabellen/{schluessel}/werte/{id}/aktivieren', p) : await api.POST('/v1/codetabellen/{schluessel}/werte/{id}/deaktivieren', p)).data!;
    },
    onSettled: refresh,
  });
  return { vorgabe, create, update, umschalten };
}
