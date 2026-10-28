/**
 * Abfragen und Änderungen des Statusberichts (UI-13, UC-004) und der Register, die er im selben Durchgang nachführt
 * (Meilensteine, Kosten, Risiken, Kommunikation, KPIs; PS.02.04, PC.01.03, PC.02.03, PS.05.03, PC.03.03). Das Projekt
 * zur Nummer kommt über die API (Features nutzen keine anderen Features).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ifMatch, newIdempotencyKey, statusOf, type Schemas } from '../../api/index.ts';

export type Bericht = Schemas['Statusbericht'];
export type BerichtPut = Schemas['StatusberichtPut'];
export type Meilenstein = Schemas['Meilenstein'];
export type Kosten = Schemas['Kosten'];
export type Risiko = Schemas['Risiko'];
export type Kpi = Schemas['Kpi'];
export type KpiWert = Schemas['KpiWert'];

export const berichtKeys = {
  all: ['bericht'] as const,
  projekt: (nr: string) => ['bericht', 'projekt', nr] as const,
  bericht: (id: string, periode: string) => ['bericht', id, periode] as const,
  register: (id: string, name: string) => ['bericht', id, 'register', name] as const,
  kpiWerte: (id: string, kpi: string) => ['bericht', id, 'kpi', kpi] as const,
};

/** Projekt zur Nummer (Kopf, Phase); `null`, wenn es das Projekt nicht gibt oder die Person es nicht sieht. */
export function useProjekt(nr: string) {
  return useQuery({
    queryKey: berichtKeys.projekt(nr),
    queryFn: async ({ signal }) => (await api.GET('/v1/projekte', { params: { query: { nummer: nr, limit: 1 } }, signal })).data!.items[0] ?? null,
  });
}

/**
 * Darf die Person jetzt eine Änderung des Projektvertrags beantragen (UC-004 A1 → UC-007 Schritt 1; wie der Vertrag:
 * `can.entwerfen` enthält «aenderung»)? Gleiche Abfrage und gleicher Schlüssel wie im Vertrag, damit beide denselben
 * Stand zeigen; ohne Recht auf den Vertrag oder bei einem Fehler: nein.
 */
export function useAenderungMoeglich(projektId: string): boolean {
  const q = useQuery({
    queryKey: ['vertrag', 'versionen', projektId] as const,
    queryFn: async ({ signal }) => (await api.GET('/v1/projekte/{id}/vertrag', { params: { path: { id: projektId } }, signal })).data!,
  });
  return !!q.data?.can.entwerfen.includes('aenderung');
}

export interface Geladen { bericht: Bericht; etag: string }
const geladen = (bericht: Bericht, response?: Response): Geladen => ({ bericht, etag: response?.headers.get('ETag') ?? ifMatch(bericht.version)['If-Match']! });

export function useBericht(id: string | undefined, periode: string) {
  return useQuery({
    queryKey: berichtKeys.bericht(id ?? '', periode),
    enabled: !!id,
    queryFn: async ({ signal }) => {
      const { data, response } = await api.GET('/v1/projekte/{id}/berichte/{periode}', { params: { path: { id: id!, periode } }, signal });
      return geladen(data!, response);
    },
  });
}

/** Entwurf speichern (automatisch, I-R3); bei 412 lädt die Seite neu. */
export function useSpeichern(id: string, periode: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ etag, body }: { etag: string; body: BerichtPut }) => {
      const { data, response } = await api.PUT('/v1/projekte/{id}/berichte/{periode}', { params: { path: { id, periode }, header: { 'if-match': etag } }, body });
      return geladen(data!, response);
    },
    onSuccess: l => { qc.setQueryData(berichtKeys.bericht(id, periode), l); },
  });
}

export function useUebergang(id: string, periode: string, art: 'einreichen' | 'zurueckziehen') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ etag }: { etag: string }) => {
      const opts = { params: { path: { id, periode }, header: { 'if-match': etag, ...(art === 'einreichen' ? { 'idempotency-key': newIdempotencyKey() } : {}) } } };
      const { data, response } = art === 'einreichen'
        ? await api.POST('/v1/projekte/{id}/berichte/{periode}/einreichen', opts)
        : await api.POST('/v1/projekte/{id}/berichte/{periode}/zurueckziehen', opts);
      return geladen(data!, response);
    },
    onSuccess: l => { qc.setQueryData(berichtKeys.bericht(id, periode), l); },
  });
}

/**
 * Aus der Warnung «wesentliche Abweichung» eskalieren (UC-004 A1.2, K1 Schritt 2): legt die Eskalation zum Bericht an
 * (fehlt der Entwurf, entsteht er); der Bericht bleibt Entwurf und kommt mit neuer Version zurück.
 */
export function useEskalieren(id: string, periode: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, grund, massnahme }: { key: string; grund: string; massnahme: string }) => {
      const { data, response } = await api.POST('/v1/projekte/{id}/berichte/{periode}/eskalation', {
        params: { path: { id, periode }, header: { 'idempotency-key': key } }, body: { grund, massnahme },
      });
      return geladen(data!, response);
    },
    onSuccess: l => { qc.setQueryData(berichtKeys.bericht(id, periode), l); },
  });
}

/** Ohne Recht (Beträge, A-33) oder ohne Register bleibt die Liste leer; `gesperrt` meldet 403. */
async function liste<T>(run: () => Promise<{ data?: { items: T[] } }>): Promise<{ items: T[]; gesperrt: boolean }> {
  try {
    return { items: (await run()).data!.items, gesperrt: false };
  } catch (e) {
    if (statusOf(e) === 403) return { items: [], gesperrt: true };
    throw e;
  }
}

export function useMeilensteine(id: string | undefined) {
  return useQuery({
    queryKey: berichtKeys.register(id ?? '', 'meilensteine'), enabled: !!id,
    queryFn: ({ signal }) => liste<Meilenstein>(() => api.GET('/v1/projekte/{id}/meilensteine', { params: { path: { id: id! }, query: { limit: 200 } }, signal })),
  });
}

export function useKosten(id: string | undefined) {
  return useQuery({
    queryKey: berichtKeys.register(id ?? '', 'kosten'), enabled: !!id,
    queryFn: ({ signal }) => liste<Kosten>(() => api.GET('/v1/projekte/{id}/kosten', { params: { path: { id: id! }, query: { limit: 200 } }, signal })),
  });
}

export function useRisiken(id: string | undefined) {
  return useQuery({
    queryKey: berichtKeys.register(id ?? '', 'risiken'), enabled: !!id,
    queryFn: ({ signal }) => liste<Risiko>(() => api.GET('/v1/projekte/{id}/risiken', { params: { path: { id: id! }, query: { limit: 200 } }, signal })),
  });
}

export function useKpis(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: berichtKeys.register(id ?? '', 'kpis'), enabled: !!id && enabled,
    queryFn: ({ signal }) => liste<Kpi>(() => api.GET('/v1/projekte/{id}/kpis', { params: { path: { id: id! }, query: { limit: 200 } }, signal })),
  });
}

export function useKpiWerte(id: string, kpiId: string) {
  return useQuery({
    queryKey: berichtKeys.kpiWerte(id, kpiId),
    queryFn: async ({ signal }) => (await api.GET('/v1/projekte/{id}/kpis/{kpiId}/werte', { params: { path: { id, kpiId } }, signal })).data!.items,
  });
}

type RegisterPfad = '/v1/projekte/{id}/meilensteine/{eintragId}' | '/v1/projekte/{id}/kosten/{eintragId}' | '/v1/projekte/{id}/risiken/{eintragId}';

/** Eintrag eines Registers ändern (ETag aus der Version); danach das Register und den Bericht neu laden. */
export function useRegisterAendern(id: string, name: 'meilensteine' | 'kosten' | 'risiken') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ eintrag, body }: { eintrag: { id: string; version: number }; body: Record<string, unknown> }) => {
      const pfad = `/v1/projekte/{id}/${name}/{eintragId}` as RegisterPfad;
      await (api.PATCH as (p: RegisterPfad, o: unknown) => Promise<unknown>)(pfad, {
        params: { path: { id, eintragId: eintrag.id }, header: ifMatch(eintrag.version) }, body,
      });
    },
    onSettled: async () => { await qc.invalidateQueries({ queryKey: berichtKeys.register(id, name) }); },
  });
}

export function useKpiWertSetzen(id: string, periode: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ kpiId, wert, version }: { kpiId: string; wert: number; version: number }) => {
      await api.PUT('/v1/projekte/{id}/kpis/{kpiId}/werte/{periode}', {
        params: { path: { id, kpiId, periode }, header: ifMatch(version) }, body: { wert },
      });
    },
    onSettled: async (_d, _e, { kpiId }) => { await qc.invalidateQueries({ queryKey: berichtKeys.kpiWerte(id, kpiId) }); },
  });
}

export type Toleranz = Schemas['GueltigeToleranzen']['toleranzen'][number];

/**
 * Gültige Toleranzen des Projekts (A-10): Baseline des Projektvertrags, sonst Standard des Phasenmodells; die API liest
 * den Standard auch für die PL ohne `phasenmodell:read`. Ohne Wert keine Warnung «wesentlich».
 */
export function useToleranzen(projektId: string) {
  return useQuery({
    queryKey: ['bericht', 'toleranzen', projektId] as const,
    queryFn: async ({ signal }): Promise<Toleranz[]> => {
      try {
        return (await api.GET('/v1/projekte/{id}/toleranzen', { params: { path: { id: projektId } }, signal })).data!.toleranzen;
      } catch (e) {
        if (statusOf(e) === 403 || statusOf(e) === 404) return [];
        throw e;
      }
    },
    staleTime: 5 * 60_000,
  });
}
