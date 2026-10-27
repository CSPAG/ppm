/** Monate und Zeitraum der Seiten (wie die API: ohne Angabe der laufende Monat und die elf folgenden, höchstens 60). */
import { fmtPeriode } from '../../ui/index.ts';

const zahl = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;
const monatVon = (n: number) => `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, '0')}`;

export const MAX_MONATE = 60;
export const plusMonate = (m: string, n: number) => monatVon(zahl(m) + n);
export const dieserMonat = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export function monate(von: string, bis: string): string[] {
  const out: string[] = [];
  for (let n = zahl(von); n <= zahl(bis); n++) out.push(monatVon(n));
  return out;
}

/** Zeitraum aus der Adresse; ungültig (Ende vor Beginn, zu lang) → null. */
export function zeitraum(s: { von?: string; bis?: string }): { von: string; bis: string } | null {
  const von = s.von ?? (s.bis ? plusMonate(s.bis, -11) : dieserMonat());
  const bis = s.bis ?? plusMonate(von, 11);
  if (bis < von || zahl(bis) - zahl(von) >= MAX_MONATE) return null;
  return { von, bis };
}

/** «Jan 27» für Spaltenköpfe, «Januar 2027» für Ansagen. */
export const monatKurz = (m: string, kurz: readonly string[]) => `${kurz[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;
export const monatLang = fmtPeriode;

/** «2027-Q2» → «Q2 2027». */
export const quartalText = (q: string) => `${q.slice(5)} ${q.slice(0, 4)}`;
