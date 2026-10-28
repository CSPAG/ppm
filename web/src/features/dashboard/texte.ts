/**
 * Texte des Features «Dashboard» (Namensraum je Feature, docs/fachmodell.md 7.2): Anrede «Du» (UX-E7), Schweizer
 * Rechtschreibung, Begriffe aus darstellung.md («Nicht gemeldet», «Eskalation»).
 */
export const TD = {
  bereich: 'Dashboard',
  title: 'Dashboard',
  sub: 'Stand der Projekte je Portfolio und Periode: Status, Trend, Phase und nächster Meilenstein.',
  aktionOeffnen: 'Dashboard öffnen',
  filter: { portfolio: 'Portfolio', allePortfolios: 'Alle Portfolios', periode: 'Periode', ansicht: 'Ansicht' },
  ansicht: { liste: 'Liste', funnel: 'Funnel nach Phase' },
  kennzahl: {
    projekte: (n: number) => (n === 1 ? '1 Projekt' : `${n} Projekte`),
    imPlan: (n: number) => `${n} im Plan`,
    kritisch: (n: number) => `${n} kritisch`,
    nichtGemeldet: (n: number) => `${n} nicht gemeldet`,
    ausstehend: (n: number) => `${n} ausstehend`,
    eskalation: (n: number) => (n === 1 ? '1 Eskalation' : `${n} Eskalationen`),
  },
  periodeOffen: (p: string) => `${p} ist noch offen: Das Dashboard zeigt den aktuellen Stand der Meldungen. Final ist es nach dem Monatsabschluss.`,
  meldung: { ausstehend: 'ausstehend', ohne_pflicht: 'ohne Berichtspflicht' } as Record<string, string>,
  werteAus: (p: string) => `Werte von ${p}`,
  spalte: { projekt: 'Projekt', portfolio: 'Portfolio', handlungsfeld: 'Handlungsfeld', projektleitung: 'Projektleitung', phase: 'Phase', meilenstein: 'Nächster Meilenstein', status: 'Status' },
  keinStatus: 'kein Status',
  oeffnen: (nr: string, name: string) => `Projekt ${nr} ${name} öffnen`,
  leer: 'In dieser Periode gibt es keine Projekte in deinen Portfolios.',
  keinRecht: 'Das Dashboard sehen Gremien, Direktionen, Geschäftsleitung, Finanzen, Ressourcen und die Unternehmensentwicklung.',
  funnel: {
    titel: 'Funnel nach Phase',
    beschreibung: 'Projekte je Phase mit Status; die Tabelle darunter zeigt dieselben Werte.',
    spalte: { phase: 'Phase', anzahl: 'Projekte', imPlan: 'im Plan', kritisch: 'kritisch', nichtGemeldet: 'nicht gemeldet bzw. ausstehend', ohneStatus: 'ohne Status' },
    filtern: (phase: string) => `Projekte in ${phase} anzeigen`,
  },
  // Kopfkarte im Eingang (informationsarchitektur.md «Startseite je Rolle»: PRAT, GLPA Gesamtstatus; DIR Projekte der Direktion)
  kopfkarte: {
    titel: (periode: string) => `Portfolio ${periode}`,
    imPlan: (n: number) => `${n} im Plan`,
    kritisch: (n: number) => `${n} kritisch`,
    ohneStatus: (n: number) => `${n} ohne Status`,
    eskalationen: (n: number) => (n === 1 ? '1 Eskalation' : `${n} Eskalationen`),
  },
};
