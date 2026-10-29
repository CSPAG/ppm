/**
 * «Meine Projekte» im Arbeitsraum «Projekte» (UI-05, Seitentyp Liste + Schublade; Einstieg in die Projektakte für
 * UC-002–004, 007, 015). Projektzeile «mittel» (darstellung.md) mit den Angaben, die es vor dem ersten Statusbericht gibt;
 * Suche, Filter nach eigener Rolle, Phase und Stand in der Adresse (I-L1, I-N5), «Mehr laden» (I-L3), Schublade `?o=<nr>`.
 * Ansicht «Alle Projekte» (`?ansicht=alle`, UI-52; Master Entscheid 14): Kopfdaten aller nicht vertraulichen Projekte;
 * wer nirgends Projekte lesen darf, sieht nur diese Ansicht.
 */
import { PersonName } from '@vollholz/iam-web';
import { useSession } from '../../auth/index.ts';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { Datenliste, fmtPhase, Icon, PhaseKurz, T, type Spalte } from '../../ui/index.ts';
import { BEENDET, LAUFEND, useProjektList, type Projekt } from './api.ts';
import { ProjektDrawer } from './ProjektDrawer.tsx';
import { ProjektStand } from './ProjektStand.tsx';
import { ROLLE, type ProjekteSearch, type RolleParam, type SetProjekteSearch } from './search.ts';
import { TP } from './texte.ts';
import './projekt.css';

const SPALTEN: Spalte<Projekt>[] = [
  { key: 'nummer', titel: TP.spalte.nummer, zelle: p => <span className="mono">{p.nummer}</span> },
  { key: 'handlungsfeld', titel: TP.spalte.handlungsfeld, zelle: p => p.handlungsfeld ?? '' },
  { key: 'name', titel: TP.spalte.name, art: 'name', zelle: p => p.name },
  { key: 'pl', titel: TP.spalte.projektleitung, zelle: p => (p.projektleitung ? <PersonName id={p.projektleitung} /> : <span className="empty">{TP.keinePl}</span>) },
  { key: 'phase', titel: TP.spalte.phase, karte: true, zelle: p => <PhaseKurz phase={p.phase} /> },
  { key: 'portfolio', titel: TP.spalte.portfolio, zelle: p => p.portfolio?.name ?? '' },
  { key: 'rollen', titel: TP.spalte.rollen, karte: true, zelle: p => p.rollen.map(r => TP.funktion[r]).join(', ') },
  { key: 'stand', titel: TP.spalte.stand, zelle: p => <ProjektStand projekt={p} /> },
];

function Auswahl({ label, value, onChange, children }: { label: string; value: string; onChange(v: string): void; children: ReactNode }) {
  const id = useId();
  return (
    <span className="pj-filter">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={e => onChange(e.target.value)}>{children}</select>
    </span>
  );
}

export function MeineProjektePage({ search, setSearch, oeffnen }: { search: ProjekteSearch; setSearch: SetProjekteSearch; oeffnen(nr: string): void }) {
  const [text, setText] = useState(search.q ?? '');
  const q = search.q ?? '';
  // Suche erst nach einer kurzen Pause in die Adresse übernehmen (ohne neuen Verlaufseintrag)
  useEffect(() => {
    const t = setTimeout(() => { if (text.trim() !== q) setSearch({ q: text.trim() || undefined }, { replace: true }); }, 250);
    return () => clearTimeout(t);
  }, [text, q, setSearch]);
  const { canSomewhere } = useSession();
  const lesen = canSomewhere('projekt:read');
  const alle = !lesen || search.ansicht === 'alle';
  const stand = search.stand ?? 'laufend';
  const list = useProjektList({
    q, rolle: search.rolle ? ROLLE[search.rolle] : undefined, phase: search.phase,
    lebenszyklus: stand === 'laufend' ? LAUFEND : stand === 'beendet' ? BEENDET : undefined, alle,
  });
  const titel = alle ? TP.alle.titel : TP.titel;
  const items = list.data?.pages.flatMap(p => p.items) ?? [];
  const gefiltert = !!(q || search.rolle || search.phase || search.stand);
  const zuruecksetzen = () => { setText(''); setSearch({ q: undefined, rolle: undefined, phase: undefined, stand: undefined }); };

  return (
    <section aria-labelledby="page-title">
      <header className="mh">
        <div className="mh-row">
          <div className="mh-title">
            <div className="type-ico neutral"><Icon name="folder" /></div>
            <div className="minw0">
              <h1 id="page-title">{titel}</h1>
              <div className="sub">{alle ? TP.alle.sub : TP.sub}</div>
            </div>
          </div>
        </div>
        {lesen ? (
          <nav className="tabs" aria-label={TP.alle.ansicht}>
            {([false, true] as const).map(a => (
              <button key={String(a)} type="button" className={`tab${a === alle ? ' on' : ''}`} aria-current={a === alle ? 'page' : undefined}
                onClick={() => setSearch({ ansicht: a ? 'alle' : undefined, o: undefined })}>{a ? TP.alle.titel : TP.titel}</button>
            ))}
          </nav>
        ) : null}
      </header>
      <div className="toolbar pj-toolbar" role="search">
        <label className="search">
          <Icon name="search" />
          <span className="sr">{TP.suche}</span>
          <input type="search" value={text} onChange={e => setText(e.target.value)} placeholder={TP.sucheHinweis} />
        </label>
        <Auswahl label={TP.filter.rolle} value={search.rolle ?? ''} onChange={v => setSearch({ rolle: v || undefined })}>
          <option value="">{TP.filter.rolleAlle}</option>
          {(Object.keys(ROLLE) as RolleParam[]).map(r => <option key={r} value={r}>{TP.funktion[ROLLE[r]]}</option>)}
        </Auswahl>
        <Auswahl label={TP.filter.phase} value={search.phase ?? ''} onChange={v => setSearch({ phase: v || undefined })}>
          <option value="">{TP.filter.phaseAlle}</option>
          {(['P0', 'P1', 'P2', 'P3', 'P4'] as const).map(p => <option key={p} value={p}>{fmtPhase(p)}</option>)}
        </Auswahl>
        <Auswahl label={TP.filter.stand} value={stand} onChange={v => setSearch({ stand: v === 'laufend' ? undefined : v })}>
          <option value="laufend">{TP.filter.laufend}</option>
          <option value="beendet">{TP.filter.beendet}</option>
          <option value="alle">{TP.filter.alle}</option>
        </Auswahl>
        {gefiltert ? <button type="button" className="btn sm" onClick={zuruecksetzen}>{T.liste.filterZuruecksetzen}</button> : null}
      </div>
      <div className="body">
        <Datenliste<Projekt> titel={titel} spalten={SPALTEN} zeilen={items} schluessel={p => p.nummer} name={p => `${p.nummer} ${p.name}`}
          oeffnen={p => setSearch({ o: p.nummer })} aktuell={search.o} laedt={list.isPending} fehler={list.error} erneut={() => void list.refetch()}
          leer={alle ? TP.alle.leer : TP.leer} gefiltert={gefiltert} leerGefiltert={TP.leerGefiltert} zuruecksetzen={zuruecksetzen}
          mehr={{ vorhanden: list.hasNextPage, laedt: list.isFetchingNextPage, laden: () => void list.fetchNextPage() }} />
      </div>
      {search.o ? <ProjektDrawer nummer={search.o} alle={alle} onClose={() => setSearch({ o: undefined })} oeffnen={oeffnen} /> : null}
    </section>
  );
}
