/**
 * Vermerke der Statusberichte (AP-E8-4; Master G1, A-74, UX-E12): Die UE schliesst die Periode auch mit ungeprüften
 * Berichten ab (UC-005 Schritt 5). Ein eingereichter Bericht einer abgeschlossenen Periode trägt dann «nicht geprüft»,
 * bis die UE ihn nachträglich bestätigt; abgeleitet aus Stand der Periode und des Berichts, gespeichert wird nichts.
 */
export interface Vermerk { art: string; text: string }

export const NICHT_GEPRUEFT: Vermerk = { art: 'nicht_geprueft', text: 'nicht geprüft' };

/** Vermerke eines Berichts: eingereicht in einer abgeschlossenen Periode = «nicht geprüft». */
export function berichtVermerke(stand: string, periodeAbgeschlossen: boolean): Vermerk[] {
  return periodeAbgeschlossen && stand === 'eingereicht' ? [NICHT_GEPRUEFT] : [];
}

/** Hinweis vor dem Abschluss (Warnung, darstellung.md): ungeprüfte Berichte gehen mit Vermerk ins Dashboard. */
export function abschlussHinweis(eingereicht: number): string | null {
  if (!eingereicht) return null;
  return `${eingereicht} ${eingereicht === 1 ? 'Bericht ist' : 'Berichte sind'} eingereicht, aber nicht geprüft. Schliesst du ab, `
    + `${eingereicht === 1 ? 'zählt er' : 'zählen sie'} mit dem Vermerk «nicht geprüft»; die Prüfung kannst du nachtragen.`;
}
