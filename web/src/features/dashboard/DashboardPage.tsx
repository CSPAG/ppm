/**
 * Portfolio › Dashboard (UI-17, Seitentyp Bericht; BC PC.04.01, UC-014 Schritt 1; Kernablauf K1, K3): Filter oben
 * (Portfolio, Periode, Ansicht), Kennzahlen, Liste der Projekte (virtualisiert) oder Funnel nach Phase. Gremien und
 * Direktionen sehen nur ihre Portfolios; ohne Periode die letzte abgeschlossene (ab dem 1. für die Gremien, UC-005).
 * Adresse: `/portfolio/dashboard?portfolio=transformation&ansicht=funnel&periode=2026-10` (I-N5).
 */
import { useMemo } from 'react';
import { useSession } from '../../auth/index.ts';
import { Empty, ErrorState, fmtPeriode, fmtPhase, Hinweis, Icon, Skelett, useVerzoegert, type Phase } from '../../ui/index.ts';
import { useDashboard, type DashboardZeile } from './api.ts';
import { Funnel } from './Funnel.tsx';
import { Projekttabelle } from './Projekttabelle.tsx';
import type { DashboardSearch, SetDashboardSearch } from './search.ts';
import { TD } from './texte.ts';
import './dashboard.css';

function Kopf({ unter }: { unter?: string }) {
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
      </div>
    </header>
  );
}

function Kennzahlen({ items }: { items: DashboardZeile[] }) {
  const n = (f: (z: DashboardZeile) => boolean) => items.filter(f).length;
  const teile = [
    TD.kennzahl.projekte(items.length),
    TD.kennzahl.imPlan(n(z => z.status === 'im_plan' && z.meldung !== 'nicht_gemeldet')),
    TD.kennzahl.kritisch(n(z => z.status === 'kritisch' && z.meldung !== 'nicht_gemeldet')),
  ];
  const ng = n(z => z.meldung === 'nicht_gemeldet');
  const aus = n(z => z.meldung === 'ausstehend');
  const esk = n(z => z.merkmale.includes('eskalation'));
  if (ng) teile.push(TD.kennzahl.nichtGemeldet(ng));
  if (aus) teile.push(TD.kennzahl.ausstehend(aus));
  if (esk) teile.push(TD.kennzahl.eskalation(esk));
  return <p className="db-kennzahlen" role="status">{teile.join(' · ')}</p>;
}

export function DashboardPage({ search, setSearch, heute = new Date() }: { search: DashboardSearch; setSearch: SetDashboardSearch; heute?: Date }) {
  const { canSomewhere } = useSession();
  const darf = canSomewhere('auswertung:read');
  const q = useDashboard(search.portfolio, search.periode, darf);
  const skelett = useVerzoegert(q.isPending && darf);
  const d = q.data;
  const zeilen = useMemo(() => (d ? (search.phase ? d.items.filter(z => z.phase === search.phase) : d.items) : []), [d, search.phase]);

  if (!darf) return <section aria-labelledby="page-title"><Kopf /><div className="body"><Empty>{TD.keinRecht}</Empty></div></section>;

  const pLabel = d ? fmtPeriode(d.periode) : undefined;
  return (
    <section aria-labelledby="page-title">
      <Kopf unter={pLabel ? `${pLabel}${d!.portfolio ? ` · ${d!.portfolios.find(x => x.schluessel === d!.portfolio)?.name ?? ''}` : ''}` : undefined} />
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
            <button type="button" className="x" aria-label={`${TD.spalte.phase} ${search.phase} entfernen`} onClick={() => setSearch({ phase: undefined })}><Icon name="x" /></button>
          </span>
        ) : null}
      </div>
      <div className="body">
        {q.isPending ? (
          <div aria-busy="true"><span className="sr" role="status">{TD.title}</span>{skelett ? <Skelett /> : null}</div>
        ) : q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : d ? (
          <>
            {d.periodeStand === 'offen' ? <div className="db-hinweis"><Hinweis stufe="hinweis">{TD.periodeOffen(fmtPeriode(d.periode).split(' ')[0]!)}</Hinweis></div> : null}
            <Kennzahlen items={zeilen} />
            {!d.items.length ? <Empty>{TD.leer}</Empty> : search.ansicht === 'funnel' ? (
              <Funnel stufen={d.funnel} phaseWaehlen={(phase: Phase) => setSearch({ ansicht: undefined, phase })} />
            ) : (
              <Projekttabelle zeilen={zeilen} projektLink={nr => `/projekte/${nr}`} heute={heute} />
            )}
          </>
        ) : null}
      </div>
    </section>
  );
}
