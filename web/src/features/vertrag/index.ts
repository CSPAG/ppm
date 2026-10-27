/**
 * Öffentliche Schnittstelle des Features «Projektvertrag» (Router importiert nur von hier; Reiter der Projektakte). Die
 * Arbeitsfläche lädt erst beim Öffnen des Reiters nach (Start-Bundle Q-L6).
 */
export { validateVertragSearch, type SetVertragSearch, type VertragSearch } from './search.ts';
export { TV as vertragTexte } from './texte.ts';
