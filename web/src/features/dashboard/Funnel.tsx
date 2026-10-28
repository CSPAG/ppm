/**
 * Funnel nach Phase (UC-014 Schritt 1, UI-17): je Phase ein Balken mit Anteil im Plan, kritisch und ohne Status;
 * dieselben Werte stehen in der Tabelle darunter (Alternative zum Diagramm, Q-B5). Jede Zahl führt zu ihren Einzelwerten
 * (Seitentyp Bericht): ein Klick zeigt die Projekte der Phase mit dieser Auswahl in der Liste. Gezählt wird mit denselben
 * Bedingungen wie der Filter (`auswahl.ts`).
 */
import { fmtPhase, type Phase } from '../../ui/index.ts';
import type { DashboardZeile } from './api.ts';
import { anzahl, type Auswahl } from './auswahl.ts';
import { TD } from './texte.ts';

const PHASEN: readonly Phase[] = ['P0', 'P1', 'P2', 'P3', 'P4'];
const SPALTEN: readonly Auswahl[] = ['im_plan', 'kritisch', 'offen', 'ohne_status'];

export function Funnel({ items, waehlen }: { items: readonly DashboardZeile[]; waehlen(phase: Phase, auswahl?: Auswahl): void }) {
  const stufen = PHASEN.map(phase => {
    const z = items.filter(i => i.phase === phase);
    return { phase, z, anzahl: z.length };
  });
  const max = Math.max(1, ...stufen.map(s => s.anzahl));
  const anteil = (n: number) => `${(n / max) * 100}%`;
  const zahl = (phase: Phase, n: number, auswahl?: Auswahl) => (
    <button type="button" className="linkbtn db-zahl" onClick={() => waehlen(phase, auswahl)} disabled={!n}
      aria-label={TD.funnel.zelle(fmtPhase(phase), auswahl ? TD.auswahl[auswahl]! : TD.funnel.spalte.anzahl, n)}>{n}</button>
  );
  return (
    <section className="db-funnel" aria-labelledby="db-funnel-h">
      <h2 id="db-funnel-h" className="grp-h">{TD.funnel.titel}</h2>
      <p className="muted small">{TD.funnel.beschreibung}</p>
      <ol className="db-stufen" aria-hidden="true">
        {stufen.map(s => (
          <li key={s.phase}>
            <span className="db-stufe-l">{s.phase}</span>
            <span className="db-stufe-b">
              <span className="db-ok" style={{ width: anteil(anzahl(s.z, 'im_plan')) }} />
              <span className="db-krit" style={{ width: anteil(anzahl(s.z, 'kritisch')) }} />
              <span className="db-ohne" style={{ width: anteil(anzahl(s.z, 'ohne_status')) }} />
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
                <button type="button" className="linkbtn db-phase" onClick={() => waehlen(s.phase)} aria-label={TD.funnel.filtern(fmtPhase(s.phase))}>{fmtPhase(s.phase)}</button>
              </th>
              <td className="num">{zahl(s.phase, s.anzahl)}</td>
              {SPALTEN.map(a => <td key={a} className="num">{zahl(s.phase, anzahl(s.z, a), a)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
