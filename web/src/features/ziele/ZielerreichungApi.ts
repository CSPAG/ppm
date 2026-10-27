/**
 * Abfrage und Erfassung der Zielerreichung je Quartal (TanStack Query über den typisierten Client; BC ZM.03.01). Nach
 * dem Speichern ersetzt die Antwort den Eintrag im Cache, ohne die übrigen Zeilen neu zu laden (Eingaben bleiben).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ifMatch, type Schemas } from '../../api/index.ts';

export type ZielerreichungQuartal = Schemas['ZielerreichungQuartal'];
export type ZielerreichungZiel = Schemas['ZielerreichungZiel'];
export type ZielerreichungEintrag = Schemas['ZielerreichungEintrag'];

export const zielerreichungKeys = { quartal: (q: string) => ['zielerreichung', q] as const };

export function useZielerreichung(quartal: string) {
  return useQuery({
    queryKey: zielerreichungKeys.quartal(quartal),
    queryFn: async ({ signal }) => (await api.GET('/v1/zielerreichung/{quartal}', { params: { path: { quartal } }, signal })).data!,
  });
}

export interface Speichern { ziel: ZielerreichungZiel; stand: string; beurteilung: string; key: string }

/** Erfassen, ändern oder (leerer Stand) entfernen; liefert den neuen Eintrag oder null. */
export function useZielerreichungSpeichern(quartal: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ziel, stand, beurteilung, key }: Speichern): Promise<ZielerreichungEintrag | null> => {
      const e = ziel.eintrag;
      if (!stand.trim()) {
        if (e) await api.DELETE('/v1/zielerreichung/{quartal}/{id}', { params: { path: { quartal, id: e.id }, header: { 'if-match': ifMatch(e.version)['If-Match']! } } });
        return null;
      }
      if (e) {
        const { data } = await api.PATCH('/v1/zielerreichung/{quartal}/{id}', { params: { path: { quartal, id: e.id }, header: { 'if-match': ifMatch(e.version)['If-Match']! } }, body: { stand, beurteilung } });
        return data!;
      }
      const { data } = await api.POST('/v1/zielerreichung/{quartal}', { params: { path: { quartal }, header: { 'idempotency-key': key } }, body: { zielTyp: ziel.typ, zielId: ziel.id, stand, beurteilung } });
      return data!;
    },
    onSuccess: (eintrag, { ziel }) => {
      qc.setQueryData<ZielerreichungQuartal>(zielerreichungKeys.quartal(quartal), alt => {
        if (!alt) return alt;
        const ziele = alt.ziele.map(z => (z.typ === ziel.typ && z.id === ziel.id ? { ...z, eintrag } : z));
        return { ...alt, ziele, fortschritt: { ...alt.fortschritt, nachgefuehrt: ziele.filter(z => z.eintrag).length } };
      });
    },
  });
}
