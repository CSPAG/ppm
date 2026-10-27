/**
 * Texte des Eingangs (UI-01; Namensraum = Feature, fachmodell.md 7.2). Anrede «Sie», Begriffe aus dem Glossar
 * (docs/ux/README.md: Eingang, Zu tun, Mitteilung, Stellvertretung).
 */
export const E = {
  titel: 'Eingang',
  sub: 'Was jetzt gilt und zu tun ist – aus allen Ihren Rollen.',
  zaehler: (n: number) => (n === 1 ? '1 offene Aufgabe' : `${n} offene Aufgaben`),
  kopf: {
    titel: 'Ihre Aufgaben',
    offen: (n: number) => (n === 0 ? 'Keine offenen Aufgaben' : n === 1 ? '1 offene Aufgabe' : `${n} offene Aufgaben`),
    ueberfaellig: (n: number) => (n === 1 ? '1 überfällig' : `${n} überfällig`),
    naechsteFrist: (frist: string) => `nächste Frist ${frist}`,
  },
  vertretung: {
    sieVertreten: (name: string, bis: string) => `Sie vertreten ${name} bis ${bis}. Aufgaben dieser Person stehen in «Zu tun».`,
    mitUnterschriften: 'Sie dürfen in Vertretung unterzeichnen.',
    werdenVertreten: (name: string, von: string, bis: string) => `${name} vertritt Sie von ${von} bis ${bis}.`,
    verwalten: 'Stellvertretung verwalten',
  },
  zuTun: {
    titel: 'Zu tun',
    nurFrist: 'Nur mit Frist',
    alle: 'Alle',
    filter: 'Aufgaben filtern',
    leer: 'Keine offenen Aufgaben. Neue Aufgaben aus Ihren Rollen erscheinen hier, sobald etwas zu tun ist.',
    leerFrist: 'Keine Aufgaben mit Frist.',
    oeffnen: 'Öffnen',
    oeffnenAria: (titel: string) => `${titel} öffnen`,
    erledigt: 'Erledigt',
    erledigtAria: (titel: string) => `${titel} als erledigt markieren`,
    erledigtToast: (titel: string) => `«${titel}» erledigt.`,
    inVertretung: (name: string) => `in Vertretung von ${name}`,
    anAlle: 'an alle mit dieser Aufgabe',
    ohneFrist: 'ohne Frist',
    frist: 'Frist',
  },
  mitteilungen: {
    titel: 'Mitteilungen',
    leer: 'Keine Mitteilungen.',
    ungelesen: (n: number) => (n === 1 ? '1 ungelesen' : `${n} ungelesen`),
    gelesen: 'Als gelesen markieren',
    gelesenAria: (text: string) => `Mitteilung «${text}» als gelesen markieren`,
    neu: 'neu',
    oeffnen: 'Öffnen',
  },
};
