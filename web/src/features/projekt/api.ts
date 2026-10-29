/** Abfragen und Änderungen der Projekte (TanStack Query über den typisierten Client). */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ifMatch, type Schemas } from '../../api/index.ts';

export type Projekt = Schemas['Projekt'];
export type Organisation = Schemas['Organisation'];
export type Funktion = Schemas['Mitglied']['funktion'];
export type Lebenszyklus = Projekt['lebenszyklus'];

/** `alle`: auch Projekte, die die Person nur auflisten darf (Kopfdaten, UI-52, Master Entscheid 14). */
export interface ListFilter { q: string; rolle?: Funktion; phase?: Projekt['phase']; lebenszyklus?: Lebenszyklus[]; alle?: boolean }

export const projektKeys = {
  all: ['projekt'] as const,
  list: (f: ListFilter) => ['projekt', 'list', f] as const,
  nummer: (nr: string) => ['projekt', 'nummer', nr] as const,
  organisation: (id: string) => ['projekt', 'organisation', id] as const,
  kopf: ['projekt', 'kopf'] as const,
};

export const LAUFEND: Lebenszyklus[] = ['aktiv', 'sistiert'];
export const BEENDET: Lebenszyklus[] = ['abgebrochen', 'abgeschlossen', 'zurueckgezogen'];

/** Laufende Projekte mit eigener Funktion für die Kopfkarte im Eingang (`GET /v1/projekte/kopf`). */
export function useProjektKopf() {
  return useQuery({ queryKey: projektKeys.kopf, queryFn: async ({ signal }) => (await api.GET('/v1/projekte/kopf', { signal })).data! });
}

/** Stand der Berichte der Projekte auf der Kopfkarte: letzter Status und Trend, Bericht der laufenden Periode. */
export function useBerichtStand(ids: readonly string[]) {
  return useQuery({
    queryKey: [...projektKeys.kopf, 'stand', ids] as const,
    enabled: ids.length > 0,
    queryFn: async ({ signal }) => (await api.GET('/v1/statusberichte/stand', { params: { query: { projektId: [...ids] } }, signal })).data!.items,
  });
}

/** Nächstes traktandiertes Geschäft je Projekt (Gremium und Datum) für die Kopfkarte. */
export function useNaechsteTraktanden(ids: readonly string[]) {
  return useQuery({
    queryKey: [...projektKeys.kopf, 'traktanden', ids] as const,
    enabled: ids.length > 0,
    queryFn: async ({ signal }) => (await api.GET('/v1/traktanden/naechste', { params: { query: { projektId: [...ids] } }, signal })).data!.items,
  });
}

export function useProjektList(f: ListFilter) {
  return useInfiniteQuery({
    queryKey: projektKeys.list(f),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await api.GET('/v1/projekte', {
        params: { query: { q: f.q || undefined, rolle: f.rolle, phase: f.phase, lebenszyklus: f.lebenszyklus, alle: f.alle || undefined, cursor: pageParam, limit: 50 } }, signal,
      });
      return data!;
    },
    getNextPageParam: last => last.nextCursor ?? undefined,
  });
}

/** Projekt zur Nummer (Adresse `/projekte/<nr>`, I-N5); `null`, wenn es das Projekt nicht gibt oder die Person es nicht sieht. */
export function useProjektNachNummer(nr: string, alle = false) {
  return useQuery({
    queryKey: [...projektKeys.nummer(nr), alle] as const,
    queryFn: async ({ signal }) => {
      const { data } = await api.GET('/v1/projekte', { params: { query: { nummer: nr, alle: alle || undefined, limit: 1 } }, signal });
      return data!.items[0] ?? null;
    },
  });
}

/** Projektorganisation mit ETag für `If-Match`. */
export interface OrgLoaded { org: Organisation; etag: string }

export function useOrganisation(id: string | undefined) {
  return useQuery({
    queryKey: projektKeys.organisation(id ?? ''),
    enabled: !!id,
    queryFn: async ({ signal }): Promise<OrgLoaded> => {
      const { data, response } = await api.GET('/v1/projekte/{id}/organisation', { params: { path: { id: id! } }, signal });
      return { org: data!, etag: response.headers.get('ETag') ?? ifMatch(data!.version)['If-Match']! };
    },
  });
}

export function useOrganisationSpeichern() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, etag, mitglieder }: { id: string; etag: string; mitglieder: Schemas['OrganisationPut']['mitglieder'] }) => {
      const { data, response } = await api.PUT('/v1/projekte/{id}/organisation', { params: { path: { id }, header: { 'if-match': etag } }, body: { mitglieder } });
      return { org: data!, etag: response.headers.get('ETag') ?? ifMatch(data!.version)['If-Match']! };
    },
    onSuccess: async (l, { id }) => {
      qc.setQueryData(projektKeys.organisation(id), l);
      // Sponsor, Projektleitung und eigene Rollen stehen auch in der Liste und im Kopf
      await qc.invalidateQueries({ queryKey: projektKeys.all });
    },
  });
}

/** Suche für die Befehlspalette (I-N4): Projekte nach Name oder Nummer, nur die sichtbaren (API). */
/** Personen in sichtbaren Projekten für die Befehlspalette (I-N4): Name und Funktionen, ohne E-Mail. */
export async function suchePersonen(q: string, signal: AbortSignal) {
  return (await api.GET('/v1/projekte/personen', { params: { query: { q, limit: 5 } }, signal })).data!.items;
}

/** Suche der Befehlspalette; `alle`: alle aufgelisteten Projekte (Master Entscheid 14), sonst nur mit Leserecht. */
export async function sucheProjekte(q: string, signal: AbortSignal, alle = false): Promise<Projekt[]> {
  const { data } = await api.GET('/v1/projekte', { params: { query: { q, alle: alle || undefined, limit: 5 } }, signal });
  return data!.items;
}
