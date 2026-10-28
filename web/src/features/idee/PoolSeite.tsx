/**
 * Portfolio › Ideen (K4 Prüfen 5; AP-E4-2): Für Personen mit `idee:read` der Ideenpool als Liste («wartet am längsten
 * zuerst», Filter Stand, Handlungsfeld, Herkunft) oder als Funnel «Pre-P0» nach Stand mit Listen-Alternative (K4
 * Barrierefreiheit); Ansicht in der Adresse (G8). «Meine Ideen» bleibt als dritte Ansicht; ohne `idee:read` nur diese.
 * Zustände Z1, Z2 («Keine Ideen zu prüfen.» mit Datum der letzten Einreichung), Z3, Z5.
 */
import { PersonName } from '@vollholz/iam-web';
import { useId } from 'react';
import { useSession } from '../../auth/index.ts';
import { Datenliste, fmtDatum, Icon, tageBis, TeilFehler, type Spalte } from '../../ui/index.ts';
import { useAuswahl } from './api.ts';
import { IdeenPage } from './IdeenPage.tsx';
import { STAENDE_POOL } from './PoolStaende.ts';
import type { IdeenSearch, SetIdeenSearch } from './PoolSuche.ts';
import { useFunnel, usePool, type PoolZeile } from './PruefungApi.ts';
import { TP } from './PruefungTexte.ts';
import { ideePfad, IdeeStandBadge, type Gehe } from './stand.tsx';
import { TI } from './texte.ts';
import './idee.css';
import './Pruefung.css';

/** Einstieg von Portfolio › Ideen: Pool für den Ideenpool (`idee:read`), sonst «Meine Ideen». */
export function IdeenBereich({ search, setSearch, gehe }: { search: IdeenSearch; setSearch: SetIdeenSearch; gehe: Gehe }) {
  const { canSomewhere } = useSession();
  if (!canSomewhere('idee:read') || search.ansicht === 'meine') {
    return canSomewhere('idee:read') ? <><PoolAnsichten search={search} setSearch={setSearch} /><IdeenPage gehe={gehe} /></> : <IdeenPage gehe={gehe} />;
  }
  return <PoolPage search={search} setSearch={setSearch} gehe={gehe} />;
}

function PoolAnsichten({ search, setSearch }: { search: IdeenSearch; setSearch: SetIdeenSearch }) {
  const aktuell = search.ansicht ?? 'liste';
  return (
    <nav className="tabs idee-ansichten" aria-label={TP.ansichtLabel}>
      {(['liste', 'funnel', 'meine'] as const).map(a => (
        <button key={a} type="button" className={`tab${a === aktuell ? ' on' : ''}`} aria-current={a === aktuell ? 'page' : undefined}
          onClick={() => setSearch({ ansicht: a === 'liste' ? undefined : a })}>{TP.ansichten[a]}</button>
      ))}
    </nav>
  );
}

const wartet = (i: PoolZeile) => Math.max(0, -tageBis(i.standAt));

export function PoolPage({ search, setSearch, gehe }: { search: IdeenSearch; setSearch: SetIdeenSearch; gehe: Gehe }) {
  const titleId = useId();
  const auswahl = useAuswahl().data;
  const funnel = useFunnel();
  const filter = { stand: search.stand, handlungsfeld: search.handlungsfeld, herkunft: search.herkunft };
  const pool = usePool(filter);
  const items = pool.data?.pages.flatMap(p => p.items) ?? [];
  const gefiltert = !!(search.stand || search.handlungsfeld || search.herkunft);
  const feldName = (id: string | null) => auswahl?.handlungsfelder.find(h => h.id === id)?.label ?? '–';
  const spalten: Spalte<PoolZeile>[] = [
    { key: 'titel', titel: TP.spalten.titel, art: 'name', zelle: i => i.titel || TI.ohneTitel },
    {
      key: 'stand', titel: TP.spalten.stand, karte: true,
      zelle: i => (
        <span className="idee-stand">
          <IdeeStandBadge stand={i.stand} standAt={i.standAt} updatedAt={i.standAt} />
          {i.stand === 'in_ergaenzung' ? <span className="idee-offen">{TP.wartetAuf(wartet(i))}</span> : null}
        </span>
      ),
    },
    { key: 'wartet', titel: TP.spalten.wartet, karte: true, zelle: i => TP.wartetSeit(wartet(i)) },
    { key: 'person', titel: TP.eingereichtVon, zelle: i => <PersonName id={i.erfasstVon} /> },
    { key: 'feld', titel: TP.spalten.handlungsfeld, zelle: i => feldName(i.handlungsfeldId) },
    { key: 'kategorie', titel: TP.spalten.kategorie, zelle: i => i.kategorie ?? '–' },
    { key: 'nummer', titel: TP.spalten.nummer, art: 'zahl', zelle: i => i.nummer },
  ];
  const letzte = funnel.data?.letzteEinreichung;
  return (
    <section aria-labelledby={titleId}>
      <header className="mh">
        <div className="mh-row">
          <div className="mh-title">
            <div className="type-ico neutral"><Icon name="grid" /></div>
            <div className="minw0">
              <h1 id={titleId}>{TP.pool}</h1>
              <div className="sub">{TP.poolSub}</div>
            </div>
          </div>
        </div>
      </header>
      <PoolAnsichten search={search} setSearch={setSearch} />
      {search.ansicht === 'funnel' ? (
        <div className="body idee-body">
          <FunnelAnsicht onStand={s => setSearch({ ansicht: undefined, stand: s })} />
        </div>
      ) : (
        <>
          <div className="toolbar idee-filter" role="search">
            <label className="idee-filter-f">
              <span>{TP.filter.stand}</span>
              <select value={search.stand ?? ''} onChange={e => setSearch({ stand: e.target.value || undefined })}>
                <option value="">{TP.filter.alle}</option>
                {STAENDE_POOL.map(s => <option key={s} value={s}>{TI.stand[s]}</option>)}
              </select>
            </label>
            <label className="idee-filter-f">
              <span>{TP.filter.handlungsfeld}</span>
              <select value={search.handlungsfeld ?? ''} onChange={e => setSearch({ handlungsfeld: e.target.value || undefined })}>
                <option value="">{TP.filter.alle}</option>
                {(auswahl?.handlungsfelder ?? []).map(h => <option key={h.id} value={h.id}>{h.label}</option>)}
              </select>
            </label>
            <label className="idee-filter-f">
              <span>{TP.filter.herkunft}</span>
              <select value={search.herkunft ?? ''} onChange={e => setSearch({ herkunft: e.target.value || undefined })}>
                <option value="">{TP.filter.alle}</option>
                {(auswahl?.herkunft ?? []).map(h => <option key={h.schluessel} value={h.schluessel}>{h.label}</option>)}
              </select>
            </label>
          </div>
          <div className="body">
            <Datenliste<PoolZeile> titel={TP.pool} spalten={spalten} zeilen={items} schluessel={i => String(i.nummer)}
              name={i => `${i.titel || TI.ohneTitel}, ${TI.stand[i.stand] ?? i.stand}`}
              oeffnen={i => gehe(ideePfad(i.nummer))} laedt={pool.isPending} fehler={pool.error} erneut={() => void pool.refetch()}
              leer={<>{TP.leer}{letzte ? ` ${TP.letzteEinreichung(fmtDatum(letzte))}` : ''}</>}
              gefiltert={gefiltert} leerGefiltert={TP.leerGefiltert}
              zuruecksetzen={() => setSearch({ stand: undefined, handlungsfeld: undefined, herkunft: undefined })}
              mehr={{ vorhanden: pool.hasNextPage, laedt: pool.isFetchingNextPage, laden: () => void pool.fetchNextPage() }} />
          </div>
        </>
      )}
    </section>
  );
}

/** Funnel «Pre-P0»: Balken je Stand mit Zahl; dieselben Zahlen als Liste (K4 Barrierefreiheit). */
function FunnelAnsicht({ onStand }: { onStand(stand: string): void }) {
  const f = useFunnel();
  if (f.isPending) return <p role="status" className="muted">…</p>;
  if (f.error || !f.data) return <TeilFehler was={TP.funnelTitel} error={f.error} onRetry={() => void f.refetch()} />;
  const max = Math.max(1, ...f.data.stufen.map(s => s.anzahl));
  return (
    <section aria-labelledby="idee-funnel" className="idee-funnel">
      <h2 id="idee-funnel">{TP.funnelTitel}</h2>
      <div className="idee-funnel-bars" aria-hidden="true">
        {f.data.stufen.map(s => (
          <div key={s.stand} className="idee-funnel-row">
            <span className="idee-funnel-l">{TI.stand[s.stand]}</span>
            <span className="idee-funnel-b" style={{ width: `${Math.max(2, (s.anzahl / max) * 100)}%` }} />
            <span className="idee-funnel-n">{s.anzahl}</span>
          </div>
        ))}
      </div>
      <details className="idee-funnel-alt" open>
        <summary>{TP.funnelAlternative}</summary>
        <ul>
          {f.data.stufen.map(s => (
            <li key={s.stand}>
              <button type="button" className="btn ghost sm" onClick={() => onStand(s.stand)}>{TI.stand[s.stand]}: {TP.anzahl(s.anzahl)}</button>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
