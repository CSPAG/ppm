/**
 * Texte des Features «Projektvertrag» für Navigation, Befehlspalette und Reiter: klein und im Start-Bundle (Q-L6). Die Texte
 * der Seiten übernehmen sie von hier und laden mit den Seiten erst bei Bedarf.
 */
export const NAV = {
  reiter: 'Vertrag',
  reiterVersionen: 'Versionen',
  palette: (nr: string, name: string) => `Änderung beantragen: ${nr} ${name}`,
  antrag: 'Änderungsantrag',
};
