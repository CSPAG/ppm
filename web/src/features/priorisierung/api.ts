/** Abfragen und Änderungen der Priorisierung (TanStack Query über den typisierten Client); BC PP.01.02, PP.01.03, PP.02.01. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ifMatch, type Schemas } from '../../api/index.ts';

export type Bewertungsmodell = Schemas['Bewertungsmodell'];
export type BewertungsmodellKurz = Schemas['BewertungsmodellKurz'];
export type Bewertungsraster = Schemas['Bewertungsraster'];
export type Kriterium = Schemas['Kriterium'];
export type BewertungAenderung = Schemas['BewertungenPut']['zellen'][number];
export type ModellPatch = Schemas['BewertungsmodellPatch'];
export interface PortfolioKurz { id: string; schluessel: string; name: string; kategorie: string }

export const priorisierungKeys = {
  all: ['priorisierung'] as const,
  modelle: ['priorisierung', 'modelle'] as const,
  modell: (id: string) => ['priorisierung', 'modell', id] as const,
  raster: (portfolioId: string, modellId: string) => ['priorisierung', 'raster', portfolioId, modellId] as const,
  portfolios: ['priorisierung', 'portfolios'] as const,
};

/** Portfolios, die die Person sieht (alle Seiten), nach Kategorie und Name. */
export function usePortfolios() {
  return useQuery({
    queryKey: priorisierungKeys.portfolios,
    staleTime: 60_000,
    queryFn: async ({ signal }): Promise<PortfolioKurz[]> => {
      const out: PortfolioKurz[] = [];
      let cursor: string | undefined;
      do {
        const { data } = await api.GET('/v1/portfolios', { params: { query: { cursor, limit: 200 } }, signal });
        out.push(...data!.items.map(p => ({ id: p.id, schluessel: p.schluessel, name: p.name, kategorie: p.kategorie })));
        cursor = data!.nextCursor ?? undefined;
      } while (cursor);
      return out.sort((a, b) => a.kategorie.localeCompare(b.kategorie) || a.name.localeCompare(b.name, 'de-CH'));
    },
  });
}

/** Versionen des Modells; ohne Recht an der Organisation (Gremium) nicht abgefragt. */
export function useModelle(enabled = true) {
  return useQuery({
    queryKey: priorisierungKeys.modelle,
    enabled,
    queryFn: async ({ signal }) => (await api.GET('/v1/bewertungsmodelle', { signal })).data!,
  });
}

/** Aktuelle Fassung mit ETag für `If-Match` (Rückfall: Version). */
export interface Loaded { item: Bewertungsmodell; etag: string }
const loaded = (item: Bewertungsmodell, response?: Response): Loaded => ({ item, etag: response?.headers.get('ETag') ?? ifMatch(item.version)['If-Match']! });

export function useModell(id: string | null) {
  return useQuery({
    queryKey: priorisierungKeys.modell(id ?? ''),
    enabled: !!id,
    queryFn: async ({ signal }) => {
      const r = await api.GET('/v1/bewertungsmodelle/{id}', { params: { path: { id: id! } }, signal });
      return loaded(r.data!, r.response);
    },
  });
}

export function useRaster(portfolioId: string | null, modellId: string | undefined) {
  return useQuery({
    queryKey: priorisierungKeys.raster(portfolioId ?? '', modellId ?? ''),
    enabled: !!portfolioId,
    queryFn: async ({ signal }) => (await api.GET('/v1/portfolios/{id}/bewertungen', { params: { path: { id: portfolioId! }, query: { modell: modellId } }, signal })).data!,
  });
}

export function useBewertungSpeichern(portfolioId: string) {
  return useMutation({
    mutationFn: async (zellen: BewertungAenderung[]) => (await api.PUT('/v1/portfolios/{id}/bewertungen', { params: { path: { id: portfolioId } }, body: { zellen } })).data!.zellen,
  });
}

export function useModellMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: priorisierungKeys.all });
  const anlegen = useMutation({
    mutationFn: async (key: string) => {
      const r = await api.POST('/v1/bewertungsmodelle', { body: {}, params: { header: { 'idempotency-key': key } } });
      return loaded(r.data!, r.response);
    },
    onSuccess: refresh,
  });
  const aendern = useMutation({
    mutationFn: async ({ id, etag, body }: { id: string; etag: string; body: ModellPatch }) => {
      const r = await api.PATCH('/v1/bewertungsmodelle/{id}', { params: { path: { id }, header: { 'if-match': etag } }, body });
      return loaded(r.data!, r.response);
    },
    onSuccess: refresh,
  });
  const inKraft = useMutation({
    mutationFn: async ({ id, etag, beschluss }: { id: string; etag: string; beschluss: string }) => {
      const r = await api.POST('/v1/bewertungsmodelle/{id}/in-kraft-setzen', { params: { path: { id }, header: { 'if-match': etag } }, body: { beschluss } });
      return loaded(r.data!, r.response);
    },
    onSuccess: refresh,
  });
  const verwerfen = useMutation({
    mutationFn: async ({ id, etag }: { id: string; etag: string }) => {
      await api.DELETE('/v1/bewertungsmodelle/{id}', { params: { path: { id }, header: { 'if-match': etag } } });
    },
    onSuccess: refresh,
  });
  return { anlegen, aendern, inKraft, verwerfen };
}
