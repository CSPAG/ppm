/**
 * Abfragen und Änderungen der Bedarfsliste und Zuteilung (TanStack Query über den typisierten Client); BC RK.02.02,
 * RK.02.03, UC-009 Schritte 3–4, A1, A2 (AP-E7-2).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, newIdempotencyKey, type Schemas } from '../../api/index.ts';
import { ressourcenKeys } from './api.ts';
import type { BedarfStand } from './BedarfSearch.ts';

export type Bedarf = Schemas['Bedarf'];
export type BedarfDetail = Schemas['BedarfDetail'];
export type Zuteilung = Schemas['Zuteilung'];
export type Konflikt = Schemas['Konflikt'];
export type PersonBelegung = Schemas['PersonBelegung'];
export type ZuteilungErgebnis = Schemas['ZuteilungErgebnis'];

export const bedarfKeys = {
  all: ['ressourcen', 'bedarf'] as const,
  liste: (von: string, bis: string, stand?: BedarfStand) => ['ressourcen', 'bedarf', 'liste', von, bis, stand ?? ''] as const,
  detail: (id: string) => ['ressourcen', 'bedarf', 'detail', id] as const,
  personen: (id: string, q: string) => ['ressourcen', 'bedarf', 'personen', id, q] as const,
  konflikte: (von: string, bis: string) => ['ressourcen', 'bedarf', 'konflikte', von, bis] as const,
};

export function useBedarfe(z: { von: string; bis: string } | null, stand?: BedarfStand) {
  return useQuery({
    queryKey: bedarfKeys.liste(z?.von ?? '', z?.bis ?? '', stand),
    enabled: !!z,
    queryFn: async ({ signal }) => (await api.GET('/v1/bedarfe', { params: { query: { von: z!.von, bis: z!.bis, stand: stand ? [stand] : undefined, limit: 200 } }, signal })).data!,
  });
}

export function useBedarf(id: string | undefined) {
  return useQuery({
    queryKey: bedarfKeys.detail(id ?? ''),
    enabled: !!id,
    queryFn: async ({ signal }) => (await api.GET('/v1/bedarfe/{id}', { params: { path: { id: id! } }, signal })).data!,
  });
}

export function usePersonen(id: string, q: string, aktiv: boolean) {
  return useQuery({
    queryKey: bedarfKeys.personen(id, q),
    enabled: aktiv,
    queryFn: async ({ signal }) => (await api.GET('/v1/bedarfe/{id}/personen', { params: { path: { id }, query: { q: q || undefined, limit: 20 } }, signal })).data!.items,
  });
}

export function useKonflikte(z: { von: string; bis: string } | null) {
  return useQuery({
    queryKey: bedarfKeys.konflikte(z?.von ?? '', z?.bis ?? ''),
    enabled: !!z,
    queryFn: async ({ signal }) => (await api.GET('/v1/zuteilungen/konflikte', { params: { query: { von: z!.von, bis: z!.bis } }, signal })).data!,
  });
}

/** Nach jeder Änderung: Bedarfsliste, Konflikte und Auslastung (Deckung) neu laden. */
function useNeuLaden() {
  const qc = useQueryClient();
  return async () => {
    await qc.invalidateQueries({ queryKey: bedarfKeys.all });
    await qc.invalidateQueries({ queryKey: ressourcenKeys.all });
  };
}

export function useZuteilen() {
  const neu = useNeuLaden();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; personId: string; fte: number; vonMonat?: string; bisMonat?: string }): Promise<ZuteilungErgebnis> =>
      (await api.POST('/v1/bedarfe/{id}/zuteilungen', { params: { path: { id }, header: { 'idempotency-key': newIdempotencyKey() } }, body })).data!,
    onSuccess: neu,
  });
}

export function useAnteilAendern() {
  const neu = useNeuLaden();
  return useMutation({
    mutationFn: async ({ id, version, fte }: { id: string; version: number; fte: number }): Promise<ZuteilungErgebnis> =>
      (await api.PATCH('/v1/zuteilungen/{id}', { params: { path: { id }, header: { 'if-match': `W/"${version}"` } }, body: { fte } })).data!,
    onSuccess: neu,
  });
}

export function useZuteilungEntfernen() {
  const neu = useNeuLaden();
  return useMutation({
    mutationFn: async ({ id, version }: { id: string; version: number }) => {
      await api.DELETE('/v1/zuteilungen/{id}', { params: { path: { id }, header: { 'if-match': `W/"${version}"` } } });
    },
    onSuccess: neu,
  });
}

export function useLuecke() {
  const neu = useNeuLaden();
  return useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string | null }) => (text === null
      ? (await api.DELETE('/v1/bedarfe/{id}/luecke', { params: { path: { id } } })).data!
      : (await api.PUT('/v1/bedarfe/{id}/luecke', { params: { path: { id } }, body: { text } })).data!),
    onSuccess: neu,
  });
}
