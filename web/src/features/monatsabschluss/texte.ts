/**
 * Texte des Features «Monatsabschluss» (Namensraum je Feature, docs/fachmodell.md 7.2): Anrede «Du» (UX-E7),
 * Schweizer Rechtschreibung, Wortlaut aus Kernablauf K1 (docs/ux/ablaeufe/K1-statusbericht.md, «Texte» und «Regeln»).
 */
const n = (k: number, eins: string, viele: string) => `${k} ${k === 1 ? eins : viele}`;

export const TM = {
  bereich: 'Monatsabschluss',
  title: 'Monatsabschluss',
  sub: 'Statusberichte der Periode prüfen, Rückfragen stellen, fehlende einfordern und die Periode abschliessen.',
  periodeVor: 'Vorherige Periode', periodeNach: 'Nächste Periode',
  ansicht: { berichte: 'Berichte', termine: 'Termine' },
  kopf: {
    eingereicht: (e: number, gesamt: number) => `${e} von ${gesamt} eingereicht`,
    geprueft: (k: number) => `${k} geprüft`,
    ausstehend: (k: number) => `${k} ausstehend`,
    zurueckgegeben: (k: number) => `${k} zurückgegeben`,
    nichtGemeldet: (k: number) => `${k} nicht gemeldet`,
    stichtag: (d: string) => `Stichtag ${d}`,
    abschlussBis: (d: string) => `Abschluss bis ${d}`,
  },
  // Filter (I-L1) und Sortierung (I-L5)
  filter: {
    stand: 'Stand', alle: 'Alle', nurAuffaellige: 'Nur auffällige', portfolio: 'Portfolio', allePortfolios: 'Alle Portfolios',
    sortierung: 'Sortierung', auffaelligZuerst: 'Auffällige zuerst', nachNummer: 'Nach Nummer',
  },
  stand: {
    eingereicht: 'eingereicht', zurueckgegeben: 'zurückgegeben', geprueft: 'geprüft', ausstehend: 'ausstehend', nicht_gemeldet: 'nicht gemeldet',
  } as Record<string, string>,
  standDetail: {
    eingereicht: 'wartet auf Unternehmensentwicklung', zurueckgegeben: 'wartet auf Projektleitung', entwurf: 'Entwurf vorhanden',
  },
  nachRueckfrage: 'nach Rückfrage',
  eingefordert: (d: string) => `eingefordert am ${d}`,
  spalte: { auswahl: 'Auswählen', projekt: 'Projekt', stand: 'Stand', status: 'Status und Trend', auffaellig: 'Auffälligkeiten', aktion: 'Aktion' },
  auswaehlen: (name: string) => `${name} auswählen`,
  alleAuswaehlen: 'Alle sichtbaren auswählen',
  // Auffälligkeiten als Badges (K1 Prüfen Schritt 1)
  auff: {
    status: 'Status geändert',
    termin: (wochen: string) => `Termin ${wochen}`,
    budget: (prozent: string) => `Prognose ${prozent} über Budget`,
    terminDetail: (text: string, bezug: 'baseline' | 'vorperiode') => (bezug === 'baseline' ? `${text} gegenüber Baseline` : `${text} gegenüber Vorperiode`),
    budgetDetail: (phase: string) => `Phase ${phase}`,
    keine: 'keine',
  },
  tage: (t: number) => (t === 1 ? '+1 Tag' : `+${t} Tage`),
  // Aktionen (K1 «Texte»)
  aktion: {
    bestaetigen: 'Bericht bestätigen', rueckfrage: 'Rückfrage stellen', einfordern: 'Bericht einfordern', oeffnen: 'Bericht öffnen',
    abschliessen: 'Periode abschliessen', zuruecknehmen: 'Rückgängig', abbrechen: 'Abbrechen', senden: 'Rückfrage senden',
    sammelBestaetigen: (k: number) => `${k} bestätigen`, sammelEinfordern: (k: number) => `${k} einfordern`, auswahlAufheben: 'Auswahl aufheben',
    eingereichteZeigen: 'Eingereichte anzeigen', projektOeffnen: (nr: string) => `Projekt ${nr} öffnen`,
  },
  auswahl: (k: number) => `${n(k, 'Bericht', 'Berichte')} ausgewählt`,
  rueckfrage: {
    label: 'Rückfrage an die Projektleitung',
    platzhalter: 'Was ist unklar? Die Projektleitung sieht deine Frage zuoberst im Bericht.',
    leer: 'Schreibe, was unklar ist.',
    offen: 'Offene Rückfrage',
    verlauf: 'Rückfragen',
    beantwortet: (d: string) => `beantwortet ${d}`,
    gestellt: (wer: string, d: string) => `${wer}, ${d}`,
  },
  // Rückmeldungen (Toasts, Ansagen; I-L4)
  toast: {
    bestaetigt: (nr: string) => `Bericht ${nr} bestätigt.`,
    zurueckgenommen: (nr: string) => `Bestätigung von ${nr} zurückgenommen.`,
    rueckfrage: (nr: string) => `Rückfrage an ${nr} gesendet. Der Bericht ist zurückgegeben.`,
    sammel: (ok: number, auff: number, stand: number) => [
      `${ok} bestätigt`,
      auff ? `${auff} mit Auffälligkeit übersprungen` : '',
      stand ? `${stand} in anderem Stand übersprungen` : '',
    ].filter(Boolean).join(', ') + '.',
    sammelZurueckgenommen: (ok: number, nicht: number) =>
      `Bestätigung von ${n(ok, 'Bericht', 'Berichten')} zurückgenommen${nicht ? `, ${nicht} inzwischen geändert und nicht zurückgenommen` : ''}.`,
    eingefordert: (ok: number, stand: number) => `${n(ok, 'Bericht', 'Berichte')} eingefordert${stand ? `, ${stand} übersprungen` : ''}.`,
    abgeschlossen: (p: string) => `${p} ist abgeschlossen.`,
  },
  // Zustände (K1 «Zustände», I-Z)
  leer: (periode: string, seit: string | null) => `Noch keine Statusberichte für ${periode}.${seit ? ` Die Projektleitungen sind seit ${seit} aufgefordert.` : ''}`,
  leerEingereicht: (ausstehend: number) => `Alle eingereichten Berichte sind geprüft.${ausstehend ? ` ${ausstehend === 1 ? '1 steht' : `${ausstehend} stehen`} noch aus.` : ''}`,
  leerFilter: 'Kein Bericht passt zum Filter.',
  gesperrt: (periode: string, wann: string, wer: string | null) => `${periode} ist abgeschlossen (${wann}${wer ? `, ${wer}` : ''}). Das Dashboard ist für die Gremien freigegeben.`,
  tasten: 'Tastatur: ↑/↓ Zeile wechseln · B bestätigen · R Rückfrage · E einfordern · Leertaste auswählen · Enter öffnen',
  konflikt: 'Der Bericht wurde inzwischen geändert. Die Liste ist neu geladen; prüfe ihn nochmals.',
  keinRecht: 'Den Monatsabschluss sieht die Unternehmensentwicklung.',
  // Vorschau vor Sammelbestätigung und Einfordern (K1 Prüfen Schritt 3, A1; I-R1 Stufe 3)
  vorschau: {
    bestaetigenTitel: (k: number) => (k ? `${n(k, 'Bericht', 'Berichte')} bestätigen?` : 'Keinen Bericht bestätigen'),
    bestaetigenWirkung: (k: number) => `${k === 1 ? 'Dieser Bericht erhält' : `Diese ${k} Berichte erhalten`} den Stand «geprüft». Danach kannst du die Bestätigung rückgängig machen, solange die Periode offen ist.`,
    keinerOhneAuffaelligkeit: 'Jeder ausgewählte Bericht hat eine Auffälligkeit oder ist nicht eingereicht. Prüfe ihn einzeln.',
    uebersprungenAuffaellig: (k: number) => `Übersprungen, mit Auffälligkeit (${k}): Prüfe ${k === 1 ? 'ihn' : 'sie'} einzeln.`,
    uebersprungenStand: (k: number) => `Übersprungen, nicht eingereicht (${k}):`,
    einfordernTitel: (nr: string | null, k: number) => (nr ? `Bericht ${nr} einfordern?` : `${n(k, 'Bericht', 'Berichte')} einfordern?`),
    einfordernWirkung: (k: number) => `${k === 1 ? 'Die Projektleitung erhält' : `Die Projektleitungen von ${k} Projekten erhalten`} eine Erinnerung im Eingang und als Benachrichtigung. Eine versendete Erinnerung lässt sich nicht zurückholen.`,
  },
  // Periode abschliessen (K1 Prüfen Schritt 5; I-R1 Stufe 3)
  abschluss: {
    titel: (p: string) => `${p} abschliessen?`,
    wirkung: (projekte: number, geprueft: number, nichtGemeldet: number) =>
      `${n(projekte, 'Projekt', 'Projekte')} · ${geprueft} geprüft · ${nichtGemeldet} nicht gemeldet.`,
    nichtGemeldet: (k: number, vorperiode: string) =>
      `Nicht gemeldet: ${k === 1 ? '1 Projekt hat' : `${k} Projekte haben`} keinen geprüften Bericht. Für ${k === 1 ? 'es gelten' : 'sie gelten'} die Werte von ${vorperiode} mit dem Vermerk «nicht gemeldet».`,
    dashboard: (p: string, ab: string) => `Das Dashboard ${p} steht ab ${ab} den Gremien zur Verfügung. Danach ist die Periode gesperrt; ein späterer Bericht zählt für die nächste Periode.`,
    weiter: 'Weiter prüfen',
  },
  // Schublade «Bericht» (K1 Prüfen Schritt 2)
  bericht: {
    titel: (nr: string, name: string) => `${nr} ${name}`,
    vergleich: 'Bericht im Vergleich zur Vorperiode',
    feld: 'Angabe', diese: (p: string) => p, vorher: (p: string) => p, keineVorperiode: 'keine Vorperiode',
    geaendert: 'geändert',
    felder: {
      status: 'Status', trend: 'Trend', phase: 'Phase', abschlussPer: 'Abschluss per', naechsterMeilenstein: 'Nächster Meilenstein',
      abhaengigkeiten: 'Abhängigkeiten', entscheide: 'Anstehende Entscheide', begruendung: 'Begründung', massnahme: 'Massnahme',
      entscheidNoetig: 'Entscheid des PRAT nötig',
    } as Record<string, string>,
    dimension: { inhalt: 'Abweichung Inhalt', termin: 'Abweichung Termin', ressourcen: 'Abweichung Ressourcen', budget: 'Abweichung Budget' } as Record<string, string>,
    ja: 'ja', nein: 'nein',
    trend: { aufwaerts: 'aufwärts', gleichbleibend: 'gleichbleibend', abwaerts: 'abwärts' } as Record<string, string>,
    stufe: { keine: 'keine', gering: 'gering', wesentlich: 'wesentlich' } as Record<string, string>,
    ausstehend: 'Für dieses Projekt ist noch kein Bericht eingereicht.',
    eingereichtAm: (d: string) => `Eingereicht ${d}`,
  },
  // Terminabweichungen (UI-16, UC-005 Schritt 4)
  termine: {
    titel: 'Terminabweichungen',
    sub: 'Baseline und aufdatierte Termine je Projekt, nach grösster Verschiebung. Stand der Register heute.',
    spalte: { projekt: 'Projekt', phase: 'Phase', baseline: 'Abschluss Baseline', aktuell: 'Abschluss aktuell', abweichung: 'Abweichung', phasen: 'Ende je Phase' },
    leer: 'Kein Projekt hat Termine mit Baseline.',
    ohneBaseline: (k: number) => `${k === 1 ? '1 Projekt hat' : `${k} Projekte haben`} noch keine Termine mit Baseline:`,
    imPlan: 'im Plan',
    frueher: (t: string) => `${t} früher`,
    exportieren: 'Exportieren (CSV)', exportiert: (name: string) => `${name} gespeichert.`,
    einzelwerte: (nummer: string, abweichung: string) => `Einzelwerte zu ${nummer}: ${abweichung}`,
    drawerTitel: (nummer: string, name: string) => `Termine ${nummer} ${name}`,
    drawerSub: 'Meilensteine und Lieferergebnisse mit Termin der Baseline; das Ende einer Phase ist ihr spätester Termin.',
    tabelle: 'Meilensteine und Lieferergebnisse',
    spalteMs: { phase: 'Phase', bezeichnung: 'Bezeichnung', baseline: 'Baseline', aktuell: 'Aktuell', abweichung: 'Abweichung' },
    art: { meilenstein: 'Meilenstein', lieferergebnis: 'Lieferergebnis' } as Record<string, string>,
    erreicht: 'erreicht',
    projektOeffnen: 'Projekt öffnen',
    unbekannt: 'Dieses Projekt steht nicht in den Terminabweichungen der Periode.',
  },
  // Kopfkarte «Monatszyklus» im Eingang (informationsarchitektur.md «Startseite je Rolle», UE und PMO)
  kopfkarte: {
    titel: (periode: string) => `Statusberichte ${periode}`,
    zuPruefen: (n: number) => (n === 1 ? '1 Bericht prüfen' : `${n} Berichte prüfen`),
    oeffnen: 'Monatsabschluss öffnen',
  },
};
