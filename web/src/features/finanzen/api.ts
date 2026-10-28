/** Abfragen und Änderungen der Finanzen (TanStack Query über den typisierten Client); BC PC.01.02, PC.01.04, PC.01.05. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, isConflict, type Schemas } from '../../api/index.ts';

export type Finanzuebersicht = Schemas['Finanzuebersicht'];
export type FinanzProjekt = Schemas['FinanzProjekt'];
export type Begruendung = Schemas['Begruendung'];
export type Budgetuebergabe = Schemas['Budgetuebergabe'];
export type Korrektur = Schemas['BudgetuebergabePut']['korrekturen'][number];
export interface PortfolioKurz { id: string; schluessel: string; name: string; kategorie: string }

export const finanzenKeys = {
  all: ['finanzen'] as const,
  portfolios: ['finanzen', 'portfolios'] as const,
  liste: (art: 'uebersicht' | 'abweichungen', portfolioId: string, alle: boolean) => ['finanzen', art, portfolioId, alle] as const,
  begruendungen: (projektId: string) => ['finanzen', 'begruendungen', projektId] as const,
  uebergabe: (jahr: number) => ['finanzen', 'uebergabe', jahr] as const,
};

/** Portfolios, die die Person sieht (alle Seiten), nach Kategorie und Name. */
export function usePortfolios() {
  return useQuery({
    queryKey: finanzenKeys.portfolios,
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

/** Übersicht bzw. Abweichungen; `portfolioId` leer = alle (Recht an der Organisation). */
export function useFinanzen(art: 'uebersicht' | 'abweichungen', portfolioId: string | null, alle: boolean, enabled = true) {
  return useQuery({
    queryKey: finanzenKeys.liste(art, portfolioId ?? '', alle),
    enabled,
    queryFn: async ({ signal }) => {
      const query = { ...(portfolioId ? { portfolio: portfolioId } : {}), ...(alle ? { alle: true } : {}) };
      const r = art === 'uebersicht'
        ? await api.GET('/v1/finanzen', { params: { query }, signal })
        : await api.GET('/v1/finanzen/abweichungen', { params: { query }, signal });
      return r.data!;
    },
  });
}

export function useKostentraeger(projektId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nummer: string | null) => (await api.PUT('/v1/projekte/{id}/kostentraeger', { params: { path: { id: projektId } }, body: { nummer } })).data!,
    onSuccess: () => qc.invalidateQueries({ queryKey: finanzenKeys.all }),
  });
}

export function useBegruendungen(projektId: string | null) {
  return useQuery({
    queryKey: finanzenKeys.begruendungen(projektId ?? ''),
    enabled: !!projektId,
    queryFn: async ({ signal }) => (await api.GET('/v1/projekte/{id}/abweichungsbegruendungen', { params: { path: { id: projektId! } }, signal })).data!,
  });
}

export function useBegruenden(projektId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ periode, text, version }: { periode: string; text: string; version: number }) =>
      (await api.PUT('/v1/projekte/{id}/abweichungsbegruendungen/{periode}', { params: { path: { id: projektId, periode }, header: { 'if-match': `W/"${version}"` } }, body: { text } })).data!,
    onSuccess: () => qc.invalidateQueries({ queryKey: finanzenKeys.all }),
  });
}

export function useUebergabe(jahr: number, enabled = true) {
  return useQuery({
    queryKey: finanzenKeys.uebergabe(jahr),
    enabled,
    queryFn: async ({ signal }) => (await api.GET('/v1/budgetuebergaben/{jahr}', { params: { path: { jahr } }, signal })).data!,
  });
}

export function useUebergabeAendern(jahr: number) {
  const qc = useQueryClient();
  const fertig = (u: Budgetuebergabe) => qc.setQueryData(finanzenKeys.uebergabe(jahr), u);
  const korrigieren = useMutation({
    mutationFn: async ({ version, korrekturen }: { version: number; korrekturen: Korrektur[] }) =>
      (await api.PUT('/v1/budgetuebergaben/{jahr}', { params: { path: { jahr }, header: { 'if-match': `W/"${version}"` } }, body: { korrekturen } })).data!,
    onSuccess: fertig,
  });
  const uebergeben = useMutation({
    mutationFn: async (version: number) => (await api.POST('/v1/budgetuebergaben/{jahr}/export', { params: { path: { jahr }, header: { 'if-match': `W/"${version}"` } } })).data!,
    onSuccess: fertig,
    // Konflikt (412): den neuen Stand holen, damit vor dem Übergeben der aktuelle Jahresbedarf zu sehen ist (Z7)
    onError: e => { if (isConflict(e)) void qc.invalidateQueries({ queryKey: finanzenKeys.uebergabe(jahr) }); },
  });
  return { korrigieren, uebergeben };
}
