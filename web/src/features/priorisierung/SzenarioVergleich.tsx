/**
 * Szenarienvergleich (UI-22, K5 Schritt 6; UC-008 Schritt 6): bis drei Szenarien nebeneinander mit Kosten, Nutzen,
 * Risiko, Strategiebeitrag, Projekten unter der Wasserlinie und Engpässen; abweichende Werte hervorgehoben (Text
 * «abweichend» zusätzlich zur Farbe, Q-B5). Dient auch als Inhalt der Entscheidungsvorlage.
 */
import type { ReactNode } from 'react';
import { fmtBetragKurz } from '../../ui/index.ts';
import type { Rolle, SzenarioVergleich as Vergleich } from './SzenarioApi.ts';
import { fmtQuartalVon, TS } from './SzenarioTexte.ts';

type Spalte = Vergleich['szenarien'][number];

export function SzenarioVergleich({ v, rollen, kopf }: { v: Vergleich; rollen: readonly Rolle[]; kopf?: (s: Spalte) => ReactNode }) {
  const nummer = new Map(v.projekte.map(p => [p.id, p.nummer]));
  const label = (r: string) => rollen.find(x => x.schluessel === r)?.label ?? r;
  const zeilen: { titel: string; wert: (s: Spalte) => string }[] = [
    { titel: TS.kostenUeber, wert: s => (s.kosten === null ? TS.ohneBetrag : fmtBetragKurz(s.kosten)) },
    { titel: TS.budgetrahmen, wert: s => (s.budget.rahmen === null ? TS.keine : fmtBetragKurz(s.budget.rahmen)) },
    { titel: TS.nutzen, wert: s => TS.anzahl(s.nutzen.hoch, s.nutzen.tief, s.nutzen.offen + s.nutzen.grenze) },
    { titel: TS.risiko, wert: s => TS.anzahl(s.risiko.hoch, s.risiko.tief, s.risiko.offen + s.risiko.grenze) },
    { titel: TS.strategie, wert: s => TS.anzahl3(s.strategiebeitrag.hoch, s.strategiebeitrag.mittel, s.strategiebeitrag.tief, s.strategiebeitrag.offen) },
    { titel: TS.unter, wert: s => (s.unter.length ? s.unter.map(id => nummer.get(id) ?? '?').join(', ') : TS.keine) },
    {
      titel: TS.grund,
      wert: s => (s.wasserlinie.grund
        ? `${TS.grundText[s.wasserlinie.grund]}${s.wasserlinie.kapazitaet ? ` (${label(s.wasserlinie.kapazitaet.rolle)}, ${fmtQuartalVon(s.wasserlinie.kapazitaet.monat)})` : ''}`
        : TS.keine),
    },
    {
      titel: TS.engpaesse,
      wert: s => (s.engpaesse.length ? s.engpaesse.map(e => `${fmtQuartalVon(e.monat)} ${label(e.rolle)}`).join(', ') : TS.keine),
    },
  ];
  return (
    <div className="sz-vergleich">
      {/* scrollbar auch ohne Eingabefelder (nur lesen, 360 px) mit der Tastatur erreichbar (axe scrollable-region-focusable) */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- beschriftete, scrollbare Region (WCAG 2.1.1) */}
      <div className="sz-scroll" tabIndex={0} role="region" aria-label={TS.vergleich}>
        <table className="sz-tab">
          <caption className="sz-vh">{TS.vergleich}</caption>
          <thead>
            <tr>
              <th scope="col">{TS.kennzahl}</th>
              {v.szenarien.map(s => <th scope="col" key={s.id}>{s.name}{kopf ? <div className="sz-kopf">{kopf(s)}</div> : null}</th>)}
            </tr>
          </thead>
          <tbody>
            {zeilen.map(z => {
              const werte = v.szenarien.map(z.wert);
              const anders = new Set(werte).size > 1;
              return (
                <tr key={z.titel}>
                  <th scope="row">{z.titel}</th>
                  {werte.map((w, i) => (
                    <td key={v.szenarien[i]!.id} className={anders ? 'sz-anders' : undefined}>
                      {w}{anders ? <span className="sz-vh"> ({TS.anders})</span> : null}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {v.szenarien.length > 1 ? (
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- beschriftete, scrollbare Region (WCAG 2.1.1, axe scrollable-region-focusable)
        <div className="sz-scroll" tabIndex={0} role="region" aria-label={TS.projekteSeite}>
          <table className="sz-tab">
            <caption>{TS.projekteSeite}</caption>
            <thead>
              <tr><th scope="col">{TS.projekt}</th>{v.szenarien.map(s => <th scope="col" key={s.id}>{s.name}</th>)}</tr>
            </thead>
            <tbody>
              {v.projekte.map(p => (
                <tr key={p.id} className={p.unterschiedlich ? 'sz-anders' : undefined}>
                  <th scope="row"><span className="mono">{p.nummer}</span> {p.name}{p.unterschiedlich ? <span className="sz-merk"> {TS.anders}</span> : null}</th>
                  {v.szenarien.map(s => (
                    <td key={s.id}>{s.ueber.includes(p.id) ? TS.ueber : s.unter.includes(p.id) ? TS.unterKurz : TS.nichtEnthalten}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
