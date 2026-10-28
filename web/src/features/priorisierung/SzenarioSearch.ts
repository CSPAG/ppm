/** Suchparameter der Szenarien (I-N5): Portfolio mit Schlüssel, gewähltes Szenario, Vergleich bis drei Szenarien. */

export interface SzenarioSearch {
  /** Schlüssel des Portfolios, z. B. «transformation». */
  portfolio?: string;
  /** Geöffnetes Szenario (ID). */
  s?: string;
  /** Verglichene Szenarien (IDs, mit Komma getrennt, bis drei). */
  vergleich?: string;
}
export type SetSzenarioSearch = (next: Partial<SzenarioSearch>, o?: { replace?: boolean }) => void;

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const text = (v: unknown, re: RegExp) => (typeof v === 'string' && re.test(v) ? v : undefined);

export function validateSzenarioSearch(raw: Record<string, unknown>): SzenarioSearch {
  const s: SzenarioSearch = {};
  const portfolio = text(raw.portfolio, /^[a-z0-9][a-z0-9-]{0,39}$/);
  const id = text(raw.s, new RegExp(`^${UUID}$`));
  const vergleich = text(raw.vergleich, new RegExp(`^${UUID}(,${UUID}){0,2}$`));
  if (portfolio) s.portfolio = portfolio;
  if (id) s.s = id;
  if (vergleich) s.vergleich = vergleich;
  return s;
}
