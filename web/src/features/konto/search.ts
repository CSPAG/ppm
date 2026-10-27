/** Suchparameter der Seite «Profil und Stellvertretung»: `o=neu` öffnet das Erfassen in der Schublade (I-N5). */
export interface KontoSearch { o?: 'neu' }

export function validateKontoSearch(raw: Record<string, unknown>): KontoSearch {
  return raw.o === 'neu' ? { o: 'neu' } : {};
}

export type SetKontoSearch = (next: Partial<KontoSearch>, o?: { replace?: boolean }) => void;
