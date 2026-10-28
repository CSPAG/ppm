/**
 * Portfolio › Finanzen (Seitentyp Bericht; BC PC.01.02, PC.01.04; UC-010 Schritte 2–4): Übersicht (UI-26) mit Prognose,
 * Budget und Ist je Projekt und Kennzahlen des Portfolios; Abweichungen (UI-27) nur mit Abweichung, wesentliche zuerst,
 * mit Begründung. Filter oben (Portfolio, auch nicht aktive), Diagramm Prognose gegenüber Budget, Tabelle, Export als
 * CSV; jede Zeile öffnet das Projekt in der Schublade (`?o=<nummer>`) mit Werten je Phase, Verlauf, Kostenträger und
 * Begründungen. Beträge nur mit `finanzen:read` (A-33); Ist ohne Wert «noch nicht verfügbar» (darstellung.md).
 * Adresse: `/portfolio/finanzen?portfolio=transformation&o=2026-014` (I-N5).
 */
import { useId } from 'react';
import { useSession } from '../../auth/index.ts';
import { Empty, ErrorState, fmtPeriode, Hinweis, Icon, Skelett, useVerzoegert } from '../../ui/index.ts';
import { abweichung, csv, herunterladen, ist, kurz } from './anzeige.ts';
import { useFinanzen, usePortfolios, type FinanzProjekt, type Finanzuebersicht } from './api.ts';
import { Kopf, reiterFuer } from './Kopf.tsx';
import { ProjektDrawer } from './ProjektDrawer.tsx';
import type { FinanzenSearch, SetFinanzenSearch } from './search.ts';
import { TF } from './texte.ts';
import './finanzen.css';

type Art = 'uebersicht' | 'abweichungen';

export function FinanzenPage({ art = 'uebersicht', search, setSearch, navigieren }: { art?: Art; search: FinanzenSearch; setSearch: SetFinanzenSearch; navigieren(pfad: string): void }) {
  const { can } = useSession();
  const selId = useId();
  const portfolios = usePortfolios();
  // Ohne Portfolio alle Projekte mit sichtbaren Beträgen (die PL ihre, das Gremium die seines Portfolios)
  const pf = search.portfolio ? portfolios.data?.find(p => p.schluessel === search.portfolio) : undefined;
  const bereit = !search.portfolio || !!pf;
  const q = useFinanzen(art, pf?.id ?? null, !!search.alle, bereit);
  const d = q.data;
  const skelett = useVerzoegert((!!search.portfolio && portfolios.isPending) || (bereit && q.isPending));
  // Reiter behalten den Filter (Portfolio, auch nicht aktive)
  const query = new URLSearchParams({ ...(pf ? { portfolio: pf.schluessel } : {}), ...(search.alle ? { alle: '1' } : {}) }).toString();
  const offen = search.o && d ? d.projekte.find(p => p.nummer === search.o) : undefined;

  const exportieren = () => {
    if (!d) return;
    const kopf = [TF.projekt, 'Name', TF.phase, `${TF.prognose} CHF`, `${TF.budget} CHF`, `${TF.ist} CHF`, `${TF.abweichung} CHF`, `${TF.abweichung} %`, TF.wesentlich, TF.kostentraeger, TF.begruendung];
    const zeilen = d.projekte.map(p => [p.nummer, p.name, p.phase, p.prognose, p.budget, p.ist, p.abweichung.betrag, p.abweichung.prozent, p.abweichung.wesentlich ? 'ja' : 'nein', p.kostentraeger, p.begruendung?.text ?? null]);
    herunterladen(`finanzen-${pf?.schluessel ?? 'alle'}-${art}.csv`, csv(kopf, zeilen));
  };

  return (
    <section aria-labelledby="page-title" className="fi">
      <Kopf reiter={art} reiterSichtbar={reiterFuer(can('finanzen:read'))} navigieren={navigieren} query={query}
        sub={d ? <Stand d={d} /> : TF.sub}
        aktionen={d?.projekte.length ? <button type="button" className="btn" onClick={exportieren}><Icon name="download" />{TF.export}</button> : null} />
      <div className="toolbar" role="search" aria-label={TF.title}>
        <label htmlFor={selId} className="fi-l">{TF.portfolio}</label>
        <select id={selId} className="fi-in" value={pf?.schluessel ?? ''} disabled={!portfolios.data?.length && !search.portfolio}
          onChange={e => setSearch({ portfolio: e.target.value || undefined, o: undefined })}>
          <option value="">{TF.allePortfolios}</option>
          {(portfolios.data ?? []).map(p => <option key={p.id} value={p.schluessel}>{`${p.kategorie} · ${p.name}`}</option>)}
        </select>
        <label className="fi-check">
          <input type="checkbox" checked={!!search.alle} onChange={e => setSearch({ alle: e.target.checked ? '1' : undefined }, { replace: true })} />
          {TF.alle}
        </label>
      </div>
      <div className="body fi-body">
        {portfolios.error && search.portfolio ? <ErrorState error={portfolios.error} onRetry={() => void portfolios.refetch()} /> : null}
        {q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : null}
        {skelett ? <Skelett zeilen={8} /> : null}
        {portfolios.data && search.portfolio && !pf ? <Empty>{TF.portfolioUnbekannt}</Empty> : null}
        {d && d.ohneProjekt.length ? (
          <Hinweis stufe="hinweis">
            {TF.ohneProjekt(d.ohneProjekt.length)}: {d.ohneProjekt.map(k => `${k.kostentraeger} (${kurz(k.betrag)} bis ${fmtPeriode(k.bis)})`).join(', ')}. {TF.ohneProjektHilfe}
          </Hinweis>
        ) : null}
        {d && !d.projekte.length ? <Empty>{art === 'abweichungen' ? TF.keineAbweichungen : TF.keineProjekte}</Empty> : null}
        {d?.projekte.length ? (
          <>
            <Kennzahlen d={d} />
            {art === 'uebersicht' ? <Diagramm projekte={d.projekte} oeffnen={nr => setSearch({ o: nr })} /> : null}
            <Tabelle art={art} projekte={d.projekte} aktuell={search.o} oeffnen={nr => setSearch({ o: nr })} />
          </>
        ) : null}
      </div>
      {search.o && d ? <ProjektDrawer projekt={offen} nummer={search.o} canWrite={d.can.write} onClose={() => setSearch({ o: undefined })} /> : null}
    </section>
  );
}

function Stand({ d }: { d: Finanzuebersicht }) {
  return <>{d.portfolio ? `${d.portfolio.name} · ` : ''}{d.istStand ? TF.istBis(fmtPeriode(d.istStand)) : TF.istNochNicht}</>;
}

/** Kennzahlen in der Reihenfolge Prognose, Budget, Ist (darstellung.md «Kosten»), dazu Abweichung und wesentliche. */
function Kennzahlen({ d }: { d: Finanzuebersicht }) {
  const s = d.summe;
  const wesentlich = d.projekte.filter(p => p.abweichung.wesentlich).length;
  const prozent = s.budget > 0 ? Math.round((s.abweichung / s.budget) * 1000) / 10 : null;
  return (
    <dl className="fi-kz">
      <div><dt>{TF.prognose}</dt><dd>{kurz(s.prognose)}</dd></div>
      <div><dt>{TF.budget}</dt><dd>{kurz(s.budget)}</dd></div>
      <div><dt>{TF.ist}</dt><dd>{ist(s.ist)}</dd></div>
      <div><dt>{TF.abweichung}</dt><dd>{abweichung({ betrag: s.budget > 0 ? s.abweichung : null, prozent })}</dd></div>
      <div className={wesentlich ? 'fi-warn' : undefined}><dt>{TF.ueberToleranz}</dt><dd>{TF.anzahlProjekte(wesentlich)}</dd></div>
    </dl>
  );
}

/** Prognose gegenüber Budget je Projekt (Balken; Text in der Beschriftung, Farbe nur zusätzlich, Q-B5). */
function Diagramm({ projekte, oeffnen }: { projekte: readonly FinanzProjekt[]; oeffnen(nummer: string): void }) {
  const max = Math.max(1, ...projekte.map(p => Math.max(p.prognose ?? 0, p.budget ?? 0)));
  return (
    <figure className="fi-diagramm">
      <figcaption>{TF.diagramm}</figcaption>
      <ul>
        {projekte.map(p => (
          <li key={p.id}>
            <button type="button" className="fi-balken-z" onClick={() => oeffnen(p.nummer)} aria-label={TF.balken(`${p.nummer} ${p.name}`, kurz(p.prognose), kurz(p.budget))}>
              <span className="fi-balken-n mono" aria-hidden="true">{p.nummer}</span>
              <span className="fi-balken" aria-hidden="true">
                <span className="fi-b-budget" style={{ width: `${((p.budget ?? 0) / max) * 100}%` }} />
                <span className={`fi-b-prognose${p.abweichung.wesentlich ? ' fi-b-warn' : ''}`} style={{ width: `${((p.prognose ?? 0) / max) * 100}%` }} />
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="fi-legende" aria-hidden="true"><span className="fi-l-prognose" /> {TF.prognose} <span className="fi-l-budget" /> {TF.budget}</p>
    </figure>
  );
}

function Tabelle({ art, projekte, aktuell, oeffnen }: { art: Art; projekte: readonly FinanzProjekt[]; aktuell?: string; oeffnen(nummer: string): void }) {
  return (
    <div className="fi-scroll">
      <table className="fi-tab">
        <caption className="sr">{art === 'abweichungen' ? TF.tabelleAbweichungen : TF.tabelle}</caption>
        <thead>
          <tr>
            <th scope="col">{TF.projekt}</th>
            <th scope="col">{TF.phase}</th>
            <th scope="col" className="num">{TF.prognose}</th>
            <th scope="col" className="num">{TF.budget}</th>
            <th scope="col" className="num">{TF.ist}</th>
            <th scope="col" className="num">{TF.abweichung}</th>
            {art === 'abweichungen' ? <th scope="col">{TF.begruendung}</th> : <th scope="col">{TF.kostentraeger}</th>}
          </tr>
        </thead>
        <tbody>
          {projekte.map(p => (
            <tr key={p.id} className={aktuell === p.nummer ? 'cur' : undefined}>
              <th scope="row"><button type="button" className="fi-pl" onClick={() => oeffnen(p.nummer)}><span className="mono">{p.nummer}</span> {p.name}</button></th>
              <td>{p.phase}</td>
              <td className="num">{kurz(p.prognose)}</td>
              <td className="num">{kurz(p.budget)}</td>
              <td className="num">{p.ist === null ? <span className="empty">{TF.nichtVerfuegbar}</span> : kurz(p.ist)}</td>
              <td className="num">
                {abweichung(p.abweichung)}
                {p.abweichung.wesentlich ? <span className="fi-badge"><Icon name="warn" />{TF.wesentlich}</span> : null}
              </td>
              {art === 'abweichungen'
                ? <td>{p.begruendung ? <><span className="fi-hint">{fmtPeriode(p.begruendung.periode)}:</span> {p.begruendung.text}</> : <span className="empty">{TF.begruendungFehlt}</span>}</td>
                : <td>{p.kostentraeger ?? <span className="empty">–</span>}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Portfolio › Finanzen › Abweichungen (UI-27). */
export function AbweichungenPage(props: { search: FinanzenSearch; setSearch: SetFinanzenSearch; navigieren(pfad: string): void }) {
  return <FinanzenPage art="abweichungen" {...props} />;
}
