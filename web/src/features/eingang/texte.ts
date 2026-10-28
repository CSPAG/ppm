/**
 * Texte des Eingangs (UI-01; Namensraum = Feature, fachmodell.md 7.2). Anrede «Du», Begriffe aus dem Glossar
 * (docs/ux/README.md: Eingang, Zu tun, Mitteilung, Stellvertretung).
 */
import { NAV } from './nav.ts';

export const E = {
  titel: NAV.titel,
  sub: 'Was jetzt gilt und zu tun ist – aus allen deinen Rollen.',
  zaehler: NAV.zaehler,
  kopf: {
    titel: 'Deine Aufgaben',
    offen: (n: number) => (n === 0 ? 'Keine offenen Aufgaben' : n === 1 ? '1 offene Aufgabe' : `${n} offene Aufgaben`),
    ueberfaellig: (n: number) => (n === 1 ? '1 überfällig' : `${n} überfällig`),
    naechsteFrist: (frist: string) => `nächste Frist ${frist}`,
  },
  vertretung: {
    sieVertreten: (name: string, bis: string) => `Du vertrittst ${name} bis ${bis}. Aufgaben dieser Person stehen in «Zu tun».`,
    mitUnterschriften: 'Du darfst in Vertretung unterzeichnen.',
    werdenVertreten: (name: string, von: string, bis: string) => `${name} vertritt dich von ${von} bis ${bis}.`,
    verwalten: 'Stellvertretung verwalten',
  },
  zuTun: {
    titel: 'Zu tun',
    nurFrist: 'Nur mit Frist',
    alle: 'Alle',
    filter: 'Aufgaben filtern',
    leer: 'Keine offenen Aufgaben. Neue Aufgaben aus deinen Rollen erscheinen hier, sobald etwas zu tun ist.',
    leerFrist: 'Keine Aufgaben mit Frist.',
    oeffnen: 'Öffnen',
    oeffnenAria: (titel: string) => `${titel} öffnen`,
    erledigt: 'Erledigt',
    erledigtAria: (titel: string) => `${titel} als erledigt markieren`,
    erledigtToast: (titel: string) => `«${titel}» erledigt.`,
    wiederOffen: (titel: string) => `«${titel}» ist wieder offen.`,
    rueckgaengig: 'Rückgängig',
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
