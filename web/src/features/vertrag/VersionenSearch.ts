/**
 * Suchparameter der Projektakte › Versionen (informationsarchitektur.md, Adressen:
 * `/projekte/<nr>/versionen?vergleich=baseline...entwurf`): zwei Versionen zum Vergleich, je «baseline», «entwurf» oder
 * die ID einer Version, ältere zuerst.
 */
export interface VersionenSearch { vergleich?: string }

const TEIL = '(?:baseline|entwurf|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})';
const VERGLEICH = new RegExp(`^${TEIL}\\.\\.\\.${TEIL}$`, 'i');

/** Prüft die rohen Suchparameter; Ungültiges fällt weg. */
export function validateVersionenSearch(raw: Record<string, unknown>): VersionenSearch {
  return typeof raw.vergleich === 'string' && VERGLEICH.test(raw.vergleich) ? { vergleich: raw.vergleich.toLowerCase() } : {};
}

/** «alt...neu» in seine Teile. */
export const vergleichTeile = (v?: string): [string, string] | null => {
  const t = v?.split('...');
  return t?.length === 2 ? [t[0]!, t[1]!] : null;
};

export type SetVersionenSearch = (next: Partial<VersionenSearch>, o?: { replace?: boolean }) => void;
