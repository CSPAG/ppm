/**
 * Suchparameter der Seite «Vorlagen» (I-N5): geöffnete Dokumentart `o=<art>` (Schlüssel, keine interne ID) und die
 * gewählte Version `v=<nummer>` in der Schublade.
 */
const ART = /^[a-z_]{1,40}$/;

export interface VorlagenSearch { o?: string; v?: number }

export function validateVorlagenSearch(raw: Record<string, unknown>): VorlagenSearch {
  const out: VorlagenSearch = {};
  if (typeof raw.o === 'string' && ART.test(raw.o)) out.o = raw.o;
  const v = typeof raw.v === 'number' ? raw.v : typeof raw.v === 'string' ? Number(raw.v) : NaN;
  if (out.o && Number.isInteger(v) && v >= 1 && v <= 100000) out.v = v;
  return out;
}

export type SetVorlagenSearch = (next: Partial<Record<keyof VorlagenSearch, string | number | undefined>>, o?: { replace?: boolean }) => void;
