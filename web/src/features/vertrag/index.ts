/**
 * Öffentliche Schnittstelle des Features «Projektvertrag» (Router importiert nur von hier; Reiter der Projektakte). Die
 * Arbeitsfläche lädt erst beim Öffnen des Reiters nach (Start-Bundle Q-L6).
 */
import { lazy } from 'react';

export const VertragPage = lazy(() => import('./VertragPage.tsx').then(m => ({ default: m.VertragPage })));
export const PruefenPage = lazy(() => import('./PruefenPage.tsx').then(m => ({ default: m.PruefenPage })));
export const UnterzeichnenPage = lazy(() => import('./UnterzeichnenPage.tsx').then(m => ({ default: m.UnterzeichnenPage })));
export { validateVertragSearch, type SetVertragSearch, type VertragSearch } from './search.ts';
export { TV as vertragTexte } from './texte.ts';
