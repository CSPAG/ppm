/**
 * Terminabweichungen (UI-16, Seitentyp Bericht; UC-005 Schritt 4, PS.01.04, K1 Prüfen Schritt 4): je Projekt Baseline
 * und aufdatierter Abschluss mit Ende je Phase, nach grösster Verschiebung sortiert. Der Balken zeigt die Verschiebung;
 * die Tabelle trägt dieselben Werte als Text (Alternative zum Balken, K1 «Barrierefreiheit»). Jede Zeile führt zum Projekt;
 * die Abweichung führt zu ihren Einzelwerten (Meilensteine und Lieferergebnisse) in der Schublade (`?o=termine:<nummer>`).
 * Export als CSV (eine Zeile je Meilenstein bzw. Lieferergebnis).
 */
import { useState } from 'react';
import { Datenliste, Drawer, fmtDatum, Icon, useToast, type Spalte } from '../../ui/index.ts';
import { termineExportieren, useTermine, type Terminabweichung } from './api.ts';
import { verschiebung } from './anzeige.tsx';
import { TM } from './texte.ts';

const TT = TM.termine;

/** Verschiebung als Text: «+3 Wochen», «2 Tage früher» oder «im Plan». */
const abweichungText = (tage: number) => (tage > 0 ? verschiebung(tage) : tage < 0 ? TT.frueher(verschiebung(-tage).replace('+', '')) : TT.imPlan);

function Abweichung({ tage, max }: { tage: number; max: number }) {
  const breite = max > 0 ? Math.max(4, Math.round((Math.max(0, tage) / max) * 100)) : 0;
  return (
    <span className="ma-abw">
      <span className="ma-balken" aria-hidden="true"><span className={tage > 0 ? 'spaet' : 'ok'} style={{ width: `${tage > 0 ? breite : 4}%` }} /></span>
      <span>{abweichungText(tage)}</span>
    </span>
  );
}

/** Einzelwerte der Abweichung eines Projekts: Meilensteine und Lieferergebnisse mit Baseline und aktuellem Termin. */
function EinzelwerteDrawer({ t, projektLink, onClose }: { t: Terminabweichung; projektLink: string; onClose(): void }) {
  return (
    <Drawer title={TT.drawerTitel(t.projektNummer, t.projektName)} onClose={onClose}
      actions={<a className="btn sm" href={projektLink}><Icon name="arrow" />{TT.projektOeffnen}</a>}>
      <p className="muted small">{TT.drawerSub}</p>
      <table className="ma-ms">
        <caption className="sr">{TT.tabelle}</caption>
        <thead>
          <tr>
            <th scope="col">{TT.spalteMs.phase}</th><th scope="col">{TT.spalteMs.bezeichnung}</th><th scope="col">{TT.spalteMs.baseline}</th>
            <th scope="col">{TT.spalteMs.aktuell}</th><th scope="col">{TT.spalteMs.abweichung}</th>
          </tr>
        </thead>
        <tbody>
          {t.meilensteine.map((m, i) => (
            <tr key={`${m.phase}-${i}`}>
              <td>{m.phase}</td>
              <th scope="row">{m.text}<div className="muted small">{TT.art[m.art] ?? m.art}</div></th>
              <td>{fmtDatum(m.baseline, '1900-01-01')}</td>
              <td>{fmtDatum(m.aktuell, '1900-01-01')}{m.erreicht ? <div className="muted small">{TT.erreicht}</div> : null}</td>
              <td className={m.tage > 0 ? 'ma-spaet' : undefined}>{abweichungText(m.tage)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Drawer>
  );
}

export function Termine({ periode, projektLink, offen, oeffnen, schliessen }: {
  periode: string | undefined; projektLink(nummer: string): string; offen?: string; oeffnen(nummer: string): void; schliessen(): void;
}) {
  const q = useTermine(periode);
  const toast = useToast();
  const [exportLaeuft, setExportLaeuft] = useState(false);
  const items = q.data?.items;
  const max = Math.max(0, ...(items ?? []).map(t => t.maxTage));
  const offenT = offen ? items?.find(t => t.projektNummer === offen) : undefined;
  const exportieren = () => {
    if (!periode) return;
    setExportLaeuft(true);
    termineExportieren(periode).then(name => toast.show(TT.exportiert(name)), e => toast.error(e)).finally(() => setExportLaeuft(false));
  };
  const spalten: Spalte<Terminabweichung>[] = [
    {
      key: 'projekt', titel: TT.spalte.projekt, karte: true,
      zelle: t => <a className="ma-link" href={projektLink(t.projektNummer)} aria-label={TM.aktion.projektOeffnen(t.projektNummer)}><span className="mono">{t.projektNummer}</span> {t.projektName}</a>,
    },
    { key: 'phase', titel: TT.spalte.phase, zelle: t => t.phase },
    { key: 'baseline', titel: TT.spalte.baseline, zelle: t => (t.abschluss ? fmtDatum(t.abschluss.baseline, '1900-01-01') : '–') },
    { key: 'aktuell', titel: TT.spalte.aktuell, karte: true, zelle: t => (t.abschluss ? fmtDatum(t.abschluss.aktuell, '1900-01-01') : '–') },
    {
      key: 'abweichung', titel: TT.spalte.abweichung, karte: true,
      // Jede Zahl führt zu ihren Einzelwerten (Seitentyp Bericht)
      zelle: t => (
        <button type="button" className="ma-zahl" aria-label={TT.einzelwerte(t.projektNummer, abweichungText(t.maxTage))}
          aria-expanded={offen === t.projektNummer} onClick={() => oeffnen(t.projektNummer)}>
          <Abweichung tage={t.maxTage} max={max} />
        </button>
      ),
    },
    {
      key: 'phasen', titel: TT.spalte.phasen,
      zelle: t => (
        <ul className="ma-phasen">
          {t.phasen.map(p => <li key={p.phase}><b>{p.phase}</b> {fmtDatum(p.aktuell, '1900-01-01')} {p.tage ? `(${abweichungText(p.tage)})` : ''}</li>)}
        </ul>
      ),
    },
  ];
  return (
    <>
      <div className="ma-termine-kopf">
        <h2 className="grp-h">{TT.titel}</h2>
        <p className="muted small">{TT.sub}</p>
        {items?.length ? (
          <button type="button" className="btn" onClick={exportieren} disabled={exportLaeuft} aria-busy={exportLaeuft || undefined}>
            <Icon name="download" />{TT.exportieren}
          </button>
        ) : null}
      </div>
      <Datenliste<Terminabweichung> titel={TT.titel} spalten={spalten} zeilen={items} schluessel={t => t.projektId}
        laedt={q.isPending} fehler={q.error} erneut={() => void q.refetch()} leer={TT.leer}
        teilweise={q.data?.ohneBaseline.length ? <>{TT.ohneBaseline(q.data.ohneBaseline.length)} {q.data.ohneBaseline.map(p => p.projektNummer).join(', ')}</> : undefined} />
      {offenT ? <EinzelwerteDrawer t={offenT} projektLink={projektLink(offenT.projektNummer)} onClose={schliessen} /> : null}
    </>
  );
}
