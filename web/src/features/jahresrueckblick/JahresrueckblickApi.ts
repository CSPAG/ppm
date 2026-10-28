/**
 * Abfragen und Änderungen des Jahresrückblicks (UI-37; BC ZM.03.03, PS.04.03; UC-013; AP-E7-5). Handlungen setzen die
 * Antwort mit ETag in den Cache; das erste Speichern legt den Rückblick ohne `If-Match` an (Fassung 0).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Schemas } from '../../api/index.ts';

export type Jahresrueckblick = Schemas['Jahresrueckblick'];
export type Jahresauswertung = Schemas['Jahresauswertung'];
export type Vorhaben = Jahresauswertung['vorhaben']['laufend'][number];
export interface JahresrueckblickLoaded { item: Jahresrueckblick; etag: string }

export const rueckblickKeys = { jahr: (jahr: number) => ['jahresrueckblick', jahr] as const };

export function useJahresrueckblick(jahr: number, enabled: boolean) {
  return useQuery({
    queryKey: rueckblickKeys.jahr(jahr),
    enabled,
    queryFn: async ({ signal }): Promise<JahresrueckblickLoaded> => {
      const { data, response } = await api.GET('/v1/jahresrueckblicke/{jahr}', { params: { path: { jahr } }, signal });
      return { item: data!, etag: response.headers.get('ETag') ?? '' };
    },
  });
}

export function useJahresrueckblickMutations(jahr: number) {
  const qc = useQueryClient();
  const setzen = (data: Jahresrueckblick | undefined, response: Response) => {
    const l = { item: data!, etag: response.headers.get('ETag') ?? '' };
    qc.setQueryData(rueckblickKeys.jahr(jahr), l);
    return l;
  };
  return {
    speichern: useMutation({
      mutationFn: async ({ l, erkenntnisse, massnahmen }: { l: JahresrueckblickLoaded; erkenntnisse: string; massnahmen: string }) => {
        const header = l.item.version > 0 ? { 'if-match': l.etag } : {};
        const r = await api.PUT('/v1/jahresrueckblicke/{jahr}', { params: { path: { jahr }, header }, body: { erkenntnisse, massnahmen } });
        return setzen(r.data, r.response);
      },
    }),
    traktandieren: useMutation({
      mutationFn: async () => {
        const r = await api.POST('/v1/jahresrueckblicke/{jahr}/traktandieren', { params: { path: { jahr } } });
        return setzen(r.data, r.response);
      },
    }),
    anfordern: useMutation({
      mutationFn: async () => {
        const r = await api.POST('/v1/jahresrueckblicke/{jahr}/lessons-learned/anfordern', { params: { path: { jahr } } });
        await qc.invalidateQueries({ queryKey: rueckblickKeys.jahr(jahr) });
        return r.data!;
      },
    }),
  };
}

/** Dokument als Datei (PDF oder Word); liefert Dateiname und Inhalt. */
export async function dokumentLaden(jahr: number, format: 'pdf' | 'docx'): Promise<{ name: string; blob: Blob }> {
  const { data, response } = await api.GET('/v1/jahresrueckblicke/{jahr}/dokument', { params: { path: { jahr }, query: { format } }, parseAs: 'blob' });
  const name = /filename="([^"]+)"/.exec(response.headers.get('content-disposition') ?? '')?.[1] ?? `Jahresrueckblick_${jahr}.${format}`;
  return { name, blob: data as unknown as Blob };
}
