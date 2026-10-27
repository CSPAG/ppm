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
  bereich: { handlungsfelder: 'Handlungsfelder', phasenmodell: 'Phasenmodell' },
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
  // Administration › Phasenmodell (UI-46, BC AM.02.03, UC-017 Schritte 3 und 5)
  phasenmodell: {
    title: 'Phasenmodell', sub: 'Phasen, Gates mit Leitfragen je Wertestrom, Standard-Ergebnisse, Pflichtangaben, Fristen und Toleranzen nach dem PM-Handbuch.',
    leer: 'Noch kein Phasenmodell. Laden Sie die Vorgabe des PM-Handbuchs als Entwurf und passen Sie sie an.',
    leerLesen: 'Noch kein Phasenmodell in Kraft. Die Unternehmensentwicklung legt es fest.',
    vorgabeLaden: 'Vorgabe des PM-Handbuchs laden', entwurfAnlegen: 'Entwurf anlegen', entwurfOeffnen: 'Entwurf öffnen',
    verwerfen: 'Entwurf verwerfen', inKraftSetzen: 'In Kraft setzen', weiterBearbeiten: 'Weiter bearbeiten',
    version: (n: number) => `Version ${n}`, versionen: 'Versionen', versionWaehlen: 'Version wählen', versionLabel: 'Version', standLabel: 'Stand',
    fristSpalte: 'Frist', toleranzSpalte: 'Dimension',
    stand: { entwurf: 'Entwurf', in_kraft: 'in Kraft', abgeloest: 'abgelöst' } as Record<string, string>,
    seit: (datum: string) => `seit ${datum}`, bis: (datum: string) => `abgelöst, in Kraft ab ${datum}`,
    beschreibung: 'Was ändert sich mit dieser Version?', beschreibungHint: 'Kurz für das Änderungsprotokoll, z. B. «Toleranzen festgelegt».',
    angelegt: 'Entwurf angelegt.', verworfen: 'Entwurf verworfen.', inKraft: (n: number) => `Version ${n} ist in Kraft.`,
    gespeichert: 'Gespeichert', speichert: 'Wird gespeichert …', ungespeichert: 'Nicht gespeichert: Angaben prüfen',
    gespeichertVor: (sek: number) => (sek < 5 ? 'Gespeichert' : sek < 60 ? `Gespeichert vor ${sek} s` : `Gespeichert vor ${Math.floor(sek / 60)} min`),
    fehlerSpeichern: 'Speichern fehlgeschlagen. Ihre Änderungen sind noch hier.', erneutSpeichern: 'Erneut speichern',
    rueckgaengig: 'Rückgängig', rueckgaengigTitel: 'Rückgängig (Strg+Z)', wiederholen: 'Wiederholen', wiederholenTitel: 'Wiederholen (Strg+Umschalt+Z)',
    gesperrt: (n: number) => `Version ${n} ist in Kraft und unveränderlich. Änderungen machen Sie in einem Entwurf; er gilt erst, wenn er in Kraft gesetzt ist.`,
    abgeloestBanner: (n: number) => `Version ${n} ist abgelöst und dient nur noch der Nachvollziehbarkeit.`,
    nurLesen: 'Sie können das Phasenmodell nur ansehen. Die Unternehmensentwicklung pflegt es, Administratorinnen und Administratoren setzen es in Kraft.',
    entwurfBesteht: (n: number) => `Es besteht ein Entwurf (Version ${n}).`,
    konflikt: 'Jemand anderes hat diesen Entwurf inzwischen geändert. Ihre Änderungen sind noch hier.',
    konfliktMeine: 'Meine Fassung speichern', konfliktAndere: 'Fassung der anderen laden',
    nichtMehrEntwurf: 'Dieser Entwurf ist nicht mehr bearbeitbar (in Kraft gesetzt oder verworfen).',
    elemente: 'Inhalt des Phasenmodells', element: 'Abschnitt',
    uebersicht: 'Version', fristenToleranzen: 'Fristen und Toleranzen', wirkung: 'Kapitelwirkung',
    phase: 'Phase', gate: 'Gate', name: 'Bezeichnung', nameFehlt: 'Geben Sie eine Bezeichnung ein.',
    lieferergebnisse: 'Standard-Lieferergebnisse', meilensteine: 'Standard-Meilensteine',
    ergebnisseHint: 'Schlägt PPM beim Planen der Phase im Projektvertrag vor (UC-002 Schritt 6).',
    leitfragen: 'Leitfragen je Wertestrom', leitfragenHint: 'Beantwortet die Projektleitung im Gate-Antrag; das Gremium beurteilt damit die Gate-Reife.',
    pflichtangaben: 'Pflichtangaben des Projektvertrags', pflichtHint: 'Fehlt eine, lässt sich der Vertrag für diese Phase nicht einreichen.',
    kapitel: 'Kapitel', feld: 'Feld', feldHint: 'Schlüssel des Felds im Kapitel, z. B. kosten', feldUngueltig: 'Kleinbuchstaben, Ziffern und _, beginnend mit einem Buchstaben.',
    text: 'Text', textFehlt: 'Text fehlt.', keine: 'keine',
    hinzufuegen: { lieferergebnis: 'Lieferergebnis hinzufügen', meilenstein: 'Meilenstein hinzufügen', leitfrage: 'Leitfrage hinzufügen', pflicht: 'Pflichtangabe hinzufügen' },
    entfernen: (was: string) => `«${was || 'Leerer Eintrag'}» entfernen`, hoch: 'Nach oben', runter: 'Nach unten',
    fristen: 'Fristen', fristenHint: 'Gelten für Aufgaben im Eingang, Versand und Protokoll; Arbeitstage ohne Wochenende und Feiertage.',
    frist: {
      bericht_aufgabe: 'Aufgabe «Statusbericht erstellen»', bericht_stichtag: 'Stichtag Statusbericht', gate_vorbereiten: 'Aufgabe «Gate vorbereiten»',
      sitzung_vorbereiten: 'Aufgabe «Sitzung vorbereiten»', versand: 'Versand der Unterlagen', protokoll: 'Versand des Protokolls',
    } as Record<string, string>,
    fristBezug: {
      bericht_aufgabe: 'im Monat der Periode', bericht_stichtag: 'im Monat der Periode', gate_vorbereiten: 'vor der Gate-Sitzung',
      sitzung_vorbereiten: 'vor der Sitzung', versand: 'vor der Sitzung', protokoll: 'nach der Sitzung',
    } as Record<string, string>,
    einheit: { tag_im_monat: 'Tag im Monat', arbeitstage: 'Arbeitstage', kalendertage: 'Kalendertage', prozent: 'Prozent' } as Record<string, string>,
    wert: 'Wert', einheitLabel: 'Einheit', wertUngueltig: 'Ganze Zahl von 0 bis 365.', tagUngueltig: 'Tag 1 bis 31.',
    toleranzen: 'Standardtoleranzen', toleranzenHint: 'Ab dieser Abweichung warnt PPM «wesentlich»; der Projektvertrag kann sie übersteuern. Ohne Wert keine Warnung.',
    toleranz: { termin: 'Termin', kosten: 'Kosten', umfang: 'Umfang' } as Record<string, string>,
    ohneWert: 'ohne Wert', toleranzUngueltig: 'Zahl ab 0 oder leer.',
    wirkungHint: 'Eine Änderung an diesen Kapiteln betrifft Scope, Budget oder Ressourcen und geht an das Gremium statt nur an die Sponsorin oder den Sponsor (UC-007 A1).',
    dimension: { scope: 'Scope', budget: 'Budget', ressourcen: 'Ressourcen' } as Record<string, string>,
    kapitelName: ['Ausgangslage / Problembeschreibung', 'Strategiebezug', 'Ziele und Nutzenbeitrag', 'Lösungsansatz', 'Abgrenzung', 'Abhängigkeiten / Schnittstellen',
      'Projektplanung und Lieferergebnisse', 'Projektstruktur und Organisation', 'Ressourcen (Kosten, Personal)', 'Risiko-Management', 'Change Management', 'Freigabe', 'Beilagen'],
    wertestrom: {
      nutzen: 'Business Value (Nutzen)', projekt: 'Projektmanagement', klinik: 'Klinisches Transformations- & Lösungsdesign',
      ict: 'Integration ICT (DTI)', infrastruktur: 'Integration Infrastruktur (DBI)',
    } as Record<string, string>,
    pruefbericht: 'Prüfbericht', pruefLeer: 'Keine Hinweise. Der Entwurf ist vollständig.', zumObjekt: 'Anzeigen',
    pruefAnzahl: (n: number) => (n === 1 ? '1 Hinweis' : `${n} Hinweise`),
    inKraftFrage: (n: number) => `Version ${n} in Kraft setzen?`,
    inKraftWirkung: 'Die Version gilt ab sofort für neue Projekte und für laufende Projekte ab ihrem nächsten Gate. Danach ist sie unveränderlich.',
    inKraftAbloesung: (n: number) => `Version ${n} wird abgelöst.`,
    inKraftWarnungen: (n: number) => (n === 1 ? 'Der Prüfbericht enthält 1 Warnung.' : `Der Prüfbericht enthält ${n} Warnungen.`),
    verwerfenFrage: (n: number) => `Entwurf (Version ${n}) verwerfen?`,
    verwerfenText: 'Alle Änderungen dieses Entwurfs gehen verloren. Die Version in Kraft bleibt unverändert.',
    gone: 'Diese Version gibt es nicht (mehr), oder Sie sehen sie nicht.',
  },
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
