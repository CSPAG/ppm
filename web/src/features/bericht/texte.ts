/**
 * Texte des Features «Bericht» (UI-13, Kernablauf K1; Namensraum je Feature, docs/fachmodell.md 7.2): Anrede «Du»
 * (UX-E7), Schweizer Rechtschreibung, Texte aus K1 «Texte» und «Regeln und Rückmeldungen».
 */
import { satzende } from '../../ui/index.ts';
import { NAV } from './nav.ts';

const NACHFUEHREN = 'Wesentliche Abweichungen sind im Projektvertrag nachzuführen. Beantrage eine Änderung oder eskaliere.';
const TB_GRUND = {
  termin: (text: string, neu: string, alt: string, w: string) => `${text} neu ${neu} statt ${alt} laut Baseline (${w}).`,
  kosten: (phase: string, p: string) => `Prognose ${phase} ${p} über Budget.`,
};

export const TB = {
  reiter: NAV.reiter,
  palette: NAV.palette,
  titel: (monat: string) => `Statusbericht ${monat}`,
  periode: 'Periode',
  anlass: { monatlich: 'monatlich', ausserordentlich: 'ausserordentlich' } as Record<string, string>,
  ausserordentlich: 'Meldung ausserhalb des Rhythmus',
  ausserordentlichHint: 'Für eine wesentliche Entwicklung zwischen zwei Monatsberichten (UC-004).',
  kopf: {
    phase: 'Phase', abschlussPer: 'Abschluss per', naechster: 'Nächster Meilenstein', vorperiode: 'Vorperiode',
    keineVorperiode: 'Erster Bericht des Projekts',
    vorperiodeText: (monat: string, status: string, trend: string) => `${monat}: ${status} · ${trend}`,
  },
  stand: { entwurf: 'Entwurf', eingereicht: 'eingereicht', zurueckgegeben: 'zurückgegeben', geprueft: 'geprüft' } as Record<string, string>,
  gespeichert: 'Gespeichert', speichert: 'Speichert …', ungespeichert: 'Ungespeicherte Änderungen',
  abschnitte: {
    meilensteine: 'Meilensteine', kosten: 'Kosten', risiken: 'Risiken', kommunikation: 'Kommunikation', kpis: 'KPIs', beurteilung: 'Beurteilung',
  },
  meilenstein: {
    leer: 'Keine überfälligen Meilensteine und keine in den nächsten drei Monaten.',
    erreicht: 'Erreicht', erreichtAm: (d: string) => `erreicht am ${d}`, neuerTermin: 'Neuer Termin', termin: 'Termin', baseline: 'Baseline',
    abweichung: (w: string) => `${w} gegenüber Baseline`, ueberfaellig: 'überfällig',
    erreichtMelden: (t: string) => `${t} als erreicht melden`, terminVon: (t: string) => `Neuer Termin für ${t}`,
  },
  wesentlich: {
    beantragen: 'Änderung beantragen',
    eskalieren: 'Eskalieren',
    eskalierenTitel: 'Abweichung eskalieren?',
    eskalierenWirkung: 'Die Eskalation erscheint als Traktandenvorschlag in der nächsten Sitzung des entscheidenden Gremiums; die Unternehmensentwicklung erhält die Aufgabe, sie zu traktandieren (ohne entscheidendes Gremium von Hand). Dein Bericht bleibt ein Entwurf und ist mit der Eskalation verknüpft.',
    grund: 'Grund', grundHint: 'Worum es geht; vorbelegt mit der Abweichung.', grundFehlt: 'Angaben fehlen: Der Grund ist leer. Beschreib, worum es geht.',
    massnahme: 'Vorgeschlagene Massnahme (optional)', massnahmeHint: 'Leer: Das Gremium entscheidet über das weitere Vorgehen.',
    eskaliertOk: (vorgeschlagen: boolean) => (vorgeschlagen
      ? 'Eskaliert. Die Eskalation steht als Vorschlag für die nächste Sitzung des Gremiums.'
      : 'Eskaliert. Das Portfolio hat kein entscheidendes Gremium; die Unternehmensentwicklung traktandiert die Eskalation von Hand.'),
    eskaliert: (d: string, stand: string) => `Eskaliert am ${d} · ${stand}`,
    eskalationStand: (stand: string, vorgeschlagen: boolean) => (stand === 'offen'
      ? (vorgeschlagen ? 'Vorschlag ans Gremium' : 'die Unternehmensentwicklung traktandiert sie')
      : stand === 'traktandiert' ? 'vom Gremium zurückgestellt' : 'vom Gremium erledigt'),
    termin: (text: string, neu: string, alt: string, w: string) => `${TB_GRUND.termin(text, neu, alt, w)} ${NACHFUEHREN}`,
    kosten: (phase: string, p: string) => `${TB_GRUND.kosten(phase, p)} ${NACHFUEHREN}`,
    /** Abweichung allein, als Vorbelegung des Grunds der Eskalation. */
    grundVon: TB_GRUND,
    regel: 'Termin', regelKosten: 'Kosten',
  },
  kosten: {
    leer: 'Keine Kostenpositionen im Register.', budget: 'Budget', ist: 'Ist-Kosten', prognose: 'Prognose',
    istFehlt: 'Ist-Kosten noch nicht verfügbar', prognoseVon: (t: string) => `Prognose für ${t} in CHF`,
    summe: (phase: string, prognose: string, diff: string) => `Prognose ${phase}: ${prognose} · ${diff}`,
    ueber: (p: string) => `${p} über Budget`, unter: (p: string) => `${p} unter Budget`, imBudget: 'im Budget', ohneBudget: 'ohne Budget',
    keinRecht: 'Beträge sehen nur Rollen mit Recht auf Finanzen.',
  },
  risiko: {
    leer: 'Keine Projektrisiken erfasst.', massnahme: 'Massnahme', keineMassnahme: 'keine Massnahme',
    stand: { offen: 'offen', umgesetzt: 'umgesetzt' } as Record<string, string>,
    umgesetzt: (t: string) => `Massnahme zu «${t}» umgesetzt`, ewaw: (ew: string, aw: string) => `EW ${ew} · AW ${aw}`,
  },
  kommunikation: {
    leer: 'In dieser Periode sind keine Kommunikationsmassnahmen fällig.', erledigt: (t: string) => `${t} erledigt`,
  },
  kpi: {
    leer: 'Keine Projekt-KPIs erfasst.', ziel: 'Zielwert', letzter: 'Letzter Ist-Wert', neu: (t: string) => `Ist-Wert ${t}`, keiner: 'noch keiner',
    abP2: 'KPI-Werte erfasst du ab der Implementierung (P2).',
  },
  beurteilung: {
    status: 'Status', trend: 'Trend', vorperiode: (w: string) => `Vorperiode: ${w}`,
    statusWerte: { im_plan: 'Im Plan', kritisch: 'Kritisch' } as Record<string, string>,
    trendWerte: { aufwaerts: 'aufwärts', gleichbleibend: 'gleichbleibend', abwaerts: 'abwärts' } as Record<string, string>,
    abweichung: 'Abweichung', dimension: { inhalt: 'Inhalt', termin: 'Termin', ressourcen: 'Ressourcen', budget: 'Budget' } as Record<string, string>,
    stufen: { keine: 'keine', gering: 'gering', wesentlich: 'wesentlich' } as Record<string, string>,
    stufeWaehlen: 'wählen', kommentar: (d: string) => `Kommentar ${d}`,
    naechster: 'Nächster Meilenstein', abschlussPer: 'Abschluss per', abhaengigkeiten: 'Abhängigkeiten', entscheide: 'Anstehende Entscheide',
    begruendung: 'Begründung', massnahme: 'Massnahme', entscheidNoetig: 'Entscheid des PRAT nötig',
    kritischHinweis: 'Kritisch: Begründung und Massnahme fehlen. Projektauftraggeber:in und Unternehmensentwicklung brauchen beides, um handeln zu können.',
    wirkungKritisch: 'Projektauftraggeber:in und Unternehmensentwicklung werden beim Einreichen informiert. Mit «Entscheid des PRAT nötig» wird eine Eskalation für die nächste PRAT-Sitzung angelegt.',
  },
  panel: {
    titel: 'Bereit zum Einreichen', bereit: 'Alle Pflichtangaben sind erfasst.',
    fehlt: (n: number) => (n === 1 ? '1 Angabe fehlt' : `${n} Angaben fehlen`),
    wirkung: 'Die Unternehmensentwicklung erhält den Bericht zur Prüfung. Das Dashboard zeigt ihn sofort.',
    einreichen: 'Statusbericht einreichen',
    nichtBearbeitbar: (stand: string) => `Stand: ${stand}. Einreichen ist nicht möglich.`,
    sperre: (liste: string) => `Angaben fehlen: ${liste}. Ergänze sie, um den Bericht einzureichen.`,
  },
  eingereicht: (monat: string) => `Statusbericht ${monat} eingereicht. Die Unternehmensentwicklung prüft ihn bis Monatsende.`,
  rueckgaengig: 'Rückgängig',
  zurueckgezogen: 'Einreichen rückgängig gemacht. Der Bericht ist wieder ein Entwurf.',
  verlauf: 'Verlauf',
  banner: {
    eingereicht: (seit: string) => `In Prüfung bei der Unternehmensentwicklung seit ${satzende(seit)} Ändern bleibt möglich; die Änderung ist markiert und erscheint bei der Unternehmensentwicklung.`,
    geprueft: 'Der Bericht ist geprüft. Ändern bleibt möglich; die Änderung ist markiert und wird erneut geprüft.',
    zurueckgegeben: 'Rückfrage der Unternehmensentwicklung: Der Bericht ist wieder bearbeitbar. Reich ihn nach der Korrektur erneut ein.',
    abgeschlossen: (monat: string) => `${monat} ist abgeschlossen. Das Dashboard ist für die Gremien freigegeben. Spätere Änderungen tragen «geändert nach Abschluss» und führen das Dashboard nach.`,
    nurLesen: 'Du kannst diesen Bericht nur ansehen.',
    keinBericht: 'Dieses Projekt berichtet nicht monatlich (Phase P4 oder nicht aktiv).',
    zukunft: 'Diese Periode hat noch nicht begonnen.',
  },
  konflikt: 'Der Bericht wurde inzwischen geändert. Er ist neu geladen; prüf deine letzte Eingabe.',
  projektFehlt: 'Dieses Projekt gibt es nicht, oder du siehst es nicht.',
};
