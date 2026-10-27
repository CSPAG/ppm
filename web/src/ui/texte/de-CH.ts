/**
 * Texte der Oberfläche auf Deutsch (Schweiz): Anrede «Sie» (docs/ux/README.md, UX-E7, bis zur Klärung von UX-OF-1),
 * Schweizer Rechtschreibung ohne Eszett, «Organisation» statt Mandant, Begriffe aus dem Glossar der UX-Schicht
 * (docs/ux/README.md, I-X4). `texte.test.ts` prüft diese Regeln über alle Quelldateien. Eine weitere Sprache ist eine
 * Datei daneben mit demselben Typ (`Texte`, UX-OF-2).
 */
export const deCH = {
  app: 'PPM',
  nav: {
    main: 'Navigation', bereiche: 'Bereiche', palette: 'Befehle', skip: 'Zum Inhalt springen', omni: 'Seiten und Befehle suchen …',
    mehr: 'Mehr', mehrTitel: 'Mehr', konto: 'Konto',
  },
  // Arbeitsräume nach docs/ux/informationsarchitektur.md (UX-E2)
  arbeitsraum: {
    eingang: 'Eingang', projekte: 'Projekte', portfolio: 'Portfolio', gremien: 'Gremien', ziele: 'Ziele', administration: 'Administration',
  },
  bereich: { handlungsfelder: 'Handlungsfelder' },
  aktion: { handlungsfeldAnlegen: 'Handlungsfeld anlegen' },
  // Konto unter «Mehr» auf dem Telefon (IA: Persönliches im Kontomenü)
  konto: {
    organisation: 'Organisation', keineRolle: 'keine Rolle', rechte: 'Meine Rollen und Rechte', abmelden: 'Abmelden',
    wechseln: (org: string) => `Zu «${org}» wechseln`,
  },
  theme: { label: 'Farbschema', light: 'Hell', dark: 'Dunkel', system: 'Wie System', toggle: 'Hell/Dunkel umschalten' },
  palette: {
    title: 'Befehle', placeholder: 'Seite, Aktion oder Objekt suchen …', empty: 'Nichts gefunden.', hint: 'Strg+K',
    seiten: 'Seiten', aktionen: 'Aktionen', treffer: 'Treffer', darstellung: 'Darstellung', sucht: 'Suche läuft …',
    fehler: 'Die Suche ist gerade nicht möglich. Seiten und Aktionen finden Sie trotzdem.',
    anzahl: (n: number) => (n === 1 ? '1 Eintrag' : `${n} Einträge`),
  },
  common: {
    save: 'Speichern', cancel: 'Abbrechen', close: 'Schliessen', delete: 'Löschen', edit: 'Bearbeiten', retry: 'Erneut versuchen',
    reload: 'Neu laden', more: 'Mehr laden', loading: 'Wird geladen …', search: 'Suchen', error: 'Etwas ist schiefgegangen.',
  },
  // Zustände einer Liste (docs/ux/rahmen/interaktion.md, Abschnitt 6)
  liste: {
    leerGefiltert: 'Nichts passt zu Ihrer Suche.', filterZuruecksetzen: 'Filter zurücksetzen', oeffnen: (name: string) => `${name} öffnen`,
  },
  // Formate nach docs/ux/darstellung.md (de-CH, Q-S2)
  format: {
    wochentage: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
    monate: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
    monateKurz: ['Jan', 'Feb', 'Mrz', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
    heute: 'heute', morgen: 'morgen',
    inTagen: (n: number) => `in ${n} Tagen`,
    inArbeitstagen: (n: number) => (n === 1 ? 'in 1 Arbeitstag' : `in ${n} Arbeitstagen`),
    heuteArbeitstag: 'heute',
    ueberfaellig: (datum: string) => `überfällig seit ${datum}`,
    mio: 'Mio.', tsd: 'Tsd.', fte: 'FTE', woche: 'Woche', wochen: 'Wochen',
  },
  // Phasenmodell (PPM-Master.md, Abschnitt Phasenmodell; Schreibweise nach docs/ux/darstellung.md)
  phase: {
    'Pre-P0': 'Ideen', P0: 'Initialisierung', P1: 'Konzept und Planung', P2: 'Implementierung', P3: 'Stabilisierung und Monitoring', P4: 'Abschluss',
  } as Record<string, string>,
  gate: { gate: 'Gate', eintritt: 'Eintritt', exit: 'Exit' },
  // Projektstatus und Trend (Q8 Kap. 9, AM.02.02; darstellung.md)
  status: {
    'im-plan': 'Im Plan', kritisch: 'Kritisch', 'nicht-gemeldet': 'Nicht gemeldet',
    vorperiode: (s: string) => `Vorperiode ${s}`,
    trend: { auf: 'Trend aufwärts', gleich: 'Trend gleichbleibend', ab: 'Trend abwärts' },
  },
  stand: {
    wartetAuf: (wer: string) => `wartet auf ${wer}`,
    traktandiert: (gremium: string, datum: string) => `traktandiert ${gremium} ${datum}`,
  },
  projekt: {
    nummer: 'Nummer', name: 'Projekt', handlungsfeld: 'Handlungsfeld', thema: 'Thema', projektleitung: 'Projektleitung', phase: 'Phase',
    meilenstein: 'Nächster Meilenstein', status: 'Status', vorperiode: 'Vorperiode', trend: 'Trend',
    abschlussPer: (datum: string) => `Abschluss per ${datum}`,
    merkmal: { 'sns-vr': 'via SNS-VR', eskalation: 'Eskalation offen' },
    keinMeilenstein: 'kein Meilenstein geplant',
  },
  // Regelprüfung (I-P1 bis I-P6)
  regel: {
    stufe: { hinweis: 'Hinweis', warnung: 'Warnung', sperre: 'Sperre' },
    statt: 'statt', quelle: 'Quelle der Regel',
  },
  notFound: { title: 'Seite nicht gefunden', text: 'Diese Seite gibt es nicht (mehr). Prüfen Sie die Adresse oder kehren Sie zur Übersicht zurück.', back: 'Zur Übersicht' },
  handlungsfeld: {
    title: 'Handlungsfelder', sub: 'Strategische Handlungsfelder mit Leitsatz und Stossrichtungen, oberste Ordnung für Ziele und Vorhaben.', one: 'Handlungsfeld', create: 'Neues Handlungsfeld', search: 'Handlungsfelder durchsuchen',
    empty: 'Noch keine Handlungsfelder erfasst. Die Handlungsfelder der Strategie ordnen Ziele und Vorhaben.',
    emptySearch: 'Kein Handlungsfeld passt zur Suche.',
    label: 'Bezeichnung', leitsatz: 'Leitsatz', stossrichtungen: 'Stossrichtungen', position: 'Reihenfolge',
    stossrichtungenHint: 'Eine Stossrichtung je Zeile.', noLeitsatz: 'kein Leitsatz', noStossrichtungen: 'keine Stossrichtungen',
    created: 'Handlungsfeld angelegt.', saved: 'Änderungen gespeichert.', deleted: 'Handlungsfeld gelöscht.',
    confirmDelete: (label: string) => `«${label}» wirklich löschen? Der Verlauf bleibt im Protokoll erhalten.`,
    conflict: 'Dieses Handlungsfeld wurde inzwischen geändert. Laden Sie es neu und übernehmen Sie Ihre Änderungen danach nochmals.',
    gone: 'Dieses Handlungsfeld gibt es nicht mehr, oder Sie sehen es nicht.',
    history: 'Verlauf', version: (v: number) => `Fassung ${v}`,
    actions: { created: 'angelegt', updated: 'geändert', deleted: 'gelöscht' } as Record<string, string>,
    noRight: 'Sie können Handlungsfelder nur ansehen.',
    labelMissing: 'Geben Sie eine Bezeichnung ein.', tooMany: 'Höchstens 20 Stossrichtungen.', positionInvalid: 'Ganze Zahl von 0 bis 999.',
  },
};
