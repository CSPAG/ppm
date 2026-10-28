/**
 * Suchparameter der Lessons Learned `/portfolio/auswertungen/lessons-learned` (UI-32): Jahr `?jahr=2026`, Kategorie
 * `?kategorie=Beschaffung` (leer = ohne Kategorie), Suche `?q=` (I-N5, G8). Die Schublade hat keine Adresse: Lessons
 * Learned haben keinen Schlüssel der Oberfläche, interne IDs erscheinen nie in Adressen (fachmodell.md 2).
 */
export interface LessonsSearch { jahr?: string; kategorie?: string; q?: string }

export function validateLessonsSearch(raw: Record<string, unknown>): LessonsSearch {
  const out: LessonsSearch = {};
  const jahr = String(raw.jahr ?? '');
  if (/^(20[0-9]{2}|2100)$/.test(jahr)) out.jahr = jahr;
  if (typeof raw.kategorie === 'string') out.kategorie = raw.kategorie.slice(0, 100);
  if (typeof raw.q === 'string' && raw.q.trim()) out.q = raw.q.slice(0, 200);
  return out;
}

export type SetLessonsSearch = (next: Partial<Record<keyof LessonsSearch, string | undefined>>, o?: { replace?: boolean }) => void;
