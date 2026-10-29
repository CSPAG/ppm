/**
 * Vermerke der Traktanden (AP-E8-4; UC-006 A2.2, Master G1, A-74, UX-E12): Fehlen Unterlagen oder ist der Quality-Check
 * offen, bleibt das Traktandum auf Wunsch der UE stehen; Traktandum und Protokoll tragen den Vermerk. Abgeleitet aus dem
 * Stand der Unterlagen (nach dem Versand der festgehaltene), gespeichert wird nur dieser Stand.
 */
import type { UnterlagenStand } from './arten.ts';

export interface Vermerk { art: string; text: string }

export function traktandumVermerke(stand: UnterlagenStand): Vermerk[] {
  if (stand === 'fehlt') return [{ art: 'unterlagen_fehlen', text: 'Unterlagen fehlen' }];
  if (stand === 'quality_check_offen') return [{ art: 'quality_check_offen', text: 'Quality-Check offen' }];
  return [];
}
