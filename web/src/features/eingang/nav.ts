/**
 * Texte des Features «Eingang» für Navigation, Befehlspalette und Reiter: klein und im Start-Bundle (Q-L6). Die Texte
 * der Seiten übernehmen sie von hier und laden mit den Seiten erst bei Bedarf.
 */
export const NAV = {
  titel: 'Eingang',
  zaehler: (n: number) => (n === 1 ? '1 offene Aufgabe' : `${n} offene Aufgaben`),
};
