/**
 * Galerie der Bausteine aus docs/ux/darstellung.md (nur im Entwicklungsbuild unter `/dev/galerie`, nicht im
 * Start-Bundle): Status und Trend, Bearbeitungsstand, Projekt klein und mittel, Formate, Hinweis und Regelmeldung,
 * Datenliste in allen Zuständen. Beispieldaten sind erfunden; `Galerie.test.tsx` prüft die Seite mit axe.
 */
import { useState } from 'react';
import {
  Datenliste, fmtAbweichung, fmtAbweichungWochen, fmtBetrag, fmtBetragKurz, fmtDatum, fmtFrist, fmtFristArbeitstage, fmtFte, fmtGate,
  fmtMonate, fmtPeriode, fmtPhase, fmtQuartal, fmtZeitpunkt, Hinweis, ProjektKlein, ProjektListe, Regelmeldung, Stand, Status,
  type ProjektKurz, type StandFamilie,
} from '../ui/index.ts';

const HEUTE = '2026-10-22';

export const PROJEKTE: ProjektKurz[] = [
  {
    nummer: '2026-014', name: 'Digitale Patientenaufnahme', phase: 'P2', status: 'kritisch', vorperiode: 'im-plan', trend: 'ab',
    handlungsfeld: 'Patientenorientierung', thema: 'Aufnahme', projektleitung: 'Lea Brunner', abschlussPer: '2027-03-31',
    meilenstein: { termin: '2026-11-12', text: 'Go-Live Pilot' }, merkmale: ['eskalation'],
  },
  {
    nummer: '2026-021', name: 'Neues Labor-Informationssystem', phase: 'P1', status: 'im-plan', vorperiode: 'im-plan', trend: 'gleich',
    handlungsfeld: 'Wirtschaftlichkeit', thema: 'Labor', projektleitung: 'Daniel Keller', abschlussPer: '2026-12-10',
    meilenstein: { termin: '2026-12-10', text: 'Gate P1–P2' }, merkmale: ['sns-vr'],
  },
  {
    nummer: '2025-007', name: 'Standortkonzept Bettenhaus', phase: 'P3', status: 'nicht-gemeldet', vorperiode: 'kritisch',
    handlungsfeld: 'Infrastruktur', thema: 'Bau', projektleitung: 'Sandra Frei',
  },
];

const STAENDE: { familie: StandFamilie; label: string; detail?: string }[] = [
  { familie: 'entwurf', label: 'Entwurf' },
  { familie: 'wartet', label: 'eingereicht', detail: 'wartet auf Unternehmensentwicklung' },
  { familie: 'traktandiert', label: 'traktandiert', detail: 'PRAT Mi 10.12.' },
  { familie: 'positiv', label: 'abgenommen' },
  { familie: 'negativ', label: 'zurückgewiesen' },
  { familie: 'ruhend', label: 'zurückgestellt' },
  { familie: 'gesperrt', label: 'abgeschlossen' },
];

type Zustand = 'daten' | 'laden' | 'leer' | 'gefiltert' | 'fehler' | 'teilweise';
const ZUSTAENDE: Zustand[] = ['daten', 'laden', 'leer', 'gefiltert', 'fehler', 'teilweise'];

export function Galerie() {
  const [zustand, setZustand] = useState<Zustand>('daten');
  const [offen, setOffen] = useState<string>();
  const formate: [string, string][] = [
    ['Datum zum Planen', fmtDatum('2026-11-12', HEUTE)],
    ['Datum anderes Jahr', fmtDatum('2027-03-31', HEUTE)],
    ['Frist nahe', fmtFrist('2026-10-25', HEUTE)],
    ['Frist überfällig', fmtFrist('2026-10-17', HEUTE)],
    ['Frist in Arbeitstagen', fmtFristArbeitstage('2026-10-28', HEUTE)],
    ['Zeitpunkt', fmtZeitpunkt('2026-11-12T14:42:00Z')],
    ['Periode', fmtPeriode('2026-10')],
    ['Quartal', fmtQuartal(2026, 3)],
    ['Betrag im Detail', fmtBetrag(1_250_000)],
    ['Betrag in Listen', `${fmtBetragKurz(1_250_000)} · ${fmtBetragKurz(380_000)}`],
    ['Abweichung', `${fmtAbweichung(300_000, 14)} · ${fmtAbweichungWochen(3)}`],
    ['Personalbedarf', `${fmtFte(2.5)} · ${fmtMonate('2027-03', '2027-12')}`],
    ['Phase', fmtPhase('P1')],
    ['Gate', `${fmtGate('P1', 'P2')} · ${fmtGate('eintritt', 'P0')} · ${fmtGate('P4', 'exit')}`],
  ];
  return (
    <section aria-labelledby="galerie-title" className="galerie">
      <header className="mh"><div className="mh-row"><div className="mh-title"><h1 id="galerie-title">Galerie der Bausteine</h1></div></div></header>
      <div className="body pad-s">
        <h2>Status und Trend</h2>
        <div className="galerie-reihe">
          <Status status="im-plan" trend="auf" />
          <Status status="kritisch" vorperiode="im-plan" trend="ab" />
          <Status status="nicht-gemeldet" vorperiode="im-plan" />
          <Status status="im-plan" trend="gleich" kompakt />
        </div>

        <h2>Bearbeitungsstand</h2>
        <div className="galerie-reihe">{STAENDE.map(s => <Stand key={s.familie} {...s} />)}</div>

        <h2>Projekt klein</h2>
        <ul className="galerie-liste">{PROJEKTE.map(p => <li key={p.nummer}><ProjektKlein projekt={p} /></li>)}</ul>

        <h2>Formate</h2>
        <dl className="attrs">{formate.map(([k, v]) => <div key={k} className="galerie-paar"><dt>{k}</dt><dd>{v}</dd></div>)}</dl>

        <h2>Hinweis und Regelmeldung</h2>
        <Regelmeldung stufe="hinweis" regel="Gremienweg" ist="via SNS-VR" wer="Gate P1–P2" vorschlag="Planen Sie die Vorlage an den SNS-VR ein." />
        <Regelmeldung stufe="warnung" regel="Unterlagen" ist="Versand 3" grenze="mindestens 5 Arbeitstage vor der Sitzung" wer="PRAT Mi 12.11."
          vorschlag="Verschieben Sie das Traktandum oder versenden Sie mit Vermerk." quelle="PM-Handbuch Kapitel 8.1" />
        <Regelmeldung stufe="sperre" regel="Kapazität Q2 2027" ist="7,5 FTE Projektleitung" grenze="höchstens 5,0"
          vorschlag="Verschieben Sie den Start eines der 3 betroffenen Projekte." aktion={<button type="button" className="btn sm">Projekte ansehen</button>} />
        <Hinweis stufe="hinweis">Freier Hinweis ohne Regel, z. B. für die Abweichung zur Baseline im Entwurf.</Hinweis>

        <h2>Datenliste mit Projekten</h2>
        <div className="seg" role="group" aria-label="Zustand der Liste">
          {ZUSTAENDE.map(z => <button key={z} type="button" className={zustand === z ? 'on' : undefined} aria-pressed={zustand === z} onClick={() => setZustand(z)}>{z}</button>)}
        </div>
        <ProjektListe titel="Projekte" heute={HEUTE} zeilen={zustand === 'leer' || zustand === 'gefiltert' ? [] : PROJEKTE}
          laedt={zustand === 'laden'} fehler={zustand === 'fehler' ? new Error('Die Projekte konnten nicht geladen werden.') : undefined} erneut={() => setZustand('daten')}
          leer="Noch keine Projekte. Erfassen Sie die laufenden Projekte, damit das Dashboard sie zeigt." leerAktion={<button type="button" className="btn primary">Projekt erfassen</button>}
          gefiltert={zustand === 'gefiltert'} zuruecksetzen={() => setZustand('daten')}
          teilweise={zustand === 'teilweise' ? 'Status der Vorperiode wird berechnet …' : undefined}
          oeffnen={p => setOffen(p.nummer)} aktuell={offen} name={p => p.name} />

        <h2>Datenliste allgemein</h2>
        <Datenliste titel="Handlungsfelder" laedt={false} leer="leer" schluessel={(r: { id: string; label: string; n: number }) => r.id}
          zeilen={[{ id: 'a', label: 'Patientenorientierung', n: 3 }, { id: 'b', label: 'Wirtschaftlichkeit', n: 5 }]}
          spalten={[{ key: 'label', titel: 'Bezeichnung', art: 'name', zelle: r => r.label }, { key: 'n', titel: 'Stossrichtungen', art: 'zahl', karte: true, zelle: r => r.n }]}
          mehr={{ vorhanden: true, laedt: false, laden: () => undefined }} />
      </div>
    </section>
  );
}
