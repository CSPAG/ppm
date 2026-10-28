/**
 * Haken beim Erfassen von Lessons Learned (PS.04.03; UC-013 A1.2): Obere Module (Jahresrückblick, AP-E7-5) registrieren
 * Verhalten, das in der Transaktion des Erfassens läuft, z. B. die Aufgabe `lessons_learned.erfassen` erledigen.
 * Rückwirkung über Registrierung, nie über Import (fachmodell.md 1.1); ein Fehler im Haken bricht das Erfassen ab.
 */
import type { Tx } from '@vollholz/platform';

export interface LessonErfasst { id: string; projektId: string; jahr: number }
type Haken = (tx: Tx, l: LessonErfasst) => Promise<void>;

const haken: Haken[] = [];

/** Haken registrieren (beim Laden des registrierenden Moduls). */
export function beimErfassen(fn: Haken): void { haken.push(fn); }

/** Alle Haken in der Transaktion des Erfassens ausführen. */
export async function erfasst(tx: Tx, l: LessonErfasst): Promise<void> {
  for (const fn of haken) await fn(tx, l);
}

/** Nur für Tests: Haken entfernen. */
export function _abmelden(fn: Haken): void { const i = haken.indexOf(fn); if (i >= 0) haken.splice(i, 1); }
