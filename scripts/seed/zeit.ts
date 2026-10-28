/** Kalender der Demo relativ zu heute (Europe/Zurich): Monate, Quartale, Sitzungstage (Mittwoch), Feiertage. */

const TAG = 86_400_000;
export const heute = (): string => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });
const utc = (d: string) => new Date(`${d}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

export const inTagen = (n: number, von = heute()): string => iso(new Date(utc(von).getTime() + n * TAG));

/** Monat `YYYY-MM` mit Abstand n zum laufenden Monat. */
export function monat(n: number): string {
  const [j, m] = heute().split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(j, m - 1 + n, 1));
  return iso(d).slice(0, 7);
}

/** Letzter Tag eines Monats `YYYY-MM`. */
export function monatsende(m: string): string {
  const [j, mm] = m.split('-').map(Number) as [number, number];
  return iso(new Date(Date.UTC(j, mm, 0)));
}

/** Dritter Mittwoch des Monats mit Abstand n (Sitzungstag des PRAT). */
export function sitzungstag(n: number, woche = 3): string {
  const d = utc(`${monat(n)}-01`);
  while (d.getUTCDay() !== 3) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCDate(d.getUTCDate() + 7 * (woche - 1));
  return iso(d);
}

export const jahr = (n = 0): number => Number(heute().slice(0, 4)) + n;

/** Abgeschlossene Quartale des laufenden Jahres (`YYYY-Qn`). */
export function quartaleVorbei(): string[] {
  const m = Number(heute().slice(5, 7));
  return Array.from({ length: Math.floor((m - 1) / 3) }, (_, i) => `${jahr()}-Q${i + 1}`);
}

/** Ostersonntag (Gauss, gregorianisch). */
function ostern(j: number): Date {
  const a = j % 19, b = Math.floor(j / 100), c = j % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31), tag = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(j, monat - 1, tag));
}

/** Feiertage im Kanton Bern. */
export function feiertage(j: number): { datum: string; label: string }[] {
  const o = ostern(j).getTime();
  const rel = (n: number) => iso(new Date(o + n * TAG));
  return [
    { datum: `${j}-01-01`, label: 'Neujahr' },
    { datum: `${j}-01-02`, label: 'Berchtoldstag' },
    { datum: rel(-2), label: 'Karfreitag' },
    { datum: rel(1), label: 'Ostermontag' },
    { datum: rel(39), label: 'Auffahrt' },
    { datum: rel(50), label: 'Pfingstmontag' },
    { datum: `${j}-08-01`, label: 'Bundesfeier' },
    { datum: `${j}-12-25`, label: 'Weihnachten' },
    { datum: `${j}-12-26`, label: 'Stephanstag' },
  ];
}
