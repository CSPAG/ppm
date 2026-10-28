/**
 * Suchparameter von Portfolio › Ideen (`/portfolio/ideen`, K4 Prüfen 5): Ansicht `ansicht=liste|funnel|meine` (G8: Ansicht
 * in der Adresse) und Filter Stand, Handlungsfeld, Herkunft. Ohne Ansicht: Pool für Personen mit `idee:read`, sonst «Meine Ideen».
 */
import { STAENDE_POOL } from './PoolStaende.ts';

export interface IdeenSearch { ansicht?: 'liste' | 'funnel' | 'meine'; stand?: string; handlungsfeld?: string; herkunft?: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function validateIdeenSearch(raw: Record<string, unknown>): IdeenSearch {
  const out: IdeenSearch = {};
  if (raw.ansicht === 'liste' || raw.ansicht === 'funnel' || raw.ansicht === 'meine') out.ansicht = raw.ansicht;
  if (typeof raw.stand === 'string' && (STAENDE_POOL as readonly string[]).includes(raw.stand)) out.stand = raw.stand;
  if (typeof raw.handlungsfeld === 'string' && UUID.test(raw.handlungsfeld)) out.handlungsfeld = raw.handlungsfeld;
  if (typeof raw.herkunft === 'string' && /^[A-Za-z0-9_.-]{1,100}$/.test(raw.herkunft)) out.herkunft = raw.herkunft;
  return out;
}

export type SetIdeenSearch = (next: Partial<Record<keyof IdeenSearch, string | undefined>>, o?: { replace?: boolean }) => void;
