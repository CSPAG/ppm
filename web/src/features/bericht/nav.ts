/**
 * Texte des Features «Bericht» für Navigation, Befehlspalette und Reiter: klein und im Start-Bundle (Q-L6). Die Texte
 * der Seiten übernehmen sie von hier und laden mit den Seiten erst bei Bedarf.
 */
export const NAV = {
  reiter: 'Bericht',
  palette: (nr: string, name: string) => `Statusbericht erstellen: ${nr} ${name}`,
};
