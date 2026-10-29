/**
 * Texte des Eingangs (UI-01; Namensraum = Feature, fachmodell.md 7.2). Anrede «Du», Begriffe aus dem Glossar
 * (docs/ux/README.md: Eingang, Zu tun, Mitteilung, Stellvertretung).
 */
import { satzende } from '../../ui/index.ts';
import { NAV } from './nav.ts';

export const E = {
  titel: NAV.titel,
  zaehler: NAV.zaehler,
  kopf: {
    titel: 'Überblick',
  },
  vertretung: {
    sieVertreten: (name: string, bis: string) => `Du vertrittst ${name} bis ${satzende(bis)} Aufgaben dieser Person stehen in «Zu tun».`,
    mitUnterschriften: 'Du darfst in Vertretung unterzeichnen.',
    werdenVertreten: (name: string, von: string, bis: string) => `${name} vertritt dich von ${von} bis ${satzende(bis)}`,
    verwalten: 'Stellvertretung verwalten',
  },
  zuTun: {
    titel: 'Zu tun',
    offen: (n: number) => `${n} offen`,
    ueberfaellig: (n: number) => `${n} überfällig`,
    nurFrist: 'Nur mit Frist',
    alle: 'Alle',
    filter: 'Aufgaben filtern',
    leer: 'Keine offenen Aufgaben. Neue Aufgaben aus deinen Rollen erscheinen hier, sobald etwas zu tun ist.',
    leerFrist: 'Keine Aufgaben mit Frist.',
    erledigt: 'Erledigt',
    erledigtAria: (titel: string) => `${titel} als erledigt markieren`,
    erledigtToast: (titel: string) => `«${titel}» erledigt.`,
    wiederOffen: (titel: string) => `«${titel}» ist wieder offen.`,
    rueckgaengig: 'Rückgängig',
    inVertretung: (name: string) => `in Vertretung von ${name}`,
    anAlle: 'an alle mit dieser Aufgabe',
    frist: 'Frist',
  },
  mitteilungen: {
    titel: 'Mitteilungen',
    leer: 'Keine Mitteilungen.',
    ungelesen: (n: number) => (n === 1 ? '1 ungelesen' : `${n} ungelesen`),
    gelesen: 'Als gelesen markieren',
    gelesenAria: (text: string) => `Mitteilung «${text}» als gelesen markieren`,
    neu: 'neu',
  },
};
