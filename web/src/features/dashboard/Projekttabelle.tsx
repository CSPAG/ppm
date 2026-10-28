/**
 * Projekte des Dashboards als Tabelle der Projektzeile «mittel» (docs/ux/darstellung.md): Nummer und Name, Portfolio,
 * Handlungsfeld, Projektleitung, Phase mit «Abschluss per», nächster Meilenstein, Status mit Vorperiode und Trend,
 * Badges «Nicht gemeldet» und «Eskalation». Virtualisiert (Q-L5: flüssig bei 1000 Zeilen) am Scroll-Container der Seite: Nur die
 * sichtbaren Zeilen stehen im DOM, Platzhalterzeilen halten die Höhe. Jede Zeile führt zur Projektakte (UC-014 A1).
 */
import { useEffect, useRef, useState } from 'react';
import { fmtDatum, Merkmale, PhaseKurz, Status, type Projektstatus, type Trend } from '../../ui/index.ts';
import type { DashboardZeile } from './api.ts';
import { TD } from './texte.ts';

/** Feste Zeilenhöhe in px (dashboard.css `.db-tab tbody tr`). */
export const ZEILE = 52;
const SICHTBAR = 600;
const PUFFER = 8;

const STATUS: Record<string, Projektstatus> = { im_plan: 'im-plan', kritisch: 'kritisch' };
const TREND: Record<string, Trend> = { aufwaerts: 'auf', gleichbleibend: 'gleich', abwaerts: 'ab' };

/** Status mit Vorperiode und Trend; «Nicht gemeldet» mit dem Status der Vorperiode bzw. der übernommenen Werte (A-11). */
export function StatusZelle({ z }: { z: DashboardZeile }) {
  const jetzt = z.status ? STATUS[z.status] : undefined;
  const vor = z.statusVorperiode ? STATUS[z.statusVorperiode] : undefined;
  if (z.meldung === 'nicht_gemeldet') return <Status status="nicht-gemeldet" vorperiode={jetzt ?? vor} />;
  if (!jetzt) return <span className="empty">{z.meldung === 'ohne_pflicht' ? TD.meldung.ohne_pflicht : TD.keinStatus}</span>;
  return (
    <>
      <Status status={jetzt} vorperiode={vor} trend={z.trend ? TREND[z.trend] : undefined} />
      {z.meldung === 'ausstehend' ? <span className="db-meldung">{TD.meldung.ausstehend}</span> : null}
    </>
  );
}

/** Nächster Vorfahre, der vertikal scrollt (in der Shell `.body`), sonst das Dokument. */
function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let p = el?.parentElement ?? null; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if (o === 'auto' || o === 'scroll') return p;
  }
  return null;
}

export function Projekttabelle({ zeilen, projektLink, heute = new Date() }: { zeilen: DashboardZeile[]; projektLink(nr: string): string; heute?: Date }) {
  const ref = useRef<HTMLTableElement>(null);
  const [fenster, setFenster] = useState({ oben: 0, hoehe: SICHTBAR });
  useEffect(() => {
    const tab = ref.current;
    const parent = scrollParent(tab);
    const ziel: HTMLElement | Window = parent ?? window;
    const messen = () => {
      if (!tab) return;
      const top = tab.getBoundingClientRect().top;
      const oben = parent ? parent.getBoundingClientRect().top : 0;
      const hoehe = (parent ? parent.clientHeight : window.innerHeight) || SICHTBAR;
      setFenster({ oben: Math.max(0, oben - top), hoehe });
    };
    messen();
    ziel.addEventListener('scroll', messen, { passive: true });
    window.addEventListener('resize', messen);
    return () => { ziel.removeEventListener('scroll', messen); window.removeEventListener('resize', messen); };
  }, []);
  const { oben, hoehe } = fenster;
  const start = Math.max(0, Math.floor(oben / ZEILE) - PUFFER);
  const ende = Math.min(zeilen.length, Math.ceil((oben + hoehe) / ZEILE) + PUFFER);
  const sichtbar = zeilen.slice(start, ende);

  return (
    <table ref={ref} className="db-tab" aria-rowcount={zeilen.length + 1}>
      <caption className="sr">{TD.title}</caption>
      <thead>
        <tr aria-rowindex={1}>
          <th scope="col">{TD.spalte.projekt}</th>
          <th scope="col" className="db-opt">{TD.spalte.portfolio}</th>
          <th scope="col" className="db-opt">{TD.spalte.handlungsfeld}</th>
          <th scope="col" className="db-opt">{TD.spalte.projektleitung}</th>
          <th scope="col">{TD.spalte.phase}</th>
          <th scope="col" className="db-opt">{TD.spalte.meilenstein}</th>
          <th scope="col">{TD.spalte.status}</th>
        </tr>
      </thead>
      <tbody>
        {start > 0 ? <tr aria-hidden="true" className="db-platz" style={{ height: start * ZEILE }}><td colSpan={7} /></tr> : null}
        {sichtbar.map((z, i) => (
          <tr key={z.projektId} aria-rowindex={start + i + 2}>
            <td className="nm">
              <a className="db-link" href={projektLink(z.nummer)} aria-label={TD.oeffnen(z.nummer, z.name)}>
                <span className="mono">{z.nummer}</span> {z.name}
              </a>
            </td>
            <td className="db-opt">{z.portfolio}</td>
            <td className="db-opt">{z.handlungsfeld ?? ''}</td>
            <td className="db-opt">{z.projektleitung ?? ''}</td>
            <td>
              <PhaseKurz phase={z.phase} />
              {z.abschlussPer ? <span className="muted small db-opt"> · {fmtDatum(z.abschlussPer, heute)}</span> : null}
            </td>
            <td className="db-opt">
              {z.naechsterMeilenstein ? <>{z.naechsterMeilenstein.termin ? `${fmtDatum(z.naechsterMeilenstein.termin, heute)} · ` : ''}{z.naechsterMeilenstein.text}</> : null}
            </td>
            <td><StatusZelle z={z} /> <Merkmale merkmale={z.merkmale} /></td>
          </tr>
        ))}
        {ende < zeilen.length ? <tr aria-hidden="true" className="db-platz" style={{ height: (zeilen.length - ende) * ZEILE }}><td colSpan={7} /></tr> : null}
      </tbody>
    </table>
  );
}
