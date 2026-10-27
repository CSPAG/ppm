/**
 * Terminabweichungen (UI-16, Seitentyp Bericht; UC-005 Schritt 4, PS.01.04, K1 Prüfen Schritt 4): je Projekt Baseline
 * und aufdatierter Abschluss mit Ende je Phase, nach grösster Verschiebung sortiert. Der Balken zeigt die Verschiebung;
 * die Tabelle trägt dieselben Werte als Text (Alternative zum Balken, K1 «Barrierefreiheit»). Jede Zeile führt zum Projekt.
 */
import { Datenliste, fmtDatum, type Spalte } from '../../ui/index.ts';
import { useTermine, type Terminabweichung } from './api.ts';
import { verschiebung } from './anzeige.tsx';
import { TM } from './texte.ts';

const TT = TM.termine;

function Abweichung({ tage, max }: { tage: number; max: number }) {
  const breite = max > 0 ? Math.max(4, Math.round((Math.max(0, tage) / max) * 100)) : 0;
  return (
    <span className="ma-abw">
      <span className="ma-balken" aria-hidden="true"><span className={tage > 0 ? 'spaet' : 'ok'} style={{ width: `${tage > 0 ? breite : 4}%` }} /></span>
      <span>{tage > 0 ? verschiebung(tage) : tage < 0 ? TT.frueher(verschiebung(-tage).replace('+', '')) : TT.imPlan}</span>
    </span>
  );
}

export function Termine({ periode, projektLink }: { periode: string; projektLink(nummer: string): string }) {
  const q = useTermine(periode);
  const items = q.data?.items;
  const max = Math.max(0, ...(items ?? []).map(t => t.maxTage));
  const spalten: Spalte<Terminabweichung>[] = [
    {
      key: 'projekt', titel: TT.spalte.projekt, karte: true,
      zelle: t => <a className="ma-link" href={projektLink(t.projektNummer)} aria-label={TM.aktion.projektOeffnen(t.projektNummer)}><span className="mono">{t.projektNummer}</span> {t.projektName}</a>,
    },
    { key: 'phase', titel: TT.spalte.phase, zelle: t => t.phase },
    { key: 'baseline', titel: TT.spalte.baseline, zelle: t => (t.abschluss ? fmtDatum(t.abschluss.baseline, '1900-01-01') : '–') },
    { key: 'aktuell', titel: TT.spalte.aktuell, karte: true, zelle: t => (t.abschluss ? fmtDatum(t.abschluss.aktuell, '1900-01-01') : '–') },
    { key: 'abweichung', titel: TT.spalte.abweichung, karte: true, zelle: t => <Abweichung tage={t.maxTage} max={max} /> },
    {
      key: 'phasen', titel: TT.spalte.phasen,
      zelle: t => (
        <ul className="ma-phasen">
          {t.phasen.map(p => <li key={p.phase}><b>{p.phase}</b> {fmtDatum(p.aktuell, '1900-01-01')} {p.tage ? `(${p.tage > 0 ? verschiebung(p.tage) : TT.frueher(verschiebung(-p.tage).replace('+', ''))})` : ''}</li>)}
        </ul>
      ),
    },
  ];
  return (
    <>
      <div className="ma-termine-kopf">
        <h2 className="grp-h">{TT.titel}</h2>
        <p className="muted small">{TT.sub}</p>
      </div>
      <Datenliste<Terminabweichung> titel={TT.titel} spalten={spalten} zeilen={items} schluessel={t => t.projektId}
        laedt={q.isPending} fehler={q.error} erneut={() => void q.refetch()} leer={TT.leer}
        teilweise={q.data?.ohneBaseline.length ? <>{TT.ohneBaseline(q.data.ohneBaseline.length)} {q.data.ohneBaseline.map(p => p.projektNummer).join(', ')}</> : undefined} />
    </>
  );
}
