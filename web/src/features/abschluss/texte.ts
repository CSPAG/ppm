/**
 * Texte des Features «Abschluss» (UI-14 Projektakte › Abschluss, UI-32 Portfolio › Auswertungen › Lessons Learned;
 * UC-015, PS.04.03; Namensraum je Feature, docs/fachmodell.md 7.2): Anrede «Du» (UX-E7, Entscheid UX-OF-1), Schweizer Rechtschreibung,
 * «Organisation» statt «Mandant».
 */
import { satzende } from '../../ui/index.ts';
import { NAV } from './nav.ts';

export const TA = {
  reiter: NAV.reiter,
  projektFehlt: 'Dieses Projekt gibt es nicht oder du hast keinen Zugriff darauf.',
  titel: { abschluss: 'Abschlussbericht', sistierung: 'Bericht zur Sistierung', abbruch: 'Bericht zum Abbruch' } as Record<string, string>,
  stand: { entwurf: 'in Arbeit', eingereicht: 'eingereicht', traktandiert: 'beim Gremium', abgenommen: 'abgenommen', nacharbeit: 'Nacharbeit' } as Record<string, string>,
  gespeichert: 'Gespeichert', speichert: 'Speichert …', ungespeichert: 'Ungespeicherte Änderungen',
  konflikt: 'Jemand anderes hat den Bericht inzwischen geändert. Deine Eingaben sind noch da, aber nicht gespeichert.',
  konfliktBehalten: 'Neu laden, meine Änderungen behalten', konfliktUebernehmen: 'Stand der anderen übernehmen',
  keine: {
    titel: 'Noch kein Abschluss',
    text: (phase: string) => `Der Abschluss beginnt in Phase P4 oder mit einem Entscheid des Gremiums zu Sistierung oder Abbruch. Das Projekt ist in ${phase}.`,
  },
  banner: {
    abgeschlossen: (d: string) => `Das Projekt ist seit ${d} formell abgeschlossen. Die Projektakte kann nur noch gelesen werden; Lessons Learned lassen sich weiter erfassen.`,
    traktandiert: 'Der Abschlussbericht liegt beim Gremium (Exit-Gate P4). Bis zum Entscheid ist er gesperrt; Sponsor und UE können die Nutzenrealisierung noch beurteilen.',
    eingereicht: (d: string) => `Eingereicht am ${satzende(d)} Der Bericht kann nur noch gelesen werden.`,
    nacharbeit: 'Das Gremium verlangt Nacharbeiten. Überarbeite den Bericht und reich ihn erneut ein; die Auflagen findest du im Eingang.',
    sistiert: 'Das Projekt ist sistiert. Erfasse Stand, offene Punkte und Lessons Learned; die Wiederaufnahme beschliesst das Gremium.',
    abgebrochen: 'Das Projekt ist abgebrochen und kann nur noch gelesen werden. Erfasse Stand, offene Punkte und Lessons Learned.',
    nurLesen: 'Den Bericht erfasst die Projektleitung.',
  },
  abschnitte: {
    grundlagen: 'Ausgangslage aus Vertrag und Register', zielerreichung: 'Zielerreichung', businessCase: 'Business Case Abschluss',
    uebergabe: 'Übergabe an Betrieb und Linie', offenePunkte: 'Offene Punkte', nutzen: 'Nutzenrealisierung', lessons: 'Lessons Learned',
    projektstand: 'Stand des Vorhabens', berichte: 'Frühere Berichte',
  },
  grundlagen: {
    baseline: (n: string | null) => (n ? `Baseline Version ${n}` : 'Noch keine Baseline des Projektvertrags'),
    ziele: 'Ziele', nutzen: 'Nutzenbeitrag', businessCase: 'Business Case', kosten: 'Kosten',
    kostenWerte: (b: string, p: string, i: string) => `Budget laut Baseline ${b} · Prognose ${p} · Ist ${i}`,
    keineBetraege: 'Beträge sehen nur Rollen mit Recht auf Finanzen.',
    offeneMeilensteine: (n: number) => (n === 1 ? '1 Meilenstein oder Lieferergebnis ist nicht erreicht' : `${n} Meilensteine oder Lieferergebnisse sind nicht erreicht`),
    alleErreicht: 'Alle Meilensteine und Lieferergebnisse sind erreicht.',
    leer: 'Keine Angaben.',
    nutzenpruefung: (v: string) => `Nutzenprüfung am Gate (Version ${v})`, gateWert: 'Wert am Gate',
  },
  felder: {
    projektstand: 'Stand des Vorhabens', projektstandHint: 'Was ist erreicht, was ist angehalten, was ist zu sichern?',
    zielerreichung: 'Zielerreichung', zielerreichungHint: 'Welche Ziele sind erreicht, welche nicht, und warum?',
    businessCase: 'Business Case Abschluss P4', businessCaseHint: 'Kosten und Nutzen im Vergleich zur Baseline.',
    uebergabe: 'Übergabe an Betrieb und Linie', uebergabeHint: 'Wer übernimmt was ab wann?',
  },
  kpi: {
    kpi: 'KPI', ziel: 'Zielwert', ist: 'Letzter Ist-Wert', erreicht: 'Erreicht am Abschluss', bemerkung: 'Bemerkung',
    erreichtVon: (t: string) => `Erreichter Wert für ${t}`, bemerkungVon: (t: string) => `Bemerkung zu ${t}`, leer: 'Keine KPIs im Register.',
  },
  punkt: {
    text: 'Offener Punkt', verantwortlich: 'Verantwortlich', termin: 'Termin', neu: 'Offenen Punkt hinzufügen',
    entfernen: (t: string) => `Offenen Punkt «${t || 'ohne Text'}» entfernen`, leer: 'Keine offenen Punkte.',
    textVon: (i: number) => `Offener Punkt ${i}`, verantwortlichVon: (i: number) => `Verantwortlich für Punkt ${i}`, terminVon: (i: number) => `Termin für Punkt ${i}`,
  },
  nutzen: {
    sp: 'Beurteilung des Sponsors', ue: 'Beurteilung der UE', offen: 'noch nicht beurteilt',
    von: (wer: string, d: string) => `${wer}, ${d}`, speichern: 'Beurteilung speichern', gespeichert: 'Beurteilung gespeichert.',
    hint: 'Sponsor und UE beurteilen, ob der Nutzen stabil erreicht ist (PC.03.02).',
  },
  lessons: {
    leer: 'Noch keine Lessons Learned. Halte fest, was künftige Vorhaben wissen sollten.',
    text: 'Erkenntnis', kategorie: 'Kategorie (optional)', erfassen: 'Lesson Learned erfassen', erfasst: 'Lesson Learned erfasst.',
    von: (wer: string, jahr: number) => `${wer} · ${jahr}`, loeschen: (t: string) => `Lesson Learned «${t}» löschen`, geloescht: 'Lesson Learned gelöscht.',
    loeschenFrage: (t: string) => `Lesson Learned «${t}» löschen?`, loeschenJa: 'Lesson Learned löschen',
    loeschenWirkung: 'Die Erkenntnis verschwindet auch aus «Lessons Learned» im Portfolio. Das lässt sich nicht rückgängig machen.',
  },
  panel: {
    titel: 'Bereit zum Einreichen', bereit: 'Alle Pflichtangaben sind erfasst.',
    fehlt: (n: number) => (n === 1 ? '1 Angabe fehlt' : `${n} Angaben fehlen`),
    sperre: (liste: string) => `Einreichen nicht möglich: ${liste} fehlen. Ergänze sie, um einzureichen.`,
    wirkungAbschluss: 'Mit dem Einreichen wird das Exit-Gate P4 dem Gremium vorgeschlagen; die UE traktandiert es. Bis zum Entscheid ist der Bericht gesperrt.',
    wirkungAnderer: 'Mit dem Einreichen ist der Bericht abgeschlossen und kann nur noch gelesen werden.',
    einreichen: 'Bericht einreichen', eingereicht: 'Bericht eingereicht.', eingereichtGremium: 'Bericht eingereicht; das Exit-Gate ist dem Gremium vorgeschlagen.',
    nichtBearbeitbar: (stand: string) => `Der Bericht ist ${stand}.`,
    frage: 'Bericht einreichen?',
  },
  wiederaufnahme: {
    aktion: 'Wiederaufnahme beantragen', titel: 'Wiederaufnahme beim Gremium beantragen?', begruendung: 'Begründung für das Gremium',
    wirkung: 'Der Antrag erscheint in den Vorschlägen des entscheidenden Gremiums. Mit «Weiterführen» ist das Projekt wieder aktiv; danach schreibst du den Projektvertrag über ein Gate fort.',
    senden: 'Antrag stellen', gesendet: 'Antrag an das Gremium gestellt.', fehlt: 'Begründung fehlt: Das Gremium entscheidet anhand deiner Begründung.',
  },
  entscheid: {
    abgeschlossen: 'Abgeschlossen', nacharbeiten: 'Nacharbeiten verlangt', sistiert: 'Sistiert', abgebrochen: 'Abgebrochen', weiterfuehren: 'Weiterführen',
  } as Record<string, string>,
  letzterEntscheid: (e: string, d: string) => `Letzter Entscheid des Gremiums: ${e} (${d})`,
  dokument: { aktion: 'Als Dokument herunterladen', pdf: 'PDF', word: 'Word', personendaten: 'Enthält Personendaten. Nur intern weitergeben.', bereit: (n: string) => `${n} gespeichert.`,
    fehler: (grund: string) => `Herunterladen nicht möglich: ${grund}` },

  // Portfolio › Auswertungen › Lessons Learned (UI-32)
  liste: {
    bereich: NAV.lessons, titel: 'Lessons Learned', sub: 'Erkenntnisse aus abgeschlossenen, sistierten und abgebrochenen Vorhaben',
    suche: 'Suchen in Erkenntnis und Projekt', jahr: 'Jahr', alleJahre: 'Alle Jahre', kategorie: 'Kategorie', alleKategorien: 'Alle Kategorien',
    ohneKategorie: 'ohne Kategorie', projekt: 'Projekt', erkenntnis: 'Erkenntnis', erfasst: 'Erfasst',
    leer: 'Noch keine Lessons Learned. Die Projektleitungen erfassen sie in der Projektakte unter «Abschluss».',
    leerGefiltert: 'Nichts passt zu deiner Suche.', eine: 'Lesson Learned', projektOeffnen: 'Zur Projektakte',
    nurLesen: 'Ändern kann die Projektleitung des Projekts.', bearbeiten: 'Bearbeiten', speichern: 'Speichern', gespeichert: 'Gespeichert.',
  },
};
