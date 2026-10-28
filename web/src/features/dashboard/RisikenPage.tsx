/**
 * Portfolio › Dashboard › Risiken (UI-18, Seitentyp Bericht; BC PC.02.02, UC-014 Schritt 2; Kernablauf K3 Schritt 7):
 * Filter oben (Portfolio), Kennzahlen, Verteilung nach Wahrscheinlichkeit × Auswirkung als Tabelle, Risiken mit
 * Massnahme, Abhängigkeiten und offene Eskalationen. Stufen als Text, nie nur Farbe (Q-B5). Jede Zahl (Feld der Matrix,
 * Kennzahl) führt zu ihren Einzelwerten: sie filtert die Risiken (`w`, `a`, `massnahme` in der Adresse); Export als CSV.
 * Adresse: `/portfolio/dashboard/risiken?portfolio=transformation&w=hoch&a=hoch` (I-N5).
 */
import { useState, type ReactNode } from 'react';
import { useSession } from '../../auth/index.ts';
import { Empty, ErrorState, fmtPeriode, fmtZeitpunkt, Icon, Skelett, Stand, useToast, useVerzoegert } from '../../ui/index.ts';
import { risikenExportieren, useRisikolage, type Portfoliobericht, type RisikolageRisiko } from './PortfolioberichtApi.ts';
import type { RisikenSearch, SetRisikenSearch } from './PortfolioberichtSuche.ts';
import { TR } from './PortfolioberichtTexte.ts';
import './dashboard.css';
import './Portfoliobericht.css';

const STUFEN = ['hoch', 'mittel', 'tief'] as const;
type Stufe = (typeof STUFEN)[number];

/** Auswahl der Risiken hinter einer Zahl (Feld der Matrix bzw. offene Massnahme). */
export interface RisikoFilter { w?: Stufe; a?: Stufe; massnahme?: 'offen' }
const passt = (f: RisikoFilter) => (r: RisikolageRisiko) =>
  (!f.w || r.wahrscheinlichkeit === f.w) && (!f.a || r.auswirkung === f.a) && (!f.massnahme || r.massnahmeStand === f.massnahme);

function Kopf({ unter, aktionen }: { unter?: string; aktionen?: ReactNode }) {
  return (
    <header className="mh">
      <div className="mh-row">
        <div className="mh-title">
          <div className="type-ico neutral"><Icon name="warn" /></div>
          <div className="minw0">
            <h1 id="page-title">{TR.title}</h1>
            <div className="sub">{unter ?? TR.sub}</div>
          </div>
        </div>
        {aktionen ? <div className="acts">{aktionen}</div> : null}
      </div>
    </header>
  );
}

/**
 * Verteilung als Tabelle (Zeilen Wahrscheinlichkeit, Spalten Auswirkung); Zahl und Text, Farbe nur zusätzlich. Mit
 * `waehlen` ist jedes Feld eine Schaltfläche zu seinen Risiken (Seitentyp Bericht); ohne (Portfoliobericht) nur Text.
 */
export function RisikoMatrix({ matrix, waehlen }: { matrix: { wahrscheinlichkeit: string; auswirkung: string; anzahl: number }[]; waehlen?(w: Stufe, a: Stufe): void }) {
  const n = (w: string, a: string) => matrix.find(m => m.wahrscheinlichkeit === w && m.auswirkung === a)?.anzahl ?? 0;
  return (
    <table className="pb-matrix">
      <caption>{TR.matrix.titel}</caption>
      <thead>
        <tr><th scope="col"><span className="sr">{TR.matrix.zeile}</span></th>{STUFEN.map(a => <th key={a} scope="col">{TR.matrix.spalte} {TR.stufe[a]}</th>)}</tr>
      </thead>
      <tbody>
        {STUFEN.map(w => (
          <tr key={w}>
            <th scope="row">{TR.matrix.zeile} {TR.stufe[w]}</th>
            {STUFEN.map(a => {
              const k = n(w, a);
              const ton = w === 'hoch' && a === 'hoch' ? 'bad' : w === 'tief' && a === 'tief' ? 'ok' : 'mid';
              const label = TR.matrix.feld(TR.stufe[w]!, TR.stufe[a]!, k);
              return (
                <td key={a} className={k ? `pb-feld pb-${ton}` : 'pb-feld'} aria-label={waehlen ? undefined : label}>
                  {waehlen ? <button type="button" className="pb-zahl" onClick={() => waehlen(w, a)} disabled={!k} aria-label={TR.zeigen(label)}>{k}</button> : k}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RisikoTabelle({ risiken, projektLink }: { risiken: RisikolageRisiko[]; projektLink?(nr: string): string }) {
  if (!risiken.length) return <Empty>{TR.risiken.leer}</Empty>;
  const S = TR.risiken.spalte;
  return (
    <div className="pb-scroll">
      <table className="pb-tab">
        <caption className="sr">{TR.risiken.titel}</caption>
        <thead><tr><th scope="col">{S.bezug}</th><th scope="col">{S.text}</th><th scope="col">{S.w}</th><th scope="col">{S.a}</th><th scope="col" className="pb-opt">{S.massnahme}</th><th scope="col">{S.stand}</th><th scope="col" className="pb-opt">{S.verantwortlich}</th></tr></thead>
        <tbody>
          {risiken.map(r => (
            <tr key={r.id}>
              <td>{r.projekt ? (projektLink ? <a className="db-link" href={projektLink(r.projekt.nummer)}>{r.projekt.nummer} {r.projekt.name}</a> : `${r.projekt.nummer} ${r.projekt.name}`) : TR.risiken.portfolio}</td>
              <td className="pb-text">{r.text}</td>
              <td>{TR.stufe[r.wahrscheinlichkeit]}</td>
              <td>{TR.stufe[r.auswirkung]}</td>
              <td className="pb-text pb-opt">{r.massnahme || '–'}</td>
              <td><Stand familie={r.massnahmeStand === 'umgesetzt' ? 'positiv' : 'wartet'} label={TR.risiken.stand[r.massnahmeStand]!} /></td>
              <td className="pb-opt">{r.verantwortlich || '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Risikolage aus der API oder aus dem gespeicherten Stand des Portfolioberichts. */
export type LageDaten = Pick<Portfoliobericht['risikolage'], 'matrix' | 'abhaengigkeiten' | 'eskalationen'> & { risiken: RisikolageRisiko[] };

/**
 * Risikolage; mit `filter` und `setFilter` (Seite UI-18) führt jede Zahl zu ihren Risiken in der Tabelle, ohne
 * (Portfoliobericht) bleibt sie Text.
 */
export function Lage({ r, projektLink, filter, setFilter }: { r: LageDaten; projektLink?(nr: string): string; filter?: RisikoFilter; setFilter?(f: RisikoFilter): void }) {
  const hoch = r.risiken.filter(passt({ w: 'hoch', a: 'hoch' })).length;
  const offen = r.risiken.filter(passt({ massnahme: 'offen' })).length;
  const f = filter ?? {};
  const gefiltert = !!(f.w || f.a || f.massnahme);
  const risiken = gefiltert ? r.risiken.filter(passt(f)) : r.risiken;
  const zahl = (text: string, n: number, neu: RisikoFilter) => (setFilter
    ? <button type="button" className="linkbtn db-zahl" onClick={() => setFilter(neu)} disabled={!n} aria-label={TR.zeigen(text)}>{text}</button>
    : text);
  const A = TR.abhaengigkeiten;
  const E = TR.eskalationen;
  return (
    <>
      <div className="db-kennzahlen" role="status">
        <ul>
          {/* die Gesamtzahl hebt eine Auswahl auf und zeigt alle Risiken */}
          <li>{gefiltert ? zahl(TR.kennzahl.risiken(r.risiken.length), r.risiken.length, {}) : TR.kennzahl.risiken(r.risiken.length)}</li>
          <li>{zahl(TR.kennzahl.hoch(hoch), hoch, { w: 'hoch', a: 'hoch' })}</li>
          <li>{zahl(TR.kennzahl.offen(offen), offen, { massnahme: 'offen' })}</li>
        </ul>
      </div>
      <div className="pb-abschnitt"><RisikoMatrix matrix={r.matrix} waehlen={setFilter ? (w, a) => setFilter({ w, a }) : undefined} /></div>
      <section className="pb-abschnitt" aria-labelledby="pb-risiken">
        <h2 id="pb-risiken" className="grp-h">{TR.risiken.titel}</h2>
        {gefiltert ? (
          <p className="pb-auswahl">
            <span className="chip">
              <span className="v"><b>{TR.filter.label}:</b> {filterText(f)}</span>
              <button type="button" className="x" aria-label={TR.filter.entfernen(filterText(f))} onClick={() => setFilter?.({})}><Icon name="x" /></button>
            </span>
          </p>
        ) : null}
        {gefiltert && !risiken.length ? (
          // Z3: leer durch Filter, mit Ausweg
          <Empty action={<button type="button" className="btn" onClick={() => setFilter?.({})}>{TR.zuruecksetzen}</button>}><span role="status">{TR.leerFilter}</span></Empty>
        ) : <RisikoTabelle risiken={risiken} projektLink={projektLink} />}
      </section>
      <section className="pb-abschnitt" aria-labelledby="pb-abh">
        <h2 id="pb-abh" className="grp-h">{A.titel}</h2>
        {r.abhaengigkeiten.length ? (
          <table className="pb-tab"><thead><tr><th scope="col">{A.von}</th><th scope="col">{A.zu}</th><th scope="col">{A.text}</th></tr></thead>
            <tbody>{r.abhaengigkeiten.map(a => <tr key={a.id}><td>{a.von.nummer} {a.von.name}</td><td>{a.zu.nummer} {a.zu.name}</td><td className="pb-text">{a.text}</td></tr>)}</tbody>
          </table>
        ) : <p className="muted">{A.leer}</p>}
      </section>
      <section className="pb-abschnitt" aria-labelledby="pb-esk">
        <h2 id="pb-esk" className="grp-h">{E.titel}</h2>
        {r.eskalationen.length ? (
          <table className="pb-tab"><thead><tr><th scope="col">{E.projekt}</th><th scope="col">{E.periode}</th><th scope="col">{E.grund}</th><th scope="col" className="pb-opt">{E.massnahme}</th></tr></thead>
            <tbody>{r.eskalationen.map(e => <tr key={e.id}><td>{e.projekt.nummer} {e.projekt.name}</td><td>{fmtPeriode(e.periode)}</td><td className="pb-text">{e.grund}</td><td className="pb-text pb-opt">{e.massnahme || '–'}</td></tr>)}</tbody>
          </table>
        ) : <p className="muted">{E.leer}</p>}
      </section>
    </>
  );
}

const filterText = (f: RisikoFilter) => [f.w && f.a ? TR.filter.feld(TR.stufe[f.w]!, TR.stufe[f.a]!) : null, f.massnahme ? TR.filter.offen : null].filter(Boolean).join(', ');

export function RisikenPage({ search, setSearch }: { search: RisikenSearch; setSearch: SetRisikenSearch }) {
  const { canSomewhere } = useSession();
  const darf = canSomewhere('auswertung:read');
  const q = useRisikolage(search.portfolio, darf);
  const skelett = useVerzoegert(q.isPending && darf);
  const d = q.data;
  const toast = useToast();
  const [exportLaeuft, setExportLaeuft] = useState(false);
  const filter: RisikoFilter = { w: search.w, a: search.a, massnahme: search.massnahme };
  const exportieren = () => {
    setExportLaeuft(true);
    risikenExportieren({ portfolio: search.portfolio, ...filter })
      .then(name => toast.show(TR.exportiert(name)), e => toast.error(e)).finally(() => setExportLaeuft(false));
  };

  if (!darf) return <section aria-labelledby="page-title"><Kopf /><div className="body"><Empty>{TR.keinRecht}</Empty></div></section>;
  return (
    <section aria-labelledby="page-title">
      <Kopf unter={d ? TR.stand(fmtZeitpunkt(d.stand)) : undefined}
        aktionen={d?.risiken.length ? (
          <button type="button" className="btn" onClick={exportieren} disabled={exportLaeuft} aria-busy={exportLaeuft || undefined}><Icon name="download" />{TR.exportieren}</button>
        ) : null} />
      <div className="toolbar" role="search" aria-label={TR.inhalt}>
        <label className="db-select">
          <span className="sr">Portfolio</span>
          <select value={search.portfolio ?? ''} onChange={e => setSearch({ portfolio: e.target.value || undefined, w: undefined, a: undefined, massnahme: undefined })} disabled={!d}>
            <option value="">Alle Portfolios</option>
            {d?.portfolios.map(p => <option key={p.id} value={p.schluessel}>{p.name}</option>)}
          </select>
        </label>
      </div>
      {/* scrollbar auch ohne Eingabefelder (nur lesen) mit der Tastatur erreichbar (axe scrollable-region-focusable) */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- beschriftete, scrollbare Region (WCAG 2.1.1) */}
      <div className="body" tabIndex={0} role="region" aria-label={TR.inhalt}>
        {q.isPending ? (
          <div aria-busy="true"><span className="sr" role="status">{TR.title}</span>{skelett ? <Skelett /> : null}</div>
        ) : q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : d ? (
          <Lage r={d} projektLink={nr => `/projekte/${nr}`} filter={filter}
            setFilter={fl => setSearch({ w: fl.w, a: fl.a, massnahme: fl.massnahme })} />
        ) : null}
      </div>
    </section>
  );
}
