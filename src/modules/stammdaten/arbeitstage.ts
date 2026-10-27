/**
 * Arbeitstage (A-43): Montag bis Freitag ohne die gepflegten Feiertage der Organisation. Für alle Fristen in
 * Arbeitstagen (docs/fachmodell.md 2.14: Versand, Protokoll, «Gate vorbereiten», «Sitzung vorbereiten»).
 * Daten als 'YYYY-MM-DD', gerechnet in UTC (ein Datum hat keine Zeitzone).
 */
import type { Tx } from '@vollholz/platform';
import { feiertageZwischen } from './store.ts';

const DAY = 86_400_000;
const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Ist `datum` ein Arbeitstag (Mo–Fr und kein Feiertag)? */
export function istArbeitstag(datum: string, feiertage: ReadonlySet<string>): boolean {
  const wd = new Date(toMs(datum)).getUTCDay();
  return wd !== 0 && wd !== 6 && !feiertage.has(datum);
}

/**
 * Datum `n` Arbeitstage nach (`n` > 0) bzw. vor (`n` < 0) `datum`; der Ausgangstag zählt nicht mit. `n` = 0 liefert
 * `datum` unverändert. Beispiel: Versand 5 Arbeitstage vor der Sitzung = `plusArbeitstage(sitzung, -5, feiertage)`.
 */
export function plusArbeitstage(datum: string, n: number, feiertage: ReadonlySet<string>): string {
  if (!Number.isInteger(n)) throw new RangeError('n muss ganzzahlig sein');
  const step = n < 0 ? -DAY : DAY;
  let ms = toMs(datum);
  for (let left = Math.abs(n); left > 0;) {
    ms += step;
    if (istArbeitstag(toIso(ms), feiertage)) left--;
  }
  return toIso(ms);
}

/** Arbeitstage zwischen `von` (ausschliesslich) und `bis` (einschliesslich); negativ, wenn `bis` vor `von` liegt. */
export function arbeitstageZwischen(von: string, bis: string, feiertage: ReadonlySet<string>): number {
  const a = toMs(von), b = toMs(bis);
  const step = b < a ? -DAY : DAY;
  let n = 0;
  for (let ms = a; ms !== b;) {
    ms += step;
    if (istArbeitstag(toIso(ms), feiertage)) n += Math.sign(step);
  }
  return n;
}

/**
 * Wie `plusArbeitstage`, mit den Feiertagen der Organisation aus der Datenbank (Lesesicht: `stammdaten:read`). Das
 * Fenster wird erweitert, bis das Ergebnis darin liegt.
 */
export async function plusArbeitstageDb(tx: Tx, datum: string, n: number): Promise<string> {
  for (let span = Math.abs(n) * 2 + 31; ; span *= 2) {
    const ende = toIso(toMs(datum) + Math.sign(n || 1) * span * DAY);
    const [von, bis] = n < 0 ? [ende, datum] : [datum, ende];
    const ergebnis = plusArbeitstage(datum, n, new Set(await feiertageZwischen(tx, von, bis)));
    if (ergebnis >= von && ergebnis <= bis) return ergebnis;
  }
}
