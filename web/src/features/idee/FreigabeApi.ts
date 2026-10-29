/** Abfragen und Änderungen für die Freigabe der Initialisierung (AP-E4-3; UC-001 Schritte 6–7, A4, A5). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Schemas } from '../../api/index.ts';
import { ideeKeys } from './api.ts';

export type Freigabe = Schemas['IdeeFreigabe'];

/** Freigabe mit ETag der Idee für `If-Match`. */
export interface FreigabeLoaded { item: Freigabe; etag: string }

export const freigabeKey = (id: string) => ['idee', 'freigabe', id] as const;

export function useFreigabe(id: string) {
  return useQuery({
    queryKey: freigabeKey(id),
    queryFn: async ({ signal }): Promise<FreigabeLoaded> => {
      const { data, response } = await api.GET('/v1/ideen/{id}/freigabe', { params: { path: { id } }, signal });
      return { item: data!, etag: response.headers.get('ETag') ?? '' };
    },
  });
}

export function useFreigabeMutations(id: string) {
  const qc = useQueryClient();
  const geladen = (data: Freigabe | undefined, response: Response): FreigabeLoaded => {
    const l = { item: data!, etag: response.headers.get('ETag') ?? '' };
    qc.setQueryData(freigabeKey(id), l);
    // Idee, Prüfung, Pool und Kopf neu laden; die Freigabe kommt mit der Antwort
    void qc.invalidateQueries({ queryKey: ideeKeys.all, predicate: q => q.queryKey[1] !== 'freigabe' });
    return l;
  };
  const header = (etag: string) => ({ 'if-match': etag });
  return {
    angaben: useMutation({
      mutationFn: async ({ etag, body }: { etag: string; body: Schemas['IdeeFreigabeAngabenIn'] }) => {
        const r = await api.PUT('/v1/ideen/{id}/freigabe/angaben', { params: { path: { id }, header: header(etag) }, body });
        return geladen(r.data, r.response);
      },
    }),
    initialisieren: useMutation({
      mutationFn: async ({ etag }: { etag: string }) => {
        const r = await api.POST('/v1/ideen/{id}/initialisieren', { params: { path: { id }, header: header(etag) } });
        return geladen(r.data, r.response);
      },
    }),
    traktandieren: useMutation({
      mutationFn: async ({ etag }: { etag: string }) => {
        const r = await api.POST('/v1/ideen/{id}/traktandieren', { params: { path: { id }, header: header(etag) } });
        return geladen(r.data, r.response);
      },
    }),
    freigeben: useMutation({
      mutationFn: async ({ etag, body }: { etag: string; body: Schemas['IdeeFreigebenIn'] }) => {
        const r = await api.POST('/v1/ideen/{id}/freigeben', { params: { path: { id }, header: header(etag) }, body });
        return geladen(r.data, r.response);
      },
    }),
    ablehnen: useMutation({
      mutationFn: async ({ etag, begruendung }: { etag: string; begruendung: string }) => {
        const r = await api.POST('/v1/ideen/{id}/ablehnen', { params: { path: { id }, header: header(etag) }, body: { begruendung } });
        return geladen(r.data, r.response);
      },
    }),
  };
}
