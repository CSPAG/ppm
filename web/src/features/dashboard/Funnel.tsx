/**
 * Funnel nach Phase (UC-014 Schritt 1, UI-17): je Phase ein Balken mit Anteil im Plan, kritisch und nicht gemeldet;
 * dieselben Werte stehen in der Tabelle darunter (Alternative zum Diagramm, Q-B5). Ein Klick auf eine Phase zeigt ihre
 * Projekte in der Liste.
 */
import { fmtPhase, type Phase } from '../../ui/index.ts';
import type { FunnelStufe } from './api.ts';
import { TD } from './texte.ts';

export function Funnel({ stufen, phaseWaehlen }: { stufen: FunnelStufe[]; phaseWaehlen(phase: Phase): void }) {
  const max = Math.max(1, ...stufen.map(s => s.anzahl));
  const anteil = (n: number) => `${(n / max) * 100}%`;
  return (
    <section className="db-funnel" aria-labelledby="db-funnel-h">
      <h2 id="db-funnel-h" className="grp-h">{TD.funnel.titel}</h2>
      <p className="muted small">{TD.funnel.beschreibung}</p>
      <ol className="db-stufen" aria-hidden="true">
        {stufen.map(s => (
          <li key={s.phase}>
            <span className="db-stufe-l">{s.phase}</span>
            <span className="db-stufe-b">
              <span className="db-ok" style={{ width: anteil(s.imPlan) }} />
              <span className="db-krit" style={{ width: anteil(s.kritisch) }} />
              <span className="db-ohne" style={{ width: anteil(s.ohneStatus) }} />
            </span>
            <span className="db-stufe-n">{s.anzahl}</span>
          </li>
        ))}
      </ol>
      <table className="db-funnel-tab">
        <caption className="sr">{TD.funnel.titel}</caption>
        <thead>
          <tr>
            <th scope="col">{TD.funnel.spalte.phase}</th>
            <th scope="col" className="num">{TD.funnel.spalte.anzahl}</th>
            <th scope="col" className="num">{TD.funnel.spalte.imPlan}</th>
            <th scope="col" className="num">{TD.funnel.spalte.kritisch}</th>
            <th scope="col" className="num">{TD.funnel.spalte.nichtGemeldet}</th>
            <th scope="col" className="num">{TD.funnel.spalte.ohneStatus}</th>
          </tr>
        </thead>
        <tbody>
          {stufen.map(s => (
            <tr key={s.phase}>
              <th scope="row">
                <button type="button" className="linkbtn db-phase" onClick={() => phaseWaehlen(s.phase)} aria-label={TD.funnel.filtern(fmtPhase(s.phase))}>{fmtPhase(s.phase)}</button>
              </th>
              <td className="num">{s.anzahl}</td>
              <td className="num">{s.imPlan}</td>
              <td className="num">{s.kritisch}</td>
              <td className="num">{s.nichtGemeldet}</td>
              <td className="num">{s.ohneStatus}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
