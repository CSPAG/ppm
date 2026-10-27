/**
 * Abfragen und Änderungen des Zielzyklus (UI-38, K6; BC ZM.02.01, ZM.02.03, ZM.02.04, PP.02.05) über den typisierten
 * Client. Nach jeder Änderung wird der Baum neu geladen (eine Abfrage je Jahr); Änderungen an Jahreszielen mit
 * `If-Match` aus der Version im Baum.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ifMatch, type Schemas } from '../../api/index.ts';

export type Zielzyklus = Schemas['Zielzyklus'];
export type StrategischerKnoten = Zielzyklus['strategischeZiele'][number];
export type JahreszielKnoten = StrategischerKnoten['jahresziele'][number];
export type ZielProjekt = Schemas['ZielProjekt'];
export interface ProjektTreffer { id: string; nummer: string; name: string }

export const zyklusKeys = {
  all: ['zielzyklus'] as const,
  jahr: (jahr: number) => ['zielzyklus', jahr] as const,
  projekte: (q: string) => ['zielzyklus', 'projekte', q] as const,
};

export function useZielzyklus(jahr: number) {
  return useQuery({
    queryKey: zyklusKeys.jahr(jahr),
    queryFn: async ({ signal }) => (await api.GET('/v1/ziele/{jahr}', { params: { path: { jahr } }, signal })).data!,
  });
}

/** Projekte für «Projekt zuordnen» (Suche in Nummer und Name, nur sichtbare). */
export function useProjektSuche(q: string) {
  return useQuery({
    queryKey: zyklusKeys.projekte(q),
    enabled: q.trim().length > 0,
    staleTime: 30_000,
    queryFn: async ({ signal }): Promise<ProjektTreffer[]> =>
      (await api.GET('/v1/projekte', { params: { query: { q: q.trim(), limit: 10 } }, signal })).data!.items.map(p => ({ id: p.id, nummer: p.nummer, name: p.name })),
  });
}

export function useZielzyklusMutations(jahr: number) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: zyklusKeys.all });
  const opts = { onSettled: refresh };
  return {
    starten: useMutation({
      mutationFn: async ({ key }: { key: string }) =>
        (await api.POST('/v1/ziele/{jahr}', { params: { path: { jahr }, header: { 'idempotency-key': key } }, body: {} })).data!,
      ...opts,
    }),
    vorlage: useMutation({
      mutationFn: async ({ version, vorlageBis }: { version: number; vorlageBis: string | null }) =>
        (await api.PATCH('/v1/ziele/{jahr}', { params: { path: { jahr }, header: { 'if-match': ifMatch(version)['If-Match']! } }, body: { vorlageBis } })).data!,
      ...opts,
    }),
    jahreszielAnlegen: useMutation({
      mutationFn: async ({ body, key }: { body: Omit<Schemas['JahreszielCreate'], 'jahr'>; key: string }) =>
        (await api.POST('/v1/jahresziele', { params: { header: { 'idempotency-key': key } }, body: { ...body, jahr } })).data!,
      ...opts,
    }),
    jahreszielAendern: useMutation({
      mutationFn: async ({ id, version, body }: { id: string; version: number; body: Schemas['JahreszielPatch'] }) =>
        (await api.PATCH('/v1/jahresziele/{id}', { params: { path: { id }, header: { 'if-match': ifMatch(version)['If-Match']! } }, body })).data!,
      ...opts,
    }),
    jahreszielLoeschen: useMutation({
      mutationFn: async ({ id, version }: { id: string; version: number }) => {
        await api.DELETE('/v1/jahresziele/{id}', { params: { path: { id }, header: { 'if-match': ifMatch(version)['If-Match']! } } });
      },
      ...opts,
    }),
    hauptaktivitaetAnlegen: useMutation({
      mutationFn: async ({ body, key }: { body: Schemas['HauptaktivitaetCreate']; key: string }) =>
        (await api.POST('/v1/hauptaktivitaeten', { params: { header: { 'idempotency-key': key } }, body })).data!,
      ...opts,
    }),
    hauptaktivitaetLoeschen: useMutation({
      mutationFn: async ({ id, version }: { id: string; version: number }) => {
        await api.DELETE('/v1/hauptaktivitaeten/{id}', { params: { path: { id }, header: { 'if-match': ifMatch(version)['If-Match']! } } });
      },
      ...opts,
    }),
    zuordnen: useMutation({
      mutationFn: async ({ projektId, body, key }: { projektId: string; body: Schemas['ProjektZielCreate']; key: string }) =>
        (await api.POST('/v1/projekte/{id}/ziele', { params: { path: { id: projektId }, header: { 'idempotency-key': key } }, body })).data!,
      ...opts,
    }),
    loesen: useMutation({
      mutationFn: async ({ projektId, zuordnungId }: { projektId: string; zuordnungId: string }) => {
        await api.DELETE('/v1/projekte/{id}/ziele/{zuordnungId}', { params: { path: { id: projektId, zuordnungId } } });
      },
      ...opts,
    }),
  };
}
