/**
 * Seite «Zielerreichung» im Arbeitsraum «Ziele» (UI-40; BC ZM.03.01; UC-012 Schritte 1–2; Kernablauf K6 Schritt 10;
 * Seitentyp Arbeitsfläche): Tabelle je Ziel mit Metrik, Zielwert, letztem Stand und Feldern für den neuen Stand mit
 * Kommentar; GL und UE erfassen gemeinsam, gespeichert wird beim Verlassen der Zeile. Kopf mit Quartal und Fortschritt
 * «24 von 30 Zielen nachgeführt». Ohne `zielerreichung:write` nur lesen (Z8).
 */
import { useCallback, useState } from 'react';
import { Empty, ErrorState, fmtQuartal, Hinweis, Icon, Skelett, useVerzoegert } from '../../ui/index.ts';
import { useZielerreichung, useZielerreichungSpeichern } from './ZielerreichungApi.ts';
import { nachbarQuartal, quartalSchluessel, type QuartalNr, type SetZielerreichungQuartal } from './ZielerreichungSearch.ts';
import { TZE } from './ZielerreichungTexte.ts';
import { ZielerreichungZeile } from './ZielerreichungZeile.tsx';
import './Zielerreichung.css';

export interface ZielerreichungPageProps {
  jahr: number;
  quartal: QuartalNr;
  setQuartal: SetZielerreichungQuartal;
  /** Leer (Z2): zu den strategischen Zielen. */
  zuZielen(): void;
}

export function ZielerreichungPage({ jahr, quartal, setQuartal, zuZielen }: ZielerreichungPageProps) {
  const schluessel = quartalSchluessel(jahr, quartal);
  const titel = fmtQuartal(jahr, quartal);
  const q = useZielerreichung(schluessel);
  const speichern = useZielerreichungSpeichern(schluessel);
  const skelett = useVerzoegert(q.isPending);
  // Ansage der gespeicherten Zeile für den Bildschirmleser (eine Stelle für die ganze Tabelle)
  const [ansage, setAnsage] = useState('');
  const ansagen = useCallback((t: string) => setAnsage(t), []);
  const vor = nachbarQuartal(jahr, quartal, -1);
  const nach = nachbarQuartal(jahr, quartal, 1);
  const d = q.data;

  return (
    <section aria-labelledby="page-title" className="ze">
      <header className="mh">
        <div className="mh-row">
          <div className="mh-title">
            <div className="type-ico neutral"><Icon name="target" /></div>
            <div className="minw0">
              <h1 id="page-title">{TZE.title(titel)}</h1>
              <div className="sub">{TZE.sub}</div>
            </div>
          </div>
          <nav className="acts" aria-label={TZE.quartalWaehlen}>
            <button type="button" className="btn" onClick={() => setQuartal(vor.jahr, vor.quartal)}>
              <Icon name="arrow" className="ze-zurueck" />{TZE.vorher}<span className="sr"> ({fmtQuartal(vor.jahr, vor.quartal)})</span>
            </button>
            <button type="button" className="btn" onClick={() => setQuartal(nach.jahr, nach.quartal)}>
              {TZE.nachher}<span className="sr"> ({fmtQuartal(nach.jahr, nach.quartal)})</span><Icon name="arrow" />
            </button>
          </nav>
        </div>
      </header>
      {d && d.ziele.length ? (
        <div className="toolbar ze-kopf">
          <progress max={d.fortschritt.gesamt} value={d.fortschritt.nachgefuehrt} aria-label={TZE.fortschritt(d.fortschritt.nachgefuehrt, d.fortschritt.gesamt)} />
          <span>{TZE.fortschritt(d.fortschritt.nachgefuehrt, d.fortschritt.gesamt)}</span>
        </div>
      ) : null}
      {/* scrollbar auch ohne Eingabefelder (nur lesen) mit der Tastatur erreichbar (axe scrollable-region-focusable) */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- beschriftete, scrollbare Region (WCAG 2.1.1) */}
      <div className="body" tabIndex={0} role="region" aria-label={TZE.tabelle(titel)}>
        {q.isPending ? (
          <div aria-busy="true"><span className="sr" role="status">{TZE.title(titel)}</span>{skelett ? <Skelett /> : null}</div>
        ) : q.error ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : !d!.ziele.length ? (
          <Empty action={<button type="button" className="btn" onClick={zuZielen}>{TZE.zuZielen}</button>}>{TZE.leer}</Empty>
        ) : (
          <>
            {!d!.can.write ? <div className="ze-hinweis"><Hinweis stufe="hinweis">{TZE.nurLesen}</Hinweis></div> : null}
            <table className="dl ze-tab">
              <caption className="sr">{TZE.tabelle(titel)}</caption>
              <thead>
                <tr>
                  {[TZE.nummer, TZE.ziel, TZE.metrik, TZE.zielwert, TZE.letzter, TZE.stand, TZE.beurteilung, TZE.status].map(t => <th key={t} scope="col"><span className="th">{t}</span></th>)}
                </tr>
              </thead>
              <tbody>
                {d!.ziele.map(z => (
                  <ZielerreichungZeile key={`${schluessel}:${z.typ}:${z.id}`} ziel={z} write={d!.can.write} speichern={speichern}
                    neuLaden={() => void q.refetch()} ansagen={ansagen} />
                ))}
              </tbody>
            </table>
            <div className="sr" role="status" aria-live="polite">{ansage}</div>
          </>
        )}
      </div>
    </section>
  );
}
