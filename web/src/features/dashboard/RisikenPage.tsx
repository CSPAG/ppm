/**
 * Portfolio › Dashboard › Risiken (UI-18, Seitentyp Bericht; BC PC.02.02, UC-014 Schritt 2; Kernablauf K3 Schritt 7):
 * Filter oben (Portfolio), Kennzahlen, Verteilung nach Wahrscheinlichkeit × Auswirkung als Tabelle, Risiken mit
 * Massnahme, Abhängigkeiten und offene Eskalationen. Stufen als Text, nie nur Farbe (Q-B5).
 * Adresse: `/portfolio/dashboard/risiken?portfolio=transformation` (I-N5).
 */
import { useSession } from '../../auth/index.ts';
import { Empty, ErrorState, fmtPeriode, fmtZeitpunkt, Icon, Skelett, Stand, useVerzoegert } from '../../ui/index.ts';
import { useRisikolage, type Portfoliobericht, type RisikolageRisiko } from './PortfolioberichtApi.ts';
import type { RisikenSearch, SetRisikenSearch } from './PortfolioberichtSuche.ts';
import { TR } from './PortfolioberichtTexte.ts';
import './dashboard.css';
import './Portfoliobericht.css';

const STUFEN = ['hoch', 'mittel', 'tief'] as const;

function Kopf({ unter }: { unter?: string }) {
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
      </div>
    </header>
  );
}

/** Verteilung als Tabelle (Zeilen Wahrscheinlichkeit, Spalten Auswirkung); Zahl und Text, Farbe nur zusätzlich. */
export function RisikoMatrix({ matrix }: { matrix: { wahrscheinlichkeit: string; auswirkung: string; anzahl: number }[] }) {
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
              return <td key={a} className={k ? `pb-feld pb-${ton}` : 'pb-feld'} aria-label={TR.matrix.feld(TR.stufe[w]!, TR.stufe[a]!, k)}>{k}</td>;
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

export function Lage({ r, projektLink }: { r: LageDaten; projektLink?(nr: string): string }) {
  const hoch = r.risiken.filter(x => x.wahrscheinlichkeit === 'hoch' && x.auswirkung === 'hoch').length;
  const offen = r.risiken.filter(x => x.massnahmeStand === 'offen').length;
  const A = TR.abhaengigkeiten;
  const E = TR.eskalationen;
  return (
    <>
      <p className="db-kennzahlen" role="status">{[TR.kennzahl.risiken(r.risiken.length), TR.kennzahl.hoch(hoch), TR.kennzahl.offen(offen)].join(' · ')}</p>
      <div className="pb-abschnitt"><RisikoMatrix matrix={r.matrix} /></div>
      <section className="pb-abschnitt" aria-labelledby="pb-risiken"><h2 id="pb-risiken" className="grp-h">{TR.risiken.titel}</h2><RisikoTabelle risiken={r.risiken} projektLink={projektLink} /></section>
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

export function RisikenPage({ search, setSearch }: { search: RisikenSearch; setSearch: SetRisikenSearch }) {
  const { canSomewhere } = useSession();
  const darf = canSomewhere('auswertung:read');
  const q = useRisikolage(search.portfolio, darf);
  const skelett = useVerzoegert(q.isPending && darf);
  const d = q.data;

  if (!darf) return <section aria-labelledby="page-title"><Kopf /><div className="body"><Empty>{TR.keinRecht}</Empty></div></section>;
  return (
    <section aria-labelledby="page-title">
      <Kopf unter={d ? TR.stand(fmtZeitpunkt(d.stand)) : undefined} />
      <div className="toolbar" role="search" aria-label={TR.title}>
        <label className="db-select">
          <span className="sr">Portfolio</span>
          <select value={search.portfolio ?? ''} onChange={e => setSearch({ portfolio: e.target.value || undefined })} disabled={!d}>
            <option value="">Alle Portfolios</option>
            {d?.portfolios.map(p => <option key={p.id} value={p.schluessel}>{p.name}</option>)}
          </select>
        </label>
      </div>
      <div className="body">
        {q.isPending ? (
          <div aria-busy="true"><span className="sr" role="status">{TR.title}</span>{skelett ? <Skelett /> : null}</div>
        ) : q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : d ? <Lage r={d} projektLink={nr => `/projekte/${nr}`} /> : null}
      </div>
    </section>
  );
}
