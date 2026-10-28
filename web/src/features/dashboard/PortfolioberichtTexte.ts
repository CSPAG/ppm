/**
 * Texte der Risikolage (UI-18) und des Portfolioberichts (UI-29) im Feature «Dashboard» (Namensraum je Feature,
 * docs/fachmodell.md 7.2): Anrede «Du» (UX-E7), Schweizer Rechtschreibung, Wortlaut aus K3 («Portfoliobericht
 * erzeugen», «Bericht der Programmleitung»).
 */
export const TR = {
  bereich: 'Risikolage',
  title: 'Risikolage',
  inhalt: 'Inhalt der Risikolage',
  sub: 'Projekt- und Portfoliorisiken mit Bewertung und Massnahme, Abhängigkeiten und offene Eskalationen.',
  stand: (d: string) => `Stand der Register ${d}`,
  kennzahl: {
    risiken: (n: number) => (n === 1 ? '1 Risiko' : `${n} Risiken`),
    hoch: (n: number) => `${n} mit hoher Auswirkung und Wahrscheinlichkeit`,
    offen: (n: number) => (n === 1 ? '1 Massnahme offen' : `${n} Massnahmen offen`),
  },
  matrix: {
    titel: 'Verteilung nach Wahrscheinlichkeit und Auswirkung',
    zeile: 'Wahrscheinlichkeit', spalte: 'Auswirkung',
    feld: (w: string, a: string, n: number) => `Wahrscheinlichkeit ${w}, Auswirkung ${a}: ${n}`,
  },
  stufe: { hoch: 'hoch', mittel: 'mittel', tief: 'tief' } as Record<string, string>,
  risiken: {
    titel: 'Risiken',
    spalte: { bezug: 'Projekt bzw. Portfolio', text: 'Risiko', w: 'Wahrscheinlichkeit', a: 'Auswirkung', massnahme: 'Massnahme', stand: 'Stand', verantwortlich: 'Verantwortlich' },
    portfolio: 'Portfolio',
    stand: { offen: 'offen', umgesetzt: 'umgesetzt' } as Record<string, string>,
    leer: 'Für dieses Portfolio sind keine Risiken erfasst.',
  },
  abhaengigkeiten: { titel: 'Abhängigkeiten', von: 'Projekt', zu: 'hängt ab von', text: 'Beschreibung', leer: 'Keine Abhängigkeiten zwischen den Projekten.' },
  eskalationen: { titel: 'Offene Eskalationen', projekt: 'Projekt', periode: 'Periode', grund: 'Grund', massnahme: 'Massnahme', leer: 'Keine offenen Eskalationen.', stand: { offen: 'offen', traktandiert: 'traktandiert' } as Record<string, string> },
  keinRecht: 'Die Risikolage sehen Gremien, Direktionen, Geschäftsleitung, Finanzen, Ressourcen und die Unternehmensentwicklung.',
};

export const TP = {
  bereich: 'Portfoliobericht',
  title: 'Portfoliobericht',
  inhalt: 'Inhalt des Portfolioberichts',
  sub: 'Bericht der Periode für das Gremium, erzeugt aus dem abgeschlossenen Dashboard und der Risikolage.',
  filter: { portfolio: 'Portfolio', periode: 'Periode' },
  liste: 'Berichte',
  stand: { entwurf: 'Entwurf', bereitgestellt: 'bereitgestellt' } as Record<string, string>,
  standDetail: { entwurf: 'nur für die Unternehmensentwicklung sichtbar', bereitgestellt: (d: string) => `für das Gremium bereit seit ${d}` },
  erzeugt: (d: string) => `Erzeugt ${d}`,
  aktion: {
    erzeugen: 'Portfoliobericht erzeugen', neuErzeugen: 'Neu erzeugen', bereitstellen: 'Bereitstellen', speichern: 'Kommentar speichern',
    pdf: 'Als PDF', word: 'Als Word', abbrechen: 'Abbrechen',
  },
  keinBericht: (periode: string) => `Für ${periode} gibt es noch keinen Portfoliobericht.`,
  keinBerichtLeser: (periode: string) => `Für ${periode} ist noch kein Portfoliobericht bereitgestellt.`,
  periodeOffen: (periode: string) => `${periode} ist noch nicht abgeschlossen. Der Portfoliobericht entsteht aus dem abgeschlossenen Dashboard.`,
  kommentar: {
    label: 'Bericht der Programmleitung', hinweis: 'Dein Kommentar steht zuoberst im Bericht.', leer: 'Kein Kommentar.',
    andere: (t: string) => `Inzwischen gespeichert: «${t}». Dein Text oben ist noch nicht gespeichert.`,
  },
  bereitstellenDialog: {
    titel: (p: string) => `Portfoliobericht ${p} bereitstellen?`,
    text: (gremium: string) => `Der Bericht wird fest und ist für ${gremium} sichtbar. Das Gremium erhält das Traktandum «Bericht der Programmleitung» als Vorschlag für die nächste Sitzung. Danach änderst du ihn nicht mehr.`,
    gremium: 'das Gremium des Portfolios',
  },
  neuErzeugenHinweis: 'Neu erzeugen übernimmt den aktuellen Stand der Risikolage; dein Kommentar bleibt.',
  toast: {
    erzeugt: (p: string) => `Portfoliobericht ${p} erzeugt.`,
    neu: (p: string) => `Portfoliobericht ${p} neu erzeugt.`,
    gespeichert: 'Kommentar gespeichert.',
    bereitgestellt: (p: string) => `Portfoliobericht ${p} bereitgestellt.`,
  },
  konflikt: 'Der Bericht wurde inzwischen geändert und ist neu geladen. Dein Kommentar ist noch da; speichere ihn nochmals.',
  abschnitt: { uebersicht: 'Übersicht', funnel: 'Funnel nach Phase', projekte: 'Projekte', risiken: 'Risikolage' },
  keinRecht: 'Den Portfoliobericht sehen Gremien, Direktionen, Geschäftsleitung, Finanzen, Ressourcen und die Unternehmensentwicklung.',
};
