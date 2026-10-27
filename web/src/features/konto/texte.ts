/**
 * Texte des Profils mit Stellvertretung (UI-43, UC-016 Schritt 4; Namensraum = Feature, fachmodell.md 7.2). Anrede «Sie».
 */
export const K = {
  titel: 'Profil und Stellvertretung',
  sub: 'Wer Sie bei Abwesenheit vertritt – damit Freigaben nicht liegen bleiben.',
  profil: { titel: 'Profil', name: 'Name', email: 'E-Mail', organisation: 'Organisation', keineAngabe: 'keine Angabe' },
  liste: {
    titel: 'Stellvertretungen',
    leer: 'Sie haben keine Stellvertretung erfasst. Erfassen Sie eine, bevor Sie abwesend sind: Ihre Aufgaben erscheinen dann auch bei der Vertretung.',
    vertretung: 'Vertretung', vertritt: 'Vertritt', zeitraum: 'Zeitraum', unterschriften: 'Unterschriften', stand: 'Stand',
    eigene: (name: string) => `${name} vertritt Sie`,
    fuerAndere: (name: string) => `Sie vertreten ${name}`,
    von: (von: string, bis: string) => `${von} bis ${bis}`,
    ja: 'erteilt', nein: 'nicht erteilt',
    aktiv: 'läuft', geplant: 'geplant',
  },
  erfassen: 'Stellvertretung erfassen',
  form: {
    person: 'Vertretung', personHint: 'Name eingeben und Person wählen.', suchen: 'Person suchen', keineTreffer: 'Keine Person gefunden.',
    gewaehlt: (name: string) => `Gewählt: ${name}`, aendern: 'Andere Person wählen',
    von: 'Von', bis: 'Bis',
    unterschriften: 'Darf in Vertretung unterzeichnen',
    unterschriftenHint: 'Nur wenn Sie es ausdrücklich erlauben: Die Vertretung unterzeichnet dann Projektverträge mit dem Vermerk «in Vertretung».',
    personFehlt: 'Wählen Sie die Person, die Sie vertritt.',
    datumFehlt: 'Geben Sie ein Datum ein.',
    bisVorVon: 'Bis muss am oder nach Von liegen.',
    vergangen: 'Der Zeitraum muss heute oder später enden.',
    wirkung: (name: string) => `Wirkung: ${name} sieht im Zeitraum Ihre Aufgaben im Eingang und erhält Ihre Rollen in Projekten und Portfolios, befristet bis zum Ende. ${name} wird benachrichtigt.`,
    speichern: 'Stellvertretung erfassen',
  },
  erfasst: 'Stellvertretung erfasst.',
  beenden: 'Beenden',
  beendenAria: (name: string) => `Stellvertretung durch ${name} beenden`,
  beendenFrage: (name: string) => `Stellvertretung durch ${name} beenden?`,
  beendenText: (name: string) => `${name} sieht Ihre Aufgaben ab sofort nicht mehr und verliert die befristeten Rollen.`,
  beendet: 'Stellvertretung beendet.',
};
