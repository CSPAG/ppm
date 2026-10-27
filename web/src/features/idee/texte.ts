/**
 * Texte des Features «Ideen» (Namensraum je Feature, docs/fachmodell.md 7.2) nach Kernablauf K4: Anrede «Sie» (UX-E7),
 * Schweizer Rechtschreibung, Status für Antragstellende in Klartext, Sperren nach I-P2 (was fehlt, warum, was tun).
 */
export const TI = {
  bereich: 'Ideen',
  titel: 'Meine Ideen',
  sub: 'Ihre Projektideen und wo sie stehen. Die Unternehmensentwicklung prüft jede eingereichte Idee.',
  einreichen: 'Projektidee einreichen',
  leer: 'Sie haben noch keine Idee eingereicht. Ideen für Projekte nimmt die Unternehmensentwicklung jederzeit entgegen.',
  spalten: { nummer: 'Nr.', titel: 'Idee', stand: 'Stand', geaendert: 'Zuletzt' },
  ohneTitel: 'Idee ohne Titel',
  weiter: 'Weiter bearbeiten',
  rueckfragenOffen: (n: number) => (n === 1 ? '1 Rückfrage offen' : `${n} Rückfragen offen`),

  // Stand in Klartext (K4 «Texte») und letztes Ereignis
  stand: {
    entwurf: 'Entwurf', eingereicht: 'eingereicht', in_pruefung: 'in Prüfung', in_ergaenzung: 'in Ergänzung', traktandiert: 'dem Gremium vorgelegt',
    freigegeben: 'freigegeben', zurueckgestellt: 'zurückgestellt', zurueckgewiesen: 'zurückgewiesen', zusammengefuehrt: 'zusammengeführt',
  } as Record<string, string>,
  seit: (datum: string) => `seit ${datum}`,
  zuletzt: (datum: string) => `zuletzt bearbeitet ${datum}`,

  // Assistent (Seitentyp Assistent, 4 Schritte)
  neu: 'Neue Projektidee',
  idee: (nr: number) => `Idee ${nr}`,
  schritt: (n: number, von: number, name: string) => `Schritt ${n} von ${von}: ${name}`,
  schritte: ['Worum geht es?', 'Bezug zur Strategie', 'Erste Einschätzung', 'Zusammenfassung'],
  zurueck: 'Zurück',
  weiterSchritt: 'Weiter',
  gespeichert: 'Entwurf gespeichert',
  speichert: 'wird gespeichert …',
  nichtGespeichert: 'Entwurf nicht gespeichert. Ihre Eingaben bleiben hier; versuchen Sie es erneut.',
  erneutSpeichern: 'Erneut speichern',
  verwerfen: 'Entwurf verwerfen',
  verwerfenFrage: (titel: string) => `Entwurf «${titel}» verwerfen? Die Angaben gehen verloren.`,
  verworfen: 'Entwurf verworfen.',
  optional: 'optional',

  // Entwurf anbieten (K4 Abnahme: abgebrochener Assistent bietet den Entwurf an)
  entwurfVorhanden: 'Sie haben einen Entwurf, den Sie noch nicht eingereicht haben.',
  entwurfFortsetzen: 'Entwurf fortsetzen',
  neuBeginnen: 'Neue Idee beginnen',

  // Schritt 1
  titelFeld: 'Titel',
  titelHilfe: 'Ein kurzer Name, unter dem die Idee im Ideenpool erscheint. Beispiel: «Digitale Patientenaufnahme».',
  ausgangslage: 'Ausgangslage',
  ausgangslageHilfe: 'Was ist heute, und was stört daran? Beispiel: «Die Aufnahme erfolgt auf Papier; Angaben werden doppelt erfasst.»',
  zielsetzung: 'Zielsetzung',
  zielsetzungHilfe: 'Was soll erreicht werden? Beispiel: «Die Aufnahme dauert ohne Papier höchstens 10 Minuten.»',

  // Schritt 2
  handlungsfeld: 'Handlungsfeld',
  handlungsfeldHilfe: 'Zu welchem strategischen Handlungsfeld passt die Idee am besten?',
  ziel: 'Strategisches Ziel',
  zielHilfe: 'Auf welches Ziel des Handlungsfelds zahlt die Idee ein?',
  keinZiel: 'Kein bestimmtes Ziel',
  keineZiele: 'Zu diesem Handlungsfeld sind keine strategischen Ziele erfasst.',
  keineHandlungsfelder: 'Es sind noch keine Handlungsfelder erfasst. Speichern Sie Ihren Entwurf; einreichen können Sie, sobald die Unternehmensentwicklung die Handlungsfelder erfasst hat.',
  bereiche: 'Betroffene Bereiche',
  bereicheHilfe: 'Welche Bereiche der Organisation sind betroffen? Mehrfachauswahl.',
  keineBereiche: 'Es sind noch keine Bereiche erfasst.',
  herkunft: 'Herkunft der Idee',
  herkunftHilfe: 'Woher stammt die Idee?',

  // Schritt 3
  stufen: { hoch: 'hoch', mittel: 'mittel', tief: 'tief' } as Record<string, string>,
  nutzen: 'Nutzen', nutzenHilfe: 'Wie gross ist der Nutzen für Patientinnen, Patienten, Mitarbeitende oder die Organisation?',
  aufwand: 'Aufwand', aufwandHilfe: 'Wie viel Aufwand erwarten Sie, grob geschätzt?',
  relevanz: 'Relevanz', relevanzHilfe: 'Wie wichtig ist die Idee für die Strategie und den Betrieb?',
  begruendung: 'Begründung in einem Satz',

  // Schritt 4
  zusammenfassung: 'Prüfen Sie Ihre Angaben, bevor Sie die Idee einreichen.',
  wirkung: 'Die Unternehmensentwicklung erhält Ihre Idee zur Prüfung. Sie sehen den Stand jederzeit unter «Meine Ideen».',
  wirkungErneut: 'Die Unternehmensentwicklung erhält Ihre Ergänzungen und prüft die Idee erneut. Sie sehen den Stand jederzeit unter «Meine Ideen».',
  aendern: 'Ändern',
  leerWert: 'nicht angegeben',
  erneutEinreichen: 'Erneut einreichen',
  fehlenTitel: 'Angaben fehlen',
  zuSchritt: (n: number) => `Zu Schritt ${n}`,

  // Bestätigung
  eingereicht: 'Ihre Idee ist eingereicht.',
  bestaetigung: 'Ihre Idee ist eingereicht. Die Unternehmensentwicklung prüft sie und meldet sich bei Rückfragen. Den Stand sehen Sie unter «Meine Ideen».',
  zuMeinenIdeen: 'Zu «Meine Ideen»',
  weitereIdee: 'Weitere Idee einreichen',

  // Rückfragen (UC-001 A2.2)
  rueckfragenTitel: 'Rückfragen der Unternehmensentwicklung',
  rueckfragenBanner: (n: number) => `Die Unternehmensentwicklung hat ${n === 1 ? 'eine Rückfrage' : `${n} Rückfragen`} zu Ihrer Idee. Ergänzen Sie die Angaben und reichen Sie die Idee erneut ein.`,
  rueckfrage: 'Rückfrage',
  antwort: 'Ihre Antwort',
  antwortGespeichert: 'Antwort gespeichert.',
  beantwortet: 'beantwortet',
  allgemein: 'Zur Idee allgemein',

  // Ansicht (Z8 nur lesen)
  nurLesen: 'Die Idee ist eingereicht. Ändern können Sie sie, wenn die Unternehmensentwicklung Rückfragen stellt.',
  zusammengefuehrt: 'Diese Idee wurde mit einer anderen Idee zusammengeführt und wird dort weiterverfolgt.',
  zurueckgewiesen: 'Die Unternehmensentwicklung verfolgt diese Idee nicht weiter.',
  begruendungZurueckweisung: 'Begründung',
  eingereichtAm: 'Eingereicht',
  nichtGefunden: 'Diese Idee gibt es nicht, oder Sie sehen sie nicht.',
  zurListe: 'Zu «Meine Ideen»',
  konflikt: 'Die Idee wurde inzwischen an anderer Stelle geändert, zum Beispiel in einem zweiten Fenster. Laden Sie sie neu und übernehmen Sie Ihre letzten Änderungen danach nochmals.',
  neuLaden: 'Neu laden',

  // Kopfkarte im Eingang
  kopfTitel: 'Ideen',
  kopfEntwurf: (n: number) => (n === 1 ? '1 Entwurf' : `${n} Entwürfe`),
  kopfErgaenzung: (n: number) => `${n} in Ergänzung`,
  kopfLaufend: (n: number) => `${n} in Bearbeitung`,
  kopfZuPruefen: (n: number) => `${n} zu prüfen`,
  kopfLeer: 'Haben Sie eine Idee für ein Projekt?',
};

/** Pflichtfelder je Schritt mit Text der Sperre (K4 «Regeln und Rückmeldungen»; verbindlich prüft der Server, I-P6). */
export const PFLICHT = {
  titel: 'Titel fehlt: Geben Sie der Idee einen kurzen Namen, unter dem sie im Ideenpool erscheint.',
  ausgangslage: 'Ausgangslage fehlt: Beschreiben Sie, was heute ist und was daran stört.',
  zielsetzung: 'Zielsetzung fehlt: Ohne Ziel kann die Unternehmensentwicklung die Idee nicht einordnen. Beschreiben Sie in zwei, drei Sätzen, was erreicht werden soll.',
  handlungsfeldId: 'Handlungsfeld fehlt: Wählen Sie das Handlungsfeld, zu dem die Idee am besten passt.',
  nutzen: 'Nutzen fehlt: Schätzen Sie den Nutzen als hoch, mittel oder tief ein.',
  aufwand: 'Aufwand fehlt: Schätzen Sie den Aufwand als hoch, mittel oder tief ein.',
  relevanz: 'Relevanz fehlt: Schätzen Sie die Relevanz als hoch, mittel oder tief ein.',
} as const;
