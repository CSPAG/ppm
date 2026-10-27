/**
 * Texte der Dokumentausgabe des Projektvertrags (UI-11; K2 Schritt 11, Texte «Als Dokument herunterladen»): Anrede «Sie»
 * (UX-E7), Schweizer Rechtschreibung; Hinweis auf Personendaten (G12).
 */
export const TD = {
  aktion: 'Als Dokument herunterladen',
  pdf: 'PDF', word: 'Word',
  pdfLang: (nummer: string) => `Version ${nummer} als PDF herunterladen`,
  wordLang: (nummer: string) => `Version ${nummer} als Word-Datei herunterladen`,
  wirdErstellt: 'Dokument wird erstellt …',
  bereit: (datei: string) => `${datei} heruntergeladen.`,
  personendaten: 'Das Dokument enthält Personendaten. Geben Sie es nur intern weiter.',
  fehler: 'Das Dokument konnte nicht erstellt werden.',
};
