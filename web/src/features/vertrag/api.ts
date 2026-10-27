/** Abfragen und Änderungen des Projektvertrags (TanStack Query über den typisierten Client; Kernablauf K2). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ifMatch, type Schemas } from '../../api/index.ts';

export type Vertrag = Schemas['Vertrag'];
export type Version = Schemas['VertragVersion'];
export type VersionDetail = Schemas['VertragVersionDetail'];
export type Kapitel = Schemas['VertragKapitel'];
export type Pflichtangaben = Schemas['VertragPflichtangaben'];
export type Angabe = Pflichtangaben['angaben'][number];
export type Inhalt = Record<string, unknown>;

export const vertragKeys = {
  all: ['vertrag'] as const,
  projekt: (nr: string) => ['vertrag', 'projekt', nr] as const,
  vertrag: (projektId: string) => ['vertrag', 'versionen', projektId] as const,
  version: (id: string) => ['vertrag', 'version', id] as const,
  kapitel: (id: string, nr: number) => ['vertrag', 'kapitel', id, nr] as const,
  pflicht: (id: string) => ['vertrag', 'pflicht', id] as const,
};

const etagVon = (response: Response, version: number) => response.headers.get('ETag') ?? ifMatch(version)['If-Match']!;

/** Projekt zur Nummer der Adresse (I-N5); `null`, wenn es das Projekt nicht gibt oder die Person es nicht sieht. */
export function useProjekt(nr: string) {
  return useQuery({
    queryKey: vertragKeys.projekt(nr),
    queryFn: async ({ signal }) => (await api.GET('/v1/projekte', { params: { query: { nummer: nr, limit: 1 } }, signal })).data!.items[0] ?? null,
  });
}

export function useVertrag(projektId: string | undefined) {
  return useQuery({
    queryKey: vertragKeys.vertrag(projektId ?? ''),
    enabled: !!projektId,
    queryFn: async ({ signal }) => (await api.GET('/v1/projekte/{id}/vertrag', { params: { path: { id: projektId! } }, signal })).data!,
  });
}

export interface VersionLoaded { detail: VersionDetail; etag: string }
export function useVersion(id: string | null) {
  return useQuery({
    queryKey: vertragKeys.version(id ?? ''),
    enabled: !!id,
    queryFn: async ({ signal }): Promise<VersionLoaded> => {
      const { data, response } = await api.GET('/v1/vertragsversionen/{id}', { params: { path: { id: id! } }, signal });
      return { detail: data!, etag: etagVon(response, data!.version.version) };
    },
  });
}

export interface KapitelLoaded { kapitel: Kapitel; etag: string }
export async function kapitelLaden(id: string, nr: number, signal?: AbortSignal): Promise<KapitelLoaded> {
  const { data, response } = await api.GET('/v1/vertragsversionen/{id}/kapitel/{nr}', { params: { path: { id, nr } }, signal });
  return { kapitel: data!, etag: etagVon(response, data!.version) };
}
export function useKapitel(id: string | null, nr: number) {
  return useQuery({ queryKey: vertragKeys.kapitel(id ?? '', nr), enabled: !!id, queryFn: ({ signal }) => kapitelLaden(id!, nr, signal) });
}

export function usePflichtangaben(id: string | null) {
  return useQuery({
    queryKey: vertragKeys.pflicht(id ?? ''),
    enabled: !!id,
    queryFn: async ({ signal }) => (await api.GET('/v1/vertragsversionen/{id}/pflichtangaben', { params: { path: { id: id! } }, signal })).data!,
  });
}

/** Strategische Ziele für Kapitel 2 (nur mit `ziel:read`; sonst bleibt die Auswahl leer). */
export function useStrategischeZiele(enabled: boolean) {
  return useQuery({
    queryKey: ['vertrag', 'ziele'] as const,
    enabled,
    queryFn: async ({ signal }) => (await api.GET('/v1/strategische-ziele', { params: { query: { limit: 200 } }, signal })).data!.items,
  });
}

/** Rollen des Ressourcenbedarfs (Codetabelle, Kap. 9.2). */
export function useRollen() {
  return useQuery({
    queryKey: ['vertrag', 'rollen'] as const,
    queryFn: async ({ signal }) => (await api.GET('/v1/codetabellen/{schluessel}/werte', { params: { path: { schluessel: 'ressourcenrolle' } }, signal })).data!.items,
  });
}

/** Projekte zur Auswahl einer Abhängigkeit (Kap. 6): nur sichtbare, laufende. */
export function useProjekteAuswahl() {
  return useQuery({
    queryKey: ['vertrag', 'projekte'] as const,
    queryFn: async ({ signal }) => (await api.GET('/v1/projekte', { params: { query: { lebenszyklus: ['aktiv', 'sistiert'], limit: 200 } }, signal })).data!.items,
  });
}

export function useVertragMutations(projektId: string | undefined) {
  const qc = useQueryClient();
  const neuLaden = async (versionId: string) => {
    await qc.invalidateQueries({ queryKey: vertragKeys.version(versionId) });
    await qc.invalidateQueries({ queryKey: vertragKeys.pflicht(versionId) });
    if (projektId) await qc.invalidateQueries({ queryKey: vertragKeys.vertrag(projektId) });
  };
  const anlegen = useMutation({
    mutationFn: async ({ key }: { key: string }) => {
      const { data, response } = await api.POST('/v1/projekte/{id}/vertrag/entwuerfe', {
        params: { path: { id: projektId! }, header: { 'idempotency-key': key } }, body: { anlass: 'initial' },
      });
      return { detail: data!, etag: etagVon(response, data!.version.version) } satisfies VersionLoaded;
    },
    onSuccess: async l => {
      qc.setQueryData(vertragKeys.version(l.detail.version.id), l);
      if (projektId) await qc.invalidateQueries({ queryKey: vertragKeys.vertrag(projektId) });
    },
  });
  // Automatisches Speichern: der Zwischenstand gehört der Arbeitsfläche, hier nur die Antwort des Servers
  const speichern = useMutation({
    mutationFn: async ({ id, nr, etag, inhalt }: { id: string; nr: number; etag: string; inhalt: Inhalt }) => {
      const { data, response } = await api.PUT('/v1/vertragsversionen/{id}/kapitel/{nr}', { params: { path: { id, nr }, header: { 'if-match': etag } }, body: { inhalt } });
      return { kapitel: data!, etag: etagVon(response, data!.version) } satisfies KapitelLoaded;
    },
    onSuccess: async (l, { id, nr }) => {
      qc.setQueryData(vertragKeys.kapitel(id, nr), l);
      // «geändert» und «Angaben fehlen» in der Navigation, Pflichtangaben im Seitenpanel
      await qc.invalidateQueries({ queryKey: vertragKeys.version(id) });
      await qc.invalidateQueries({ queryKey: vertragKeys.pflicht(id) });
    },
  });
  const einreichen = useMutation({
    mutationFn: async ({ id, etag }: { id: string; etag: string }) => {
      const { data, response } = await api.POST('/v1/vertragsversionen/{id}/einreichen', { params: { path: { id }, header: { 'if-match': etag } } });
      return { detail: data!, etag: etagVon(response, data!.version.version) } satisfies VersionLoaded;
    },
    onSuccess: async (l, { id }) => {
      qc.setQueryData(vertragKeys.version(id), l);
      await neuLaden(id);
      await qc.invalidateQueries({ queryKey: ['vertrag', 'kapitel', id] });
    },
  });
  return { anlegen, speichern, einreichen, neuLaden };
}
