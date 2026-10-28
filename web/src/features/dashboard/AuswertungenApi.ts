/** Abfrage und Export der Ad-hoc-Auswertungen (TanStack Query über den typisierten Client); PC.04.03, UC-014 A2. */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, type Schemas } from '../../api/index.ts';
import type { paths } from '../../api/schema.d.ts';
import type { AuswertungenSearch } from './AuswertungenSearch.ts';

export type Auswertung = Schemas['Auswertung'];
export type AuswertungGruppe = Schemas['AuswertungGruppe'];
export type AuswertungEinzelwert = Schemas['AuswertungEinzelwert'];

type Query = NonNullable<paths['/v1/auswertungen']['get']['parameters']['query']>;

/** Abfrage der API aus den Suchparametern (ohne `o`, die Schublade fragt nichts ab). */
export function abfrage(s: AuswertungenSearch): Query {
  return {
    periode: s.periode, portfolio: s.portfolio, phase: s.phase, lebenszyklus: s.lebenszyklus, status: s.status,
    handlungsfeld: s.handlungsfeld, kennzahlen: s.kennzahlen, gruppierung: s.gruppierung,
  };
}

export function useAuswertung(s: AuswertungenSearch, enabled: boolean) {
  const q = abfrage(s);
  return useQuery({
    queryKey: ['auswertungen', q],
    enabled,
    // beim Ändern der Filter bleibt das letzte Ergebnis stehen (kein Springen der Seite)
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<Auswertung> => (await api.GET('/v1/auswertungen', { params: { query: q }, signal })).data!,
  });
}

/** Export als CSV über den Client (Organisation im Kopf der Anfrage), im Browser gespeichert; liefert den Dateinamen. */
export async function exportieren(s: AuswertungenSearch, ebene: 'gruppen' | 'einzelwerte'): Promise<string> {
  const { data, response } = await api.GET('/v1/auswertungen', { params: { query: { ...abfrage(s), format: 'csv', ...(ebene === 'einzelwerte' ? { ebene } : {}) } }, parseAs: 'blob' });
  const name = /filename="([^"]+)"/.exec(response.headers.get('content-disposition') ?? '')?.[1] ?? 'auswertung.csv';
  const url = URL.createObjectURL(data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return name;
}
