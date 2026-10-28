/**
 * Abfragen und Änderungen des Quartalsreportings an den VR (BC ZM.03.02; UC-012 Schritte 3–6, A1; AP-E6-4). Handlungen mit
 * `If-Match` setzen die Antwort in den Cache; die Dokumentausgabe lädt die Datei über den typisierten Client.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, isGone, newIdempotencyKey, type Schemas } from '../../api/index.ts';

export type Quartalsbericht = Schemas['Quartalsbericht'];
export type Kommentare = Quartalsbericht['kommentare'];
export type Abschnitt = keyof Kommentare;
export interface QuartalsberichtLoaded { item: Quartalsbericht; etag: string }

export const quartalKeys = { bericht: (q: string) => ['quartalsbericht', q] as const };

/** Bericht des Quartals; `null`, solange er nicht erzeugt ist (404). */
export function useQuartalsbericht(quartal: string) {
  return useQuery({
    queryKey: quartalKeys.bericht(quartal),
    queryFn: async ({ signal }): Promise<QuartalsberichtLoaded | null> => {
      try {
        const { data, response } = await api.GET('/v1/quartalsberichte/{quartal}', { params: { path: { quartal } }, signal });
        return { item: data!, etag: response.headers.get('ETag') ?? '' };
      } catch (e) {
        if (isGone(e)) return null;
        throw e;
      }
    },
  });
}

export function useQuartalsberichtMutations(quartal: string) {
  const qc = useQueryClient();
  const setzen = (data: Quartalsbericht | undefined, response: Response) => {
    const l = { item: data!, etag: response.headers.get('ETag') ?? '' };
    qc.setQueryData(quartalKeys.bericht(quartal), l);
    return l;
  };
  const h = (etag: string) => ({ 'if-match': etag });
  return {
    erzeugen: useMutation({
      mutationFn: async () => {
        const r = await api.POST('/v1/quartalsberichte/{quartal}/erzeugen', { params: { path: { quartal }, header: { 'idempotency-key': newIdempotencyKey() } } });
        return setzen(r.data, r.response);
      },
    }),
    kommentare: useMutation({
      mutationFn: async ({ etag, kommentare }: { etag: string; kommentare: Partial<Kommentare> }) => {
        const r = await api.PATCH('/v1/quartalsberichte/{quartal}', { params: { path: { quartal }, header: h(etag) }, body: { kommentare } });
        return setzen(r.data, r.response);
      },
    }),
    traktandieren: useMutation({
      mutationFn: async ({ etag }: { etag: string }) => {
        const r = await api.POST('/v1/quartalsberichte/{quartal}/traktandieren', { params: { path: { quartal }, header: { ...h(etag), 'idempotency-key': newIdempotencyKey() } } });
        return setzen(r.data, r.response);
      },
    }),
    vrRueckmeldung: useMutation({
      mutationFn: async ({ etag, vrRueckmeldung }: { etag: string; vrRueckmeldung: string }) => {
        const r = await api.PUT('/v1/quartalsberichte/{quartal}/vr-rueckmeldung', { params: { path: { quartal }, header: h(etag) }, body: { vrRueckmeldung } });
        return setzen(r.data, r.response);
      },
    }),
    auftrag: useMutation({
      mutationFn: async (body: { text: string; verantwortlich: string; termin: string | null }) => {
        await api.POST('/v1/quartalsberichte/{quartal}/auftraege', { params: { path: { quartal }, header: { 'idempotency-key': newIdempotencyKey() } }, body });
        await qc.invalidateQueries({ queryKey: quartalKeys.bericht(quartal) });
      },
    }),
  };
}

/** Dokument als Datei (PDF oder Word); liefert Dateiname und Inhalt. */
export async function dokumentLaden(quartal: string, format: 'pdf' | 'docx'): Promise<{ name: string; blob: Blob }> {
  const { data, response } = await api.GET('/v1/quartalsberichte/{quartal}/dokument', { params: { path: { quartal }, query: { format } }, parseAs: 'blob' });
  const name = /filename="([^"]+)"/.exec(response.headers.get('content-disposition') ?? '')?.[1] ?? `Quartalsreporting_${quartal}.${format}`;
  return { name, blob: data as unknown as Blob };
}
