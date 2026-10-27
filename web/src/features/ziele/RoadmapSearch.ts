/** Suchparameter der Roadmap `/portfolio/roadmap` (UI-31): Jahr `?jahr=2027` und Ansicht `?ansicht=vorschau` (I-N5, G8). */
export interface RoadmapSearch { jahr?: string; ansicht?: 'vorschau' }

export function validateRoadmapSearch(raw: Record<string, unknown>): RoadmapSearch {
  const out: RoadmapSearch = {};
  const jahr = String(raw.jahr ?? '');
  if (/^(20[0-9]{2}|2100)$/.test(jahr)) out.jahr = jahr;
  if (raw.ansicht === 'vorschau') out.ansicht = 'vorschau';
  return out;
}

export type SetRoadmapSearch = (next: Partial<RoadmapSearch> & { jahr?: string | undefined; ansicht?: 'vorschau' | undefined }, o?: { replace?: boolean }) => void;
