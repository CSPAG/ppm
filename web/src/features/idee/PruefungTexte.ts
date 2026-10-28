/**
 * Texte für Ideenpool und Prüfung (AP-E4-2, Kernablauf K4; Namensraum des Features «Ideen»): Anrede «Sie», Schweizer
 * Rechtschreibung; Regeln nach I-P2 (Regel, Ist, Ausweg) mit den Texten aus K4 «Regeln und Rückmeldungen».
 */
export const TP = {
  // Ideenpool (K4 Prüfen 5)
  pool: 'Ideenpool',
  poolSub: 'Eingereichte Projektideen: prüfen, zusammenführen, zurückfragen oder dem Gremium vorlegen.',
  ansichten: { liste: 'Liste', funnel: 'Funnel «Pre-P0»', meine: 'Meine Ideen' } as Record<string, string>,
  ansichtLabel: 'Ansicht',
  leer: 'Keine Ideen zu prüfen.',
  letzteEinreichung: (datum: string) => `Letzte Einreichung ${datum}.`,
  leerGefiltert: 'Keine Idee passt zu diesen Filtern.',
  filter: { stand: 'Stand', handlungsfeld: 'Handlungsfeld', herkunft: 'Herkunft', alle: 'alle' },
  spalten: { titel: 'Idee', stand: 'Stand', wartet: 'Wartet', handlungsfeld: 'Handlungsfeld', kategorie: 'Kategorie', nummer: 'Nr.' },
  wartetSeit: (tage: number) => (tage === 0 ? 'seit heute' : tage === 1 ? 'seit 1 Tag' : `seit ${tage} Tagen`),
  wartetAuf: (tage: number) => `wartet auf Antragsteller:in ${tage === 1 ? 'seit 1 Tag' : `seit ${tage} Tagen`}`,
  funnelTitel: 'Ideen je Stand',
  funnelAlternative: 'Dieselben Zahlen als Liste',
  anzahl: (n: number) => (n === 1 ? '1 Idee' : `${n} Ideen`),

  // Prüfen (K4 Prüfen 6–8)
  pruefen: 'Idee prüfen',
  eingereichtVon: 'Eingereicht von',
  angaben: 'Angaben der Idee',
  aehnliche: 'Ähnliche Ideen',
  aehnlicheHinweis: (n: number, feld: string) => `Ähnlich: ${n === 1 ? '1 Idee' : `${n} Ideen`} ${feld ? `im Handlungsfeld ${feld} oder ` : ''}mit gleichen Bereichen.`,
  keineAehnlichen: 'Keine ähnlichen Ideen im Pool.',
  gleichesFeld: 'gleiches Handlungsfeld',
  gemeinsameBereiche: (n: number) => (n === 1 ? '1 gemeinsamer Bereich' : `${n} gemeinsame Bereiche`),
  zusammenfuehren: 'Ideen zusammenführen',
  zusammenfuehrenMit: (nr: number) => `Mit Idee ${nr} zusammenführen`,

  leitfragen: 'Leitfragen zum Eintritt P0',
  leitfragenSub: 'Antworten der UE mit dem vorgesehenen Sponsor (UC-001 Schritt 4); Fragen aus dem Phasenmodell in Kraft.',
  keinPhasenmodell: 'Es ist kein Phasenmodell in Kraft; die Leitfragen fehlen. Administration › Phasenmodell setzt eines in Kraft.',
  sponsor: 'Vorgesehener Sponsor',
  sponsorHilfe: 'Sieht die Idee lesend und qualifiziert sie mit.',
  antwortenSpeichern: 'Antworten speichern',
  gespeichert: 'Gespeichert.',

  raster: 'Kriterienraster',
  rasterSub: 'Je Kriterium hoch, mittel oder tief; das System schlägt die naheliegende Kategorie vor, Sie entscheiden.',
  kriterien: {
    relevanz: 'Strategische Relevanz', direktionen: 'Anzahl betroffener Direktionen', abhaengigkeiten: 'Abhängigkeiten',
    priorisierung: 'Bedarf an zentraler Priorisierung und Finanzierung', change: 'Change-Aufwand',
  } as Record<string, string>,
  stufen: { hoch: 'hoch', mittel: 'mittel', tief: 'tief' } as Record<string, string>,
  offen: 'offen',
  vorschlag: (v: { kategorie: string; hoch: number; mittel: number; tief: number }) => {
    const [n, s] = v.kategorie === 'A' ? [v.hoch, 'hoch'] : v.kategorie === 'C' ? [v.tief, 'tief'] : [v.mittel, 'mittel'];
    return `Raster: ${n} von 5 Kriterien ${s}, das spricht für Kategorie ${v.kategorie}.`;
  },
  vorschlagFehlt: 'Schätzen Sie alle fünf Kriterien ein, dann zeigt das System die naheliegende Kategorie.',

  kategorie: 'Kategorie',
  kategorien: { A: 'A · Transformation (strategisch)', B: 'B · Geschäftsleitung (taktisch-operativ)', C: 'C · Direktion (operativ)' } as Record<string, string>,
  portfolio: 'Portfolio',
  portfolioWaehlen: 'Portfolio wählen',
  kategorieBegruendung: 'Begründung',
  abweichung: (v: { kategorie: string; hoch: number; mittel: number; tief: number }, gewaehlt: string) => `${TP.vorschlag(v)} Sie haben ${gewaehlt} gewählt; halten Sie den Grund fest.`,
  zuordnen: 'Kategorie zuordnen',
  wirkung: (kategorie: string, gremium: string | null) => `Kategorie ${kategorie}${gremium ? ` · zuständig ${gremium}` : ''}`,

  // Aktionen (K4 Texte)
  rueckfrage: 'Rückfrage stellen',
  rueckfrageText: 'Rückfrage',
  rueckfrageFeld: 'Betrifft',
  rueckfrageAllgemein: 'die Idee allgemein',
  rueckfrageWirkung: (name: string) => `Die Idee geht mit Stand «in Ergänzung» an ${name} zurück; ${name} erhält «Rückfragen zu Ihrer Idee beantworten».`,
  rueckfrageGestellt: 'Rückfrage gestellt.',
  felder: {
    titel: 'Titel', ausgangslage: 'Ausgangslage', zielsetzung: 'Zielsetzung', handlungsfeld: 'Handlungsfeld', strategischesZiel: 'Strategisches Ziel',
    bereiche: 'Betroffene Bereiche', nutzen: 'Nutzen', aufwand: 'Aufwand', relevanz: 'Relevanz', herkunft: 'Herkunft',
  } as Record<string, string>,
  zurueckweisen: 'Zurückweisen',
  zurueckweisenFrage: (titel: string) => `Idee «${titel}» zurückweisen?`,
  begruendung: 'Begründung',
  begruendungFehlt: (name: string) => `Begründung fehlt: ${name} erfährt sonst nicht, warum die Idee nicht weiterverfolgt wird.`,
  zurueckweisenWirkung: (name: string) => `${name} wird mit Ihrer Begründung informiert. Ist ein Portfolio zugeordnet, erfährt es auch das Gremium (A-06).`,
  zurueckgewiesen: 'Idee zurückgewiesen.',
  zusammenfuehrenFrage: 'Ideen zusammenführen?',
  fuehrend: 'Führende Idee',
  zusammenfuehrenVorschau: (andere: number, fuehrende: number) => `Idee ${andere} wird als «zusammengeführt» geschlossen und verweist auf Idee ${fuehrende}. Betroffene Bereiche und die Texte von Ausgangslage und Zielsetzung gehen in Idee ${fuehrende} über.`,
  zusammenfuehrenWirkung: 'Beide Antragstellenden werden informiert. Das lässt sich nicht rückgängig machen.',
  zusammengefuehrt: 'Ideen zusammengeführt.',
  abbrechen: 'Abbrechen',
  person: 'die antragstellende Person',

  // Zustände
  bannerZusammengefuehrt: 'Diese Idee ist zusammengeführt und wird in der führenden Idee weiterverfolgt.',
  zurFuehrenden: 'Zur führenden Idee',
  bannerZurueckgewiesen: (begruendung: string) => `Zurückgewiesen. Begründung: ${begruendung}`,
  bannerErgaenzung: 'Die Idee liegt bei der antragstellenden Person zur Ergänzung; Prüfung und Kategorie sind bis zum erneuten Einreichen gesperrt.',
  nurLesen: 'Sie sehen die Idee lesend; prüfen kann die Unternehmensentwicklung.',
  konflikt: 'Die Idee wurde inzwischen geändert. Laden Sie sie neu und wiederholen Sie die Aktion.',
};
