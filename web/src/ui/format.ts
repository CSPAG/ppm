/**
 * Formate nach docs/ux/darstellung.md (Region Schweiz, Q-S2; I-T1 bis I-T4): Datum zum Planen mit Wochentag, nahe Fristen
 * relativ und absolut, Fristen in Arbeitstagen (UX-E11), Zeitpunkte absolut mit Zeit, Perioden, Quartale, Beträge in CHF,
 * Abweichungen mit Vorzeichen, FTE, Phasen und Gates. Ein Tag ohne Zeit ist `YYYY-MM-DD` und gilt in der Zeitzone der
 * Person; `heute` ist überall übergebbar, damit Tests und Galerie feste Werte zeigen.
 */
import { T } from './texte/index.ts';

/** Geschütztes Leerzeichen zwischen Zahl und Einheit (kein Umbruch in «CHF 1'250'000»). */
const NB = '\u00a0';
const MS_TAG = 86_400_000;

export type Tag = string | Date;

/** Kalendertag ohne Zeit (lokale Mitternacht). */
export function tag(d: Tag): Date {
  if (d instanceof Date) return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (!m) throw new Error(`Kein Datum: ${d}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Kalendertage von `heute` bis `d` (negativ: vergangen). */
export function tageBis(d: Tag, heute: Tag = new Date()): number {
  return Math.round((tag(d).getTime() - tag(heute).getTime()) / MS_TAG);
}

/** Datum zum Planen: «Mi 12.11.»; Jahr nur, wenn nicht das laufende: «Mi 31.3.2027» (I-T3). */
export function fmtDatum(d: Tag, heute: Tag = new Date()): string {
  const t = tag(d);
  const jahr = t.getFullYear() === tag(heute).getFullYear() ? '' : String(t.getFullYear());
  return `${T.format.wochentage[t.getDay()]} ${t.getDate()}.${t.getMonth() + 1}.${jahr}`;
}

/** Frist in Kalendertagen: nahe (≤ 14 Tage) relativ und absolut, überfällige mit «überfällig seit», ferne nur absolut (I-T2). */
export function fmtFrist(d: Tag, heute: Tag = new Date()): string {
  const n = tageBis(d, heute);
  const datum = fmtDatum(d, heute);
  if (n < 0) return T.format.ueberfaellig(datum);
  if (n > 14) return datum;
  const rel = n === 0 ? T.format.heute : n === 1 ? T.format.morgen : T.format.inTagen(n);
  return `${datum} · ${rel}`;
}

/**
 * Arbeitstage (Mo–Fr) nach `heute` bis und mit `d`; Feiertage zählen noch mit (Kalender der Organisation folgt mit
 * dem Phasenmodell, UC-017).
 */
export function arbeitstageBis(d: Tag, heute: Tag = new Date()): number {
  const ziel = tag(d);
  const t = tag(heute);
  const vor = ziel >= t ? 1 : -1;
  let n = 0;
  while (t.getTime() !== ziel.getTime()) {
    t.setDate(t.getDate() + vor);
    const wt = t.getDay();
    if (wt !== 0 && wt !== 6) n += vor;
  }
  return n;
}

/** Frist in Arbeitstagen, ausdrücklich so benannt (UX-E11): «Mi 5.11. · in 4 Arbeitstagen». */
export function fmtFristArbeitstage(d: Tag, heute: Tag = new Date()): string {
  const datum = fmtDatum(d, heute);
  if (tageBis(d, heute) < 0) return T.format.ueberfaellig(datum);
  const n = arbeitstageBis(d, heute);
  return `${datum} · ${n === 0 ? T.format.heuteArbeitstag : T.format.inArbeitstagen(n)}`;
}

const zeit = new Intl.DateTimeFormat('de-CH', { timeZone: 'Europe/Zurich', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** Zeitpunkt für Entscheide, Protokoll, Unterschriften und Verlauf, immer absolut in Schweizer Zeit: «Mi 12.11.2026, 15:42». */
export function fmtZeitpunkt(iso: string | Date): string {
  const p = Object.fromEntries(zeit.formatToParts(new Date(iso)).map(x => [x.type, Number(x.value)]));
  const wt = T.format.wochentage[new Date(Date.UTC(p.year!, p.month! - 1, p.day!)).getUTCDay()];
  const zz = (n: number | undefined) => String(n).padStart(2, '0');
  return `${wt} ${p.day}.${p.month}.${p.year}, ${zz(p.hour)}:${zz(p.minute)}`;
}

/** Früherer Name für den Verlauf; gleich wie `fmtZeitpunkt`. */
export const fmtDateTime = fmtZeitpunkt;

/** Periode «2026-10» → «Oktober 2026». */
export function fmtPeriode(periode: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(periode);
  if (!m) throw new Error(`Keine Periode: ${periode}`);
  return `${T.format.monate[Number(m[2]) - 1]} ${m[1]}`;
}

/** Quartal: «Q3 2026». */
export function fmtQuartal(jahr: number, quartal: 1 | 2 | 3 | 4): string {
  return `Q${quartal} ${jahr}`;
}

/** Zeitraum in Monaten: «Mrz–Dez 2027», über den Jahreswechsel «Nov 2026–Feb 2027». */
export function fmtMonate(von: string, bis: string): string {
  const [vj, vm] = von.split('-').map(Number) as [number, number];
  const [bj, bm] = bis.split('-').map(Number) as [number, number];
  const k = T.format.monateKurz;
  return vj === bj ? `${k[vm - 1]}–${k[bm - 1]} ${bj}` : `${k[vm - 1]} ${vj}–${k[bm - 1]} ${bj}`;
}

/** Ganze Zahl mit Apostroph als Tausendertrennzeichen: 1250000 → «1'250'000». */
function tausender(n: number): string {
  return String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

/** Dezimalzahl mit Komma und fester Anzahl Stellen. */
function dezimal(n: number, stellen: number): string {
  return Math.abs(n).toFixed(stellen).replace('.', ',');
}

const vorzeichen = (n: number, immer: boolean) => (n < 0 ? '−' : immer && n > 0 ? '+' : '');

/** Betrag im Detail, ohne Rappen: «CHF 1'250'000». */
export function fmtBetrag(n: number, o: { vorzeichen?: boolean } = {}): string {
  return `${vorzeichen(n, !!o.vorzeichen)}CHF${NB}${tausender(n)}`;
}

/** Betrag in Listen, Dashboard und Matrix: ab 1 Mio. «CHF 1,25 Mio.», darunter «CHF 380 Tsd.», unter 1000 im Detail. */
export function fmtBetragKurz(n: number, o: { vorzeichen?: boolean } = {}): string {
  const a = Math.abs(n);
  const v = vorzeichen(n, !!o.vorzeichen);
  if (a >= 999_500) return `${v}CHF${NB}${dezimal(a / 1_000_000, 2)}${NB}${T.format.mio}`;
  if (a >= 1000) return `${v}CHF${NB}${tausender(a / 1000)}${NB}${T.format.tsd}`;
  return fmtBetrag(n, o);
}

/** Prozent mit Vorzeichen: «+14 %». */
export function fmtProzent(p: number, o: { vorzeichen?: boolean } = { vorzeichen: true }): string {
  return `${vorzeichen(p, !!o.vorzeichen)}${Math.round(Math.abs(p))}${NB}%`;
}

/** Abweichung eines Betrags: «+CHF 300 Tsd. · +14 %». */
export function fmtAbweichung(betrag: number, prozent?: number): string {
  const b = fmtBetragKurz(betrag, { vorzeichen: true });
  return prozent === undefined ? b : `${b} · ${fmtProzent(prozent)}`;
}

/** Abweichung eines Termins in Wochen: «+3 Wochen». */
export function fmtAbweichungWochen(wochen: number): string {
  return `${vorzeichen(wochen, true)}${Math.abs(wochen)}${NB}${Math.abs(wochen) === 1 ? T.format.woche : T.format.wochen}`;
}

/** Personalbedarf: «2,5 FTE». */
export function fmtFte(n: number): string {
  return `${dezimal(n, 1)}${NB}${T.format.fte}`;
}

export type Phase = 'Pre-P0' | 'P0' | 'P1' | 'P2' | 'P3' | 'P4';

/** Phase mit Kürzel und Name: «P1 Konzept und Planung». */
export function fmtPhase(p: Phase): string {
  return `${p} ${T.phase[p] ?? ''}`.trim();
}

/** Gate zwischen zwei Phasen «Gate P1–P2», Eintritt «Gate Eintritt P0», Exit «Gate Exit P4». */
export function fmtGate(von: Phase | 'eintritt', zu: Phase | 'exit'): string {
  if (von === 'eintritt') return `${T.gate.gate} ${T.gate.eintritt} ${zu}`;
  if (zu === 'exit') return `${T.gate.gate} ${T.gate.exit} ${von}`;
  return `${T.gate.gate} ${von}–${zu}`;
}

/** Stabile Farbe je Person für Avatare (wie vollholz/assets); ausreichender Kontrast zu weisser Schrift. */
const AV = ['#0D6B5B', '#4B5BB8', '#A0550C', '#8A3B8F', '#2F62B5', '#7A4B2A', '#3F6B2A', '#B13A50'];
export function avatarColor(seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return AV[Math.abs(h) % AV.length]!;
}
