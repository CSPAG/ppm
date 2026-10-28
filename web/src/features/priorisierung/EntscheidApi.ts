/**
 * Abfragen und Änderungen des Priorisierungsentscheids (AP-E5-5; UC-008 Schritte 7–8, A2; K5 Schritte 7–8): Folgeentscheide
 * je laufendem Projekt unter der Wasserlinie beantragen und den Antrag für das Gremium traktandieren. Beides ändert die
 * Version des Szenarios; danach werden Szenario und Entscheid neu gelesen.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ifMatch, type Schemas } from '../../api/index.ts';
import { szenarioKeys, type Szenario } from './SzenarioApi.ts';

export type Entscheid = Schemas['SzenarioEntscheid'];
export type Folge = NonNullable<Entscheid['unterWasserlinie'][number]['folge']>;
export type FolgeAenderung = Schemas['SzenarioFolgenPut']['folgen'][number];

export const entscheidKeys = { eins: (id: string) => ['priorisierung', 'szenarien', 'entscheid', id] as const };

export function useEntscheid(id: string, aktiv = true) {
  return useQuery({
    queryKey: entscheidKeys.eins(id),
    enabled: aktiv,
    queryFn: async ({ signal }) => (await api.GET('/v1/szenarien/{id}/entscheid', { params: { path: { id } }, signal })).data!,
  });
}

export function useEntscheidMutations(s: Szenario) {
  const qc = useQueryClient();
  const neuLesen = () => {
    void qc.invalidateQueries({ queryKey: szenarioKeys.eins(s.id) });
    void qc.invalidateQueries({ queryKey: szenarioKeys.liste(s.portfolioId) });
  };
  const folgen = useMutation({
    mutationFn: async (liste: FolgeAenderung[]) =>
      (await api.PUT('/v1/szenarien/{id}/folgen', { params: { path: { id: s.id }, header: { 'if-match': ifMatch(s.version)['If-Match']! } }, body: { folgen: liste } })).data!,
    onSuccess: e => { qc.setQueryData(entscheidKeys.eins(s.id), e); neuLesen(); },
  });
  const traktandieren = useMutation({
    mutationFn: async () =>
      (await api.POST('/v1/szenarien/{id}/traktandieren', { params: { path: { id: s.id }, header: { 'if-match': ifMatch(s.version)['If-Match']! } } })).data!,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: entscheidKeys.eins(s.id) }); neuLesen(); },
  });
  return { folgen, traktandieren };
}
