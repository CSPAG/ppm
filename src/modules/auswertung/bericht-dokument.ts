/**
 * Portfoliobericht als Dokument (BC PC.04.02; AP-E2-3) über die Ausgabe des Moduls `vorlage` (AP-E3-5, keine zweite
 * PDF-Erzeugung): Kommentar der Programmleitung, Übersicht, Funnel nach Phase, Projekte, Risikolage. Kopfzeile «Intern ·
 * enthält Personendaten» (Projektleitungen, G12).
 */
import { PERSONENDATEN, type Block, type Dokument, type Format } from '../vorlage/index.ts';
import { monat, TITEL_TRAKTANDUM, type BerichtDaten } from './bericht.ts';

const STATUS: Record<string, string> = { im_plan: 'Im Plan', kritisch: 'Kritisch' };
const MELDUNG: Record<string, string> = { gemeldet: 'gemeldet', ausstehend: 'ausstehend', nicht_gemeldet: 'nicht gemeldet', ohne_pflicht: 'ohne Berichtspflicht' };
const TREND: Record<string, string> = { aufwaerts: 'aufwärts', gleichbleibend: 'gleichbleibend', abwaerts: 'abwärts' };
const STUFE: Record<string, string> = { hoch: 'hoch', mittel: 'mittel', tief: 'tief' };
const datum = (iso: string | Date | null) => (iso ? new Intl.DateTimeFormat('de-CH', { timeZone: 'Europe/Zurich', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso)) : '–');

export function berichtDokument(b: BerichtDaten): Dokument {
  const d = b.dashboard;
  const r = b.risikolage;
  const zaehl = (f: (i: (typeof d.items)[number]) => boolean) => String(d.items.filter(f).length);
  const bloecke: Block[] = [
    { art: 'titel', text: 'Portfoliobericht', untertitel: `${b.portfolio.name} · ${monat(b.periode)}` },
    { art: 'felder', zeilen: [
      ['Portfolio', b.portfolio.name], ['Periode', monat(b.periode)], ['Dashboard abgeschlossen', datum(d.abgeschlossenAt)],
      ['Erzeugt', datum(b.erzeugtAt)], ['Stand', b.stand === 'bereitgestellt' ? `bereitgestellt ${datum(b.bereitgestelltAt)}` : 'Entwurf'],
    ] },
    { art: 'ueberschrift', text: `1 ${TITEL_TRAKTANDUM}`, ebene: 1 },
    { art: 'absatz', text: b.kommentar, leer: 'Kein Kommentar.' },
    { art: 'ueberschrift', text: '2 Übersicht', ebene: 1 },
    { art: 'felder', zeilen: [
      ['Projekte', String(d.items.length)], ['Im Plan', zaehl(i => i.status === 'im_plan')], ['Kritisch', zaehl(i => i.status === 'kritisch')],
      ['Nicht gemeldet', zaehl(i => i.meldung === 'nicht_gemeldet')], ['Eskalationen', zaehl(i => i.merkmale.includes('eskalation'))],
    ] },
    { art: 'ueberschrift', text: 'Funnel nach Phase', ebene: 2 },
    { art: 'tabelle', kopf: ['Phase', 'Projekte', 'Im Plan', 'Kritisch', 'Nicht gemeldet'],
      zeilen: d.funnel.map(f => [f.phase, String(f.anzahl), String(f.imPlan), String(f.kritisch), String(f.nichtGemeldet)]) },
    { art: 'ueberschrift', text: '3 Projekte', ebene: 1 },
    { art: 'tabelle', kopf: ['Nr.', 'Projekt', 'Phase', 'Status', 'Trend', 'Meldung', 'Nächster Meilenstein', 'Projektleitung'],
      breiten: [9, 20, 6, 10, 11, 11, 20, 13], leer: 'Keine Projekte in dieser Periode.',
      zeilen: d.items.map(i => [
        i.nummer, i.name + (i.merkmale.includes('eskalation') ? ' (Eskalation)' : ''), i.phase,
        i.status ? STATUS[i.status]! : '–', i.trend ? TREND[i.trend] ?? i.trend : '–', MELDUNG[i.meldung]!,
        i.naechsterMeilenstein ? `${i.naechsterMeilenstein.text}${i.naechsterMeilenstein.termin ? ` (${datum(i.naechsterMeilenstein.termin)})` : ''}` : '–',
        i.projektleitung ?? '–',
      ]) },
    { art: 'ueberschrift', text: '4 Risikolage', ebene: 1 },
    { art: 'tabelle', kopf: ['Ebene', 'Risiko', 'Wahrscheinlichkeit', 'Auswirkung', 'Massnahme', 'Stand'], breiten: [14, 30, 11, 11, 24, 10],
      leer: 'Keine Risiken erfasst.',
      zeilen: r.risiken.map(x => [
        x.projekt ? `${x.projekt.nummer} ${x.projekt.name}` : 'Portfolio', x.text, STUFE[x.wahrscheinlichkeit]!, STUFE[x.auswirkung]!,
        x.massnahme || '–', x.massnahmeStand === 'umgesetzt' ? 'umgesetzt' : 'offen',
      ]) },
    { art: 'ueberschrift', text: 'Abhängigkeiten', ebene: 2 },
    { art: 'tabelle', kopf: ['Projekt', 'hängt ab von', 'Beschreibung'], leer: 'Keine Abhängigkeiten.',
      zeilen: r.abhaengigkeiten.map(a => [`${a.von.nummer} ${a.von.name}`, `${a.zu.nummer} ${a.zu.name}`, a.text]) },
    { art: 'ueberschrift', text: 'Offene Eskalationen', ebene: 2 },
    { art: 'tabelle', kopf: ['Projekt', 'Periode', 'Grund', 'Massnahme'], leer: 'Keine offenen Eskalationen.',
      zeilen: r.eskalationen.map(e => [`${e.projekt.nummer} ${e.projekt.name}`, monat(e.periode), e.grund, e.massnahme || '–']) },
  ];
  return { titel: `Portfoliobericht ${b.portfolio.name} ${monat(b.periode)}`, kopfzeile: PERSONENDATEN, fusszeile: `Portfoliobericht ${b.portfolio.name} · ${monat(b.periode)}`, bloecke };
}

export const dateiname = (b: Pick<BerichtDaten, 'portfolio' | 'periode'>, format: Format) => `Portfoliobericht_${b.portfolio.schluessel}_${b.periode}.${format}`;
