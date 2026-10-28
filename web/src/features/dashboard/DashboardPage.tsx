/**
 * Portfolio › Dashboard (UI-17, Seitentyp Bericht; BC PC.04.01, UC-014 Schritt 1; Kernablauf K1, K3): Filter oben
 * (Portfolio, Periode, Ansicht), Kennzahlen, Liste der Projekte (virtualisiert) oder Funnel nach Phase. Gremien und
 * Direktionen sehen nur ihre Portfolios; ohne Periode die letzte abgeschlossene (ab dem 1. für die Gremien, UC-005).
 * Jede Zahl (Kennzahl, Funnel) führt zu ihren Einzelwerten: sie filtert die Liste (`auswahl`, `phase`); Export als CSV.
 * Adresse: `/portfolio/dashboard?portfolio=transformation&ansicht=funnel&periode=2026-10&auswahl=kritisch` (I-N5).
 */
import { useMemo, useState, type ReactNode } from 'react';
import { useSession } from '../../auth/index.ts';
import { Empty, ErrorState, fmtPeriode, fmtPhase, Hinweis, Icon, Skelett, useToast, useVerzoegert, type Phase } from '../../ui/index.ts';
import { dashboardExportieren, useDashboard, type DashboardZeile } from './api.ts';
import { anzahl, filtern, type Auswahl } from './auswahl.ts';
import { Funnel } from './Funnel.tsx';
import { Projekttabelle } from './Projekttabelle.tsx';
import type { DashboardSearch, SetDashboardSearch } from './search.ts';
import { TD } from './texte.ts';
import './dashboard.css';

function Kopf({ unter, aktionen }: { unter?: string; aktionen?: ReactNode }) {
  return (
    <header className="mh">
      <div className="mh-row">
        <div className="mh-title">
          <div className="type-ico neutral"><Icon name="graph" /></div>
          <div className="minw0">
            <h1 id="page-title">{TD.title}</h1>
            <div className="sub">{unter ?? TD.sub}</div>
          </div>
        </div>
        {aktionen ? <div className="acts">{aktionen}</div> : null}
      </div>
    </header>
  );
}

/**
 * Kennzahlen der Liste (nach Phase gefiltert); jede Zahl zeigt ihre Projekte (Auswahl in der Adresse). Die Gesamtzahl
 * hebt eine Auswahl auf und zeigt damit alle gezählten Projekte.
 */
function Kennzahlen({ items, waehlen, alle }: { items: DashboardZeile[]; waehlen(a: Auswahl): void; alle?(): void }) {
  const teil = (a: Auswahl, text: (n: number) => string, immer = false) => {
    const n = anzahl(items, a);
    if (!n && !immer) return null;
    return (
      <li key={a}>
        <button type="button" className="linkbtn db-zahl" onClick={() => waehlen(a)} disabled={!n} aria-label={TD.zeigen(text(n))}>{text(n)}</button>
      </li>
    );
  };
  return (
    <div className="db-kennzahlen" role="status">
      <ul>
        <li>{alle && items.length
          ? <button type="button" className="linkbtn db-zahl" onClick={alle} aria-label={TD.zeigen(TD.kennzahl.projekte(items.length))}>{TD.kennzahl.projekte(items.length)}</button>
          : TD.kennzahl.projekte(items.length)}</li>
        {teil('im_plan', TD.kennzahl.imPlan, true)}
        {teil('kritisch', TD.kennzahl.kritisch, true)}
        {teil('nicht_gemeldet', TD.kennzahl.nichtGemeldet)}
        {teil('ausstehend', TD.kennzahl.ausstehend)}
        {teil('eskalation', TD.kennzahl.eskalation)}
      </ul>
    </div>
  );
}

export function DashboardPage({ search, setSearch, heute = new Date() }: { search: DashboardSearch; setSearch: SetDashboardSearch; heute?: Date }) {
  const { canSomewhere } = useSession();
  const darf = canSomewhere('auswertung:read');
  const q = useDashboard(search.portfolio, search.periode, darf);
  const skelett = useVerzoegert(q.isPending && darf);
  const d = q.data;
  // Kennzahlen zählen die Phase; die Liste zeigt Phase und Auswahl
  const inPhase = useMemo(() => (d ? filtern(d.items, { phase: search.phase }) : []), [d, search.phase]);
  const zeilen = useMemo(() => filtern(inPhase, { auswahl: search.auswahl }), [inPhase, search.auswahl]);
  const toast = useToast();
  const [exportLaeuft, setExportLaeuft] = useState(false);
  const gefiltert = !!(search.phase || search.auswahl);
  const zuruecksetzen = () => setSearch({ phase: undefined, auswahl: undefined });
  const exportieren = () => {
    if (!d) return;
    setExportLaeuft(true);
    dashboardExportieren({ portfolio: d.portfolio ?? undefined, periode: d.periode, phase: search.phase, auswahl: search.auswahl })
      .then(name => toast.show(TD.exportiert(name)), e => toast.error(e)).finally(() => setExportLaeuft(false));
  };

  if (!darf) return <section aria-labelledby="page-title"><Kopf /><div className="body"><Empty>{TD.keinRecht}</Empty></div></section>;

  const pLabel = d ? fmtPeriode(d.periode) : undefined;
  return (
    <section aria-labelledby="page-title">
      <Kopf unter={pLabel ? `${pLabel}${d!.portfolio ? ` · ${d!.portfolios.find(x => x.schluessel === d!.portfolio)?.name ?? ''}` : ''}` : undefined}
        aktionen={zeilen.length ? (
          <button type="button" className="btn" onClick={exportieren} disabled={exportLaeuft} aria-busy={exportLaeuft || undefined}><Icon name="download" />{TD.exportieren}</button>
        ) : null} />
      <div className="toolbar" role="search" aria-label={TD.title}>
        <label className="db-select">
          <span className="sr">{TD.filter.portfolio}</span>
          <select value={search.portfolio ?? ''} onChange={e => setSearch({ portfolio: e.target.value || undefined, phase: undefined })} disabled={!d}>
            <option value="">{TD.filter.allePortfolios}</option>
            {d?.portfolios.map(p => <option key={p.id} value={p.schluessel}>{p.name}</option>)}
          </select>
        </label>
        <label className="db-select">
          <span className="sr">{TD.filter.periode}</span>
          <select value={search.periode ?? d?.periode ?? ''} onChange={e => setSearch({ periode: e.target.value || undefined })} disabled={!d}>
            {d?.perioden.map(p => <option key={p.periode} value={p.periode}>{fmtPeriode(p.periode)}</option>)}
          </select>
        </label>
        <div className="seg" role="group" aria-label={TD.filter.ansicht}>
          <button type="button" className={search.ansicht ? '' : 'on'} aria-pressed={!search.ansicht} onClick={() => setSearch({ ansicht: undefined })}>{TD.ansicht.liste}</button>
          <button type="button" className={search.ansicht === 'funnel' ? 'on' : ''} aria-pressed={search.ansicht === 'funnel'} onClick={() => setSearch({ ansicht: 'funnel' })}>{TD.ansicht.funnel}</button>
        </div>
        {search.phase ? (
          <span className="chip">
            <span className="v"><b>{TD.spalte.phase}:</b> {fmtPhase(search.phase)}</span>
            <button type="button" className="x" aria-label={TD.phaseEntfernen(search.phase)} onClick={() => setSearch({ phase: undefined })}><Icon name="x" /></button>
          </span>
        ) : null}
        {search.auswahl ? (
          <span className="chip">
            <span className="v"><b>{TD.auswahlLabel}:</b> {TD.auswahl[search.auswahl]}</span>
            <button type="button" className="x" aria-label={TD.auswahlEntfernen(TD.auswahl[search.auswahl]!)} onClick={() => setSearch({ auswahl: undefined })}><Icon name="x" /></button>
          </span>
        ) : null}
      </div>
      <div className="body">
        {q.isPending ? (
          <div aria-busy="true"><span className="sr" role="status">{TD.title}</span>{skelett ? <Skelett /> : null}</div>
        ) : q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : d ? (
          <>
            {d.periodeStand === 'offen' ? <div className="db-hinweis"><Hinweis stufe="hinweis">{TD.periodeOffen(fmtPeriode(d.periode).split(' ')[0]!)}</Hinweis></div> : null}
            <Kennzahlen items={inPhase} waehlen={auswahl => setSearch({ ansicht: undefined, auswahl })}
              alle={search.auswahl ? () => setSearch({ ansicht: undefined, auswahl: undefined }) : undefined} />
            {!d.items.length ? <Empty>{TD.leer}</Empty> : search.ansicht === 'funnel' ? (
              <Funnel items={d.items} waehlen={(phase: Phase, auswahl?: Auswahl) => setSearch({ ansicht: undefined, phase, auswahl })} />
            ) : zeilen.length ? (
              <Projekttabelle zeilen={zeilen} projektLink={nr => `/projekte/${nr}`} heute={heute} />
            ) : gefiltert ? (
              // Z3: leer durch Filter, mit Ausweg
              <Empty action={<button type="button" className="btn" onClick={zuruecksetzen}>{TD.zuruecksetzen}</button>}><span role="status">{TD.leerFilter}</span></Empty>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
