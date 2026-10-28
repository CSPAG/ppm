/**
 * Suchparameter der Finanzen (I-N5): Übersicht und Abweichungen mit Portfolio (Schlüssel), «auch abgeschlossene» und
 * geöffnetem Projekt (Nummer); Budgetprozess mit Jahr und Schritt des Assistenten.
 */
export interface FinanzenSearch { portfolio?: string; alle?: '1'; o?: string }
export interface BudgetSearch { jahr?: string; schritt?: '1' | '2' | '3' }

export type SetFinanzenSearch = (next: Partial<FinanzenSearch>, o?: { replace?: boolean }) => void;
export type SetBudgetSearch = (next: Partial<BudgetSearch>, o?: { replace?: boolean }) => void;

const text = (v: unknown, re: RegExp) => (typeof v === 'string' && re.test(v) ? v : typeof v === 'number' && re.test(String(v)) ? String(v) : undefined);

export function validateFinanzenSearch(raw: Record<string, unknown>): FinanzenSearch {
  const s: FinanzenSearch = {};
  const portfolio = text(raw.portfolio, /^[a-z0-9][a-z0-9_-]{0,39}$/);
  const o = text(raw.o, /^[0-9A-Za-z][0-9A-Za-z-]{0,29}$/);
  if (portfolio) s.portfolio = portfolio;
  if (raw.alle === '1' || raw.alle === 1) s.alle = '1';
  if (o) s.o = o;
  return s;
}

export function validateBudgetSearch(raw: Record<string, unknown>): BudgetSearch {
  const s: BudgetSearch = {};
  const jahr = text(raw.jahr, /^20[0-9]{2}$/);
  const schritt = text(raw.schritt, /^[123]$/);
  if (jahr) s.jahr = jahr;
  if (schritt) s.schritt = schritt as BudgetSearch['schritt'];
  return s;
}
