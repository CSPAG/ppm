/**
 * Server-Zustand der Projekte (TanStack Query): Liste mit Cursor, Einzelabruf, Verlauf und Änderungen mit
 * `If-Match` (Fassung) bzw. `Idempotency-Key`. Nach jeder Änderung wird alles unter `projektKeys.all` neu geladen.
 */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import type { ResourceRef } from '@vollholz/iam-web';
import { useCallback } from 'react';
import { api, ifMatch, required } from '../../api/client.ts';
import type { Projekt, ProjektCreate, ProjektPatch } from './types.ts';

export const PAGE_SIZE = 50;

export const projektKeys = {
  all: ['projekte'] as const,
  list: (q: string) => ['projekte', 'list', q] as const,
  one: (id: string) => ['projekte', 'one', id] as const,
  history: (id: string) => ['projekte', 'history', id] as const,
};

type Page = { items: Projekt[]; next: string | null };

export function useProjektList(q: string) {
  return useInfiniteQuery({
    queryKey: projektKeys.list(q),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<Page> => required(await api.GET('/v1/projekte', {
      params: { query: { limit: PAGE_SIZE, ...(q ? { q } : {}), ...(pageParam ? { cursor: pageParam } : {}) } },
    })),
    getNextPageParam: last => last.next ?? undefined,
  });
}

export function useProjekt(id: string | undefined) {
  return useQuery({
    queryKey: projektKeys.one(id ?? ''),
    enabled: !!id,
    queryFn: async () => required(await api.GET('/v1/projekte/{id}', { params: { path: { id: id! } } })),
  });
}

export function useProjektHistory(id: string, enabled = true) {
  return useQuery({
    queryKey: projektKeys.history(id),
    enabled,
    queryFn: async () => required(await api.GET('/v1/projekte/{id}/history', { params: { path: { id } } })).items,
  });
}

/** Ergebnis einer Änderung in den Cache schreiben, den Rest neu laden. */
function settle(qc: QueryClient, p?: Projekt) {
  if (p) qc.setQueryData(projektKeys.one(p.id), p);
  return qc.invalidateQueries({ queryKey: projektKeys.all });
}

export function useCreateProjekt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, key }: { body: ProjektCreate; key: string }) =>
      required(await api.POST('/v1/projekte', { params: { header: { 'idempotency-key': key } }, body })),
    onSuccess: p => settle(qc, p),
  });
}

export function useUpdateProjekt(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ patch, version }: { patch: ProjektPatch; version: number }) =>
      required(await api.PATCH('/v1/projekte/{id}', { params: { path: { id }, header: { 'if-match': ifMatch(version)['If-Match']! } }, body: patch })),
    onSuccess: p => settle(qc, p),
  });
}

export function useDeleteProjekt(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ version }: { version: number }) => {
      await api.DELETE('/v1/projekte/{id}', { params: { path: { id }, header: { 'if-match': ifMatch(version)['If-Match']! } } });
    },
    onSuccess: () => {
      qc.removeQueries({ queryKey: projektKeys.one(id) });
      return settle(qc);
    },
  });
}

/** Namen der Projekte aus dem Cache (für «Zugriff», «Meine Rechte», «Mitglieder» von iam-web). */
export function useProjektNames(): { name(ref: ResourceRef): string | undefined } {
  const qc = useQueryClient();
  const name = useCallback((ref: ResourceRef) => {
    if (ref.type !== 'projekt' || !ref.id) return undefined;
    const one = qc.getQueryData<Projekt>(projektKeys.one(ref.id));
    if (one) return one.label;
    for (const [, data] of qc.getQueriesData<InfiniteData<Page>>({ queryKey: [...projektKeys.all, 'list'] })) {
      const hit = data?.pages.flatMap(pg => pg.items).find(p => p.id === ref.id);
      if (hit) return hit.label;
    }
    return undefined;
  }, [qc]);
  return { name };
}
