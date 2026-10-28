/**
 * Texte des Profils mit Stellvertretung (UI-43, UC-016 Schritt 4; Namensraum = Feature, fachmodell.md 7.2). Anrede «Du».
 */
import { NAV } from './nav.ts';

export const K = {
  titel: NAV.titel,
  sub: 'Wer dich bei Abwesenheit vertritt – damit Freigaben nicht liegen bleiben.',
  profil: { titel: 'Profil', name: 'Name', email: 'E-Mail', organisation: 'Organisation', keineAngabe: 'keine Angabe' },
  liste: {
    titel: 'Stellvertretungen',
    leer: 'Du hast keine Stellvertretung erfasst. Erfasse eine, bevor du abwesend bist: Deine Aufgaben erscheinen dann auch bei der Vertretung.',
    vertretung: 'Vertretung', vertritt: 'Vertritt', zeitraum: 'Zeitraum', unterschriften: 'Unterschriften', stand: 'Stand',
    eigene: (name: string) => `${name} vertritt dich`,
    fuerAndere: (name: string) => `Du vertrittst ${name}`,
    von: (von: string, bis: string) => `${von} bis ${bis}`,
    ja: 'erteilt', nein: 'nicht erteilt',
    aktiv: 'läuft', geplant: 'geplant',
  },
  erfassen: NAV.erfassen,
  form: {
    person: 'Vertretung', personHint: 'Name eingeben und Person wählen.', suchen: 'Person suchen', keineTreffer: 'Keine Person gefunden.',
    gewaehlt: (name: string) => `Gewählt: ${name}`, aendern: 'Andere Person wählen',
    von: 'Von', bis: 'Bis',
    unterschriften: 'Darf in Vertretung unterzeichnen',
    unterschriftenHint: 'Nur wenn du es ausdrücklich erlaubst: Die Vertretung unterzeichnet dann Projektverträge mit dem Vermerk «in Vertretung».',
    personFehlt: 'Wähle die Person, die dich vertritt.',
    datumFehlt: 'Gib ein Datum ein.',
    bisVorVon: 'Bis muss am oder nach Von liegen.',
    vergangen: 'Der Zeitraum muss heute oder später enden.',
    wirkung: (name: string) => `Wirkung: ${name} sieht im Zeitraum deine Aufgaben im Eingang und erhält deine Rollen in Projekten und Portfolios, befristet bis zum Ende. ${name} wird benachrichtigt.`,
    speichern: 'Stellvertretung erfassen',
  },
  erfasst: 'Stellvertretung erfasst.',
  beenden: 'Beenden',
  beendenAria: (name: string) => `Stellvertretung durch ${name} beenden`,
  beendenFrage: (name: string) => `Stellvertretung durch ${name} beenden?`,
  beendenText: (name: string) => `${name} sieht deine Aufgaben ab sofort nicht mehr und verliert die befristeten Rollen.`,
  beendet: 'Stellvertretung beendet.',
};
