/**
 * Öffentliche Schnittstelle des Features «Dashboard» (Router, Suche und Navigation importieren nur von hier); AP-E1-3.
 * Die Seite wird erst beim Aufruf nachgeladen (Q-L6: Start-Bundle ≤ 250 kB); Texte und Suchparameter sind klein.
 */
import { lazy } from 'react';

export const DashboardPage = lazy(() => import('./DashboardPage.tsx').then(m => ({ default: m.DashboardPage })));
export { validateDashboardSearch, type DashboardSearch, type SetDashboardSearch } from './search.ts';
export { TD as dashboardTexte } from './texte.ts';
