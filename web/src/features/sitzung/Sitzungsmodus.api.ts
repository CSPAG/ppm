/**
 * Abfragen und Änderungen für Sitzungsmodus, Entscheide, Auflagen und Protokoll (AP-E2-2; UC-006 Schritte 6–9, A1,
 * A3, A4). Jede Änderung ist bestätigt (I-R2): Erst die Antwort des Servers gilt; danach werden die betroffenen
 * Abfragen neu geladen.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, newIdempotencyKey, type Schemas } from '../../api/index.ts';
import { sitzungKeys } from './api.ts';

export type Sitzungsmodus = Schemas['Sitzungsmodus'];
export type ModusTraktandum = Sitzungsmodus['traktanden'][number];
export type Entscheid = Schemas['Entscheid'];
export type EntscheidPut = Schemas['EntscheidPut'];
export type EntscheidEintrag = Schemas['EntscheidEintrag'];
export type Auflage = Schemas['Auflage'];
export type Protokoll = Schemas['Protokoll'];
export type ProtokollPut = Schemas['ProtokollPut'];
export type Protokollversand = Schemas['Protokollversand'];
export type Person = Schemas['Person'];

export const modusKeys = {
  modus: (id: string) => ['sitzung', 'modus', id] as const,
  protokoll: (id: string) => ['sitzung', 'protokoll', id] as const,
  protokollversand: (id: string) => ['sitzung', 'protokollversand', id] as const,
  entscheide: (filter: EntscheideFilter) => ['sitzung', 'entscheide', filter] as const,
  personen: ['sitzung', 'personen'] as const,
};

const etag = (version: number) => `W/"${version}"`;

/** Traktanden der Sitzung mit Optionen und Entscheiden (Sitzungsmodus, K3 Schritte 7–9). */
export function useSitzungsmodus(id: string | undefined) {
  return useQuery({
    queryKey: modusKeys.modus(id ?? ''),
    enabled: !!id,
    queryFn: async ({ signal }) => (await api.GET('/v1/sitzungen/{id}/entscheide', { params: { path: { id: id! } }, signal })).data!,
  });
}

/** Personen der Organisation für «Verantwortlich» einer Auflage (A3); ohne Recht leer. */
export function usePersonen() {
  return useQuery({
    queryKey: modusKeys.personen,
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) => {
      try {
        return (await api.GET('/v1/people', { params: { query: { limit: 200 } }, signal })).data!.items;
      } catch {
        return [] as Person[];
      }
    },
  });
}

export function useModusMutations(kuerzel: string, datum: string, sitzungId: string | undefined) {
  const qc = useQueryClient();
  const neu = async () => {
    await qc.invalidateQueries({ queryKey: modusKeys.modus(sitzungId ?? '') });
    await qc.invalidateQueries({ queryKey: sitzungKeys.eine(kuerzel, datum) });
  };
  const starten = useMutation({
    mutationFn: async (m: Sitzungsmodus) =>
      (await api.POST('/v1/sitzungen/{id}/starten', { params: { path: { id: m.sitzungId }, header: { 'if-match': etag(m.version) } } })).data!,
    onSuccess: async m => { qc.setQueryData(modusKeys.modus(m.sitzungId), m); await neu(); },
  });
  const erfassen = useMutation({
    mutationFn: async ({ t, body }: { t: ModusTraktandum; body: EntscheidPut }) =>
      (await api.PUT('/v1/traktanden/{id}/entscheid', {
        params: { path: { id: t.traktandumId }, header: t.entscheid ? { 'if-match': etag(t.entscheid.version) } : {} }, body,
      })).data!,
    onSuccess: neu,
  });
  const schliessen = useMutation({
    mutationFn: async (m: Sitzungsmodus) =>
      (await api.POST('/v1/sitzungen/{id}/schliessen', { params: { path: { id: m.sitzungId }, header: { 'if-match': etag(m.version) } } })).data!,
    onSuccess: async r => { qc.setQueryData(modusKeys.modus(r.sitzung.sitzungId), r.sitzung); await qc.invalidateQueries({ queryKey: sitzungKeys.all }); },
  });
  const sns = useMutation({
    mutationFn: async ({ t, body }: { t: ModusTraktandum; body: Schemas['SnsEntscheidPut'] }) =>
      (await api.PUT('/v1/traktanden/{id}/entscheid/sns', { params: { path: { id: t.traktandumId }, header: { 'if-match': etag(t.entscheid!.version) } }, body })).data!,
    onSuccess: neu,
  });
  return { starten, erfassen, schliessen, sns };
}

// --- Protokoll ----------------------------------------------------------------------------------------------------

export function useProtokoll(id: string | undefined) {
  return useQuery({
    queryKey: modusKeys.protokoll(id ?? ''),
    enabled: !!id,
    queryFn: async ({ signal }) => (await api.GET('/v1/sitzungen/{id}/protokoll', { params: { path: { id: id! } }, signal })).data!,
    retry: false,
  });
}

export function useProtokollversand(id: string, enabled: boolean) {
  return useQuery({
    queryKey: modusKeys.protokollversand(id),
    enabled,
    staleTime: 0,
    queryFn: async ({ signal }) => (await api.GET('/v1/sitzungen/{id}/protokoll/versand', { params: { path: { id } }, signal })).data!,
  });
}

export function useProtokollMutations(sitzungId: string) {
  const qc = useQueryClient();
  const setze = (p: Protokoll) => qc.setQueryData(modusKeys.protokoll(sitzungId), p);
  const speichern = useMutation({
    mutationFn: async ({ p, body }: { p: Protokoll; body: ProtokollPut }) =>
      (await api.PUT('/v1/sitzungen/{id}/protokoll', { params: { path: { id: sitzungId }, header: { 'if-match': etag(p.version) } }, body })).data!,
    onSuccess: setze,
  });
  const versenden = useMutation({
    mutationFn: async (p: Protokoll) =>
      (await api.POST('/v1/sitzungen/{id}/protokoll/versenden', { params: { path: { id: sitzungId }, header: { 'if-match': etag(p.version) } } })).data!,
    onSuccess: async p => { setze(p); await qc.invalidateQueries({ queryKey: sitzungKeys.all }); },
  });
  return { speichern, versenden };
}

// --- Entscheide und Auflagen (UI-36) ------------------------------------------------------------------------------

export interface EntscheideFilter { gremium?: string; auflagen?: 'offen'; anVr?: boolean }

export function useEntscheide(filter: EntscheideFilter) {
  return useQuery({
    queryKey: modusKeys.entscheide(filter),
    queryFn: async ({ signal }) => {
      const items: EntscheidEintrag[] = [];
      let cursor: string | undefined;
      // höchstens 4 Seiten (200 Entscheide); ältere über den Filter
      for (let i = 0; i < 4; i += 1) {
        const { data } = await api.GET('/v1/entscheide', { params: { query: { ...filter, limit: 50, cursor } }, signal });
        items.push(...data!.items);
        cursor = data!.nextCursor ?? undefined;
        if (!cursor) break;
      }
      return { items, mehr: !!cursor };
    },
  });
}

export function useAuflageErfuellen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: Auflage) =>
      (await api.POST('/v1/auflagen/{id}/erfuellen', { params: { path: { id: a.id }, header: { 'idempotency-key': newIdempotencyKey() } } })).data!,
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['sitzung', 'entscheide'] }); },
  });
}
