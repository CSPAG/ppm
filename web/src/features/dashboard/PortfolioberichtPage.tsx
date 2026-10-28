/**
 * Portfolio › Auswertungen › Portfoliobericht (UI-29, Seitentyp Bericht; BC PC.04.02, UC-014 Schritt 3; Kernablauf K3
 * Schritt 4): Bericht der Periode je Portfolio aus dem abgeschlossenen Dashboard und der Risikolage (PPM-4). Die UE
 * erzeugt ihn («Portfoliobericht erzeugen»), ergänzt den Kommentar «Bericht der Programmleitung» und stellt ihn bereit
 * (Wirkung vorher, I-R1 Stufe 3); Gremien sehen bereitgestellte Berichte. Dokument als PDF oder Word.
 * Adresse: `/portfolio/auswertungen/portfoliobericht?portfolio=transformation&periode=2026-10` (I-N5).
 */
import { useId, useState } from 'react';
import { isConflict } from '../../api/index.ts';
import { useSession } from '../../auth/index.ts';
import {
  Dialog, Empty, ErrorState, fmtPeriode, fmtPhase, fmtZeitpunkt, Hinweis, Icon, Skelett, Stand, Status, useToast, useVerzoegert,
} from '../../ui/index.ts';
import { useDashboard, type DashboardZeile } from './api.ts';
import { dokumentUrl, useBericht, useBerichtAktionen, useBerichte, type Portfoliobericht } from './PortfolioberichtApi.ts';
import type { PortfolioberichtSearch, SetPortfolioberichtSearch } from './PortfolioberichtSuche.ts';
import { TP } from './PortfolioberichtTexte.ts';
import { TD } from './texte.ts';
import { Lage, type LageDaten } from './RisikenPage.tsx';
import './dashboard.css';
import './Portfoliobericht.css';

const STATUS = { im_plan: 'im-plan', kritisch: 'kritisch' } as const;

function Kopf({ unter, rechts }: { unter?: string; rechts?: React.ReactNode }) {
  return (
    <header className="mh">
      <div className="mh-row">
        <div className="mh-title">
          <div className="type-ico neutral"><Icon name="doc" /></div>
          <div className="minw0">
            <h1 id="page-title">{TP.title}</h1>
            <div className="sub">{unter ?? TP.sub}</div>
          </div>
        </div>
        {rechts ? <div className="pb-kopf">{rechts}</div> : null}
      </div>
    </header>
  );
}

function Projekte({ items }: { items: DashboardZeile[] }) {
  if (!items.length) return <p className="muted">{TD.leer}</p>;
  return (
    <div className="pb-scroll">
      <table className="pb-tab">
        <caption className="sr">{TP.abschnitt.projekte}</caption>
        <thead><tr><th scope="col">{TD.spalte.projekt}</th><th scope="col">{TD.spalte.phase}</th><th scope="col">{TD.spalte.status}</th><th scope="col" className="pb-opt">{TD.spalte.meilenstein}</th><th scope="col" className="pb-opt">{TD.spalte.projektleitung}</th></tr></thead>
        <tbody>
          {items.map(z => (
            <tr key={z.projektId}>
              <td><a className="db-link" href={`/projekte/${z.nummer}`}>{z.nummer} {z.name}</a>{z.merkmale.includes('eskalation') ? <span className="db-meldung">{TD.kennzahl.eskalation(1)}</span> : null}</td>
              <td>{fmtPhase(z.phase)}</td>
              <td>{z.meldung === 'nicht_gemeldet'
                ? <Status status="nicht-gemeldet" vorperiode={z.status ? STATUS[z.status] : undefined} />
                : z.status ? <Status status={STATUS[z.status]} /> : <span className="muted">{TD.keinStatus}</span>}</td>
              <td className="pb-text pb-opt">{z.naechsterMeilenstein?.text ?? '–'}</td>
              <td className="pb-opt">{z.projektleitung ?? '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Inhalt des Berichts; den Kommentar zeigt im Entwurf das Eingabefeld darüber. */
function Inhalt({ b }: { b: Portfoliobericht }) {
  const d = b.dashboard;
  const n = (f: (z: DashboardZeile) => boolean) => d.items.filter(f).length;
  const F = TD.funnel.spalte;
  return (
    <>
      {b.can.bearbeiten ? null : (
        <section className="pb-abschnitt" aria-labelledby="pb-kommentar-h">
          <h2 id="pb-kommentar-h" className="grp-h">{TP.kommentar.label}</h2>
          <p className="pb-text">{b.kommentar || <span className="muted">{TP.kommentar.leer}</span>}</p>
        </section>
      )}
      <section className="pb-abschnitt" aria-labelledby="pb-uebersicht">
        <h2 id="pb-uebersicht" className="grp-h">{TP.abschnitt.uebersicht}</h2>
        <p>{[TD.kennzahl.projekte(d.items.length), TD.kennzahl.imPlan(n(z => z.status === 'im_plan' && z.meldung !== 'nicht_gemeldet')),
          TD.kennzahl.kritisch(n(z => z.status === 'kritisch' && z.meldung !== 'nicht_gemeldet')), TD.kennzahl.nichtGemeldet(n(z => z.meldung === 'nicht_gemeldet')),
          TD.kennzahl.eskalation(n(z => z.merkmale.includes('eskalation')))].join(' · ')}</p>
        <table className="pb-tab">
          <caption className="sr">{TP.abschnitt.funnel}</caption>
          <thead><tr><th scope="col">{F.phase}</th><th scope="col">{F.anzahl}</th><th scope="col">{F.imPlan}</th><th scope="col">{F.kritisch}</th><th scope="col">{F.nichtGemeldet}</th></tr></thead>
          <tbody>{d.funnel.map(f => <tr key={f.phase}><th scope="row">{fmtPhase(f.phase)}</th><td>{f.anzahl}</td><td>{f.imPlan}</td><td>{f.kritisch}</td><td>{f.nichtGemeldet}</td></tr>)}</tbody>
        </table>
      </section>
      <section className="pb-abschnitt" aria-labelledby="pb-projekte"><h2 id="pb-projekte" className="grp-h">{TP.abschnitt.projekte}</h2><Projekte items={d.items} /></section>
      <section aria-labelledby="pb-lage"><h2 id="pb-lage" className="grp-h pb-abschnitt">{TP.abschnitt.risiken}</h2><Lage r={b.risikolage as LageDaten} /></section>
    </>
  );
}

/**
 * Kommentar der Programmleitung. Ein neuer Stand vom Server (nach Speichern oder Konflikt 412) ersetzt den Text nur, solange
 * er nicht geändert ist; sonst bleibt die Eingabe, und der inzwischen gespeicherte Kommentar steht daneben (Z7).
 */
function Kommentar({ b, speichern, busy }: { b: Portfoliobericht; speichern(text: string): void; busy: boolean }) {
  const id = useId();
  const [text, setText] = useState(b.kommentar);
  const [basis, setBasis] = useState(b.kommentar);
  const [andere, setAndere] = useState<string | null>(null);
  // neuer Stand vom Server: während des Renderns abgleichen (React «Zustand bei geänderten Props anpassen»)
  if (b.kommentar !== basis) {
    setBasis(b.kommentar);
    if (text === basis || text.trim() === b.kommentar.trim()) { setText(b.kommentar); setAndere(null); } else setAndere(b.kommentar);
  }
  return (
    <div className="pb-abschnitt pb-kommentar field">
      <label htmlFor={id}>{TP.kommentar.label}</label>
      <textarea id={id} value={text} maxLength={8000} aria-describedby={`${id}-h`} onChange={e => setText(e.target.value)} />
      <div id={`${id}-h`} className="note">{TP.kommentar.hinweis}</div>
      {andere !== null ? <Hinweis stufe="warnung">{TP.kommentar.andere(andere || TP.kommentar.leer)}</Hinweis> : null}
      <button type="button" className="btn sm" disabled={busy || text.trim() === b.kommentar} onClick={() => speichern(text)}><Icon name="check" />{TP.aktion.speichern}</button>
    </div>
  );
}

export function PortfolioberichtPage({ search, setSearch }: { search: PortfolioberichtSearch; setSearch: SetPortfolioberichtSearch }) {
  const { canSomewhere, can } = useSession();
  const darf = canSomewhere('auswertung:read');
  const schreiben = can('auswertung:write');
  const toast = useToast();
  const [frage, setFrage] = useState(false);
  const dash = useDashboard(search.portfolio, undefined, darf);
  const portfolio = search.portfolio ?? dash.data?.portfolios[0]?.schluessel;
  const perioden = dash.data?.perioden ?? [];
  const periode = search.periode ?? perioden.find(p => p.stand === 'abgeschlossen')?.periode;
  const liste = useBerichte(portfolio, darf && !!portfolio);
  const kurz = liste.data?.find(b => b.periode === periode && b.portfolio.schluessel === portfolio);
  const q = useBericht(kurz?.id);
  const a = useBerichtAktionen();
  const skelett = useVerzoegert((dash.isPending || liste.isPending) && darf);
  const b = q.data;
  const pText = periode ? fmtPeriode(periode) : '';
  const abgeschlossen = perioden.find(p => p.periode === periode)?.stand === 'abgeschlossen';
  const fehler = (e: unknown) => { toast.error(e, isConflict(e) ? TP.konflikt : undefined); if (isConflict(e)) void q.refetch(); };

  if (!darf) return <section aria-labelledby="page-title"><Kopf /><div className="body"><Empty>{TP.keinRecht}</Empty></div></section>;

  const erzeugen = () => portfolio && periode && a.erzeugen.mutate({ portfolio, periode }, {
    onSuccess: n => toast.show(n.version > 1 ? TP.toast.neu(pText) : TP.toast.erzeugt(pText)), onError: fehler,
  });
  const busy = a.erzeugen.isPending || a.kommentieren.isPending || a.bereitstellen.isPending;
  const standBadge = b ? <Stand familie={b.stand === 'bereitgestellt' ? 'positiv' : 'wartet'} label={TP.stand[b.stand]!}
    detail={b.stand === 'bereitgestellt' ? TP.standDetail.bereitgestellt(fmtZeitpunkt(b.bereitgestelltAt!)) : TP.standDetail.entwurf} /> : null;

  return (
    <section aria-labelledby="page-title">
      <Kopf unter={b ? `${b.portfolio.name} · ${pText} · ${TP.erzeugt(fmtZeitpunkt(b.erzeugtAt))}` : undefined} rechts={standBadge} />
      <div className="toolbar" role="search" aria-label={TP.title}>
        <label className="db-select">
          <span className="sr">{TP.filter.portfolio}</span>
          <select value={portfolio ?? ''} onChange={e => setSearch({ portfolio: e.target.value || undefined })} disabled={!dash.data}>
            {dash.data?.portfolios.map(p => <option key={p.id} value={p.schluessel}>{p.name}</option>)}
          </select>
        </label>
        <label className="db-select">
          <span className="sr">{TP.filter.periode}</span>
          <select value={periode ?? ''} onChange={e => setSearch({ periode: e.target.value || undefined })} disabled={!dash.data}>
            {perioden.map(p => <option key={p.periode} value={p.periode}>{fmtPeriode(p.periode)}</option>)}
          </select>
        </label>
      </div>
      {/* scrollbar mit der Tastatur erreichbar, auch für Lesende ohne Eingabefelder (axe scrollable-region-focusable) */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- beschriftete, scrollbare Region (WCAG 2.1.1) */}
      <div className="body" tabIndex={0} role="region" aria-label={TP.inhalt}>
        {dash.isPending || liste.isPending || (kurz && q.isPending) ? (
          <div aria-busy="true"><span className="sr" role="status">{TP.title}</span>{skelett ? <Skelett /> : null}</div>
        ) : dash.error || liste.error || q.error ? (
          <ErrorState error={dash.error ?? liste.error ?? q.error} onRetry={() => { void dash.refetch(); void liste.refetch(); }} />
        ) : !portfolio || !periode ? <Empty>{TD.leer}</Empty> : !b ? (
          !abgeschlossen ? <div className="pb-abschnitt"><Hinweis stufe="hinweis">{TP.periodeOffen(pText)}</Hinweis></div>
            : schreiben ? (
              <Empty action={<button type="button" className="btn primary" disabled={busy} onClick={erzeugen}><Icon name="plus" />{TP.aktion.erzeugen}</button>}>{TP.keinBericht(pText)}</Empty>
            ) : <Empty>{TP.keinBerichtLeser(pText)}</Empty>
        ) : (
          <>
            <div className="pb-aktionen">
              {b.can.bereitstellen ? <button type="button" className="btn primary" disabled={busy} onClick={() => setFrage(true)}><Icon name="send" />{TP.aktion.bereitstellen}</button> : null}
              {b.can.bearbeiten ? <button type="button" className="btn" disabled={busy} onClick={erzeugen} title={TP.neuErzeugenHinweis}>{TP.aktion.neuErzeugen}</button> : null}
              <a className="btn" href={dokumentUrl(b.id, 'pdf')} download><Icon name="download" />{TP.aktion.pdf}</a>
              <a className="btn" href={dokumentUrl(b.id, 'docx')} download><Icon name="download" />{TP.aktion.word}</a>
            </div>
            {b.can.bearbeiten ? <Kommentar key={b.id} b={b} busy={busy} speichern={text => a.kommentieren.mutate({ b, kommentar: text }, { onSuccess: () => toast.show(TP.toast.gespeichert), onError: fehler })} /> : null}
            <Inhalt b={b} />
          </>
        )}
      </div>
      {frage && b ? (
        <Dialog title={TP.bereitstellenDialog.titel(pText)} onClose={() => setFrage(false)} footer={<>
          <button type="button" className="btn" onClick={() => setFrage(false)} data-autofocus>{TP.aktion.abbrechen}</button>
          <button type="button" className="btn primary" disabled={busy} onClick={() => a.bereitstellen.mutate(b, {
            onSuccess: () => { setFrage(false); toast.show(TP.toast.bereitgestellt(pText)); }, onError: e => { setFrage(false); fehler(e); },
          })}>{TP.aktion.bereitstellen}</button>
        </>}>
          <p>{TP.bereitstellenDialog.text(TP.bereitstellenDialog.gremium)}</p>
        </Dialog>
      ) : null}
    </section>
  );
}
