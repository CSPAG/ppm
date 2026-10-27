/**
 * Suchparameter der Ideen (Adressen nach K4, I-N5): neue Idee `/portfolio/ideen/neu` mit Vorbelegung `ziel=ziel:<nummer>`
 * (z. B. «Projektidee anstossen» aus dem Zielzyklus, UC-011 Schritt 4) und `herkunft=<schlüssel>` (Direktlink aus dem
 * Intranet oder dem Innovationsprozess); Idee `/portfolio/ideen/<nr>` mit dem Schritt des Assistenten `schritt=1…4`.
 * Das Präfix «ziel:» hält die Nummer nichtnumerisch (sonst liest der Router «2.10» als Zahl 2.1).
 */
export interface IdeeNeuSearch { ziel?: string; herkunft?: string }
export interface IdeeSearch { schritt?: number }

const ZIEL = /^ziel:[0-9]{1,3}(\.[0-9]{1,3}){0,3}$/;

/** Adresse des Assistenten mit Vorbelegung, z. B. `ideeNeuPfad({ ziel: '2.1' })` → `/portfolio/ideen/neu?ziel=ziel%3A2.1`. */
export function ideeNeuPfad(o: { ziel?: string; herkunft?: string } = {}): string {
  const q = new URLSearchParams();
  if (o.ziel) q.set('ziel', `ziel:${o.ziel}`);
  if (o.herkunft) q.set('herkunft', o.herkunft);
  const s = q.toString();
  return `/portfolio/ideen/neu${s ? `?${s}` : ''}`;
}

export function validateIdeeNeuSearch(raw: Record<string, unknown>): IdeeNeuSearch {
  const out: IdeeNeuSearch = {};
  if (typeof raw.ziel === 'string' && ZIEL.test(raw.ziel)) out.ziel = raw.ziel;
  if (typeof raw.herkunft === 'string' && /^[A-Za-z0-9_.-]{1,100}$/.test(raw.herkunft)) out.herkunft = raw.herkunft;
  return out;
}

export function validateIdeeSearch(raw: Record<string, unknown>): IdeeSearch {
  const n = Number(raw.schritt);
  return Number.isInteger(n) && n >= 1 && n <= 4 ? { schritt: n } : {};
}

/** Nummer der Idee aus dem Pfadparameter; null bei ungültigem Wert (Z10). */
export function nummerAusPfad(raw: string): number | null {
  return /^[1-9][0-9]{0,8}$/.test(raw) ? Number(raw) : null;
}

export type SetIdeeSearch = (next: Partial<IdeeSearch>, o?: { replace?: boolean }) => void;
