/**
 * Texte des Features «Ressourcen» (Namensraum je Feature, docs/fachmodell.md 7.2): Anrede «Du» (UX-E7), Schweizer
 * Rechtschreibung; Pool = Rolle (A-20), Mengen in FTE.
 */
import { NAV } from './pfade.ts';

export const TR = {
  bereich: NAV.bereich,
  title: 'Ressourcen',
  sub: 'Kapazitätsangebot je Rolle und Monat gegen den Ressourcenbedarf der Projekte.',
  tabs: { auslastung: 'Auslastung', kapazitaet: 'Kapazität', bedarf: 'Bedarf' },
  aktionKapazitaet: NAV.aktionKapazitaet,
  aktionAuslastung: NAV.aktionAuslastung,
  zeitraum: 'Zeitraum', von: 'Von', bis: 'Bis',
  zeitraumUngueltig: 'Wähle einen Zeitraum von höchstens 60 Monaten, der nicht vor seinem Beginn endet.',
  rolle: 'Rolle',
  monat: 'Monat',
  // UI-23 Auslastung (Bericht)
  kennzahlen: 'Kennzahlen',
  engpaesse: 'Engpässe',
  engpaesseHinweis: 'Rolle und Quartal mit mehr Bedarf als Angebot',
  ohneAngebot: 'Bedarf ohne Angebot',
  ohneAngebotHinweis: 'Monate mit Bedarf, für die kein Angebot erfasst ist',
  frei: 'Freie Kapazität',
  freiHinweis: 'Summe des nicht verplanten Angebots im Zeitraum',
  fteMonate: (n: string) => `${n} FTE × Monate`,
  tabelle: 'Auslastung je Rolle und Monat',
  legende: 'Je Zelle: Bedarf / Angebot in FTE.',
  lage: {
    ueberbucht: 'überbucht', ohne_angebot: 'ohne Angebot', ausgelastet: 'ausgelastet', frei: 'frei', leer: 'kein Angebot, kein Bedarf',
  } as Record<string, string>,
  zelleLabel: (rolle: string, monat: string, bedarf: string, angebot: string, lage: string) => `${rolle}, ${monat}: Bedarf ${bedarf}, Angebot ${angebot}, ${lage}`,
  keinAngebot: 'kein Angebot',
  // Mustertext darstellung.md: «Kapazität Q2 2027: 7,5 FTE Projektleitung statt höchstens 5,0. Verschiebe …»
  engpassRegel: (quartal: string) => `Kapazität ${quartal}`,
  engpassIst: (fte: string, rolle: string) => `${fte} ${rolle}`,
  engpassGrenze: (fte: string) => `höchstens ${fte}`,
  engpassVorschlag: (n: number) => (n === 1
    ? 'Verschiebe den Start des betroffenen Projekts oder erhöhe das Angebot.'
    : `Verschiebe den Start eines der ${n} betroffenen Projekte oder erhöhe das Angebot.`),
  engpassOhneAngebot: (quartal: string, rolle: string, fte: string) => `Kapazität ${quartal}: ${fte} ${rolle} ohne erfasstes Angebot. Lege das Angebot unter «Kapazität» fest.`,
  engpassZeigen: 'Einzelwerte zeigen',
  szenario: (name: string) => `Auslastung im Szenario «${name}»: Projekte und Startmonate wie im Szenario, übrige Projekte wie geplant.`,
  istStand: 'Ist-Stand anzeigen',
  nurFte: 'Gezählt wird der Bedarf in FTE × Monate der Projekte, die du siehst; Bedarf nur als Grösse S, M oder L ist noch nicht eingerechnet.',
  leer: 'Im Zeitraum gibt es weder Angebot noch Bedarf. Die Auslastung zeigt, wo der Bedarf der Projekte das Kapazitätsangebot je Rolle übersteigt.',
  leerAktion: 'Kapazität planen',
  export: 'Als CSV exportieren',
  csvKopf: ['Rolle', 'Monat', 'Angebot (FTE)', 'Bedarf (FTE)', 'Frei (FTE)', 'Lage'],
  // Schublade: Einzelwerte einer Zelle
  beitraege: 'Bedarf der Projekte',
  projekt: 'Projekt', phase: 'Phase', fte: 'FTE', deckung: 'Deckung',
  gedeckt: 'gedeckt', offen: 'offen',
  keineBeitraege: 'In diesem Monat meldet kein Projekt Bedarf für diese Rolle.',
  summe: 'Summe',
  zelleUnbekannt: 'Diese Zelle liegt nicht im gewählten Zeitraum.',
  // UI-24 Kapazität (Arbeitsfläche)
  kapazitaetSub: 'Für Vorhaben verfügbare Kapazität je Rolle und Monat in FTE.',
  rasterLabel: 'Kapazitätsangebot je Rolle und Monat',
  zelleEingabe: (rolle: string, monat: string) => `Angebot ${rolle}, ${monat}, in FTE`,
  ungueltig: 'Zahl von 0 bis 1000, höchstens zwei Nachkommastellen.',
  nurLesen: 'Du kannst das Kapazitätsangebot nur ansehen; es pflegt das Ressourcenmanagement.',
  keineRollen: 'Es gibt noch keine Rollen des Ressourcenbedarfs. Lege sie in der Administration unter Codetabellen an (Rolle des Ressourcenbedarfs).',
  deaktiviert: 'deaktiviert',
  speichert: 'Wird gespeichert …',
  gespeichert: 'Gespeichert',
  gerade: 'gerade eben',
  vorSekunden: (s: number) => `vor ${s} s`,
  vorMinuten: (m: number) => `vor ${m} Min.`,
  ungespeichert: (n: number) => (n === 1 ? '1 Änderung noch nicht gespeichert' : `${n} Änderungen noch nicht gespeichert`),
  rueckgaengig: 'Rückgängig', wiederholen: 'Wiederholen',
  konflikt: 'Jemand anderes hat das Angebot inzwischen geändert. Lade neu; deine Änderungen bleiben erhalten und werden danach gespeichert.',
  neuLaden: 'Neu laden',
  fehlerSpeichern: 'Das Angebot konnte nicht gespeichert werden.',
  erneut: 'Erneut versuchen',
  tastatur: 'Pfeiltasten und Eingabetaste wechseln die Zeile; Strg+Z macht rückgängig.',
};
