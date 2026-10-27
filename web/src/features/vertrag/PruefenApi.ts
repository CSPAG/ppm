/** Abfragen und Übergänge für Quality-Check und Unterschriften (AP-E3-2; UI-12; K2 Schritte 7–8). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ifMatch, type Schemas } from '../../api/index.ts';
import { vertragKeys } from './api.ts';

export type Pruefung = Schemas['VertragPruefung'];
export type Funktion = Pruefung['can']['unterzeichnen'][number]['funktion'];
export interface PruefungLoaded { pruefung: Pruefung; etag: string }

export const pruefungKey = (versionId: string) => ['vertrag', 'pruefung', versionId] as const;

export function usePruefung(versionId: string | null) {
  return useQuery({
    queryKey: pruefungKey(versionId ?? ''),
    enabled: !!versionId,
    queryFn: async ({ signal }): Promise<PruefungLoaded> => {
      const { data, response } = await api.GET('/v1/vertragsversionen/{id}/pruefung', { params: { path: { id: versionId! } }, signal });
      return { pruefung: data!, etag: response.headers.get('ETag') ?? ifMatch(data!.version)['If-Match']! };
    },
  });
}

/** Übergänge: Ergebnis vom Server bestätigt (I-R2), danach Version, Vertrag und Prüfung neu. */
export function usePruefungMutations(projektId: string | undefined) {
  const qc = useQueryClient();
  const nach = async (p: Pruefung) => {
    qc.setQueryData(pruefungKey(p.versionId), { pruefung: p, etag: ifMatch(p.version)['If-Match']! } satisfies PruefungLoaded);
    await qc.invalidateQueries({ queryKey: vertragKeys.version(p.versionId) });
    if (projektId) await qc.invalidateQueries({ queryKey: vertragKeys.vertrag(projektId) });
  };
  const qualityCheck = useMutation({
    mutationFn: async ({ id, etag, body }: { id: string; etag: string; body: Schemas['VertragQualityCheckIn'] }) =>
      (await api.POST('/v1/vertragsversionen/{id}/quality-check', { params: { path: { id }, header: { 'if-match': etag } }, body })).data!,
    onSuccess: nach,
  });
  const unterschrift = useMutation({
    mutationFn: async ({ id, etag, body }: { id: string; etag: string; body: Schemas['VertragUnterschriftIn'] }) =>
      (await api.POST('/v1/vertragsversionen/{id}/unterschriften', { params: { path: { id }, header: { 'if-match': etag } }, body })).data!,
    onSuccess: nach,
  });
  return { qualityCheck, unterschrift };
}
