/**
 * Texte des Features «Ideen» (Namensraum je Feature, docs/fachmodell.md 7.2) nach Kernablauf K4: Anrede «Du» (UX-E7),
 * Schweizer Rechtschreibung, Status für Antragstellende in Klartext, Sperren nach I-P2 (was fehlt, warum, was tun).
 */
import { NAV } from './nav.ts';

export const TI = {
  bereich: NAV.bereich,
  titel: 'Meine Ideen',
  sub: 'Deine Projektideen und wo sie stehen. Die Unternehmensentwicklung prüft jede eingereichte Idee.',
  einreichen: NAV.einreichen,
  leer: 'Du hast noch keine Idee eingereicht. Ideen für Projekte nimmt die Unternehmensentwicklung jederzeit entgegen.',
  spalten: { nummer: 'Nr.', titel: 'Idee', stand: 'Stand', geaendert: 'Zuletzt' },
  ohneTitel: 'Idee ohne Titel',
  weiter: 'Weiter bearbeiten',
  rueckfragenOffen: (n: number) => (n === 1 ? '1 Rückfrage offen' : `${n} Rückfragen offen`),

  // Stand in Klartext (K4 «Texte») und letztes Ereignis
  stand: {
    entwurf: 'Entwurf', eingereicht: 'eingereicht', in_pruefung: 'in Prüfung', in_ergaenzung: 'in Ergänzung', traktandiert: 'dem Gremium vorgelegt',
    freigegeben: 'freigegeben', zurueckgestellt: 'zurückgestellt', zurueckgewiesen: 'zurückgewiesen', zusammengefuehrt: 'zusammengeführt',
  } as Record<string, string>,
  // eingereichte Ideen aller Mitglieder (Master Entscheid 14) und ähnliche Ideen beim Ausfüllen (K4 Schritt 2)
  ansichten: { meine: 'Meine Ideen', eingereicht: 'Eingereichte Ideen' },
  ansichtLabel: 'Ansicht',
  alleEingereichten: {
    titel: 'Eingereichte Ideen',
    sub: 'Alle eingereichten Projektideen der Organisation mit ihrem Stand. Die Prüfung der Unternehmensentwicklung siehst du nur bei deinen eigenen.',
    leer: 'Noch niemand hat eine Idee eingereicht.',
  },
  aehnlich: {
    titel: (n: number) => (n === 1 ? '1 ähnliche Idee im Ideenpool ansehen' : `${n} ähnliche Ideen im Ideenpool ansehen`),
    erklaerung: 'Eingereichte Ideen mit gleichem Handlungsfeld oder gleichen Bereichen. Vielleicht gibt es schon etwas, an das du anknüpfen kannst; die Ideen öffnen in einem neuen Tab.',
    gleichesFeld: 'gleiches Handlungsfeld',
    bereiche: (n: number) => (n === 1 ? '1 gemeinsamer Bereich' : `${n} gemeinsame Bereiche`),
  },
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
  nichtGespeichert: 'Entwurf nicht gespeichert. Deine Eingaben bleiben hier; versuche es erneut.',
  erneutSpeichern: 'Erneut speichern',
  verwerfen: 'Entwurf verwerfen',
  verwerfenFrage: (titel: string) => `Entwurf «${titel}» verwerfen? Die Angaben gehen verloren.`,
  verworfen: 'Entwurf verworfen.',
  optional: 'optional',

  // Entwurf anbieten (K4 Abnahme: abgebrochener Assistent bietet den Entwurf an)
  entwurfVorhanden: 'Du hast einen Entwurf, den du noch nicht eingereicht hast.',
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
  keineHandlungsfelder: 'Es sind noch keine Handlungsfelder erfasst. Speichere deinen Entwurf; einreichen kannst du, sobald die Unternehmensentwicklung die Handlungsfelder erfasst hat.',
  bereiche: 'Betroffene Bereiche',
  bereicheHilfe: 'Welche Bereiche der Organisation sind betroffen? Mehrfachauswahl.',
  keineBereiche: 'Es sind noch keine Bereiche erfasst.',
  herkunft: 'Herkunft der Idee',
  herkunftHilfe: 'Woher stammt die Idee?',

  // Schritt 3
  stufen: { hoch: 'hoch', mittel: 'mittel', tief: 'tief' } as Record<string, string>,
  nutzen: 'Nutzen', nutzenHilfe: 'Wie gross ist der Nutzen für Patientinnen, Patienten, Mitarbeitende oder die Organisation?',
  aufwand: 'Aufwand', aufwandHilfe: 'Wie viel Aufwand erwartest du, grob geschätzt?',
  relevanz: 'Relevanz', relevanzHilfe: 'Wie wichtig ist die Idee für die Strategie und den Betrieb?',
  begruendung: 'Begründung in einem Satz',

  // Schritt 4
  zusammenfassung: 'Prüfe deine Angaben, bevor du die Idee einreichst.',
  wirkung: 'Die Unternehmensentwicklung erhält deine Idee zur Prüfung. Du siehst den Stand jederzeit unter «Meine Ideen».',
  wirkungErneut: 'Die Unternehmensentwicklung erhält deine Ergänzungen und prüft die Idee erneut. Du siehst den Stand jederzeit unter «Meine Ideen».',
  aendern: 'Ändern',
  leerWert: 'nicht angegeben',
  erneutEinreichen: 'Erneut einreichen',
  fehlenTitel: 'Angaben fehlen',
  zuSchritt: (n: number) => `Zu Schritt ${n}`,

  // Bestätigung
  eingereicht: 'Deine Idee ist eingereicht.',
  bestaetigung: 'Deine Idee ist eingereicht. Die Unternehmensentwicklung prüft sie und meldet sich bei Rückfragen. Den Stand siehst du unter «Meine Ideen».',
  zuMeinenIdeen: 'Zu «Meine Ideen»',
  weitereIdee: 'Weitere Idee einreichen',

  // Rückfragen (UC-001 A2.2)
  rueckfragenTitel: 'Rückfragen der Unternehmensentwicklung',
  rueckfragenBanner: (n: number) => `Die Unternehmensentwicklung hat ${n === 1 ? 'eine Rückfrage' : `${n} Rückfragen`} zu deiner Idee. Ergänze die Angaben und reiche die Idee erneut ein.`,
  rueckfrage: 'Rückfrage',
  antwort: 'Deine Antwort',
  antwortGespeichert: 'Antwort gespeichert.',
  beantwortet: 'beantwortet',
  allgemein: 'Zur Idee allgemein',

  // Ansicht (Z8 nur lesen)
  nurLesen: 'Die Idee ist eingereicht. Ändern kannst du sie, wenn die Unternehmensentwicklung Rückfragen stellt.',
  zusammengefuehrt: 'Diese Idee wurde mit einer anderen Idee zusammengeführt und wird dort weiterverfolgt.',
  zurueckgewiesen: 'Die Unternehmensentwicklung verfolgt diese Idee nicht weiter.',
  begruendungZurueckweisung: 'Begründung',
  eingereichtAm: 'Eingereicht',
  nichtGefunden: 'Diese Idee gibt es nicht, oder du siehst sie nicht.',
  zurListe: 'Zu «Meine Ideen»',
  konflikt: 'Die Idee wurde inzwischen an anderer Stelle geändert, zum Beispiel in einem zweiten Fenster. Lade sie neu und übernimm deine letzten Änderungen danach nochmals.',
  neuLaden: 'Neu laden',

  // Kopfkarte im Eingang
  kopfTitel: 'Ideen',
  kopfEntwurf: (n: number) => (n === 1 ? '1 Entwurf' : `${n} Entwürfe`),
  kopfErgaenzung: (n: number) => `${n} in Ergänzung`,
  kopfLaufend: (n: number) => `${n} in Bearbeitung`,
  kopfZuPruefen: (n: number) => `${n} zu prüfen`,
  auswahlLaden: 'Die Auswahl (Handlungsfelder, Bereiche, Herkunft)',
  kopfLeer: 'Hast du eine Idee für ein Projekt?',
};

/** Pflichtfelder je Schritt mit Text der Sperre (K4 «Regeln und Rückmeldungen»; verbindlich prüft der Server, I-P6). */
export const PFLICHT = {
  titel: 'Titel fehlt: Gib der Idee einen kurzen Namen, unter dem sie im Ideenpool erscheint.',
  ausgangslage: 'Ausgangslage fehlt: Beschreibe, was heute ist und was daran stört.',
  zielsetzung: 'Zielsetzung fehlt: Ohne Ziel kann die Unternehmensentwicklung die Idee nicht einordnen. Beschreibe in zwei, drei Sätzen, was erreicht werden soll.',
  handlungsfeldId: 'Handlungsfeld fehlt: Wähle das Handlungsfeld, zu dem die Idee am besten passt.',
  nutzen: 'Nutzen fehlt: Schätze den Nutzen als hoch, mittel oder tief ein.',
  aufwand: 'Aufwand fehlt: Schätze den Aufwand als hoch, mittel oder tief ein.',
  relevanz: 'Relevanz fehlt: Schätze die Relevanz als hoch, mittel oder tief ein.',
} as const;
