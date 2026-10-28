/**
 * Suchparameter der Projektakte › Vertrag (informationsarchitektur.md, Adressen: `/projekte/<nr>/vertrag?kapitel=7&
 * version=entwurf`): Kapitel 1–13, Version (Entwurf oder Baseline) und das Feld, zu dem die Seite springt (K2-4);
 * `aenderung=1` öffnet den Dialog «Änderung beantragen» (Sprung aus der Warnung im Statusbericht, UC-004 A1).
 */
export interface VertragSearch { kapitel?: number; version?: 'entwurf' | 'baseline' | (string & {}); feld?: string; aenderung?: true }

const FELD = /^[a-zA-Z][a-zA-Z0-9]{0,59}$/;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Prüft die rohen Suchparameter; Unbekanntes und Ungültiges fällt weg. */
export function validateVertragSearch(raw: Record<string, unknown>): VertragSearch {
  const out: VertragSearch = {};
  const k = typeof raw.kapitel === 'number' ? raw.kapitel : typeof raw.kapitel === 'string' ? Number(raw.kapitel) : NaN;
  if (Number.isInteger(k) && k >= 1 && k <= 13) out.kapitel = k;
  // «entwurf», «baseline» oder die ID einer Version (z. B. ein abgelehnter Änderungsantrag, AP-E3-4)
  if (raw.version === 'entwurf' || raw.version === 'baseline' || (typeof raw.version === 'string' && ID.test(raw.version))) out.version = raw.version;
  if (typeof raw.feld === 'string' && FELD.test(raw.feld)) out.feld = raw.feld;
  if (raw.aenderung === 1 || raw.aenderung === true || raw.aenderung === '1' || raw.aenderung === 'true') out.aenderung = true;
  return out;
}

export type SetVertragSearch = (next: Partial<VertragSearch>, o?: { replace?: boolean }) => void;
