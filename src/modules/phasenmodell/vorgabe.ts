/**
 * Vorgabe des PM-Handbuchs (docs/fachmodell.md Abschnitt 6): Inhalt eines neuen Phasenmodells, wenn die Organisation noch
 * keines in Kraft hat oder die UE die Vorgabe ausdrücklich lädt (UC-017 Schritt 3).
 *
 * Quellen: Phasen, Lieferergebnisse und Meilensteine Q8 Kap. 7 mit Abb. 4 und Anhang 1 (Deliverable-Matrix); Gates und
 * Leitfragen je Wertestrom Q6 F6 bzw. Q8 Abb. 6; Fristen A-26, A-27 und Q8 Kap. 8.1, 8.4; Pflichtangaben A-12 (UC-003
 * A1); Toleranzen ohne Wert, weil Q8 keine nennt (A-10, K11). Die Kapitelwirkung ist ein Vorschlag aus den Kapiteln der
 * Vorlage Projektvertrag (Q7: 5 Abgrenzung, 9 Ressourcen mit Kosten und Personal), den die UE bestätigt (UC-007 A1).
 */
import type { Dokument } from './schemas.ts';

/** Schlüssel der Werteströme (Codetabelle `wertestrom` in `stammdaten`, Q8 Abb. 4 und 6). */
export const WERTESTROEME = ['nutzen', 'projekt', 'klinik', 'ict', 'infrastruktur'] as const;

/** Bezeichnungen für Prüftexte, solange die Codetabelle nicht gelesen wird (Q8 Kap. 7 «Werteströme», PPM-Master). */
export const WERTESTROM_LABEL: Record<(typeof WERTESTROEME)[number], string> = {
  nutzen: 'Business Value (Nutzen)', projekt: 'Projektmanagement', klinik: 'Klinisches Transformations- & Lösungsdesign',
  ict: 'Integration ICT (DTI)', infrastruktur: 'Integration Infrastruktur (DBI)',
};

type Leitfragen = readonly [string, string, string, string, string];
const leitfragen = (f: Leitfragen) => f.map((text, i) => ({ wertestrom: WERTESTROEME[i]!, text }));

const lieferergebnisse = (...t: string[]) => t.map(text => ({ art: 'lieferergebnis' as const, text }));
const meilensteine = (...t: string[]) => t.map(text => ({ art: 'meilenstein' as const, text }));

/** Personal und Kosten ab dem Gate P1–P2 (A-12, UC-003 A1): statt der Grösse S/M/L. */
const planung = [
  { kapitel: 9, feld: 'personal', text: 'Personal in FTE und Monaten je Rolle und Phase' },
  { kapitel: 9, feld: 'kosten', text: 'Kosten je Phase bis P4 (CAPEX/OPEX)' },
];

export const VORGABE: Dokument = {
  phasen: [
    { code: 'PRE_P0', name: 'Ideen', ergebnisse: [], pflichtangaben: [] },
    {
      code: 'P0', name: 'Initialisierung', pflichtangaben: [],
      ergebnisse: [
        ...lieferergebnisse('Vorstudie (optional)', 'Initialer Business Case P0', 'Projektvertrag für P1'),
        ...meilensteine('Abnahme der Vorstudie mit initialem Business Case P0', 'Entscheid zur Erstellung einer Projektvereinbarung', 'Freigabe Projektvereinbarung P1', 'Freigabe Phase Konzept & Planung'),
      ],
    },
    {
      code: 'P1', name: 'Konzept & Planung', pflichtangaben: [],
      ergebnisse: [
        ...lieferergebnisse('Lösungskonzept', 'Detailplanung für die Implementierung', 'Business Case Baseline P1', 'Projektvertrag für P2'),
        ...meilensteine('Freigabe Lösungskonzept und Detailplanung mit Business Case P1', 'Freigabe Projektvereinbarung Phase 2', 'Freigabe Phase Implementierung'),
      ],
    },
    {
      code: 'P2', name: 'Implementierung', pflichtangaben: [],
      ergebnisse: [
        ...lieferergebnisse('Realisierte und in den produktiven Betrieb überführte Lösung', 'Business Case Update P2', 'Projektvertrag für P3'),
        ...meilensteine('Abnahme der realisierten und produktiven Lösung mit Business Case P2', 'Freigabe Projektvereinbarung Phase 3', 'Freigabe Phase Stabilisierung & Monitoring'),
      ],
    },
    {
      code: 'P3', name: 'Stabilisierung & Monitoring', pflichtangaben: [],
      ergebnisse: [
        ...lieferergebnisse('Übergabe der produktiven Lösung an die Betriebsorganisation', 'Business Case Update P3', 'Projektvertrag für P4'),
        ...meilensteine('Übergabe an den Betrieb mit Review des realisierten Nutzens (Business Case P3)', 'Freigabe Projektvereinbarung Phase 4', 'Freigabe Phase Abschluss'),
      ],
    },
    {
      code: 'P4', name: 'Abschluss', pflichtangaben: [],
      ergebnisse: [
        ...lieferergebnisse('Abschlussbericht', 'Business Case Abschluss P4', 'Lessons Learned'),
        ...meilensteine('Abnahme Abschlussbericht mit Kosten/Nutzen-Erreichung (Business Case P4)', 'Formeller Projektabschluss'),
      ],
    },
  ],
  gates: [
    {
      code: 'EINTRITT_P0', name: 'Eintritt P0', pflichtangaben: [],
      leitfragen: leitfragen(['Ist die Initiative strategisch relevant?', 'Ist das Projektziel klar?', 'Ist die klinische Fragestellung klar?', 'Braucht es ICT-Einbindung?', 'Braucht es Infrastruktur-Anpassungen?']),
    },
    {
      code: 'P0_P1', name: 'Gate P0–P1', pflichtangaben: [],
      leitfragen: leitfragen(['Hat das Projekt ausreichenden Nutzen?', 'Ist das Projekt ausreichend definiert?', 'Ist das Zielbild der klinischen Transformation klar?', 'Verstehen wir die initialen ICT-Anforderungen?', 'Verstehen wir die initialen Infrastruktur-Anforderungen?']),
    },
    {
      code: 'P1_P2', name: 'Gate P1–P2', pflichtangaben: planung,
      leitfragen: leitfragen(['Stimmt das Kosten/Nutzen-Verhältnis?', 'Sind wir reif für die Umsetzung und können es finanzieren?', 'Ist die Lösung klinisch umsetzbar?', 'Haben wir einen robusten ICT-Integrationsplan?', 'Haben wir einen robusten Infrastruktur-Umsetzungsplan?']),
    },
    {
      code: 'P2_P3', name: 'Gate P2–P3 (Go-Live)', pflichtangaben: planung,
      leitfragen: leitfragen(['Haben wir kosteneffizient Nutzen erreicht?', 'Ist die Organisation Go-Live-bereit?', 'Ist die klinische Lösung erfolgreich implementiert?', 'Ist die ICT-Integration erfolgreich vollzogen?', 'Ist die Infrastruktur-Anpassung erfolgreich umgesetzt?']),
    },
    {
      code: 'P3_P4', name: 'Gate P3–P4', pflichtangaben: planung,
      leitfragen: leitfragen(['Ist der Nutzen stabil erreicht?', 'Ist das Projektziel stabil erreicht?', 'Ist die klinische Lösung stabil verankert?', 'Ist die Integration stabil?', 'Ist die ICT-Infrastruktur stabil genutzt?']),
    },
    {
      code: 'EXIT_P4', name: 'Exit P4', pflichtangaben: [],
      leitfragen: leitfragen(['Haben wir Kosten/Nutzen erreicht?', 'Kann das Projekt formal abgeschlossen werden?', 'Kann die klinische Lösung an die Linienorganisation übergeben werden?', 'Ist die operative ICT-Übergabe erfolgreich abgeschlossen?', 'Ist die operative Infrastruktur-Übergabe erfolgreich abgeschlossen?']),
    },
  ],
  kapitelWirkung: [{ kapitel: 5, dimension: 'scope' }, { kapitel: 9, dimension: 'budget' }, { kapitel: 9, dimension: 'ressourcen' }],
  fristen: [
    { schluessel: 'bericht_aufgabe', wert: 18, einheit: 'tag_im_monat' },
    { schluessel: 'bericht_stichtag', wert: 25, einheit: 'tag_im_monat' },
    { schluessel: 'gate_vorbereiten', wert: 30, einheit: 'arbeitstage' },
    { schluessel: 'sitzung_vorbereiten', wert: 15, einheit: 'arbeitstage' },
    { schluessel: 'versand', wert: 5, einheit: 'arbeitstage' },
    { schluessel: 'protokoll', wert: 3, einheit: 'arbeitstage' },
  ],
  toleranzen: [
    { dimension: 'termin', wert: null, einheit: 'kalendertage' },
    { dimension: 'kosten', wert: null, einheit: 'prozent' },
    { dimension: 'umfang', wert: null, einheit: 'prozent' },
  ],
};
