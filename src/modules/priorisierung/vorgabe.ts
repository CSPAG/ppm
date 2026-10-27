/**
 * Vorgabe für das erste Bewertungsmodell: die Kriterien aus UC-008 Schritt 2 (Q6 F2). Die Zuordnung zu Nutzen oder Risiko
 * (A-39) legt die UE im Entwurf fest; die Vorgabe lässt sie offen, die Spezifikation nennt keine.
 */
export const VORGABE_KRITERIEN: readonly { schluessel: string; text: string }[] = [
  { schluessel: 'strategiebeitrag', text: 'Strategiebeitrag' },
  { schluessel: 'transformationsrelevanz', text: 'Transformationsrelevanz' },
  { schluessel: 'betroffene_bereiche', text: 'Betroffene Bereiche' },
  { schluessel: 'komplexitaet_abhaengigkeiten', text: 'Komplexität und Abhängigkeiten' },
  { schluessel: 'finanzierungsbedarf', text: 'Finanzierungsbedarf' },
  { schluessel: 'ressourcenverfuegbarkeit', text: 'Ressourcenverfügbarkeit' },
  { schluessel: 'change_aufwand', text: 'Kommunikations- und Change-Aufwand' },
];

/** Schlüssel aus dem Text: «Komplexität und Abhängigkeiten» → «komplexitaet_und_abhaengigkeiten». */
export function schluesselAus(text: string): string {
  const s = text.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40).replace(/_+$/g, '');
  return s || 'kriterium';
}
