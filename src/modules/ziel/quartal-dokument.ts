/**
 * Quartalsreporting als Dokument für den VR (BC ZM.03.02; UC-012 Schritt 5; K6 Schritt 13 «Als Dokument herunterladen")
 * über die Ausgabe des Moduls `vorlage` (keine zweite PDF-Erzeugung). Gliederung nach UC-012 Schritt 3: Gesamtstatus mit
 * Fortschritten und Meilensteinen, Zielerreichung, wesentliche Entwicklungen, kritische Risiken, Abhängigkeiten und
 * Eskalationen, Auswirkungen, Weiterleitungen (UC-006 A4). Kopfzeile «Intern · enthält Personendaten» (G12).
 */
import { PERSONENDATEN, type Block, type Dokument, type Format } from '../vorlage/index.ts';
import { monat, quartalLabel } from './quartal.ts';
import type { KommentareOut, QuartalsInhaltOut } from './quartal-schemas.ts';
import type { BerichtRow } from './quartal-store.ts';

const STAND: Record<string, string> = { in_arbeit: 'in Arbeit', traktandiert: 'traktandiert', verabschiedet: 'verabschiedet' };
const datum = (iso: string | Date | null) => (iso ? new Intl.DateTimeFormat('de-CH', { timeZone: 'Europe/Zurich', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso)) : '–');
const p = (x: { nummer: string; name: string }) => `${x.nummer} ${x.name}`;

export function quartalDokument(b: BerichtRow): Dokument {
  const i = b.inhalt as unknown as QuartalsInhaltOut;
  const k = b.kommentare as Partial<KommentareOut>;
  const pf = i.portfolios;
  const summe = (f: (x: (typeof pf)[number]) => number) => String(pf.reduce((s, x) => s + f(x), 0));
  const kommentar = (key: keyof KommentareOut): Block => ({ art: 'absatz', text: k[key] ?? '', leer: 'Kein Kommentar.' });
  const bloecke: Block[] = [
    { art: 'titel', text: 'Quartalsreporting an den VR', untertitel: quartalLabel(b.quartal) },
    { art: 'felder', zeilen: [
      ['Quartal', quartalLabel(b.quartal)], ['Erzeugt', datum(b.erzeugt_at)], ['Stand', STAND[b.stand] ?? b.stand],
      ['Verabschiedet im PRAT', datum(b.verabschiedet_at)],
    ] },
    { art: 'ueberschrift', text: '1 Gesamtstatus', ebene: 1 },
    kommentar('gesamtstatus'),
    { art: 'tabelle', kopf: ['Portfolio', 'Periode', 'Projekte', 'Im Plan', 'Kritisch', 'Nicht gemeldet'],
      leer: 'Kein Portfolio mit Berichtspflicht.',
      zeilen: [...pf.map(x => [x.name, monat(x.periode), String(x.projekte), String(x.imPlan), String(x.kritisch), String(x.nichtGemeldet)]),
        ...(pf.length > 1 ? [['Total', '', summe(x => x.projekte), summe(x => x.imPlan), summe(x => x.kritisch), summe(x => x.nichtGemeldet)]] : [])] },
    { art: 'ueberschrift', text: 'Kritische Projekte', ebene: 2 },
    { art: 'tabelle', kopf: ['Projekt', 'Portfolio', 'Phase', 'Trend'], leer: 'Keine kritischen Projekte.',
      zeilen: pf.flatMap(x => x.kritischeProjekte.map(c => [p(c), x.name, c.phase, c.trend ?? '–'])) },
    { art: 'ueberschrift', text: 'Nächste Meilensteine', ebene: 2 },
    { art: 'tabelle', kopf: ['Projekt', 'Meilenstein', 'Termin'], breiten: [30, 50, 20], leer: 'Keine Meilensteine.',
      zeilen: pf.flatMap(x => x.meilensteine).slice(0, 30).map(m => [p(m.projekt), m.text, datum(m.termin)]) },
    { art: 'ueberschrift', text: '2 Zielerreichung', ebene: 1 },
    { art: 'felder', zeilen: [['Nachgeführt', `${i.zielerreichung.nachgefuehrt} von ${i.zielerreichung.gesamt} Zielen`]] },
    { art: 'tabelle', kopf: ['Nr.', 'Ziel', 'Metrik', 'Zielwert', 'Stand', 'Beurteilung'], breiten: [7, 28, 15, 12, 13, 25], leer: 'Keine Ziele erfasst.',
      zeilen: i.zielerreichung.ziele.map(z => [z.nummer, z.text, z.metrik, z.zielwert,
        z.stand ? `${z.stand}${z.quartal && z.quartal !== b.quartal ? ` (${quartalLabel(z.quartal)})` : ''}` : '–', z.beurteilung || '–']) },
    { art: 'ueberschrift', text: '3 Wesentliche Entwicklungen', ebene: 1 },
    kommentar('entwicklungen'),
    { art: 'ueberschrift', text: '4 Kritische Portfoliorisiken', ebene: 1 },
    kommentar('risiken'),
    { art: 'tabelle', kopf: ['Ebene', 'Risiko', 'Wahrscheinlichkeit', 'Auswirkung', 'Massnahme'], breiten: [18, 34, 12, 12, 24], leer: 'Keine kritischen Risiken.',
      zeilen: pf.flatMap(x => x.risiken.map(r => [r.projekt ? p(r.projekt) : x.name, r.text, r.wahrscheinlichkeit, r.auswirkung, r.massnahme || '–'])) },
    { art: 'ueberschrift', text: '5 Strategische Abhängigkeiten und Eskalationen', ebene: 1 },
    kommentar('abhaengigkeiten'),
    { art: 'tabelle', kopf: ['Projekt', 'hängt ab von', 'Beschreibung'], leer: 'Keine Abhängigkeiten.',
      zeilen: pf.flatMap(x => x.abhaengigkeiten.map(a => [p(a.von), p(a.zu), a.text])) },
    { art: 'tabelle', kopf: ['Eskalation', 'Periode', 'Grund', 'Massnahme'], leer: 'Keine offenen Eskalationen.',
      zeilen: pf.flatMap(x => x.eskalationen.map(e => [p(e.projekt), monat(e.periode), e.grund, e.massnahme || '–'])) },
    { art: 'ueberschrift', text: '6 Finanzielle und organisatorische Auswirkungen', ebene: 1 },
    kommentar('auswirkungen'),
    { art: 'ueberschrift', text: '7 Geschäfte zur Weiterleitung an den VR', ebene: 1 },
    kommentar('weiterleitungen'),
    { art: 'tabelle', kopf: ['Datum', 'Gremium', 'Geschäft', 'Entscheid', 'Begründung'], breiten: [11, 9, 30, 15, 35], leer: 'Keine Geschäfte zur Weiterleitung.',
      zeilen: i.weiterleitungen.map(w => [datum(w.datum), w.gremium, w.titel + (w.ausserordentlichAm ? ` (bereits weitergeleitet ${datum(w.ausserordentlichAm)})` : ''), w.ergebnis, w.begruendung]) },
  ];
  return { titel: `Quartalsreporting ${quartalLabel(b.quartal)}`, kopfzeile: PERSONENDATEN, fusszeile: `Quartalsreporting an den VR · ${quartalLabel(b.quartal)}`, bloecke };
}

export const dateiname = (quartal: string, format: Format) => `Quartalsreporting_${quartal}.${format}`;
