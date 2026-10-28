/**
 * Texte der Register in der Projektübersicht (AP-E0-6, Namensraum des Features «Projekte»): Anrede «Du», Schweizer
 * Rechtschreibung, Begriffe nach docs/ux/darstellung.md und der Vorlage Projektvertrag (Q7).
 */
type Stufe = 'hoch' | 'mittel' | 'tief';

export const TR = {
  meilensteine: {
    titel: 'Meilensteine und Lieferergebnisse',
    leer: 'Noch keine Meilensteine geplant. Die Projektleitung plant sie im Projektvertrag (Kapitel 7).',
    tabelle: 'Meilensteine, Lieferergebnisse und Kommunikationsmassnahmen',
    phase: 'Phase', art: 'Art', text: 'Bezeichnung', termin: 'Termin', stand: 'Stand',
    art_: { meilenstein: 'Meilenstein', lieferergebnis: 'Lieferergebnis', kommunikation: 'Kommunikation' },
    erreicht: (d: string) => `erreicht ${d}`,
    abgenommen: (d: string) => `vom Gremium abgenommen ${d}`,
    offen: 'offen',
    ueberfaellig: 'überfällig',
    baseline: (d: string) => `Baseline ${d}`,
    keinTermin: 'kein Termin',
  },
  risiken: {
    titel: 'Risiken',
    leer: 'Keine Risiken erfasst.',
    tabelle: 'Risiken des Projekts, höchste Auswirkung zuerst',
    text: 'Risiko', ew: 'EW', aw: 'AW', ewLang: 'Eintrittswahrscheinlichkeit', awLang: 'Auswirkung', massnahme: 'Massnahme', stand: 'Stand',
    stufe: { hoch: 'hoch', mittel: 'mittel', tief: 'tief' } satisfies Record<Stufe, string>,
    massnahmeStand: { offen: 'offen', umgesetzt: 'umgesetzt' },
    keineMassnahme: 'keine Massnahme',
  },
  kosten: {
    titel: 'Kosten',
    leer: 'Noch keine Kosten geplant.',
    tabelle: 'Kosten nach CAPEX und OPEX',
    art: 'Art', baseline: 'Budget (Baseline)', prognose: 'Prognose', ist: 'Ist',
    art_: { capex: 'CAPEX', opex: 'OPEX' },
    total: 'Total',
    nichtVerfuegbar: 'noch nicht verfügbar',
  },
  abhaengigkeiten: {
    titel: 'Abhängigkeiten',
    leer: 'Keine Abhängigkeiten zu anderen Projekten erfasst.',
    ausgehend: 'Dieses Projekt hängt ab von',
    eingehend: 'Von diesem Projekt hängt ab',
    unsichtbar: 'ein Projekt, das du nicht siehst',
    ansprechperson: (p: string) => `Ansprechperson: ${p}`,
  },
  weitere: {
    titel: 'Weitere Angaben',
    kpis: 'KPIs', stakeholder: 'Stakeholder', bedarf: 'Ressourcenbedarf', meldungen: 'Meldungen an ICT und Infrastruktur',
    anzahl: (n: number) => (n === 1 ? '1 Eintrag' : `${n} Einträge`),
    fte: (fte: string) => `${fte} geplant`,
    gemeldet: (stelle: string, datum: string) => `${stelle}, gemeldet ${datum}`,
    stelle: { dti: 'ICT (DTI)', dbi: 'Infrastruktur (DBI)' },
    keine: 'keine',
  },
  weitereEintraege: (n: number) => `Gezeigt werden die ersten ${n} Einträge.`,
};
