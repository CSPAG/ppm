/** Abfragen und Änderungen der Projektideen (TanStack Query über den typisierten Client); BC DM.01.01, UC-001 Schritte 1–2, A2.2. */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ifMatch, type Schemas } from '../../api/index.ts';

export type Idee = Schemas['Idee'];
export type IdeeZeile = Schemas['IdeeZeile'];
export type IdeeInput = Schemas['IdeePatch'];
export type IdeeAuswahl = Schemas['IdeeAuswahl'];
export type Rueckfrage = Schemas['IdeeRueckfrage'];
export type IdeeKopf = Schemas['IdeeKopf'];
export type IdeeStand = Idee['stand'];

export const ideeKeys = {
  all: ['idee'] as const,
  eigene: ['idee', 'eigene'] as const,
  entwuerfe: ['idee', 'entwuerfe'] as const,
  nummer: (nummer: number) => ['idee', 'nummer', nummer] as const,
  auswahl: ['idee', 'auswahl'] as const,
  kopf: ['idee', 'kopf'] as const,
};

/** Aktuelle Fassung mit ETag für `If-Match` (Rückfall: Version). */
export interface Loaded { item: Idee; etag: string }
export const loaded = (item: Idee, response?: Response): Loaded => ({ item, etag: response?.headers.get('ETag') ?? ifMatch(item.version)['If-Match']! });

/** «Meine Ideen»: eigene Ideen, neueste zuerst, mit «Mehr laden». */
export function useEigeneIdeen() {
  return useInfiniteQuery({
    queryKey: ideeKeys.eigene,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => (await api.GET('/v1/ideen', { params: { query: { eigene: true, cursor: pageParam, limit: 50 } }, signal })).data!,
    getNextPageParam: last => last.nextCursor ?? undefined,
  });
}

/** Eigene Entwürfe (K4: abgebrochener Assistent bietet den Entwurf an). */
export function useEigeneEntwuerfe(enabled: boolean) {
  return useQuery({
    queryKey: ideeKeys.entwuerfe,
    enabled,
    queryFn: async ({ signal }) => (await api.GET('/v1/ideen', { params: { query: { eigene: true, stand: ['entwurf'], limit: 5 } }, signal })).data!.items,
  });
}

/** Idee über ihre Nummer (Adresse `/portfolio/ideen/<nr>`); `null`, wenn es keine gibt oder die Person sie nicht sieht. */
export function useIdeeNachNummer(nummer: number | null) {
  return useQuery({
    queryKey: ideeKeys.nummer(nummer ?? 0),
    enabled: nummer !== null,
    queryFn: async ({ signal }): Promise<Loaded | null> => {
      const { data } = await api.GET('/v1/ideen', { params: { query: { nummer: nummer!, limit: 1 } }, signal });
      const hit = data!.items[0];
      if (!hit) return null;
      const one = await api.GET('/v1/ideen/{id}', { params: { path: { id: hit.id } }, signal });
      return loaded(one.data!, one.response);
    },
  });
}

/** Auswahl für den Assistenten (Handlungsfelder mit Zielen, Bereiche, Herkunft), auch ohne Leserecht auf Ziele. */
export function useAuswahl(enabled = true) {
  return useQuery({
    queryKey: ideeKeys.auswahl,
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) => (await api.GET('/v1/ideen/auswahl', { signal })).data!,
  });
}

/** Suche für die Befehlspalette (I-N4): Titel oder Nummer, nach Recht wie die Liste. */
export async function sucheIdeen(q: string, signal: AbortSignal): Promise<IdeeZeile[]> {
  const { data } = await api.GET('/v1/ideen', { params: { query: { q, limit: 5 } }, signal });
  return data!.items;
}

export function useIdeeKopf() {
  return useQuery({ queryKey: ideeKeys.kopf, queryFn: async ({ signal }) => (await api.GET('/v1/ideen/kopf', { signal })).data! });
}

export function useIdeeMutations() {
  const qc = useQueryClient();
  // Liste, Entwürfe und Kopf neu laden; die geöffnete Idee führt der Assistent selbst nach
  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: ideeKeys.eigene }), qc.invalidateQueries({ queryKey: ideeKeys.entwuerfe }), qc.invalidateQueries({ queryKey: ideeKeys.kopf }),
  ]);
  const create = useMutation({
    mutationFn: async ({ body, key }: { body: IdeeInput | Record<string, never>; key: string }) => {
      const { data, response } = await api.POST('/v1/ideen', { body, params: { header: { 'idempotency-key': key } } });
      return loaded(data!, response);
    },
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: async ({ id, etag, body }: { id: string; etag: string; body: IdeeInput }) => {
      const { data, response } = await api.PATCH('/v1/ideen/{id}', { params: { path: { id }, header: { 'if-match': etag } }, body });
      return loaded(data!, response);
    },
    onSuccess: refresh,
  });
  const einreichen = useMutation({
    mutationFn: async ({ id, etag, key }: { id: string; etag: string; key: string }) => {
      const { data, response } = await api.POST('/v1/ideen/{id}/einreichen', { params: { path: { id }, header: { 'if-match': etag, 'idempotency-key': key } } });
      return loaded(data!, response);
    },
    onSuccess: refresh,
  });
  const verwerfen = useMutation({
    mutationFn: async ({ id, etag }: { id: string; etag: string }) => {
      await api.DELETE('/v1/ideen/{id}', { params: { path: { id }, header: { 'if-match': etag } } });
    },
    onSuccess: refresh,
  });
  const antworten = useMutation({
    mutationFn: async ({ id, rueckfrageId, antwort }: { id: string; rueckfrageId: string; antwort: string }) =>
      (await api.PUT('/v1/ideen/{id}/rueckfragen/{rueckfrageId}', { params: { path: { id, rueckfrageId } }, body: { antwort } })).data!,
  });
  return { create, update, einreichen, verwerfen, antworten };
}
