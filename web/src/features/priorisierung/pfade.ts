/** Adressen und Texte der Navigation (klein, im Start-Bundle; die Seiten selbst lädt der Router bei Bedarf, Q-L6). */
export type Reiter = 'bewertung' | 'matrix' | 'modell';
export const PFAD = { bewertung: '/portfolio/priorisierung/bewertung', matrix: '/portfolio/priorisierung/matrix', modell: '/portfolio/priorisierung/modell' } as const satisfies Record<Reiter, string>;
export const NAV = { bereich: 'Priorisierung', aktionBewerten: 'Projekte bewerten', aktionModell: 'Bewertungsmodell bearbeiten' };
