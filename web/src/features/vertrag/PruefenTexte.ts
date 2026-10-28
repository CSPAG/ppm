/**
 * Texte für Prüfen und Unterzeichnen (UI-12; Kernablauf K2 Schritte 7–8, «Texte»): Anrede «Du», Schweizer
 * Rechtschreibung, Schaltflächen wie im Kernablauf.
 */
type Funktion = 'sp' | 'pl' | 'ctl';

export const TP = {
  funktion: { sp: 'Sponsor', pl: 'Projektleitung', ctl: 'CTL' } satisfies Record<Funktion, string>,
  zurueckZumVertrag: 'Ganzen Vertrag ansehen',
  version: (nummer: string, phase: string) => `Version ${nummer} für ${phase}`,
  keinEntwurf: 'Für dieses Projekt gibt es keinen Entwurf, der geprüft oder unterzeichnet wird.',

  // Quality-Check (K2 Schritt 7)
  pruefenTitel: 'Quality-Check',
  checkliste: 'Checkliste',
  checkPflicht: (fehlen: number) => (fehlen === 0 ? 'Pflichtangaben der Phase vollständig' : `${fehlen === 1 ? '1 Pflichtangabe fehlt' : `${fehlen} Pflichtangaben fehlen`}`),
  checkHandbuch: 'Einhaltung PM-Handbuch: prüfe die Kapitel; Abweichungen kommentierst du am Kapitel.',
  kapitel: 'Kapitel',
  kapitelAnsehen: (nr: number) => `Kapitel ${nr} ansehen`,
  kommentar: (nr: number, titel: string) => `Rückmeldung zu Kapitel ${nr} ${titel}`,
  kommentarHint: 'Leer lassen, wenn das Kapitel in Ordnung ist.',
  kommentareAnzahl: (n: number) => (n === 1 ? '1 Kapitel mit Rückmeldung' : `${n} Kapitel mit Rückmeldung`),
  bestaetigen: 'Quality-Check bestätigen',
  bestaetigenWirkung: 'Sponsor, Projektleitung und CTL erhalten je eine Unterzeichnungsaufgabe.',
  zurueckgeben: 'Zurück an die Projektleitung',
  zurueckgebenWirkung: 'Der Entwurf geht mit deinen Rückmeldungen zurück an die Projektleitung und ist wieder in Arbeit.',
  zurueckgebenFehlt: 'Rückmeldung fehlt: Die Projektleitung erfährt sonst nicht, was zu ändern ist. Kommentiere mindestens ein Kapitel.',
  bestaetigt: 'Quality-Check bestätigt. Sponsor, Projektleitung und CTL unterzeichnen.',
  zurueckgegeben: 'Zurück an die Projektleitung.',
  nichtInPruefung: (stand: string) => `Diese Version ist ${stand}; ein Quality-Check ist nur «in Prüfung» möglich.`,
  nurUe: 'Den Quality-Check führt die Unternehmensentwicklung durch.',
  fruehere: 'Frühere Rückmeldungen',
  rueckmeldungVom: (datum: string) => `Rückmeldung vom ${datum}`,
  bestaetigtAm: (datum: string) => `Bestätigt am ${datum}`,
  organisationFehlt: 'Die Projektorganisation ist unvollständig. Sponsor und Projektleitung legen sie in der Projektübersicht fest.',
  konflikt: 'Der Stand hat sich inzwischen geändert. Lade neu und prüfe erneut.',

  // Unterzeichnen (K2 Schritt 8, K2-1)
  unterzeichnenTitel: 'Projektvertrag unterzeichnen',
  anlass: { initial: 'erster Vertrag', gate: 'Gate', aenderung: 'Änderung' } as Record<string, string>,
  unterschriften: 'Unterschriften',
  stand: (n: number) => `${n} von 3`,
  unterzeichnet: 'unterzeichnet',
  verweigert: 'nicht unterzeichnet',
  ausstehend: 'ausstehend',
  inVertretung: 'in Vertretung von',
  vertretungBanner: 'Du unterzeichnest in Vertretung. Die Unterschrift trägt den Vermerk.',
  wirkungLetzte: 'Mit deiner Unterschrift ist der Vertrag vollständig unterzeichnet und geht an das zuständige Gremium.',
  wirkungWeitere: (fehlen: string) => `Danach fehlt noch die Unterschrift von ${fehlen}.`,
  unterzeichnen: 'Unterzeichnen',
  nichtUnterzeichnen: 'Nicht unterzeichnen',
  nichtFrage: 'Nicht unterzeichnen?',
  nichtWirkung: 'Der Entwurf geht zurück an die Projektleitung; die übrigen Unterschriften entfallen.',
  begruendung: 'Begründung',
  begruendungFehlt: 'Begründung fehlt: Die Projektleitung erfährt sonst nicht, was zu ändern ist.',
  abbrechen: 'Abbrechen',
  toastVollstaendig: 'Unterzeichnet. Der Vertrag ist vollständig unterzeichnet.',
  toastFehlt: (fehlen: string) => `Unterzeichnet. Es fehlt noch die Unterschrift von ${fehlen}.`,
  toastNicht: 'Nicht unterzeichnet. Die Projektleitung erhält deine Begründung.',
  keineOffene: 'Du hast für diese Version keine offene Unterschrift.',
  nichtZurUnterzeichnung: (stand: string) => `Diese Version ist ${stand}.`,
  vollstaendig: 'Der Vertrag ist vollständig unterzeichnet.',
} as const;
