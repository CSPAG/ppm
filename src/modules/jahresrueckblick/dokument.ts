/**
 * Jahresrückblick als Dokument (BC ZM.03.03; UC-013 Resultat «Jahresrückblick dokumentiert») über die Ausgabe des
 * Moduls `vorlage` im Layout des Grundbestands (keine zweite PDF-Erzeugung; der Jahresrückblick ist keine Dokumentart
 * mit eigener Vorlage nach UC-018, wie das Quartalsreporting). Gliederung nach UC-013 Schritt 1: Zielerreichung,
 * Vorhaben, Lessons Learned; danach Erkenntnisse und Massnahmen (Schritt 4). Kopfzeile «Intern · enthält Personendaten»
 * (G12), weil Lessons Learned Namen nennen können.
 */
import { PERSONENDATEN, type Block, type Dokument, type Format } from '../vorlage/index.ts';
import { TITEL } from './rueckblick.ts';
import type { JahresauswertungOut, JahresrueckblickOut } from './schemas.ts';

const STAND: Record<string, string> = { offen: 'offen', in_arbeit: 'in Arbeit', traktandiert: 'traktandiert', ausgewertet: 'ausgewertet (PRAT)' };
const datum = (iso: string | Date | null) => (iso ? new Intl.DateTimeFormat('de-CH', { timeZone: 'Europe/Zurich', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso)) : '–');
type Vorhaben = JahresauswertungOut['vorhaben']['laufend'];

const LZ: Record<string, string> = { aktiv: 'aktiv', sistiert: 'sistiert', abgeschlossen: 'abgeschlossen', abgebrochen: 'abgebrochen' };
const vorhaben = (l: Vorhaben, seit: boolean, leer: string): Block => seit
  ? { art: 'tabelle', kopf: ['Projekt', 'Portfolio', 'Phase', 'Am'], breiten: [45, 25, 10, 20], leer, zeilen: l.map(p => [`${p.nummer} ${p.name}`, p.portfolio, p.phase, datum(p.seit)]) }
  : { art: 'tabelle', kopf: ['Projekt', 'Portfolio', 'Phase', 'Lebenszyklus'], breiten: [45, 25, 10, 20], leer, zeilen: l.map(p => [`${p.nummer} ${p.name}`, p.portfolio, p.phase, LZ[p.lebenszyklus] ?? p.lebenszyklus]) };

export function rueckblickDokument(r: JahresrueckblickOut): Dokument {
  const a = r.auswertung as JahresauswertungOut;
  const z = a.zielerreichung;
  const bloecke: Block[] = [
    { art: 'titel', text: TITEL(r.jahr), untertitel: 'Auswertung des Jahres für den PRAT' },
    { art: 'felder', zeilen: [['Jahr', String(r.jahr)], ['Stand', STAND[r.stand] ?? r.stand], ['Traktandiert', datum(r.traktandiertAt)], ['Ausgewertet', datum(r.ausgewertetAt)]] },
    { art: 'ueberschrift', text: '1 Zielerreichung', ebene: 1 },
    { art: 'felder', zeilen: [['Mit Stand im Jahr', `${z.mitStand} von ${z.gesamt} Zielen`]] },
    { art: 'tabelle', kopf: ['Nr.', 'Ziel', 'Metrik', 'Zielwert', 'Stand', 'Beurteilung'], breiten: [7, 28, 15, 12, 13, 25], leer: 'Keine Ziele erfasst.',
      zeilen: z.ziele.map(x => [x.nummer, x.text, x.metrik, x.zielwert, x.stand ? `${x.stand}${x.quartal ? ` (${x.quartal.replace('-', ' ')})` : ''}` : '–', x.beurteilung || '–']) },
    { art: 'ueberschrift', text: '2 Vorhaben', ebene: 1 },
    { art: 'ueberschrift', text: 'Abgeschlossen', ebene: 2 },
    vorhaben(a.vorhaben.abgeschlossen, true, 'Im Jahr wurde kein Vorhaben abgeschlossen.'),
    { art: 'ueberschrift', text: 'Abgebrochen', ebene: 2 },
    vorhaben(a.vorhaben.abgebrochen, true, 'Im Jahr wurde kein Vorhaben abgebrochen.'),
    { art: 'ueberschrift', text: 'Laufend', ebene: 2 },
    vorhaben(a.vorhaben.laufend, false, 'Keine laufenden Vorhaben.'),
    { art: 'ueberschrift', text: '3 Lessons Learned', ebene: 1 },
    { art: 'tabelle', kopf: ['Projekt', 'Kategorie', 'Lesson Learned'], breiten: [28, 17, 55], leer: 'Im Jahr sind keine Lessons Learned erfasst.',
      zeilen: a.lessonsLearned.eintraege.map(l => [`${l.projekt.nummer} ${l.projekt.name}`, l.kategorie || '–', l.text]) },
    { art: 'ueberschrift', text: 'Abgeschlossene Vorhaben ohne Lessons Learned', ebene: 2 },
    { art: 'tabelle', kopf: ['Projekt', 'Portfolio', 'Abgeschlossen am'], breiten: [50, 30, 20], leer: 'Für alle abgeschlossenen Vorhaben liegen Lessons Learned vor.',
      zeilen: a.lessonsLearned.ohne.map(p => [`${p.nummer} ${p.name}`, p.portfolio, datum(p.seit)]) },
    { art: 'ueberschrift', text: '4 Erkenntnisse und Massnahmen für den nächsten Zielzyklus', ebene: 1 },
    { art: 'ueberschrift', text: 'Erkenntnisse', ebene: 2 },
    { art: 'absatz', text: r.erkenntnisse, leer: 'Keine Erkenntnisse erfasst.' },
    { art: 'ueberschrift', text: 'Massnahmen', ebene: 2 },
    { art: 'absatz', text: r.massnahmen, leer: 'Keine Massnahmen erfasst.' },
  ];
  return { titel: TITEL(r.jahr), kopfzeile: PERSONENDATEN, fusszeile: `${TITEL(r.jahr)} · Stand ${STAND[r.stand] ?? r.stand}`, bloecke };
}

export const dateiname = (jahr: number, format: Format) => `Jahresrueckblick_${jahr}.${format}`;
