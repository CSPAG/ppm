/**
 * Suchparameter der Projektakte › Vertrag (informationsarchitektur.md, Adressen: `/projekte/<nr>/vertrag?kapitel=7&
 * version=entwurf`): Kapitel 1–13, Version (Entwurf oder Baseline) und das Feld, zu dem die Seite springt (K2-4).
 */
export interface VertragSearch { kapitel?: number; version?: 'entwurf' | 'baseline'; feld?: string }

const FELD = /^[a-zA-Z][a-zA-Z0-9]{0,59}$/;

/** Prüft die rohen Suchparameter; Unbekanntes und Ungültiges fällt weg. */
export function validateVertragSearch(raw: Record<string, unknown>): VertragSearch {
  const out: VertragSearch = {};
  const k = typeof raw.kapitel === 'number' ? raw.kapitel : typeof raw.kapitel === 'string' ? Number(raw.kapitel) : NaN;
  if (Number.isInteger(k) && k >= 1 && k <= 13) out.kapitel = k;
  if (raw.version === 'entwurf' || raw.version === 'baseline') out.version = raw.version;
  if (typeof raw.feld === 'string' && FELD.test(raw.feld)) out.feld = raw.feld;
  return out;
}

export type SetVertragSearch = (next: Partial<VertragSearch>, o?: { replace?: boolean }) => void;
