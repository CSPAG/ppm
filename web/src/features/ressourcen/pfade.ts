/** Adressen und Texte der Navigation (klein, im Start-Bundle; die Seiten lädt der Router bei Bedarf, Q-L6). */
export type Reiter = 'auslastung' | 'kapazitaet' | 'bedarf';
export const PFAD = { auslastung: '/portfolio/ressourcen/auslastung', kapazitaet: '/portfolio/ressourcen/kapazitaet', bedarf: '/portfolio/ressourcen/bedarf' } as const satisfies Record<Reiter, string>;
export const NAV = { bereich: 'Ressourcen', aktionKapazitaet: 'Kapazität planen', aktionAuslastung: 'Auslastung analysieren' };
