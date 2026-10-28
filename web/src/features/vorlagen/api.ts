/** Abfragen und Änderungen der Vorlagen (TanStack Query über den typisierten Client); BC AM.03.01, UC-018. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Schemas } from '../../api/index.ts';
import type { paths } from '../../api/schema.d.ts';

export type VorlageArt = Schemas['VorlageArt'];
export type VorlageDetail = Schemas['VorlageDetail'];
export type VorlageVersion = Schemas['VorlageVersion'];
export type VorlageFeld = Schemas['VorlageFeld'];
export type Art = paths['/v1/vorlagen/{art}']['get']['parameters']['path']['art'];

export const vorlagenKeys = {
  all: ['vorlagen'] as const,
  liste: ['vorlagen', 'liste'] as const,
  art: (art: string) => ['vorlagen', 'art', art] as const,
};

export function useVorlagen() {
  return useQuery({ queryKey: vorlagenKeys.liste, queryFn: async ({ signal }) => (await api.GET('/v1/vorlagen', { signal })).data!.items });
}

export function useVorlage(art: Art) {
  return useQuery({ queryKey: vorlagenKeys.art(art), queryFn: async ({ signal }) => (await api.GET('/v1/vorlagen/{art}', { params: { path: { art } }, signal })).data! });
}

/** Datei als Base64 (ohne Präfix «data:…»). */
export async function base64(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const etag = (v: VorlageVersion) => `W/"${v.rev}"`;

export function useVorlageMutations(art: Art) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: vorlagenKeys.all });
  const pfad = (v: VorlageVersion) => ({ path: { art, version: v.version }, header: { 'if-match': etag(v) } });
  return {
    hochladen: useMutation({
      mutationFn: async ({ file, key }: { file: File; key: string }) =>
        (await api.POST('/v1/vorlagen/{art}/versionen', { params: { path: { art }, header: { 'idempotency-key': key } }, body: { dateiname: file.name, inhalt: await base64(file) } })).data!,
      onSuccess: refresh,
    }),
    zuordnen: useMutation({
      mutationFn: async ({ v, zuordnung }: { v: VorlageVersion; zuordnung: Record<string, string | null> }) =>
        (await api.PATCH('/v1/vorlagen/{art}/versionen/{version}', { params: pfad(v), body: { zuordnung } })).data!,
      onSuccess: refresh,
    }),
    aktivieren: useMutation({
      mutationFn: async ({ v }: { v: VorlageVersion }) => (await api.POST('/v1/vorlagen/{art}/versionen/{version}/aktivieren', { params: pfad(v) })).data!,
      onSuccess: refresh,
    }),
    entfernen: useMutation({
      mutationFn: async ({ v }: { v: VorlageVersion }) => { await api.DELETE('/v1/vorlagen/{art}/versionen/{version}', { params: pfad(v) }); },
      onSuccess: refresh,
    }),
  };
}

/** Datei einer Version herunterladen (gleiche Herkunft, Organisation im Kopf der Anfrage). */
export async function dateiLaden(art: Art, v: VorlageVersion): Promise<void> {
  const { data } = await api.GET('/v1/vorlagen/{art}/versionen/{version}/datei', { params: { path: { art, version: v.version } }, parseAs: 'blob' });
  const url = URL.createObjectURL(data as unknown as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = v.dateiname;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
