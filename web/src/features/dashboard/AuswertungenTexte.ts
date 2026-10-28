/**
 * Texte der Ad-hoc-Auswertungen (UI-30; Namensraum je Datei, docs/fachmodell.md 7.2): Anrede «Du» (UX-OF-1), Schweizer
 * Rechtschreibung, Begriffe aus der Spezifikation (Kennzahl, Gruppierung, Einzelwerte, Export).
 */
import { NAV } from './nav.ts';

export const TA = {
  bereich: NAV.auswertungen,
  title: 'Auswertungen',
  sub: 'Spezifische Fragen beantworten: Filter, Kennzahlen und Gruppierung wählen, Einzelwerte ansehen und exportieren.',
  keinRecht: 'Ad-hoc-Auswertungen erstellen die Unternehmensentwicklung und die Finanzen.',
  filter: {
    titel: 'Filter', portfolio: 'Portfolio', allePortfolios: 'Alle Portfolios', phase: 'Phase', allePhasen: 'Alle Phasen',
    lebenszyklus: 'Lebenszyklus', status: 'Status', alleStatus: 'Alle', handlungsfeld: 'Handlungsfeld', alleHandlungsfelder: 'Alle Handlungsfelder',
    periode: 'Stichperiode', periodeHilfe: 'Status aus dem letzten eingereichten Bericht bis zu dieser Periode.',
    zuruecksetzen: 'Alle Filter zurücksetzen', entfernen: (f: string) => `Filter ${f} entfernen`,
  },
  kennzahlen: 'Kennzahlen',
  kennzahlenHilfe: 'Beträge nur mit Leserecht auf die Finanzen.',
  gruppierung: 'Gruppierung',
  gruppierungen: { portfolio: 'Portfolio', phase: 'Phase', status: 'Status', lebenszyklus: 'Lebenszyklus', handlungsfeld: 'Handlungsfeld', keine: 'Keine (Gesamt)' } as Record<string, string>,
  lebenszyklen: { aktiv: 'Aktiv', sistiert: 'Sistiert', abgebrochen: 'Abgebrochen', abgeschlossen: 'Abgeschlossen', zurueckgezogen: 'Zurückgezogen' } as Record<string, string>,
  status: { kritisch: 'Kritisch', im_plan: 'Im Plan', ohne: 'Ohne Bericht' } as Record<string, string>,
  ergebnis: 'Ergebnis',
  ergebnisLabel: (gruppierung: string, n: number) => `Ergebnis nach ${gruppierung}, ${n === 1 ? '1 Projekt' : `${n} Projekte`}`,
  summe: 'Summe',
  einzelwerte: 'Einzelwerte',
  zelle: (gruppe: string, kennzahl: string, wert: string) => `${gruppe}, ${kennzahl}: ${wert}. Einzelwerte öffnen`,
  einzelwerteTitel: (gruppe: string) => `Einzelwerte: ${gruppe}`,
  projekt: 'Projekt', phase: 'Phase', statusSpalte: 'Status',
  oeffnen: (nr: string, name: string) => `Projekt ${nr} ${name} öffnen`,
  gruppeUnbekannt: 'Diese Gruppe gibt es im aktuellen Ergebnis nicht mehr.',
  export: 'Exportieren (CSV)',
  exportEinzelwerte: 'Einzelwerte exportieren (CSV)',
  exportiert: (name: string) => `${name} heruntergeladen.`,
  leer: 'Keine Projekte passen zu diesen Filtern.',
  ohneStatus: 'kein Bericht',
};
