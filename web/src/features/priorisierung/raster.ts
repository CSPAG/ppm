/** Hilfen des Bewertungsrasters (rein, ohne React). */
import type { Bewertungsraster } from './api.ts';

export type Wert = 'hoch' | 'mittel' | 'tief' | '';
export const k = (projektId: string, kriterium: string) => `${projektId}|${kriterium}`;

/** Taste → Einschätzung (K5 «Barrierefreiheit»: 1 / 2 / 3 für tief / mittel / hoch; Entf entfernt); sonst undefined. */
export function wertAusTaste(key: string): Wert | undefined {
  if (key === '1') return 'tief';
  if (key === '2') return 'mittel';
  if (key === '3') return 'hoch';
  if (key === 'Delete' || key === 'Backspace' || key === '0') return '';
  return undefined;
}

/** Klick: der Reihe nach tief → mittel → hoch → leer. */
export const naechster = (w: Wert): Wert => (w === '' ? 'tief' : w === 'tief' ? 'mittel' : w === 'mittel' ? 'hoch' : '');

/** Projekte, bei denen jedes Kriterium bewertet ist (mit den Werten der Oberfläche, auch ungespeicherten). */
export function vollstaendig(r: Bewertungsraster, wert: (key: string) => Wert): number {
  const kriterien = r.modell?.kriterien ?? [];
  if (!kriterien.length) return 0;
  return r.projekte.filter(p => kriterien.every(c => wert(k(p.id, c.schluessel)) !== '')).length;
}
