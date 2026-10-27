/**
 * Texte je Sprache an einer Stelle (Q-S1). Bis zur Klärung von UX-OF-2 nur Deutsch (Schweiz); eine weitere Sprache ist
 * eine Datei `fr-CH.ts` o. ä. vom Typ `Texte`, ausgewählt hier.
 */
import { deCH } from './de-CH.ts';

export type Texte = typeof deCH;

export const T: Texte = deCH;
