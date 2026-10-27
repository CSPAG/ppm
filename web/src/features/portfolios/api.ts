/** Abfragen und Änderungen von Portfolios, Gremien, Gremienweg und Sitzungsterminen (TanStack Query, BC AM.02.04). */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ifMatch, type Schemas } from '../../api/index.ts';

export type Portfolio = Schemas['Portfolio'];
export type Gremium = Schemas['Gremium'];
export type Gremienweg = Schemas['Gremienweg'];
export type GremienwegPut = Schemas['GremienwegPut'];
export type Sitzungstermin = Schemas['Sitzungstermin'];
export type GateCode = GremienwegPut['schritte'][number]['gate'];

/** Gates in der Reihenfolge des Phasenmodells (docs/fachmodell.md 2.3) mit Anzeige nach `fmtGate`. */
export const GATES: readonly { code: GateCode; von: 'eintritt' | 'P0' | 'P1' | 'P2' | 'P3' | 'P4'; zu: 'P0' | 'P1' | 'P2' | 'P3' | 'P4' | 'exit' }[] = [
  { code: 'EINTRITT_P0', von: 'eintritt', zu: 'P0' },
  { code: 'P0_P1', von: 'P0', zu: 'P1' },
  { code: 'P1_P2', von: 'P1', zu: 'P2' },
  { code: 'P2_P3', von: 'P2', zu: 'P3' },
  { code: 'P3_P4', von: 'P3', zu: 'P4' },
  { code: 'EXIT_P4', von: 'P4', zu: 'exit' },
];

export const portfolioKeys = {
  all: ['portfolio'] as const,
  list: ['portfolio', 'list'] as const,
  one: (id: string) => ['portfolio', 'one', id] as const,
  gremien: ['portfolio', 'gremien'] as const,
  gremium: (id: string) => ['portfolio', 'gremium', id] as const,
  weg: (id: string) => ['portfolio', 'weg', id] as const,
  termine: (id: string) => ['portfolio', 'termine', id] as const,
};

/** Aktuelle Fassung mit ETag für `If-Match` (Rückfall: Version). */
export interface Loaded<T extends { version: number }> { item: T; etag: string }
const loaded = <T extends { version: number }>(item: T, response: Response): Loaded<T> =>
  ({ item, etag: response.headers.get('ETag') ?? ifMatch(item.version)['If-Match']! });

export function usePortfolioList() {
  return useInfiniteQuery({
    queryKey: portfolioKeys.list,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => (await api.GET('/v1/portfolios', { params: { query: { cursor: pageParam, limit: 50 } }, signal })).data!,
    getNextPageParam: last => last.nextCursor ?? undefined,
  });
}

export function usePortfolio(id: string | null) {
  return useQuery({
    queryKey: portfolioKeys.one(id ?? ''),
    enabled: !!id,
    queryFn: async ({ signal }) => {
      const { data, response } = await api.GET('/v1/portfolios/{id}', { params: { path: { id: id! } }, signal });
      return loaded(data!, response);
    },
  });
}

/** Alle Gremien der Organisation (wenige je Portfolio): für die Spalte «Entscheidendes Gremium» und die Schubladen. */
export function useGremien() {
  return useQuery({
    queryKey: portfolioKeys.gremien,
    queryFn: async ({ signal }) => {
      const items: Gremium[] = [];
      let cursor: string | undefined;
      do {
        const data = (await api.GET('/v1/gremien', { params: { query: { cursor, limit: 200 } }, signal })).data!;
        items.push(...data.items);
        cursor = data.nextCursor ?? undefined;
      } while (cursor);
      return items;
    },
  });
}

export function useGremium(id: string | null) {
  return useQuery({
    queryKey: portfolioKeys.gremium(id ?? ''),
    enabled: !!id,
    queryFn: async ({ signal }) => {
      const { data, response } = await api.GET('/v1/gremien/{id}', { params: { path: { id: id! } }, signal });
      return loaded(data!, response);
    },
  });
}

export function useGremienweg(portfolioId: string) {
  return useQuery({
    queryKey: portfolioKeys.weg(portfolioId),
    queryFn: async ({ signal }) => (await api.GET('/v1/portfolios/{id}/gremienweg', { params: { path: { id: portfolioId } }, signal })).data!,
  });
}

export function useTermine(gremiumId: string) {
  return useQuery({
    queryKey: portfolioKeys.termine(gremiumId),
    queryFn: async ({ signal }) => (await api.GET('/v1/gremien/{id}/termine', { params: { path: { id: gremiumId } }, signal })).data!,
  });
}

export function usePortfolioMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: portfolioKeys.all });
  const create = useMutation({
    mutationFn: async ({ body, key }: { body: Schemas['PortfolioCreate']; key: string }) => {
      const { data, response } = await api.POST('/v1/portfolios', { body, params: { header: { 'idempotency-key': key } } });
      return loaded(data!, response);
    },
    onSuccess: async l => { qc.setQueryData(portfolioKeys.one(l.item.id), l); await refresh(); },
  });
  const update = useMutation({
    mutationFn: async ({ id, etag, body }: { id: string; etag: string; body: Schemas['PortfolioPatch'] }) => {
      const { data, response } = await api.PATCH('/v1/portfolios/{id}', { params: { path: { id }, header: { 'if-match': etag } }, body });
      return loaded(data!, response);
    },
    onSuccess: async l => { qc.setQueryData(portfolioKeys.one(l.item.id), l); await refresh(); },
  });
  const remove = useMutation({
    mutationFn: async ({ id, etag }: { id: string; etag: string }) => {
      await api.DELETE('/v1/portfolios/{id}', { params: { path: { id }, header: { 'if-match': etag } } });
    },
    onSuccess: async (_r, { id }) => { qc.removeQueries({ queryKey: portfolioKeys.one(id) }); await refresh(); },
  });
  const weg = useMutation({
    mutationFn: async ({ id, etag, body }: { id: string; etag: string; body: GremienwegPut }) =>
      (await api.PUT('/v1/portfolios/{id}/gremienweg', { params: { path: { id }, header: { 'if-match': etag } }, body })).data!,
    onSuccess: async w => { qc.setQueryData(portfolioKeys.weg(w.portfolioId), w); await refresh(); },
  });
  return { create, update, remove, weg };
}

export function useGremiumMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: portfolioKeys.all });
  const create = useMutation({
    mutationFn: async ({ body, key }: { body: Schemas['GremiumCreate']; key: string }) => {
      const { data, response } = await api.POST('/v1/gremien', { body, params: { header: { 'idempotency-key': key } } });
      return loaded(data!, response);
    },
    onSuccess: async l => { qc.setQueryData(portfolioKeys.gremium(l.item.id), l); await refresh(); },
  });
  const update = useMutation({
    mutationFn: async ({ id, etag, body }: { id: string; etag: string; body: Schemas['GremiumPatch'] }) => {
      const { data, response } = await api.PATCH('/v1/gremien/{id}', { params: { path: { id }, header: { 'if-match': etag } }, body });
      return loaded(data!, response);
    },
    onSuccess: async l => { qc.setQueryData(portfolioKeys.gremium(l.item.id), l); await refresh(); },
  });
  const remove = useMutation({
    mutationFn: async ({ id, etag }: { id: string; etag: string }) => {
      await api.DELETE('/v1/gremien/{id}', { params: { path: { id }, header: { 'if-match': etag } } });
    },
    onSuccess: async (_r, { id }) => { qc.removeQueries({ queryKey: portfolioKeys.gremium(id) }); await refresh(); },
  });
  const termin = useMutation({
    mutationFn: async ({ id, datum, key }: { id: string; datum: string; key: string }) =>
      (await api.POST('/v1/gremien/{id}/termine', { params: { path: { id }, header: { 'idempotency-key': key } }, body: { datum } })).data!,
    onSuccess: async t => { await qc.invalidateQueries({ queryKey: portfolioKeys.termine(t.gremiumId) }); },
  });
  const terminEntfernen = useMutation({
    mutationFn: async ({ id, datum }: { id: string; datum: string }) => {
      await api.DELETE('/v1/gremien/{id}/termine/{datum}', { params: { path: { id, datum } } });
    },
    onSuccess: async (_r, { id }) => { await qc.invalidateQueries({ queryKey: portfolioKeys.termine(id) }); },
  });
  return { create, update, remove, termin, terminEntfernen };
}
