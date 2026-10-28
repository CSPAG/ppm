/**
 * Texte der Freigabe der Jahresziele (UI-39, K6 Schritte 6–7; eigene Datei von AP-E6-2): Anrede «Du», Schweizer
 * Rechtschreibung, Schaltflächen aus K6 «Texte».
 */
export const TF = {
  titel: (jahr: number) => `Jahresziele ${jahr} zur Freigabe`,
  vorlegen: 'Zur Freigabe vorlegen',
  erfassen: 'Freigabe erfassen',
  zurueck: 'Zurück',
  weiter: 'Weiter',
  zumZyklus: (jahr: number) => `Zum Zielzyklus ${jahr}`,
  schritte: ['Prüfung', 'Zusammenfassung', 'Vorlegen'],
  schritt: (n: number, von: number) => `Schritt ${n} von ${von}`,
  // Prüfung (K6 Regeln)
  pruefungOk: 'Alle Jahresziele haben Metrik und Zielwert.',
  metrikFehlt: (nummern: string[]) => `Metrik fehlt: ${nummern.length === 1 ? '1 Jahresziel hat' : `${nummern.length} Jahresziele haben`} keine Metrik oder keinen Zielwert (${nummern.join(', ')}). Ergänze Metrik und Zielwert.`,
  ohneUmsetzung: (nummer: string) => `Jahresziel ${nummer} hat noch keine Hauptaktivität und kein Projekt.`,
  zumZiel: (nummer: string) => `Zu Jahresziel ${nummer}`,
  leer: 'Der Zielzyklus hat noch keine Jahresziele. Füge zuerst Jahresziele hinzu.',
  // Zusammenfassung
  zusammenfassung: 'Jahresziele je Handlungsfeld',
  handlungsfeld: 'Handlungsfeld', anzahl: (jahr: number) => `Jahresziele ${jahr}`, vorjahr: (jahr: number) => `Vorjahr ${jahr}`,
  ohneHandlungsfeld: 'Handlungsfeld nicht sichtbar',
  total: 'Total',
  keinVorjahr: (jahr: number) => `Für ${jahr} gibt es keinen Zielzyklus zum Vergleich.`,
  drucken: 'Zusammenfassung drucken',
  // Wirkung (I-F5, I-R1 Stufe 3)
  wirkungVorlegen: (n: number) => `${n === 1 ? '1 Jahresziel wird' : `${n} Jahresziele werden`} «zur Freigabe» gesetzt und ${n === 1 ? 'ist' : 'sind'} bis zum Entscheid des VR gesperrt. Die Aufgabe «Jahresziele vervollständigen» ist damit erledigt.`,
  vorgelegt: (jahr: number) => `Jahresziele ${jahr} liegen dem VR zur Freigabe vor.`,
  // Freigabe erfassen (UE)
  erfassenSub: 'Der VR ist kein Benutzer: Erfasse seinen Entscheid.',
  datum: 'Datum des Entscheids',
  entscheid: 'Entscheid des VR',
  freigegeben: 'Freigegeben',
  anpassungen: 'Anpassungen verlangt',
  text: 'Rückmeldungen des VR',
  textOptional: '(optional)',
  textFehlt: 'Erfasse, welche Anpassungen der VR verlangt.',
  datumFehlt: 'Gib das Datum des Entscheids ein.',
  wirkungFreigegeben: (jahr: number) => `Die Jahresziele ${jahr} treten in Kraft. Danach kannst du die Roadmap ${jahr} publizieren.`,
  wirkungAnpassungen: (jahr: number) => `Die Jahresziele ${jahr} gehen zurück auf «in Arbeit». Die Geschäftsleitung erhält die Aufgabe «Jahresziele ${jahr} anpassen».`,
  erfasst: { freigegeben: (jahr: number) => `Jahresziele ${jahr} in Kraft gesetzt.`, anpassungen: (jahr: number) => `Jahresziele ${jahr} zur Anpassung zurückgegeben.` },
  // anderer Stand
  nichtsZuTun: { in_arbeit: (jahr: number) => `Die Jahresziele ${jahr} sind in Arbeit. Vorlegen kann die Geschäftsleitung.`, zur_freigabe: (jahr: number) => `Die Jahresziele ${jahr} liegen dem VR zur Freigabe vor. Den Entscheid erfasst die Unternehmensentwicklung.`, in_kraft: (jahr: number) => `Die Jahresziele ${jahr} sind in Kraft.` } as Record<string, (jahr: number) => string>,
  konflikt: 'Der Zielzyklus wurde inzwischen geändert. Lade die Seite neu und prüfe den Stand.',
  neuLaden: 'Neu laden',
};
