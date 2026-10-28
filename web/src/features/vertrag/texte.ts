/**
 * Texte des Features «Projektvertrag» (Namensraum des Features, fachmodell.md 7.2; Kernablauf K2): Anrede «Sie»,
 * Schweizer Rechtschreibung, Begriffe nach docs/ux/darstellung.md und der Vorlage Projektvertrag (Q7).
 */
type Stand = 'in_arbeit' | 'in_pruefung' | 'zur_unterzeichnung' | 'unterzeichnet' | 'traktandiert' | 'abgenommen' | 'abgelehnt' | 'verworfen' | 'zurueckgezogen';
type Anlass = 'initial' | 'gate' | 'aenderung';

export const TV = {
  reiter: 'Vertrag',
  reiterVersionen: 'Versionen',
  titel: 'Projektvertrag',
  kapitel: 'Kapitel',
  kapitelWahl: 'Kapitel wählen',
  seitenpanel: 'Seitenpanel',
  version: (nummer: string) => `Version ${nummer}`,
  versionFuer: (nummer: string, phase: string) => `Version ${nummer} für ${phase}`,
  anlass: { initial: 'erster Vertrag', gate: 'Gate', aenderung: 'Änderung' } satisfies Record<Anlass, string>,
  stand: {
    in_arbeit: 'in Arbeit', in_pruefung: 'in Prüfung', zur_unterzeichnung: 'zur Unterzeichnung', unterzeichnet: 'unterzeichnet',
    traktandiert: 'traktandiert', abgenommen: 'abgenommen', abgelehnt: 'abgelehnt', verworfen: 'verworfen', zurueckgezogen: 'zurückgezogen',
  } satisfies Record<Stand, string>,
  baseline: 'Baseline',
  geaendert: 'geändert gegenüber der Baseline',
  fehlt: (n: number) => (n === 1 ? '1 Angabe fehlt' : `${n} Angaben fehlen`),

  // Zustände (K2 «Zustände», Z2, Z8, Z9)
  leer: 'Für dieses Projekt gibt es noch keinen Projektvertrag. Die Projektleitung erstellt ihn nach der Freigabe der Initialisierung.',
  anlegen: 'Projektvertrag erstellen',
  legtAn: 'Der Projektvertrag wird angelegt …',
  nurLesen: 'Sie sehen den Projektvertrag. Ändern kann ihn die Projektleitung, solange der Entwurf in Arbeit ist.',
  inPruefung: (datum: string) => `In Prüfung bei der Unternehmensentwicklung seit ${datum}. Bis zum Ergebnis ist der Entwurf gesperrt.`,
  gesperrt: (stand: string) => `Diese Version ist ${stand} und kann nicht mehr bearbeitet werden.`,
  baselineSeit: (nummer: string, datum: string) => `Version ${nummer} ist seit ${datum} Baseline.`,
  ohneBetraege: 'Beträge sehen Sie nur mit Recht auf Beträge; dieses Kapitel können Sie darum nicht bearbeiten.',

  // Speichern (I-R3), Rückgängig, Konflikt (Z7)
  speichert: 'Wird gespeichert …',
  gespeichert: 'Gespeichert',
  gespeichertVor: (s: number) => (s < 5 ? 'Gespeichert' : `Gespeichert vor ${s < 60 ? `${Math.floor(s / 5) * 5} s` : `${Math.floor(s / 60)} min`}`),
  ungespeichert: 'Nicht gespeichert: Prüfen Sie die markierten Felder.',
  fehlerSpeichern: 'Ihre Änderungen sind noch nicht gespeichert.',
  erneutSpeichern: 'Erneut speichern',
  rueckgaengig: 'Rückgängig',
  wiederholen: 'Wiederholen',
  rueckgaengigTitel: 'Rückgängig (Strg+Z)',
  wiederholenTitel: 'Wiederholen (Strg+Umschalt+Z)',
  konflikt: (kapitel: number) => `Kapitel ${kapitel} wurde inzwischen von jemand anderem geändert. Neu laden – Ihre Änderungen bleiben erhalten.`,
  konfliktLaden: 'Neu laden, meine Änderungen behalten',
  konfliktVerwerfen: 'Stand der anderen übernehmen',

  // Seitenpanel: Pflichtangaben (I-P4, K2-4)
  pflicht: 'Pflichtangaben',
  pflichtFuer: (phase: string) => `für ${phase}`,
  pflichtKeine: 'Für diese Phase verlangt das Phasenmodell keine Angaben.',
  pflichtVollstaendig: 'Alle verlangten Angaben sind erfasst.',
  pflichtFehlen: (n: number, phase: string) => `${n === 1 ? '1 Angabe fehlt' : `${n} Angaben fehlen`} für ${phase}.`,
  pflichtSprung: (text: string, kapitel: number) => `${text} (Kap. ${kapitel}) ergänzen`,
  naechsteFehlende: 'Nächste fehlende Angabe (Alt+N)',
  erfuellt: 'erfasst',

  // Einreichen (K2 Schritt 6, I-R1 Stufe 3)
  einreichen: 'Zur Prüfung einreichen',
  einreichenFrage: (nummer: string) => `Version ${nummer} zur Prüfung einreichen?`,
  einreichenWirkung: 'Die Unternehmensentwicklung erhält den Quality-Check. Bis zum Ergebnis ist der Entwurf gesperrt.',
  einreichenGesperrt: (phase: string, liste: string) => `Angaben für ${phase} fehlen: ${liste}. Ergänzen Sie sie, um einzureichen.`,
  eingereicht: 'Eingereicht. Die Unternehmensentwicklung prüft den Vertrag.',
  weiterBearbeiten: 'Weiter bearbeiten',
  aenderungEinreichen: 'Eine Änderung reichen Sie beim Sponsor ein («Änderung einreichen»).',

  // Kapitelinhalte
  optional: 'optional',
  keine: 'Keine Einträge.',
  hinzufuegen: (was: string) => `${was} hinzufügen`,
  entfernen: (was: string, n: number) => `${was} ${n} entfernen`,
  zeile: (was: string, n: number) => `${was} ${n}`,
  basis: (wert: string) => `Baseline: ${wert}`,
  zielHinweis: (nummer: string) => `Das Projekt erscheint nach der Freigabe im Arbeitsraum Ziele unter Ziel ${nummer}.`,
  zielKeins: 'Kein Ziel gewählt',
  zielNichtLesbar: 'Die strategischen Ziele sehen Sie mit dem Recht «Ziele lesen».',
  abhaengigkeitHinweis: 'Die Abhängigkeit erscheint nach der Freigabe auch beim anderen Projekt.',
  organisationHinweis: 'Wer hier steht, erhält mit der Projektorganisation Zugriff auf das Projekt; die Rollen setzen Sponsor und Projektleitung in der Projektübersicht.',
  personalHinweis: 'Bis zum Gate P1–P2 genügt die Grösse S/M/L; danach braucht es FTE mit Monat von und bis je Rolle und Phase.',
  bitteWaehlen: 'Bitte wählen',
  ja: 'ja',
} as const;
