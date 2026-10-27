/**
 * Arbeitstage (A-43): Montag bis Freitag ohne die gepflegten Feiertage der Organisation (`stammdaten`, AM.02.02). Reine
 * Rechnung auf Kalenderdaten `YYYY-MM-DD` ohne Zeitzone; die Feiertage gibt der Aufrufer mit (siehe `fristen.ts`).
 *
 * «n Arbeitstage vor D» ist der Tag, an dem zwischen ihm und D genau n Arbeitstage liegen, D nicht mitgezählt
 * (Versand 5 Arbeitstage vor der Sitzung Mi 12.11.2025 → Mi 5.11.2025; Protokoll 3 Arbeitstage nach der Sitzung →
 * Mo 17.11.2025; docs/ux/ablaeufe/K3-gremiumssitzung.md).
 */

export type Datum = string;

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const TAG = 86_400_000;

/** Kalenderdatum als Tageszahl seit 1970 (UTC); wirft bei ungültigem Datum. */
export function tagesZahl(d: Datum): number {
  const m = ISO.exec(d);
  const t = m ? Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!) : NaN;
  if (!m || Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== d) throw new RangeError(`Kein Datum: ${d}`);
  return t / TAG;
}

export const ausTagesZahl = (n: number): Datum => new Date(n * TAG).toISOString().slice(0, 10);

/** Tage addieren (negativ: zurück). */
export const plusTage = (d: Datum, n: number): Datum => ausTagesZahl(tagesZahl(d) + n);

export function istArbeitstag(d: Datum, feiertage: ReadonlySet<Datum>): boolean {
  const wochentag = new Date(tagesZahl(d) * TAG).getUTCDay();
  return wochentag !== 0 && wochentag !== 6 && !feiertage.has(d);
}

/** n Arbeitstage nach `d` (n < 0: vor `d`); n = 0 liefert `d` unverändert. */
export function addiereArbeitstage(d: Datum, n: number, feiertage: ReadonlySet<Datum>): Datum {
  if (!Number.isInteger(n)) throw new RangeError(`Keine ganze Zahl: ${n}`);
  const schritt = Math.sign(n);
  let tag = tagesZahl(d);
  for (let rest = Math.abs(n); rest > 0;) {
    tag += schritt;
    if (istArbeitstag(ausTagesZahl(tag), feiertage)) rest--;
  }
  return ausTagesZahl(tag);
}

/** Arbeitstage von `von` (ausschliesslich) bis `bis` (einschliesslich); negativ, wenn `bis` vor `von` liegt. */
export function arbeitstageZwischen(von: Datum, bis: Datum, feiertage: ReadonlySet<Datum>): number {
  const a = tagesZahl(von), b = tagesZahl(bis);
  // vorwärts: (von, bis]; rückwärts: [bis, von) – gezählt wird immer das Ende der Richtung, nie der Start
  const [lo, hi, vz] = a <= b ? [a + 1, b, 1] : [b, a - 1, -1];
  let n = 0;
  for (let t = lo; t <= hi; t++) if (istArbeitstag(ausTagesZahl(t), feiertage)) n++;
  return n === 0 ? 0 : n * vz;
}
