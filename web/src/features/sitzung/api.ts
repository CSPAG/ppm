/** Abfragen und Änderungen der Sitzungen (TanStack Query über den typisierten Client; UC-006 Schritte 1–5). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, newIdempotencyKey, statusOf, type Schemas } from '../../api/index.ts';
import { sitzungPfad } from './search.ts';

export type Sitzung = Schemas['Sitzung'];
export type Traktandum = Schemas['Traktandum'];
export type Vorschlaege = Schemas['Vorschlaege'];
export type Versandvorschau = Schemas['Versandvorschau'];
export type SitzungEintrag = Schemas['SitzungEintrag'];
export type Gremium = Schemas['Gremium'];

export const sitzungKeys = {
  all: ['sitzung'] as const,
  gremien: ['sitzung', 'gremien'] as const,
  liste: (kuerzel: string) => ['sitzung', 'liste', kuerzel] as const,
  eine: (kuerzel: string, datum: string) => ['sitzung', 'eine', kuerzel, datum] as const,
  vorschlaege: (id: string) => ['sitzung', 'vorschlaege', id] as const,
  versand: (id: string) => ['sitzung', 'versand', id] as const,
  kopf: ['sitzung', 'kopf'] as const,
};

/** Nächste Sitzungen, die die Person sieht, für die Kopfkarte im Eingang (`GET /v1/sitzungen/kopf`). */
export function useSitzungKopf() {
  return useQuery({ queryKey: sitzungKeys.kopf, queryFn: async ({ signal }) => (await api.GET('/v1/sitzungen/kopf', { signal })).data!.sitzungen });
}

/** Adresse der nächsten Sitzung, die die Person sieht (Befehlspalette «Nächste Sitzung öffnen», I-N4); null ohne Sitzung. */
export async function naechsteSitzungPfad(signal: AbortSignal): Promise<string | null> {
  const s = (await api.GET('/v1/sitzungen/kopf', { signal })).data!.sitzungen[0];
  return s ? sitzungPfad(s.gremium.kuerzel, s.datum) : null;
}

/** Entscheidende Gremien, deren Sitzungen die Person sieht (externe wie der SNS-VR haben keine Sitzungen im System). */
export function useGremien() {
  return useQuery({
    queryKey: sitzungKeys.gremien,
    queryFn: async ({ signal }) => {
      const items: Gremium[] = [];
      let cursor: string | undefined;
      do {
        const { data } = await api.GET('/v1/gremien', { params: { query: { limit: 200, cursor } }, signal });
        items.push(...data!.items);
        cursor = data!.nextCursor ?? undefined;
      } while (cursor);
      return items.filter(g => g.art === 'entscheidend');
    },
  });
}

/** Termine und Sitzungen eines Gremiums ab heute; ohne Recht am Portfolio des Gremiums null (das Gremium entfällt). */
export function useSitzungsliste(kuerzel: string) {
  return useQuery({
    queryKey: sitzungKeys.liste(kuerzel),
    queryFn: async ({ signal }) => {
      try {
        return (await api.GET('/v1/gremien/{kuerzel}/sitzungen', { params: { path: { kuerzel }, query: { limit: 5 } }, signal })).data!;
      } catch (e) {
        if (statusOf(e) === 403 || statusOf(e) === 404) return null;
        throw e;
      }
    },
  });
}

export function useSitzung(kuerzel: string, datum: string) {
  return useQuery({
    queryKey: sitzungKeys.eine(kuerzel, datum),
    queryFn: async ({ signal }) => (await api.GET('/v1/gremien/{kuerzel}/sitzungen/{datum}', { params: { path: { kuerzel, datum } }, signal })).data!,
    retry: (n, e) => statusOf(e) !== 404 && n < 2,
  });
}

export function useVorschlaege(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: sitzungKeys.vorschlaege(id ?? ''),
    enabled: !!id && enabled,
    queryFn: async ({ signal }) => (await api.GET('/v1/sitzungen/{id}/vorschlaege', { params: { path: { id: id! } }, signal })).data!,
  });
}

export function useVersandvorschau(id: string, enabled: boolean) {
  return useQuery({
    queryKey: sitzungKeys.versand(id),
    enabled,
    staleTime: 0,
    queryFn: async ({ signal }) => (await api.GET('/v1/sitzungen/{id}/versand', { params: { path: { id } }, signal })).data!,
  });
}

const etag = (version: number) => `W/"${version}"`;

/** Änderungen an der Sitzung; jede Antwort ersetzt die Sitzung im Zwischenspeicher (bestätigt, I-R2). */
export function useSitzungMutations(kuerzel: string, datum: string) {
  const qc = useQueryClient();
  const setze = (s: Sitzung) => {
    qc.setQueryData(sitzungKeys.eine(kuerzel, datum), s);
    void qc.invalidateQueries({ queryKey: sitzungKeys.vorschlaege(s.id) });
    void qc.invalidateQueries({ queryKey: sitzungKeys.liste(kuerzel) });
  };
  const anlegen = useMutation({
    mutationFn: async () => (await api.POST('/v1/gremien/{kuerzel}/sitzungen', { params: { path: { kuerzel }, header: { 'idempotency-key': newIdempotencyKey() } }, body: { datum } })).data!,
    onSuccess: setze,
  });
  const aufnehmen = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Schemas['TraktandumCreate'] }) =>
      (await api.POST('/v1/sitzungen/{id}/traktanden', { params: { path: { id }, header: { 'idempotency-key': newIdempotencyKey() } }, body })).data!,
    onSuccess: setze,
  });
  const ordnen = useMutation({
    mutationFn: async ({ s, reihenfolge }: { s: Sitzung; reihenfolge: string[] }) =>
      (await api.PUT('/v1/sitzungen/{id}/traktanden', { params: { path: { id: s.id }, header: { 'if-match': etag(s.version) } }, body: { reihenfolge } })).data!,
    onSuccess: setze,
  });
  const entfernen = useMutation({
    mutationFn: async (t: Traktandum) =>
      (await api.POST('/v1/traktanden/{id}/entfernen', { params: { path: { id: t.id }, header: { 'idempotency-key': newIdempotencyKey() } } })).data!,
    onSuccess: setze,
  });
  const verschieben = useMutation({
    mutationFn: async (t: Traktandum) =>
      (await api.POST('/v1/traktanden/{id}/verschieben', { params: { path: { id: t.id }, header: { 'idempotency-key': newIdempotencyKey() } } })).data!,
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: sitzungKeys.all }); },
  });
  const versenden = useMutation({
    mutationFn: async (s: Sitzung) =>
      (await api.POST('/v1/sitzungen/{id}/versenden', { params: { path: { id: s.id }, header: { 'if-match': etag(s.version) } } })).data!,
    onSuccess: setze,
  });
  return { anlegen, aufnehmen, ordnen, entfernen, verschieben, versenden };
}
