/** Abfragen für Zugang entziehen und Neubesetzung (UC-016 A1, AP-E7-8). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, newIdempotencyKey, type Schemas } from '../../api/index.ts';

export type Neubesetzung = Schemas['Neubesetzung'];
export type NeubesetzungDetail = Schemas['NeubesetzungDetail'];
export type Vorschau = Schemas['ZugangVorschau'];
export type NeuRolle = NeubesetzungDetail['rollen'][number];

export const zugangKeys = {
  all: ['zugang'] as const,
  liste: (offen: boolean) => ['zugang', 'liste', offen] as const,
  detail: (id: string) => ['zugang', 'neubesetzung', id] as const,
  vorschau: (person: string) => ['zugang', 'vorschau', person] as const,
  personen: (q: string) => ['zugang', 'personen', q] as const,
  ort: (typ: string, id: string) => ['zugang', 'ort', typ, id] as const,
};

export function useNeubesetzungen(offen: boolean) {
  return useQuery({
    queryKey: zugangKeys.liste(offen),
    queryFn: async ({ signal }) => (await api.GET('/v1/neubesetzungen', { params: { query: offen ? { offen: true, limit: 100 } : { limit: 100 } }, signal })).data!,
  });
}

export function useNeubesetzung(id: string) {
  return useQuery({ queryKey: zugangKeys.detail(id), queryFn: async ({ signal }) => (await api.GET('/v1/neubesetzungen/{id}', { params: { path: { id } }, signal })).data! });
}

export function useVorschau(person: string | undefined) {
  return useQuery({
    queryKey: zugangKeys.vorschau(person ?? ''),
    enabled: !!person,
    queryFn: async ({ signal }) => (await api.GET('/v1/zugaenge/{person}', { params: { path: { person: person! } }, signal })).data!,
  });
}

/** Personen der Organisation zum Suchtext (höchstens 8). */
export function usePersonen(q: string) {
  return useQuery({
    queryKey: zugangKeys.personen(q),
    enabled: q.trim().length >= 2,
    queryFn: async ({ signal }) => (await api.GET('/v1/people', { params: { query: { q: q.trim(), limit: 8 } }, signal })).data!.items,
  });
}

export function useEntziehen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ person, key }: { person: string; key: string }) =>
      (await api.POST('/v1/zugaenge/{person}/entziehen', { params: { path: { person }, header: { 'idempotency-key': key } } })).data!,
    // Aufgabe «neu besetzen» erscheint im Eingang; Personenverzeichnis ohne die Person
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: zugangKeys.all }), qc.invalidateQueries({ queryKey: ['eingang'] })]),
  });
}

export { newIdempotencyKey };

/** Name und Adresse eines Orts (Baukasten liefert keine Namen); `null`, wenn der Typ unbekannt oder nicht sichtbar ist. */
export interface OrtInfo { name: string; pfad: string | null }

export function useOrt(typ: string, id: string) {
  return useQuery({
    queryKey: zugangKeys.ort(typ, id),
    retry: false,
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }): Promise<OrtInfo | null> => {
      if (typ === 'projekt') {
        const r = await api.GET('/v1/projekte/{id}', { params: { path: { id } }, signal }).catch(() => null);
        return r?.data ? { name: `${r.data.nummer} · ${r.data.name}`, pfad: `/projekte/${r.data.nummer}` } : null;
      }
      if (typ === 'portfolio') {
        const r = await api.GET('/v1/portfolios/{id}', { params: { path: { id } }, signal }).catch(() => null);
        return r?.data ? { name: r.data.name, pfad: `/administration/portfolios?o=${id}` } : null;
      }
      return null;
    },
  });
}
