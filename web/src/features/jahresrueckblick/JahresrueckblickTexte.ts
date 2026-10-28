/**
 * Texte der Seite «Jahresrückblick» (UI-37; UC-013; Entscheid in K3 Schritt 8): Anrede «Du» (UX-OF-1), Schweizer
 * Rechtschreibung, in sichtbaren Texten «Organisation»; Wortlaut der Ergebnisse aus K3 («Verabschiedet», «Anpassungen
 * verlangt»).
 */
const mehr = (n: number, eins: string, viele: string) => `${n} ${n === 1 ? eins : viele}`;

export const TJ = {
  bereich: 'Jahresrückblick',
  title: (j: number) => `Jahresrückblick ${j}`,
  sub: 'Auswertung des Jahres für den PRAT: Zielerreichung, Vorhaben und Lessons Learned; danach Erkenntnisse und Massnahmen für den nächsten Zielzyklus.',
  inhalt: (j: number) => `Inhalt des Jahresrückblicks ${j}`,
  jahrWaehlen: 'Jahr', vorher: 'Vorheriges Jahr', nachher: 'Nächstes Jahr',
  stand: { offen: 'noch nicht begonnen', in_arbeit: 'in Arbeit', traktandiert: 'traktandiert', ausgewertet: 'ausgewertet' } as Record<string, string>,
  standDetail: {
    offen: 'noch nichts gespeichert', in_arbeit: 'Auswertung mit dem aktuellen Stand',
    traktandiert: (d: string) => `Stand bei Traktandierung am ${d}`, ausgewertet: (d: string) => `im PRAT verabschiedet am ${d}`,
  },
  kennzahl: {
    ziele: (n: number, g: number) => `${n} von ${mehr(g, 'Ziel', 'Zielen')} mit Stand`,
    abgeschlossen: (n: number) => `${n} abgeschlossen`,
    abgebrochen: (n: number) => `${n} abgebrochen`,
    laufend: (n: number) => `${n} laufend`,
    lessons: (n: number) => mehr(n, 'Lesson Learned', 'Lessons Learned'),
    ohne: (n: number) => `${mehr(n, 'Vorhaben', 'Vorhaben')} ohne Lessons Learned`,
    kennzahlen: 'Kennzahlen',
  },
  abschnitte: {
    zielerreichung: '1 Zielerreichung', vorhaben: '2 Vorhaben', lessons: '3 Lessons Learned', erkenntnisse: '4 Erkenntnisse und Massnahmen',
  } as Record<string, string>,
  spalte: {
    nummer: 'Nr.', ziel: 'Ziel', metrik: 'Metrik', zielwert: 'Zielwert', stand: 'Stand', beurteilung: 'Beurteilung',
    projekt: 'Projekt', portfolio: 'Portfolio', phase: 'Phase', am: 'Am', lebenszyklus: 'Lebenszyklus', kategorie: 'Kategorie', lesson: 'Lesson Learned',
  },
  lebenszyklus: { aktiv: 'aktiv', sistiert: 'sistiert', abgeschlossen: 'abgeschlossen', abgebrochen: 'abgebrochen' } as Record<string, string>,
  ausQuartal: (q: string) => `(${q})`,
  vorhaben: { abgeschlossen: 'Abgeschlossen', abgebrochen: 'Abgebrochen', laufend: 'Laufend' },
  leer: {
    ziele: 'Für das Jahr sind keine Ziele erfasst.',
    abgeschlossen: 'Im Jahr wurde kein Vorhaben abgeschlossen.',
    abgebrochen: 'Im Jahr wurde kein Vorhaben abgebrochen.',
    laufend: 'Keine laufenden Vorhaben.',
    lessons: 'Im Jahr sind keine Lessons Learned erfasst.',
    ohne: 'Für alle abgeschlossenen Vorhaben liegen Lessons Learned vor.',
    erkenntnisse: 'Keine Erkenntnisse erfasst.',
    massnahmen: 'Keine Massnahmen erfasst.',
  },
  tabelle: { ziele: 'Ziele des Jahres mit letztem Stand', lessons: 'Lessons Learned des Jahres' },
  ohneTitel: 'Abgeschlossene Vorhaben ohne Lessons Learned',
  sammlung: 'Alle Lessons Learned des Jahres',
  anfordern: 'Lessons Learned anfordern',
  anfordernWirkung: (n: number) => `Die Projektleitungen von ${mehr(n, 'Vorhaben', 'Vorhaben')} erhalten die Aufgabe «Lessons Learned erfassen» in ihrem Eingang; erledigt ist sie mit der ersten erfassten Lesson Learned.`,
  anfordernVorher: 'Speichere zuerst deine Erkenntnisse und Massnahmen; danach kannst du die Lessons Learned anfordern.',
  angefordert: (v: number, a: number) => (a === 0
    ? `Keine Aufgabe geöffnet: Für ${mehr(v, 'Vorhaben', 'Vorhaben')} ist keine Projektleitung erfasst.`
    : `${mehr(a, 'Aufgabe', 'Aufgaben')} an die Projektleitungen geöffnet.`),

  erkenntnisse: 'Erkenntnisse', massnahmen: 'Massnahmen für den nächsten Zielzyklus',
  erkenntnisseHinweis: 'Was hat im Jahr funktioniert, was nicht?',
  massnahmenHinweis: (j: number) => `Erscheinen im Zielzyklus ${j}.`,
  speichern: 'Speichern', gespeichert: 'Gespeichert.',
  traktandieren: 'Im PRAT traktandieren',
  traktandierenVorher: 'Speichere zuerst deine Erkenntnisse; traktandiert wird der gespeicherte Stand.',
  dialog: {
    titel: (j: number) => `Jahresrückblick ${j} im PRAT traktandieren?`,
    text: 'Die Auswertung wird mit dem heutigen Stand festgehalten und erscheint als Vorschlag in der nächsten Sitzung des PRAT. Bis zum Entscheid änderst du den Rückblick nicht mehr.',
    abbrechen: 'Abbrechen',
  },
  traktandiert: (j: number) => `Jahresrückblick ${j} traktandiert.`,
  bannerTraktandiert: (d: string) => `Dem PRAT vorgelegt am ${d}. Der Entscheid fällt in der Sitzung; bis dahin ist der Rückblick gesperrt.`,
  bannerAusgewertet: (d: string, j: number) => `Im PRAT verabschiedet am ${d}. Du kannst Erkenntnisse und Massnahmen für den Zielzyklus ${j} weiter nachführen.`,
  rueckmeldung: (t: string) => `Der PRAT verlangt Anpassungen: ${t}`,
  nurLesen: 'Du siehst den Jahresrückblick lesend; zusammenstellen kann die Unternehmensentwicklung.',
  konflikt: 'Der Jahresrückblick wurde inzwischen geändert. Er ist neu geladen; prüfe deine Eingaben.',
  keinRecht: 'Den Jahresrückblick sehen Personen, die die Ziele der Organisation lesen, etwa Geschäftsleitung und Unternehmensentwicklung. Traktandiert erscheint er in der Sitzung des PRAT.',

  dokument: 'Als Dokument herunterladen', pdf: 'PDF', word: 'Word',
  personendaten: 'Das Dokument kann Personendaten enthalten (Lessons Learned). Nur intern weitergeben.',
  dokumentVorher: 'Das Dokument gibt es, sobald der Rückblick gespeichert ist.',
  wirdErstellt: 'Dokument wird erstellt …', dokumentBereit: (n: string) => `${n} gespeichert.`,
};
