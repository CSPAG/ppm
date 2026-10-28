/** Adressen und Texte der Navigation (klein, im Start-Bundle; die Seiten lädt der Router bei Bedarf, Q-L6). */
export type Reiter = 'uebersicht' | 'abweichungen' | 'budgetprozess';
export const PFAD = {
  uebersicht: '/portfolio/finanzen',
  abweichungen: '/portfolio/finanzen/abweichungen',
  budgetprozess: '/portfolio/finanzen/budgetprozess',
} as const satisfies Record<Reiter, string>;
export const NAV = { bereich: 'Finanzen', aktionBudget: 'Jahresbedarf an den Budgetprozess übergeben' };
