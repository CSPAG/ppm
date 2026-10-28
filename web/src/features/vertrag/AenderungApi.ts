/** Abfragen und Übergänge für Änderungsantrag, Hauptänderungen und Versionsvergleich (AP-E3-4; UI-09, UI-10; K2 Schritte 1, 5, 9). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ifMatch, type Schemas } from '../../api/index.ts';
import { vertragKeys, type VersionLoaded } from './api.ts';

export type Aenderung = Schemas['VertragAenderung'];
export type Hauptaenderungen = Schemas['VertragHauptaenderungen'];
export type Rubrik = Hauptaenderungen['rubriken'][number]['rubrik'];
export type Vergleich = Schemas['VertragVergleich'];
export type Unterschied = Schemas['VertragUnterschied'];
export interface AenderungLoaded { aenderung: Aenderung; etag: string }
export interface HauptaenderungenLoaded { h: Hauptaenderungen; etag: string }

export const aenderungKeys = {
  aenderung: (id: string) => ['vertrag', 'aenderung', id] as const,
  haupt: (id: string) => ['vertrag', 'hauptaenderungen', id] as const,
  vergleich: (id: string, mit: string) => ['vertrag', 'vergleich', id, mit] as const,
};

const etagVon = (r: Response, version: number) => r.headers.get('ETag') ?? ifMatch(version)['If-Match']!;

export function useAenderung(versionId: string | null) {
  return useQuery({
    queryKey: aenderungKeys.aenderung(versionId ?? ''),
    enabled: !!versionId,
    queryFn: async ({ signal }): Promise<AenderungLoaded> => {
      const { data, response } = await api.GET('/v1/vertragsversionen/{id}/aenderung', { params: { path: { id: versionId! } }, signal });
      return { aenderung: data!, etag: etagVon(response, data!.version) };
    },
  });
}

export function useHauptaenderungen(versionId: string | null) {
  return useQuery({
    queryKey: aenderungKeys.haupt(versionId ?? ''),
    enabled: !!versionId,
    queryFn: async ({ signal }): Promise<HauptaenderungenLoaded> => {
      const { data, response } = await api.GET('/v1/vertragsversionen/{id}/hauptaenderungen', { params: { path: { id: versionId! } }, signal });
      return { h: data!, etag: etagVon(response, data!.version) };
    },
  });
}

/** Vergleich `neu` gegen `alt` (beide IDs). */
export function useVergleich(neu: string | null, alt: string | null) {
  return useQuery({
    queryKey: aenderungKeys.vergleich(neu ?? '', alt ?? ''),
    enabled: !!neu && !!alt && neu !== alt,
    queryFn: async ({ signal }) =>
      (await api.GET('/v1/vertragsversionen/{id}/vergleich', { params: { path: { id: neu! }, query: { mit: alt! } }, signal })).data!,
  });
}

/** Übergänge des Antrags; danach Version, Vertrag, Antrag und Hauptänderungen neu (bestätigt durch den Server, I-R2). */
export function useAenderungMutations(projektId: string | undefined) {
  const qc = useQueryClient();
  const neu = async (versionId: string) => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: vertragKeys.version(versionId) }),
      qc.invalidateQueries({ queryKey: aenderungKeys.haupt(versionId) }),
      qc.invalidateQueries({ queryKey: ['vertrag', 'kapitel', versionId] }),
      projektId ? qc.invalidateQueries({ queryKey: vertragKeys.vertrag(projektId) }) : null,
    ]);
  };
  const nachAntrag = async (l: AenderungLoaded) => {
    qc.setQueryData(aenderungKeys.aenderung(l.aenderung.versionId), l);
    await neu(l.aenderung.versionId);
  };
  const beantragen = useMutation({
    mutationFn: async ({ key, begruendung }: { key: string; begruendung: string }) => {
      const { data, response } = await api.POST('/v1/projekte/{id}/vertrag/entwuerfe', {
        params: { path: { id: projektId! }, header: { 'idempotency-key': key } }, body: { anlass: 'aenderung', begruendung },
      });
      return { detail: data!, etag: etagVon(response, data!.version.version) } satisfies VersionLoaded;
    },
    onSuccess: async l => {
      qc.setQueryData(vertragKeys.version(l.detail.version.id), l);
      if (projektId) await qc.invalidateQueries({ queryKey: vertragKeys.vertrag(projektId) });
    },
  });
  const einreichen = useMutation({
    mutationFn: async ({ id, etag }: { id: string; etag: string }): Promise<AenderungLoaded> => {
      const { data, response } = await api.POST('/v1/vertragsversionen/{id}/aenderung/einreichen', { params: { path: { id }, header: { 'if-match': etag } } });
      return { aenderung: data!, etag: etagVon(response, data!.version) };
    },
    onSuccess: nachAntrag,
  });
  const entscheiden = useMutation({
    mutationFn: async ({ id, etag, body }: { id: string; etag: string; body: Schemas['VertragAenderungEntscheid'] }): Promise<AenderungLoaded> => {
      const { data, response } = await api.POST('/v1/vertragsversionen/{id}/aenderung/entscheiden', { params: { path: { id }, header: { 'if-match': etag } }, body });
      return { aenderung: data!, etag: etagVon(response, data!.version) };
    },
    onSuccess: nachAntrag,
  });
  const hauptSpeichern = useMutation({
    mutationFn: async ({ id, etag, body }: { id: string; etag: string; body: Schemas['VertragHauptaenderungenPut'] }): Promise<HauptaenderungenLoaded> => {
      const { data, response } = await api.PUT('/v1/vertragsversionen/{id}/hauptaenderungen', { params: { path: { id }, header: { 'if-match': etag } }, body });
      return { h: data!, etag: etagVon(response, data!.version) };
    },
    onSuccess: async l => {
      qc.setQueryData(aenderungKeys.haupt(l.h.versionId), l);
      // die Version ist mit den Hauptänderungen fortgeschrieben (ETag für Einreichen)
      await qc.invalidateQueries({ queryKey: vertragKeys.version(l.h.versionId) });
      await qc.invalidateQueries({ queryKey: aenderungKeys.aenderung(l.h.versionId) });
    },
  });
  return { beantragen, einreichen, entscheiden, hauptSpeichern };
}
