/** Abfragen und Änderungen des Gate-Modus (AP-E3-3; UI-08; K2 Schritte 1–4; UC-003 Schritte 1–4, A2). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Schemas } from '../../api/index.ts';
import { vertragKeys, type VersionLoaded } from './api.ts';

export type Gate = Schemas['VertragGate'];
export type Leitfrage = Schemas['VertragLeitfrage'];

export const gateKey = (versionId: string) => ['vertrag', 'gate', versionId] as const;

export function useGate(versionId: string | null) {
  return useQuery({
    queryKey: gateKey(versionId ?? ''),
    enabled: !!versionId,
    queryFn: async ({ signal }) => (await api.GET('/v1/vertragsversionen/{id}/gate', { params: { path: { id: versionId! } }, signal })).data!,
  });
}

/** Bezeichnungen der Werteströme (Codetabelle «Werteströme», UC-017 Schritt 2); ohne Recht der Schlüssel. */
export function useWertestroeme() {
  return useQuery({
    queryKey: ['vertrag', 'wertestroeme'] as const,
    retry: false,
    queryFn: async ({ signal }) => {
      const r = await api.GET('/v1/codetabellen/{schluessel}/werte', { params: { path: { schluessel: 'wertestrom' } }, signal });
      return new Map((r.data?.items ?? []).map(w => [w.schluessel, w.label] as const));
    },
  });
}

export function useGateMutations(projektId: string | undefined) {
  const qc = useQueryClient();
  /** Entwurf für die nächste Phase aus der Baseline (UC-003 Schritt 2). */
  const anlegen = useMutation({
    mutationFn: async ({ key }: { key: string }) => {
      const { data, response } = await api.POST('/v1/projekte/{id}/vertrag/entwuerfe', {
        params: { path: { id: projektId! }, header: { 'idempotency-key': key } }, body: { anlass: 'gate' },
      });
      return { detail: data!, etag: response.headers.get('ETag') ?? `W/"${data!.version.version}"` } satisfies VersionLoaded;
    },
    onSuccess: async l => {
      qc.setQueryData(vertragKeys.version(l.detail.version.id), l);
      if (projektId) await qc.invalidateQueries({ queryKey: vertragKeys.vertrag(projektId) });
    },
  });
  /** Antwort speichern (automatisch beim Verlassen des Felds, I-R3); bestätigt durch den Server. */
  const antworten = useMutation({
    mutationFn: async ({ versionId, frage, antwort, zutreffend }: { versionId: string; frage: Leitfrage; antwort: string; zutreffend: boolean }) =>
      (await api.PUT('/v1/vertragsversionen/{id}/gate/leitfragen/{leitfrageId}', {
        params: { path: { id: versionId, leitfrageId: frage.id }, header: { 'if-match': `W/"${frage.antwort?.version ?? 0}"` } },
        body: { antwort, zutreffend },
      })).data!,
    onSuccess: (neu, { versionId }) => {
      qc.setQueryData(gateKey(versionId), (g: Gate | undefined) => {
        if (!g) return g;
        const leitfragen = g.leitfragen.map(f => (f.id === neu.id ? neu : f));
        return { ...g, leitfragen, fortschritt: { ...g.fortschritt, beantwortet: leitfragen.filter(f => f.antwort).length } };
      });
    },
  });
  const nutzen = useMutation({
    mutationFn: async ({ versionId, version, body }: { versionId: string; version: number; body: Schemas['VertragNutzenIn'] }) =>
      (await api.PUT('/v1/vertragsversionen/{id}/gate/nutzen', { params: { path: { id: versionId }, header: { 'if-match': `W/"${version}"` } }, body })).data!,
    onSuccess: (g, { versionId }) => { qc.setQueryData(gateKey(versionId), g); },
  });
  return { anlegen, antworten, nutzen };
}
