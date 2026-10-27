/** Darstellung von Zeiten und Daten (de-CH). */
const dt = new Intl.DateTimeFormat('de-CH', { dateStyle: 'medium', timeStyle: 'short' });
export const fmtDateTime = (iso: string): string => dt.format(new Date(iso));

/** Stabile Farbe je Person für Avatare (wie vollholz/assets); ausreichender Kontrast zu weisser Schrift. */
const AV = ['#0D6B5B', '#4B5BB8', '#A0550C', '#8A3B8F', '#2F62B5', '#7A4B2A', '#3F6B2A', '#B13A50'];
export function avatarColor(seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return AV[Math.abs(h) % AV.length]!;
}
