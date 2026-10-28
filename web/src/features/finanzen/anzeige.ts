/** Beträge der Finanzen anzeigen (darstellung.md «Zahlen», «Kosten»): Ist ohne Wert «noch nicht verfügbar», nie 0. */
import { fmtAbweichung, fmtBetrag, fmtBetragKurz } from '../../ui/index.ts';
import { TF } from './texte.ts';

export const kurz = (n: number | null, leer = '–') => (n === null ? leer : fmtBetragKurz(n));
export const lang = (n: number | null, leer = '–') => (n === null ? leer : fmtBetrag(n));
export const ist = (n: number | null, o: { lang?: boolean } = {}) => (n === null ? TF.nichtVerfuegbar : o.lang ? fmtBetrag(n) : fmtBetragKurz(n));
export const abweichung = (a: { betrag: number | null; prozent: number | null }) =>
  (a.betrag === null ? TF.keinBudget : fmtAbweichung(a.betrag, a.prozent ?? undefined));

/** CSV mit Semikolon (Excel in der Schweiz), Beträge ohne Tausendertrennzeichen, Text in Anführungszeichen. */
export function csv(kopf: readonly string[], zeilen: readonly (readonly (string | number | null)[])[]): string {
  const zelle = (v: string | number | null) => (v === null ? '' : typeof v === 'number' ? String(v) : `"${v.replace(/"/g, '""')}"`);
  return [kopf.map(zelle), ...zeilen.map(z => z.map(zelle))].map(z => z.join(';')).join('\r\n');
}

/** Datei im Browser speichern (same-origin, ohne Netz). */
export function herunterladen(name: string, inhalt: string): void {
  const url = URL.createObjectURL(new Blob([`\uFEFF${inhalt}`], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
