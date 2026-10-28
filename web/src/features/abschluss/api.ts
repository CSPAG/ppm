/**
 * Abfragen und Änderungen des Abschlusses (UI-14, UC-015) und der Lessons Learned (UI-32, PS.04.03). Das Projekt zur
 * Nummer kommt über die API (Features nutzen keine anderen Features).
 */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ifMatch, newIdempotencyKey, type Schemas } from '../../api/index.ts';

export type Abschluss = Schemas['Abschluss'];
export type Bericht = Schemas['AbschlussBericht'];
export type AbschlussIn = Schemas['AbschlussIn'];
export type Lesson = Schemas['AbschlussLessonLearned'];
export type OffenerPunkt = Schemas['AbschlussOffenerPunkt'];

export const abschlussKeys = {
  all: ['abschluss'] as const,
  projekt: (nr: string) => ['abschluss', 'projekt', nr] as const,
  abschluss: (id: string) => ['abschluss', id] as const,
  lessons: (f: LessonFilter) => ['abschluss', 'lessons', f] as const,
};

/** Projekt zur Nummer; `null`, wenn es das Projekt nicht gibt oder die Person es nicht sieht. */
export function useProjekt(nr: string) {
  return useQuery({
    queryKey: abschlussKeys.projekt(nr),
    queryFn: async ({ signal }) => (await api.GET('/v1/projekte', { params: { query: { nummer: nr, limit: 1 } }, signal })).data!.items[0] ?? null,
  });
}

export interface Geladen { abschluss: Abschluss; etag: string }
const geladen = (a: Abschluss, response?: Response): Geladen => ({ abschluss: a, etag: response?.headers.get('ETag') ?? ifMatch(a.bericht?.version ?? 0)['If-Match']! });

export function useAbschluss(id: string | undefined) {
  return useQuery({
    queryKey: abschlussKeys.abschluss(id ?? ''),
    enabled: !!id,
    queryFn: async ({ signal }) => {
      const { data, response } = await api.GET('/v1/projekte/{id}/abschluss', { params: { path: { id: id! } }, signal });
      return geladen(data!, response);
    },
  });
}

/** Bericht speichern (automatisch, I-R3); bei 412 lädt die Seite neu. */
export function useSpeichern(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ etag, body }: { etag: string; body: AbschlussIn }) => {
      const { data, response } = await api.PUT('/v1/projekte/{id}/abschluss', { params: { path: { id }, header: { 'if-match': etag } }, body });
      return geladen(data!, response);
    },
    onSuccess: l => { qc.setQueryData(abschlussKeys.abschluss(id), l); },
  });
}

export function useNutzen(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ etag, rolle, beurteilung }: { etag: string; rolle: 'sp' | 'ue'; beurteilung: string }) => {
      const { data, response } = await api.PUT('/v1/projekte/{id}/abschluss/nutzen', { params: { path: { id }, header: { 'if-match': etag } }, body: { rolle, beurteilung } });
      return geladen(data!, response);
    },
    onSuccess: l => { qc.setQueryData(abschlussKeys.abschluss(id), l); },
  });
}

export function useEinreichen(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ etag }: { etag: string }) => {
      const { data, response } = await api.POST('/v1/projekte/{id}/abschluss/einreichen', { params: { path: { id }, header: { 'if-match': etag } } });
      return geladen(data!, response);
    },
    onSuccess: l => { qc.setQueryData(abschlussKeys.abschluss(id), l); void qc.invalidateQueries({ queryKey: ['eingang'] }); },
  });
}

export function useWiederaufnahme(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ begruendung, key }: { begruendung: string; key: string }) => {
      const { data, response } = await api.POST('/v1/projekte/{id}/wiederaufnahme', { params: { path: { id }, header: { 'idempotency-key': key } }, body: { begruendung } });
      return geladen(data!, response);
    },
    onSuccess: l => { qc.setQueryData(abschlussKeys.abschluss(id), l); },
  });
}

// ---------------------------------------------------------------- Lessons Learned

export interface LessonFilter { jahr?: number; kategorie?: string; q?: string; projekt?: string }

export function useLessons(f: LessonFilter) {
  return useInfiniteQuery({
    queryKey: abschlussKeys.lessons(f),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => (await api.GET('/v1/lessons-learned', { params: { query: { ...f, cursor: pageParam, limit: 50 } }, signal })).data!,
    getNextPageParam: p => p.nextCursor ?? undefined,
  });
}

/** Lessons Learned anlegen, ändern, löschen; danach Abschluss und Listen neu laden. */
export function useLessonMutations(projektId?: string) {
  const qc = useQueryClient();
  const neu = () => qc.invalidateQueries({ queryKey: abschlussKeys.all });
  return {
    anlegen: useMutation({
      mutationFn: async ({ text, kategorie, key }: { text: string; kategorie: string; key: string }) =>
        (await api.POST('/v1/projekte/{id}/lessons-learned', { params: { path: { id: projektId! }, header: { 'idempotency-key': key } }, body: { text, kategorie } })).data!,
      onSuccess: () => { void neu(); },
    }),
    aendern: useMutation({
      mutationFn: async ({ l, text, kategorie }: { l: Lesson; text: string; kategorie: string }) =>
        (await api.PATCH('/v1/lessons-learned/{id}', { params: { path: { id: l.id }, header: { 'if-match': ifMatch(l.version)['If-Match']! } }, body: { text, kategorie } })).data!,
      onSuccess: () => { void neu(); },
    }),
    loeschen: useMutation({
      mutationFn: async (l: Lesson) => { await api.DELETE('/v1/lessons-learned/{id}', { params: { path: { id: l.id }, header: { 'if-match': ifMatch(l.version)['If-Match']! } } }); },
      onSuccess: () => { void neu(); },
    }),
  };
}

export { newIdempotencyKey };
