/**
 * Codetabellen (BC AM.02.02, UC-017 Schritt 2): fest im Code (docs/fachmodell.md 2.2), die Werte pflegt ADM je
 * Organisation. Die Vorgabe entspricht dem PM-Handbuch und den Annahmen des Bauplans; «Vorgabe laden» ergänzt nur
 * fehlende Schlüssel und überschreibt nichts (fachmodell.md 6).
 */

export interface Codetabelle {
  schluessel: string;
  label: string;
  beschreibung: string;
  vorgabe: readonly { schluessel: string; label: string }[];
}

export const CODETABELLEN = [
  {
    schluessel: 'projektstatus', label: 'Projektstatus', beschreibung: 'Status im Statusbericht, zweistufig (Q8 Kap. 9).',
    vorgabe: [{ schluessel: 'im_plan', label: 'Im Plan' }, { schluessel: 'kritisch', label: 'Kritisch' }],
  },
  {
    schluessel: 'trend', label: 'Trend', beschreibung: 'Entwicklung gegenüber der Vorperiode.',
    vorgabe: [{ schluessel: 'aufwaerts', label: 'aufwärts' }, { schluessel: 'gleichbleibend', label: 'gleichbleibend' }, { schluessel: 'abwaerts', label: 'abwärts' }],
  },
  {
    schluessel: 'groesse', label: 'Grösse', beschreibung: 'Grobe Grösse des Personalbedarfs bis Gate P1–P2 (UC-003 A1).',
    vorgabe: [{ schluessel: 'S', label: 'S' }, { schluessel: 'M', label: 'M' }, { schluessel: 'L', label: 'L' }],
  },
  {
    schluessel: 'kategorie', label: 'Projektkategorie', beschreibung: 'Kategorie A, B oder C; bestimmt das Portfolio (Q8 Kap. 1, 6).',
    vorgabe: [{ schluessel: 'A', label: 'A – Transformationsprogramm' }, { schluessel: 'B', label: 'B – Geschäftsleitung' }, { schluessel: 'C', label: 'C – Direktion' }],
  },
  {
    // A-38 (UX-OF-17)
    schluessel: 'abweichung', label: 'Abweichung', beschreibung: 'Beurteilung je Dimension im Statusbericht (Inhalt, Termin, Ressourcen, Budget).',
    vorgabe: [{ schluessel: 'keine', label: 'keine' }, { schluessel: 'gering', label: 'gering' }, { schluessel: 'wesentlich', label: 'wesentlich' }],
  },
  {
    schluessel: 'wertestrom', label: 'Wertestrom', beschreibung: 'Werteströme der Leitfragen je Gate (Q8 Kap. 7.6).',
    vorgabe: [
      { schluessel: 'nutzen', label: 'Business Value (Nutzen)' }, { schluessel: 'projekt', label: 'Projektmanagement' },
      { schluessel: 'klinik', label: 'Klinische Transformation und Lösungsdesign' }, { schluessel: 'ict', label: 'Integration ICT (DTI)' },
      { schluessel: 'infrastruktur', label: 'Infrastruktur (DBI)' },
    ],
  },
  {
    schluessel: 'risikostufe', label: 'Risikostufe', beschreibung: 'Eintrittswahrscheinlichkeit und Auswirkung von Risiken (PC.02.04).',
    vorgabe: [{ schluessel: 'hoch', label: 'hoch' }, { schluessel: 'mittel', label: 'mittel' }, { schluessel: 'tief', label: 'tief' }],
  },
  {
    // Q7 Kap. 9.2, A-20: Pool = Rolle
    schluessel: 'ressourcenrolle', label: 'Rolle des Ressourcenbedarfs', beschreibung: 'Rollen für den Personalbedarf je Phase (Q7 Kap. 9.2).',
    vorgabe: [
      { schluessel: 'sponsor', label: 'Sponsor' }, { schluessel: 'projektleitung', label: 'Projektleitung' }, { schluessel: 'ctl', label: 'CTL' },
      { schluessel: 'kernteam', label: 'TPL / Kernteam' }, { schluessel: 'projektmitarbeit', label: 'Projektmitarbeit' },
    ],
  },
  {
    schluessel: 'idee_herkunft', label: 'Herkunft der Idee', beschreibung: 'Woher eine Projektidee stammt (K4, UC-001 Schritt 1).',
    vorgabe: [{ schluessel: 'innovationsprozess', label: 'Innovationsprozess' }, { schluessel: 'strategieprozess', label: 'Strategieprozess' }, { schluessel: 'bereich', label: 'Bereich' }],
  },
] as const satisfies readonly Codetabelle[];

export type CodetabelleKey = (typeof CODETABELLEN)[number]['schluessel'];

export const CODETABELLE_KEYS = CODETABELLEN.map(c => c.schluessel) as CodetabelleKey[];

export const codetabelle = (key: string): Codetabelle | undefined => CODETABELLEN.find(c => c.schluessel === key);
