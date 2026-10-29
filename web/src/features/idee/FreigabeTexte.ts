/**
 * Texte für die Freigabe der Initialisierung (AP-E4-3, Kernablauf K4 Schritte 8–10; Namensraum des Features «Ideen»):
 * Anrede «Du», Schweizer Rechtschreibung; Wirkung vor der Handlung (I-R1) mit den Texten aus K4.
 */
export const TF = {
  // Initialisierung vor dem Entscheid (UC-001 A6, UX-E12)
  vorab: {
    aktion: 'Initialisierung jetzt starten',
    frage: 'Initialisierung vor dem Entscheid starten?',
    wirkung: 'Das Projekt entsteht in Phase P0 mit Projektauftraggeber:in und Projektleitung, mit dem Vermerk «Initialisierung nicht freigegeben». Der Entscheid bleibt offen; lehnt das Gremium ab, läuft das Projekt weiter und die Projektleitung wird informiert.',
    erledigt: 'Initialisierung gestartet, Entscheid offen.',
  },
  titel: 'Entscheid über die Initialisierung',
  ohneKategorie: 'Ordne zuerst die Kategorie zu; sie bestimmt, wer über die Initialisierung entscheidet.',
  zustaendig: (wer: string) => `Zuständig: ${wer}`,

  // Gremium (Kategorie A, B; UC-001 Schritt 6)
  sponsor: 'Sponsor',
  projektleitung: 'Projektleitung',
  angabenHilfe: 'Das Gremium benennt den Sponsor, der Sponsor die Projektleitung. Erfasse beide vor dem Entscheid; ohne sie lässt sich die Initialisierung nicht freigeben.',
  sponsorFehlt: 'Sponsor fehlt: Benenne den Sponsor, er trägt das Projekt.',
  plFehlt: 'Projektleitung fehlt: Die Projektleitung erhält die Aufgabe «Projektvertrag erstellen».',
  angabenSpeichern: 'Sponsor und Projektleitung speichern',
  traktandieren: 'Für das Gremium traktandieren',
  traktandierenWirkung: (gremium: string) => `Die Idee erscheint als Vorschlag in der nächsten Sitzung von ${gremium}; die antragstellende Person wird informiert.`,
  vorgelegt: (gremium: string) => `Dem Gremium ${gremium} vorgelegt. Der Entscheid fällt in der Sitzung.`,
  zurueckgestellt: 'Vom Gremium zurückgestellt. Die Idee kommt in der nächsten Sitzung erneut zum Entscheid.',

  // Direktion (Kategorie C; UC-001 A4)
  uebergeben: (direktion: string) => `Der ${direktion} übergeben`,
  uebergebenWirkung: (direktion: string) => `Die ${direktion} erhält im Eingang «Initialisierung freigeben»; die antragstellende Person wird informiert.`,
  beiDirektion: (direktion: string) => `Bei der ${direktion} zur Freigabe.`,
  freigeben: 'Initialisierung freigeben',
  freigebenWirkung: (titel: string) => `Das Projekt «${titel}» entsteht in Phase P0 mit den Angaben der Idee. Die antragstellende Person wird informiert. Die Projektleitung erhält die Aufgabe «Projektvertrag erstellen».`,
  begruendung: 'Begründung',
  optional: 'optional',
  zurueckweisen: 'Zurückweisen',
  zurueckweisenFrage: (titel: string) => `Initialisierung von «${titel}» zurückweisen?`,
  begruendungFehlt: 'Begründung fehlt: Die antragstellende Person erfährt sonst nicht, warum die Idee nicht weiterverfolgt wird.',
  zurueckweisenWirkung: 'Die Idee wird mit Stand «zurückgewiesen» geschlossen; die antragstellende Person erhält deine Begründung.',

  // Ergebnis (K4 Schritt 10)
  freigegeben: (nummer: string, name: string) => `Initialisierung freigegeben: Projekt ${nummer} ${name} in Phase P0.`,
  zumProjekt: 'Zum Projekt',
  gespeichert: 'Gespeichert.',
  vorgelegtToast: 'Zum Entscheid vorgelegt.',
  freigegebenToast: 'Initialisierung freigegeben.',
  zurueckgewiesenToast: 'Idee zurückgewiesen.',
  konflikt: 'Die Idee wurde inzwischen geändert. Lade sie neu und wiederhole die Aktion.',
};
