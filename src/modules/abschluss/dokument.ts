/**
 * Abschlussbericht als Dokument (BC PS.04.01; UC-015 Schritt 5 «System erzeugt den Abschlussbericht»; Vorlagenart
 * «Abschlussbericht», UC-018) über die Ausgabe des Moduls `vorlage` (keine zweite PDF-Erzeugung). Gliederung nach dem
 * PM-Handbuch (Q8 Glossar «Abschlussbericht»: Zielerreichung, Ergebnisse, offene Punkte, Übergabe an den Betrieb,
 * Lessons Learned) und UC-015 (Business Case Abschluss, Nutzenrealisierung). Kopfzeile «Intern · enthält Personendaten»
 * (G12); Beträge nur mit Recht auf Beträge (A-33), sonst «nicht verfügbar». Feldkatalog für eigene Word-Vorlagen
 * (AP-E7-7) wie beim Projektvertrag.
 */
import { PERSONENDATEN, type Block, type Dokument, type VorlageFeld } from '../vorlage/index.ts';
import type { AbschlussOut } from './schemas.ts';

const ART_TITEL = { abschluss: 'Abschlussbericht', sistierung: 'Bericht zur Sistierung', abbruch: 'Bericht zum Abbruch' } as const;
const STAND_TEXT: Record<string, string> = { entwurf: 'in Arbeit', eingereicht: 'eingereicht', traktandiert: 'beim Gremium', abgenommen: 'abgenommen', nacharbeit: 'in Nacharbeit' };
const LEER = 'Keine Angaben.';
const NICHT_VERFUEGBAR = 'nicht verfügbar';

const datum = (d: Date | string | null | undefined): string => {
  if (!d) return '–';
  const t = typeof d === 'string' ? new Date(d.length === 10 ? `${d}T12:00:00Z` : d) : d;
  return new Intl.DateTimeFormat('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Zurich' }).format(t);
};
const betrag = (n: number) => `CHF ${new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;

const g = (gruppe: string, felder: [string, string][]): VorlageFeld[] => felder.map(([schluessel, bezeichnung]) => ({ schluessel, bezeichnung, gruppe }));

/** Datenfelder für die Zuordnung eigener Word-Vorlagen (UC-018 Schritt 2). */
export const ABSCHLUSS_FELDER: readonly VorlageFeld[] = [
  ...g('Deckblatt', [
    ['projekt.nummer', 'Projektnummer'], ['projekt.name', 'Projektname'], ['bericht.art', 'Art des Berichts'], ['bericht.stand', 'Stand'],
    ['bericht.eingereicht', 'Eingereicht'], ['bericht.abgenommen', 'Abgenommen'], ['dokument.datum', 'Erstellt am'],
  ]),
  ...g('Zielerreichung', [['bericht.projektstand', 'Stand des Vorhabens'], ['bericht.zielerreichung', 'Zielerreichung'], ['bericht.kpis', 'KPIs mit Ziel und Ergebnis']]),
  ...g('Business Case', [['bericht.businessCase', 'Business Case Abschluss P4'], ['bericht.kosten', 'Kosten Baseline, Prognose, Ist']]),
  ...g('Übergabe', [['bericht.uebergabe', 'Übergabe an Betrieb und Linie'], ['bericht.offenePunkte', 'Offene Punkte']]),
  ...g('Nutzenrealisierung', [['bericht.nutzenSp', 'Beurteilung Sponsor'], ['bericht.nutzenUe', 'Beurteilung UE']]),
  ...g('Lessons Learned', [['bericht.lessons', 'Lessons Learned']]),
];

/** Dateiname «Abschlussbericht-2026-014.pdf». */
export const dateiname = (art: keyof typeof ART_TITEL, nummer: string, endung: string) => `${ART_TITEL[art].replace(/ /g, '-')}-${nummer}.${endung}`.replace(/[^A-Za-z0-9._-]/g, '_');

export function abschlussDokument(a: AbschlussOut): Dokument {
  const b = a.bericht!;
  const titel = ART_TITEL[b.art];
  const kpi = new Map(a.grundlagen.kpis.map(k => [k.id, k]));
  const abschluss = b.art === 'abschluss';
  const h1 = (text: string): Block => ({ art: 'ueberschrift', text, ebene: 1 });
  const absatz = (text: string, feld: string): Block => ({ art: 'absatz', text, leer: LEER, feld });
  const k = a.grundlagen.kosten;
  let n = 0;
  const nr = (t: string) => `${++n} ${t}`;

  const bloecke: Block[] = [
    { art: 'titel', text: titel, untertitel: `${a.projekt.nummer} ${a.projekt.name}` },
    { art: 'felder', zeilen: [
      ['Projekt', `${a.projekt.nummer} ${a.projekt.name}`], ['Bericht', titel], ['Stand', STAND_TEXT[b.stand] ?? b.stand],
      ['Eingereicht', datum(b.eingereichtAt)], ['Abgenommen', datum(b.abgenommenAt)],
    ], felder: [null, 'bericht.art', 'bericht.stand', 'bericht.eingereicht', 'bericht.abgenommen'] },
    ...(abschluss
      ? [
        h1(nr('Zielerreichung')), absatz(b.zielerreichung, 'bericht.zielerreichung'),
        { art: 'tabelle' as const, kopf: ['KPI', 'Einheit', 'Zielwert', 'Erreicht', 'Bemerkung'], breiten: [4, 1.5, 1.5, 1.5, 3], leer: 'Keine KPIs erfasst.', feld: 'bericht.kpis',
          zeilen: b.kpiWerte.map(w => { const x = kpi.get(w.kpiId); return [x?.text ?? 'KPI nicht verfügbar', x?.einheit ?? '', x?.zielwert ?? '–', w.wert || '–', w.bemerkung]; }) },
        h1(nr('Business Case Abschluss')), absatz(b.businessCase, 'bericht.businessCase'),
        { art: 'felder' as const, zeilen: [
          ['Budget laut Baseline', k ? betrag(k.budgetBaseline) : NICHT_VERFUEGBAR], ['Prognose', k ? betrag(k.prognose) : NICHT_VERFUEGBAR],
          ['Ist-Kosten', k ? betrag(k.ist) : NICHT_VERFUEGBAR],
        ] as const, felder: ['bericht.kosten', null, null] },
      ]
      : [h1(nr('Stand des Vorhabens')), absatz(b.projektstand, 'bericht.projektstand')]),
    ...(abschluss ? [h1(nr('Übergabe an Betrieb und Linie')), absatz(b.uebergabe, 'bericht.uebergabe')] : []),
    h1(nr('Offene Punkte')),
    { art: 'tabelle', kopf: ['Offener Punkt', 'Verantwortlich', 'Termin'], breiten: [6, 3, 2], leer: 'Keine offenen Punkte.', feld: 'bericht.offenePunkte',
      zeilen: b.offenePunkte.map(o => [o.text, o.verantwortlich || '–', datum(o.termin)]) },
    ...(abschluss
      ? [
        h1(nr('Nutzenrealisierung')),
        { art: 'felder' as const, zeilen: [
          ['Sponsor', b.nutzen.sp ? `${b.nutzen.sp.text} (${b.nutzen.sp.von}, ${datum(b.nutzen.sp.at)})` : 'nicht beurteilt'],
          ['UE', b.nutzen.ue ? `${b.nutzen.ue.text} (${b.nutzen.ue.von}, ${datum(b.nutzen.ue.at)})` : 'nicht beurteilt'],
        ] as const, felder: ['bericht.nutzenSp', 'bericht.nutzenUe'] },
      ]
      : []),
    h1(nr('Lessons Learned')),
    { art: 'tabelle', kopf: ['Kategorie', 'Erkenntnis', 'Jahr'], breiten: [2, 8, 1], leer: 'Keine Lessons Learned erfasst.', feld: 'bericht.lessons',
      zeilen: a.lessonsLearned.map(l => [l.kategorie || '–', l.text, String(l.jahr)]) },
  ];

  return {
    titel: `${titel} ${a.projekt.nummer} ${a.projekt.name}`,
    kopfzeile: PERSONENDATEN,
    fusszeile: `${titel} ${a.projekt.nummer} · ${STAND_TEXT[b.stand] ?? b.stand}`,
    bloecke,
    felder: { 'projekt.nummer': a.projekt.nummer, 'projekt.name': a.projekt.name, 'dokument.datum': datum(new Date()) },
  };
}
