/**
 * Abfragen und Änderungen der Szenarien (UI-22; BC PP.03.01–03; UC-008 Schritte 5–6; AP-E5-3), TanStack Query über den
 * typisierten Client. Umordnen ist optimistisch (I-R2): die Reihenfolge steht sofort, Wasserlinie und Engpässe kommen mit
 * der Antwort des Servers (K5-1).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ifMatch, type Schemas } from '../../api/index.ts';

export type Szenario = Schemas['Szenario'];
export type SzenarioPosition = Szenario['positionen'][number];
export type SzenarioVergleich = Schemas['SzenarioVergleich'];
export type PositionAenderung = Schemas['SzenarioPositionenPut']['positionen'][number];
export interface Rolle { schluessel: string; label: string }

export const szenarioKeys = {
  all: ['priorisierung', 'szenarien'] as const,
  liste: (portfolioId: string) => ['priorisierung', 'szenarien', 'liste', portfolioId] as const,
  eins: (id: string) => ['priorisierung', 'szenarien', 'eins', id] as const,
  vergleich: (ids: readonly string[]) => ['priorisierung', 'szenarien', 'vergleich', ...ids] as const,
  rollen: ['priorisierung', 'szenarien', 'rollen'] as const,
};

const etagVon = (s: Szenario, response?: Response) => response?.headers.get('ETag') ?? ifMatch(s.version)['If-Match']!;

export function useSzenarien(portfolioId: string | null) {
  return useQuery({
    queryKey: szenarioKeys.liste(portfolioId ?? ''),
    enabled: !!portfolioId,
    queryFn: async ({ signal }) => (await api.GET('/v1/portfolios/{id}/szenarien', { params: { path: { id: portfolioId! } }, signal })).data!,
  });
}

export function useSzenario(id: string | null) {
  return useQuery({
    queryKey: szenarioKeys.eins(id ?? ''),
    enabled: !!id,
    queryFn: async ({ signal }) => (await api.GET('/v1/szenarien/{id}', { params: { path: { id: id! } }, signal })).data!,
  });
}

export function useVergleich(ids: readonly string[]) {
  return useQuery({
    queryKey: szenarioKeys.vergleich(ids),
    enabled: ids.length > 0,
    queryFn: async ({ signal }) => (await api.GET('/v1/szenarien/vergleich', { params: { query: { ids: ids.join(',') } }, signal })).data!,
  });
}

/** Bezeichnungen der Rollen (Pools, A-20) aus der Codetabelle `ressourcenrolle` für die Texte der Engpässe. */
export function useRollen() {
  return useQuery({
    queryKey: szenarioKeys.rollen,
    staleTime: 60_000,
    queryFn: async ({ signal }): Promise<Rolle[]> => {
      const out: Rolle[] = [];
      let cursor: string | undefined;
      do {
        const { data } = await api.GET('/v1/codetabellen/{schluessel}/werte', { params: { path: { schluessel: 'ressourcenrolle' }, query: { limit: 200, cursor } }, signal });
        out.push(...data!.items.map(w => ({ schluessel: w.schluessel, label: w.label })));
        cursor = data!.nextCursor ?? undefined;
      } while (cursor);
      return out;
    },
  });
}

export function useSzenarioMutations(portfolioId: string | null) {
  const qc = useQueryClient();
  const setzen = (s: Szenario) => {
    qc.setQueryData(szenarioKeys.eins(s.id), s);
    void qc.invalidateQueries({ queryKey: szenarioKeys.liste(s.portfolioId) });
    void qc.invalidateQueries({ queryKey: [...szenarioKeys.all, 'vergleich'] });
  };
  const anlegen = useMutation({
    mutationFn: async ({ name, key }: { name: string; key: string }) =>
      (await api.POST('/v1/portfolios/{id}/szenarien', { params: { path: { id: portfolioId! }, header: { 'idempotency-key': key } }, body: { name } })).data!,
    onSuccess: setzen,
  });
  const positionen = useMutation({
    mutationFn: async ({ s, liste }: { s: Szenario; liste: PositionAenderung[] }) => {
      const r = await api.PUT('/v1/szenarien/{id}/positionen', { params: { path: { id: s.id }, header: { 'if-match': etagVon(s) } }, body: { positionen: liste } });
      return r.data!;
    },
    onSuccess: setzen,
  });
  const umbenennen = useMutation({
    mutationFn: async ({ s, name }: { s: Szenario; name: string }) =>
      (await api.PATCH('/v1/szenarien/{id}', { params: { path: { id: s.id }, header: { 'if-match': etagVon(s) } }, body: { name } })).data!,
    onSuccess: setzen,
  });
  const verwerfen = useMutation({
    mutationFn: async (s: Szenario) => (await api.POST('/v1/szenarien/{id}/verwerfen', { params: { path: { id: s.id }, header: { 'if-match': etagVon(s) } } })).data!,
    onSuccess: setzen,
  });
  // aus dem Vergleich: die aktuelle Fassung lesen, dann mit ihr wählen (412, falls inzwischen geändert)
  const beantragen = useMutation({
    mutationFn: async ({ id, vergleich }: { id: string; vergleich: string[] }) => {
      const r = await api.GET('/v1/szenarien/{id}', { params: { path: { id } } });
      return (await api.POST('/v1/szenarien/{id}/beantragen', { params: { path: { id }, header: { 'if-match': etagVon(r.data!, r.response) } }, body: { vergleich } })).data!;
    },
    onSuccess: s => { setzen(s); void qc.invalidateQueries({ queryKey: szenarioKeys.all }); },
  });
  return { anlegen, positionen, umbenennen, verwerfen, beantragen };
}
