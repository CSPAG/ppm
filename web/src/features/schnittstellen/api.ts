/** Abfragen und Änderungen der Schnittstellen und des Änderungsprotokolls (TanStack Query über den typisierten Client). */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ifMatch, type Schemas } from '../../api/index.ts';
import type { ProtokollSearch } from './search.ts';

export type Schnittstelle = Schemas['Schnittstelle'];
export type Lauf = Schemas['SchnittstelleLauf'];
export type Katalogeintrag = Schemas['SchnittstelleKatalogeintrag'];
export type ProtokollEintrag = Schemas['AenderungsprotokollEintrag'];

export const schnittstellenKeys = {
  all: ['schnittstellen'] as const,
  liste: ['schnittstellen', 'liste'] as const,
  eine: (id: string) => ['schnittstellen', 'eine', id] as const,
  laeufe: (id: string) => ['schnittstellen', 'laeufe', id] as const,
  protokoll: (f: ProtokollSearch) => ['aenderungsprotokoll', 'liste', f] as const,
  objekte: ['aenderungsprotokoll', 'objekte'] as const,
};

/** Aktuelle Fassung mit ETag für `If-Match` (Rückfall: Version). */
export interface Geladen { item: Schnittstelle; etag: string }

export function useSchnittstellen() {
  return useQuery({ queryKey: schnittstellenKeys.liste, queryFn: async ({ signal }) => (await api.GET('/v1/schnittstellen', { signal })).data! });
}

export function useSchnittstelle(id: string | null) {
  return useQuery({
    queryKey: schnittstellenKeys.eine(id ?? ''),
    enabled: !!id,
    queryFn: async ({ signal }): Promise<Geladen> => {
      const { data, response } = await api.GET('/v1/schnittstellen/{id}', { params: { path: { id: id! } }, signal });
      return { item: data!, etag: response.headers.get('ETag') ?? ifMatch(data!.version)['If-Match']! };
    },
  });
}

export function useLaeufe(id: string) {
  return useInfiniteQuery({
    queryKey: schnittstellenKeys.laeufe(id),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => (await api.GET('/v1/schnittstellen/{id}/laeufe', { params: { path: { id }, query: { cursor: pageParam, limit: 20 } }, signal })).data!,
    getNextPageParam: last => last.nextCursor ?? undefined,
  });
}

export function useSchnittstellenMutationen() {
  const qc = useQueryClient();
  // Läufe und Konfiguration ändern auch das Änderungsprotokoll und den Eingang (Fehleraufgabe)
  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: schnittstellenKeys.all }), qc.invalidateQueries({ queryKey: ['aenderungsprotokoll'] }), qc.invalidateQueries({ queryKey: ['eingang'] }),
  ]);
  const einrichten = useMutation({
    mutationFn: async ({ body, key }: { body: Schemas['SchnittstelleCreate']; key: string }) =>
      (await api.POST('/v1/schnittstellen', { body, params: { header: { 'idempotency-key': key } } })).data!,
    onSuccess: refresh,
  });
  const aendern = useMutation({
    mutationFn: async ({ id, etag, body }: { id: string; etag: string; body: Schemas['SchnittstellePatch'] }) =>
      (await api.PATCH('/v1/schnittstellen/{id}', { params: { path: { id }, header: { 'if-match': etag } }, body })).data!,
    onSuccess: refresh,
  });
  const starten = useMutation({
    mutationFn: async ({ id, key }: { id: string; key: string }) =>
      (await api.POST('/v1/schnittstellen/{id}/starten', { params: { path: { id }, header: { 'idempotency-key': key } } })).data!,
    onSettled: refresh,
  });
  return { einrichten, aendern, starten };
}

export function useProtokoll(f: ProtokollSearch) {
  return useInfiniteQuery({
    queryKey: schnittstellenKeys.protokoll(f),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => (await api.GET('/v1/aenderungsprotokoll', { params: { query: { ...f, cursor: pageParam, limit: 50 } }, signal })).data!,
    getNextPageParam: last => last.nextCursor ?? undefined,
  });
}

export function useProtokollObjekte() {
  return useQuery({ queryKey: schnittstellenKeys.objekte, queryFn: async ({ signal }) => (await api.GET('/v1/aenderungsprotokoll/objekte', { signal })).data!.items });
}

/**
 * Export des Änderungsprotokolls als CSV (UI-50, Seitentyp Bericht): alle Einträge zum Filter über den typisierten
 * Client (gleiche Herkunft, Organisation im Kopf), im Browser gespeichert; liefert den Dateinamen.
 */
export async function protokollExportieren(f: ProtokollSearch): Promise<string> {
  const { data, response } = await api.GET('/v1/aenderungsprotokoll', { params: { query: { ...f, format: 'csv' } }, parseAs: 'blob' });
  const name = /filename="([^"]+)"/.exec(response.headers.get('content-disposition') ?? '')?.[1] ?? 'aenderungsprotokoll.csv';
  const url = URL.createObjectURL(data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return name;
}
