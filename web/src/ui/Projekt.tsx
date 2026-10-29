/**
 * Projekt als Zeile des Dashboards (docs/ux/darstellung.md «Projekt», Q6 F7): «klein» für Eingang, Traktandum und
 * Auswahl (Name, Phase, Status mit Trend); «mittel» als Datenliste für Dashboard, Monatsabschluss und Meine Projekte
 * (Nummer, Handlungsfeld, Name, Thema, Projektleitung, Phase mit «Abschluss per», nächster Meilenstein, Status mit
 * Vorperiode und Trend). Auf dem Telefon wird die Zeile zur Karte mit Name, Status und Meilenstein (I-L6). Projekte
 * «via SNS-VR» oder mit offener Eskalation tragen ein Badge mit Text. «gross» (Projektübersicht) folgt mit Etappe E1.
 */
import { Datenliste, type DatenlisteProps, type Spalte } from './Datenliste.tsx';
import { fmtDatum, fmtPhase, type Phase, type Tag } from './format.ts';
import { Status, type Projektstatus, type Trend } from './Status.tsx';
import { T } from './texte/index.ts';

export type ProjektMerkmal = 'sns-vr' | 'eskalation' | 'nicht_geprueft';

export interface ProjektKurz {
  /** Jahr und laufende Nummer, z. B. «2026-014». */
  nummer: string;
  name: string;
  phase: Phase;
  status: Projektstatus;
  vorperiode?: Projektstatus;
  trend?: Trend;
  handlungsfeld?: string;
  thema?: string;
  projektleitung?: string;
  /** Geplanter Abschluss der aktuellen Phase (`YYYY-MM-DD`). */
  abschlussPer?: string;
  meilenstein?: { termin: string; text: string };
  merkmale?: ProjektMerkmal[];
}

/** Phase als Kürzel, Name als Tooltip und für Bildschirmleser (enge Spalten). */
export function PhaseKurz({ phase }: { phase: Phase }) {
  const lang = fmtPhase(phase);
  return <span className="phase"><span aria-hidden="true" title={lang}>{phase}</span><span className="sr">{lang}</span></span>;
}

export function Merkmale({ merkmale }: { merkmale?: ProjektMerkmal[] }) {
  if (!merkmale?.length) return null;
  // «nicht geprüft» ist ein offener Vermerk (A-74) und erscheint wie jeder Vermerk
  return <>{merkmale.map(m => (m === 'nicht_geprueft'
    ? <span key={m} className="vermerk"><span className="vermerk-kreis" aria-hidden="true" />{T.projekt.merkmal[m]}</span>
    : <span key={m} className={`merkmal merkmal-${m}`}>{T.projekt.merkmal[m]}</span>))}</>;
}

/** Projekt klein: Name, Phase, Status mit Trend. */
export function ProjektKlein({ projekt: p }: { projekt: ProjektKurz }) {
  return (
    <span className="pk">
      <span className="pk-n">{p.name}</span>
      <PhaseKurz phase={p.phase} />
      <Status status={p.status} vorperiode={p.vorperiode} trend={p.trend} kompakt />
      <Merkmale merkmale={p.merkmale} />
    </span>
  );
}

/** Spalten der Projektzeile «mittel»; `heute` für das Jahr im Datum (I-T3). */
export function projektSpalten(heute: Tag = new Date()): Spalte<ProjektKurz>[] {
  return [
    { key: 'nummer', titel: T.projekt.nummer, zelle: p => <span className="mono">{p.nummer}</span> },
    { key: 'handlungsfeld', titel: T.projekt.handlungsfeld, zelle: p => p.handlungsfeld ?? '' },
    { key: 'name', titel: T.projekt.name, art: 'name', zelle: p => p.name },
    { key: 'thema', titel: T.projekt.thema, zelle: p => p.thema ?? '' },
    { key: 'pl', titel: T.projekt.projektleitung, zelle: p => p.projektleitung ?? '' },
    {
      key: 'phase', titel: T.projekt.phase,
      zelle: p => <><PhaseKurz phase={p.phase} />{p.abschlussPer ? <span className="muted small"> · {T.projekt.abschlussPer(fmtDatum(p.abschlussPer, heute))}</span> : null}</>,
    },
    {
      key: 'meilenstein', titel: T.projekt.meilenstein, karte: true,
      zelle: p => (p.meilenstein ? <>{fmtDatum(p.meilenstein.termin, heute)} · {p.meilenstein.text}</> : <span className="empty">{T.projekt.keinMeilenstein}</span>),
    },
    {
      key: 'status', titel: T.projekt.status, karte: true,
      zelle: p => <><Status status={p.status} vorperiode={p.vorperiode} trend={p.trend} /> <Merkmale merkmale={p.merkmale} /></>,
    },
  ];
}

/** Projekte «mittel» als Datenliste mit allen Zuständen. */
export function ProjektListe({ heute, ...p }: Omit<DatenlisteProps<ProjektKurz>, 'spalten' | 'schluessel'> & { heute?: Tag }) {
  return <Datenliste {...p} spalten={projektSpalten(heute)} schluessel={x => x.nummer} />;
}
