/** Datum in Texten der Aufgaben und Mitteilungen nach de-CH (darstellung.md, Formate): «Mi 12.11.». */
const TAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] as const;

export function kurzDatum(d: string): string {
  const [j, m, t] = d.split('-').map(Number) as [number, number, number];
  return `${TAGE[new Date(Date.UTC(j, m - 1, t)).getUTCDay()]} ${t}.${m}.`;
}

/** Heute in der Schweiz (Fristen sind Kalendertage in Europe/Zurich). */
export function heute(jetzt = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(jetzt);
}

/** Uhrzeit «HH:MM» plus Minuten (Zeitfenster der Eingeladenen, K3 Einstieg «ca. 14:20»). */
export function plusMinuten(zeit: string, min: number): string {
  const [h, m] = zeit.split(':').map(Number) as [number, number];
  const t = (h * 60 + m + min) % (24 * 60);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}
