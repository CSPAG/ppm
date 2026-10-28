/**
 * Abfragen und Aktionen des Monatsabschlusses (TanStack Query über den typisierten Client); BC PS.01.02–04, UC-005,
 * Kernablauf K1. Rechtlich Relevantes (Bestätigen, Rückfrage, Abschluss) wird erst nach der Antwort des Servers als
 * erledigt gezeigt (I-R2, bestätigt).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ifMatch, newIdempotencyKey, type Schemas } from '../../api/index.ts';
import type { MonatsabschlussSearch } from './search.ts';

export type Zeile = Schemas['PeriodeZeile'];
export type Periodenstand = Schemas['Periodenstand'];
export type Auffaelligkeit = Schemas['Auffaelligkeit'];
export type Sammelergebnis = Schemas['PeriodeSammelergebnis'];
export type Terminabweichung = Schemas['Terminabweichung'];
export type Bericht = Schemas['Statusbericht'];
export type Rueckfrage = Schemas['Rueckfrage'];

export const monatsabschlussKeys = {
  all: ['monatsabschluss'] as const,
  kopf: ['monatsabschluss', 'kopf'] as const,
  periode: (periode: string, f: Filter) => ['monatsabschluss', 'periode', periode, f] as const,
  termine: (periode: string) => ['monatsabschluss', 'termine', periode] as const,
  bericht: (projektId: string, periode: string) => ['monatsabschluss', 'bericht', projektId, periode] as const,
  rueckfragen: (projektId: string, periode: string) => ['monatsabschluss', 'rueckfragen', projektId, periode] as const,
};

export type Filter = Pick<MonatsabschlussSearch, 'stand' | 'auffaellig' | 'portfolio' | 'sort'>;

/** Periode, an der die UE arbeitet (Kopf je Rolle); Standard der Seite ohne `periode` in der Adresse. */
export function useKopf(enabled: boolean) {
  return useQuery({
    queryKey: monatsabschlussKeys.kopf,
    enabled,
    queryFn: async ({ signal }) => (await api.GET('/v1/statusberichte/kopf', { signal })).data!,
  });
}

export function usePeriode(periode: string | undefined, f: Filter) {
  return useQuery({
    queryKey: monatsabschlussKeys.periode(periode ?? '', f),
    enabled: !!periode,
    queryFn: async ({ signal }) => (await api.GET('/v1/perioden/{periode}', {
      params: {
        path: { periode: periode! },
        query: { stand: f.stand, auffaellig: f.auffaellig ? true : undefined, portfolio: f.portfolio, sort: f.sort, limit: 1000 },
      },
      signal,
    })).data!,
  });
}

export function useTermine(periode: string | undefined) {
  return useQuery({
    queryKey: monatsabschlussKeys.termine(periode ?? ''),
    enabled: !!periode,
    queryFn: async ({ signal }) => (await api.GET('/v1/perioden/{periode}/terminabweichungen', { params: { path: { periode: periode! } }, signal })).data!,
  });
}

/** Bericht der Periode und der Vorperiode für den Vergleich (K1 Prüfen Schritt 2); `null` ohne gespeicherten Bericht. */
export function useBerichtVergleich(projektId: string | undefined, periode: string, vorperiode: string | null) {
  return useQuery({
    queryKey: monatsabschlussKeys.bericht(projektId ?? '', periode),
    enabled: !!projektId,
    queryFn: async ({ signal }) => {
      const lesen = async (p: string) => {
        const { data } = await api.GET('/v1/projekte/{id}/berichte/{periode}', { params: { path: { id: projektId!, periode: p } }, signal });
        return data!.id ? data! : null;
      };
      return { bericht: await lesen(periode), vor: vorperiode ? await lesen(vorperiode) : null };
    },
  });
}

export function useRueckfragen(projektId: string | undefined, periode: string) {
  return useQuery({
    queryKey: monatsabschlussKeys.rueckfragen(projektId ?? '', periode),
    enabled: !!projektId,
    queryFn: async ({ signal }) => (await api.GET('/v1/projekte/{id}/berichte/{periode}/rueckfragen', { params: { path: { id: projektId!, periode } }, signal })).data!.items,
  });
}

export function useMonatsabschlussAktionen(periode: string) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: monatsabschlussKeys.all });
  const bericht = (z: Zeile) => ({ path: { id: z.projektId, periode }, header: { ...lower(ifMatch(z.version)), 'idempotency-key': newIdempotencyKey() } });
  const bestaetigen = useMutation({
    mutationFn: async (z: Zeile) => (await api.POST('/v1/projekte/{id}/berichte/{periode}/pruefen', { params: bericht(z) })).data!,
    onSettled: refresh,
  });
  const zuruecknehmen = useMutation({
    mutationFn: async (z: Zeile) => (await api.POST('/v1/projekte/{id}/berichte/{periode}/pruefung-zuruecknehmen', {
      params: { path: { id: z.projektId, periode }, header: lower(ifMatch(z.version)) },
    })).data!,
    onSettled: refresh,
  });
  const rueckfrage = useMutation({
    mutationFn: async ({ z, text }: { z: Zeile; text: string }) => (await api.POST('/v1/projekte/{id}/berichte/{periode}/rueckfragen', { params: bericht(z), body: { text } })).data!,
    onSettled: refresh,
  });
  const sammel = (pfad: '/v1/perioden/{periode}/bestaetigen' | '/v1/perioden/{periode}/einfordern') => async (projekte: string[]) =>
    (await api.POST(pfad, { params: { path: { periode }, header: { 'idempotency-key': newIdempotencyKey() } }, body: { projekte } })).data!;
  const sammelBestaetigen = useMutation({ mutationFn: sammel('/v1/perioden/{periode}/bestaetigen'), onSettled: refresh });
  const einfordern = useMutation({ mutationFn: sammel('/v1/perioden/{periode}/einfordern'), onSettled: refresh });
  // Rückgängig nach der Sammelbestätigung (I-R1 Stufe 1): je Bericht mit dem aktuellen Stand (If-Match), Rest gezählt
  const sammelZuruecknehmen = useMutation({
    mutationFn: async (projekte: string[]) => {
      const { data } = await api.GET('/v1/perioden/{periode}', { params: { path: { periode }, query: { limit: 1000 } } });
      const zs = data!.items.filter(z => projekte.includes(z.projektId) && z.can.zuruecknehmen);
      const r = await Promise.allSettled(zs.map(z => api.POST('/v1/projekte/{id}/berichte/{periode}/pruefung-zuruecknehmen', {
        params: { path: { id: z.projektId, periode }, header: lower(ifMatch(z.version)) },
      })));
      const ok = r.filter(x => x.status === 'fulfilled').length;
      return { ok, nicht: projekte.length - ok };
    },
    onSettled: refresh,
  });
  const abschliessen = useMutation({
    mutationFn: async (version: number) => (await api.POST('/v1/perioden/{periode}/abschliessen', { params: { path: { periode }, header: lower(ifMatch(version)) } })).data!,
    onSettled: refresh,
  });
  return { bestaetigen, zuruecknehmen, rueckfrage, sammelBestaetigen, sammelZuruecknehmen, einfordern, abschliessen };
}

/** `If-Match` als Kopfzeile in Kleinbuchstaben (Schema der API). */
const lower = (h: Record<string, string | undefined>) => ({ 'if-match': h['If-Match']! });
