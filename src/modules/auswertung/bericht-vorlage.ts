/**
 * Eigene Word-Vorlage des Portfolioberichts (AM.03.01, UC-018 Schritt 2; BC PC.04.02): Feldkatalog der Dokumentart
 * `portfoliobericht` und Ausgabe über die aktive Vorlage wie beim Projektvertrag (AP-E7-7). Die Werte kommen aus dem
 * gespeicherten Stand des Berichts, über die Blöcke von `berichtDokument` (gleiche Texte wie im Grundbestand); Tabellen
 * erscheinen als Text mit einer Zeile je Eintrag.
 */
import type { Tx } from '@vollholz/platform';
import { vorlage, type Block, type Dokument, type Format, type VorlageFeld } from '../vorlage/index.ts';
import type { BerichtDaten } from './bericht.ts';
import { berichtDokument } from './bericht-dokument.ts';

const g = (gruppe: string, felder: [string, string][]): VorlageFeld[] => felder.map(([schluessel, bezeichnung]) => ({ schluessel, bezeichnung, gruppe }));

const DECKBLATT: [string, string][] = [
  ['portfolio.name', 'Portfolio'], ['bericht.periode', 'Periode'], ['dashboard.abgeschlossen', 'Dashboard abgeschlossen'], ['bericht.erzeugt', 'Erzeugt'],
  ['bericht.stand', 'Stand'],
];
const UEBERSICHT: [string, string][] = [
  ['uebersicht.projekte', 'Projekte'], ['uebersicht.imPlan', 'Im Plan'], ['uebersicht.kritisch', 'Kritisch'], ['uebersicht.nichtGemeldet', 'Nicht gemeldet'],
  ['uebersicht.eskalationen', 'Eskalationen'],
];
/** Tabellen des Grundbestands nach ihrer Überschrift (`bericht-dokument.ts`). */
const TABELLEN: Record<string, [string, string]> = {
  'Funnel nach Phase': ['uebersicht.funnel', 'Funnel nach Phase'],
  '3 Projekte': ['projekte', 'Projekte der Periode'],
  '4 Risikolage': ['risikolage.risiken', 'Risiken'],
  Abhängigkeiten: ['risikolage.abhaengigkeiten', 'Abhängigkeiten'],
  'Offene Eskalationen': ['risikolage.eskalationen', 'Offene Eskalationen'],
};

export const BERICHT_FELDER: readonly VorlageFeld[] = [
  ...g('Deckblatt', [...DECKBLATT, ['portfolio.schluessel', 'Portfolio-Kürzel']]),
  ...g('1 Bericht der Programmleitung', [['bericht.kommentar', 'Kommentar der Programmleitung']]),
  ...g('2 Übersicht', [...UEBERSICHT, TABELLEN['Funnel nach Phase']!]),
  ...g('3 Projekte', [TABELLEN['3 Projekte']!]),
  ...g('4 Risikolage', [TABELLEN['4 Risikolage']!, TABELLEN.Abhängigkeiten!, TABELLEN['Offene Eskalationen']!]),
];

/** Feldkatalog registrieren (beim Laden des Moduls, `index.ts`). */
export const registriereVorlage = () => vorlage.felderRegistrieren('portfoliobericht', BERICHT_FELDER);

/** Dokument des Berichts mit den Datenfeldern an seinen Blöcken: Deckblatt, Kommentar, Übersicht und Tabellen. */
export function mitFeldern(b: BerichtDaten): Dokument {
  const d = berichtDokument(b);
  let ueberschrift = '';
  let felder = 0;
  const bloecke = d.bloecke.map((x): Block => {
    if (x.art === 'ueberschrift') { ueberschrift = x.text; return x; }
    if (x.art === 'felder') return { ...x, felder: (felder++ === 0 ? DECKBLATT : UEBERSICHT).map(([k]) => k) };
    if (x.art === 'absatz' && ueberschrift.startsWith('1 ')) return { ...x, feld: 'bericht.kommentar' };
    const tabelle = TABELLEN[ueberschrift];
    if (x.art === 'tabelle' && tabelle) return { ...x, feld: tabelle[0] };
    return x;
  });
  return { ...d, bloecke, felder: { 'portfolio.schluessel': b.portfolio.schluessel } };
}

/** Datei des Berichts: Word mit der aktiven eigenen Vorlage, sonst und für PDF der Grundbestand. `tx` in voller Sicht. */
export async function berichtAusgeben(tx: Tx, b: BerichtDaten, format: Format): Promise<Buffer> {
  return (await vorlage.ausgeben(tx, { art: 'portfoliobericht', format, dokument: mitFeldern(b) })).datei;
}
