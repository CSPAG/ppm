/**
 * Lessons Learned anfordern (UC-013 A1; fachmodell.md 4.2 `lessons_learned.erfassen`; AP-E7-5): Die UE legt den
 * Projektleitungen der im Jahr abgeschlossenen Vorhaben ohne Lessons Learned eine Aufgabe in den Eingang; erledigt ist
 * sie, sobald zum Projekt eine Lesson Learned erfasst ist (Haken von `abschluss`, in dessen Transaktion).
 */
import type { Tx } from '@vollholz/platform';
import { lessonsLearned } from '../abschluss/index.ts';
import { aufgabe } from '../eingang/index.ts';
import { auswerten } from './rueckblick.ts';

export const ART_ERFASSEN = 'lessons_learned.erfassen';
const bezugVon = (projektId: string) => ({ typ: 'projekt', id: projektId });

/** Aufgaben öffnen (idempotent je Projekt und Person); liefert Anzahl Vorhaben und Aufgaben. */
export async function anfordern(tx: Tx, jahr: number): Promise<{ vorhaben: number; aufgaben: number }> {
  const ohne = (await auswerten(tx, jahr)).lessonsLearned.ohne;
  let aufgaben = 0;
  for (const p of ohne) {
    for (const person of await lessonsLearned.projektleitung(tx, p.id)) {
      await aufgabe.oeffnen(tx, {
        art: ART_ERFASSEN, bezug: bezugVon(p.id), empfaenger: { person },
        titel: `Lessons Learned ${p.name} erfassen`,
        kontext: `${p.nummer} ${p.name} · als PL · für den Jahresrückblick ${jahr}`,
        // Lessons Learned erfasst die PL beim Abschluss des Projekts (AP-E7-1)
        link: `/projekte/${p.nummer}/abschluss`,
      });
      aufgaben += 1;
    }
  }
  return { vorhaben: ohne.length, aufgaben };
}

/** Beim Laden des Moduls: erfasste Lessons Learned erledigen die Aufgabe des Projekts (UC-013 A1.2). */
export function registriereLessonsHaken(): void {
  lessonsLearned.beimErfassen(async (tx, l) => { await aufgabe.erledigen(tx, { art: ART_ERFASSEN, bezug: bezugVon(l.projektId) }); });
}
