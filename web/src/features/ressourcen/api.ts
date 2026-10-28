/** Abfragen und Änderungen von Kapazität und Auslastung (TanStack Query über den typisierten Client); BC RK.01.01, RK.02.04. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Schemas } from '../../api/index.ts';

export type Auslastung = Schemas['Auslastung'];
export type AuslastungZelle = Schemas['AuslastungZelle'];
export type Kapazitaet = Schemas['Kapazitaet'];
export type KapazitaetZelle = Schemas['KapazitaetZelle'];
export type KapazitaetHr = Schemas['KapazitaetHr'];
export type KapazitaetAenderung = Schemas['KapazitaetPut']['zellen'][number];
export interface Rolle { schluessel: string; label: string; aktiv: boolean }

export const ressourcenKeys = {
  all: ['ressourcen'] as const,
  auslastung: (von: string, bis: string, szenario?: string) => ['ressourcen', 'auslastung', von, bis, szenario ?? ''] as const,
  kapazitaet: (von: string, bis: string) => ['ressourcen', 'kapazitaet', von, bis] as const,
  kapazitaetHr: (von: string, bis: string) => ['ressourcen', 'kapazitaet-hr', von, bis] as const,
  rollen: ['ressourcen', 'rollen'] as const,
};

export function useAuslastung(z: { von: string; bis: string } | null, szenario?: string) {
  return useQuery({
    queryKey: ressourcenKeys.auslastung(z?.von ?? '', z?.bis ?? '', szenario),
    enabled: !!z,
    queryFn: async ({ signal }) => (await api.GET('/v1/auslastung', { params: { query: { von: z!.von, bis: z!.bis, szenario } }, signal })).data!,
  });
}

export function useKapazitaet(z: { von: string; bis: string } | null) {
  return useQuery({
    queryKey: ressourcenKeys.kapazitaet(z?.von ?? '', z?.bis ?? ''),
    enabled: !!z,
    queryFn: async ({ signal }) => (await api.GET('/v1/kapazitaet', { params: { query: { von: z!.von, bis: z!.bis } }, signal })).data!,
  });
}

/** Kapazität laut HR-System je Rolle und Monat (RK.01.02, UC-009 Schritt 1; Annahme AP-E7-2). */
export function useKapazitaetHr(z: { von: string; bis: string } | null) {
  return useQuery({
    queryKey: ressourcenKeys.kapazitaetHr(z?.von ?? '', z?.bis ?? ''),
    enabled: !!z,
    queryFn: async ({ signal }) => (await api.GET('/v1/kapazitaet/hr', { params: { query: { von: z!.von, bis: z!.bis } }, signal })).data!,
  });
}

/**
 * Rollen des Ressourcenbedarfs = Pools (A-20) aus der Codetabelle `ressourcenrolle` (Stammdaten, alle Rollen lesen sie),
 * nach Reihenfolge; auch deaktivierte, damit erfasstes Angebot sichtbar bleibt.
 */
export function useRollen() {
  return useQuery({
    queryKey: ressourcenKeys.rollen,
    staleTime: 60_000,
    queryFn: async ({ signal }): Promise<Rolle[]> => {
      const out: Rolle[] = [];
      let cursor: string | undefined;
      do {
        const { data } = await api.GET('/v1/codetabellen/{schluessel}/werte', { params: { path: { schluessel: 'ressourcenrolle' }, query: { limit: 200, cursor } }, signal });
        out.push(...data!.items.map(w => ({ schluessel: w.schluessel, label: w.label, aktiv: w.aktiv })));
        cursor = data!.nextCursor ?? undefined;
      } while (cursor);
      return out;
    },
  });
}

/** Zellen speichern (alles oder nichts); danach Auslastung neu laden. */
export function useKapazitaetSpeichern() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (zellen: KapazitaetAenderung[]) => (await api.PUT('/v1/kapazitaet', { body: { zellen } })).data!.zellen,
    onSuccess: () => qc.invalidateQueries({ queryKey: [...ressourcenKeys.all, 'auslastung'] }),
  });
}
