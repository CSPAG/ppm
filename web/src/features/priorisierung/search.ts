/** Suchparameter der Priorisierung (I-N5: Portfolio mit Schlüssel, Modell mit Nummer, Projekt mit Nummer). */

export interface BewertungSearch {
  /** Schlüssel des Portfolios, z. B. «transformation». */
  portfolio?: string;
  /** Nummer einer früheren Modellversion (G11). */
  modell?: string;
  /** Geöffnetes Projekt (Nummer «2026-014»). */
  o?: string;
}
export interface ModellSearch { o?: string }

export type SetBewertungSearch = (next: Partial<BewertungSearch>, o?: { replace?: boolean }) => void;
export type SetModellSearch = (next: Partial<ModellSearch>, o?: { replace?: boolean }) => void;

const text = (v: unknown, re: RegExp) => (typeof v === 'string' && re.test(v) ? v : typeof v === 'number' && re.test(String(v)) ? String(v) : undefined);

export function validateBewertungSearch(raw: Record<string, unknown>): BewertungSearch {
  const s: BewertungSearch = {};
  const portfolio = text(raw.portfolio, /^[a-z0-9][a-z0-9-]{0,39}$/);
  const modell = text(raw.modell, /^[0-9]{1,6}$/);
  const o = text(raw.o, /^[0-9A-Za-z][0-9A-Za-z-]{0,29}$/);
  if (portfolio) s.portfolio = portfolio;
  if (modell) s.modell = modell;
  if (o) s.o = o;
  return s;
}

export function validateModellSearch(raw: Record<string, unknown>): ModellSearch {
  const o = text(raw.o, /^([0-9]{1,6}|neu)$/);
  return o ? { o } : {};
}

/** Matrix (UI-21): Portfolio, Ansicht, Darstellung als Tabelle, geöffnetes Projekt (Nummer) bzw. Schublade «risiken»/«berechnung». */
export interface MatrixSearch {
  portfolio?: string;
  ansicht?: 'ressourcen';
  tabelle?: '1';
  o?: string;
}
export type SetMatrixSearch = (next: Partial<MatrixSearch>, o?: { replace?: boolean }) => void;

export function validateMatrixSearch(raw: Record<string, unknown>): MatrixSearch {
  const s: MatrixSearch = {};
  const portfolio = text(raw.portfolio, /^[a-z0-9][a-z0-9-]{0,39}$/);
  const o = text(raw.o, /^[0-9A-Za-z][0-9A-Za-z-]{0,29}$/);
  if (portfolio) s.portfolio = portfolio;
  if (raw.ansicht === 'ressourcen') s.ansicht = 'ressourcen';
  if (raw.tabelle === '1' || raw.tabelle === 1) s.tabelle = '1';
  if (o) s.o = o;
  return s;
}
