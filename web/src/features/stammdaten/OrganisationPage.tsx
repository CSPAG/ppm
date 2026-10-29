/**
 * Seite «Organisation» in der Administration (UI-44, UC-017 Schritt 1, BC AM.02.01), Seitentyp Liste + Schublade:
 * Ansicht «Einheiten» (Organisationseinheiten mit Direktionen, A-23) und «Feiertage» (für Fristen in Arbeitstagen, A-43).
 * Ansicht, Suche, Filter und Schublade stehen in der Adresse (I-N5); Bearbeiten nur nach `can` der Antwort (Z8).
 */
import { useEffect, useId, useMemo, useState } from 'react';
import { useSession } from '../../auth/index.ts';
import { Datenliste, fmtDatum, Icon, Stand, type Spalte } from '../../ui/index.ts';
import { useFeiertage, useOrgAlle, useOrgList, type Feiertag, type OrgEinheit } from './api.ts';
import { FeiertagDrawer } from './FeiertagDrawer.tsx';
import { OrgEinheitDrawer } from './OrgEinheitDrawer.tsx';
import type { OrganisationSearch, SetOrganisationSearch } from './search.ts';
import { TS } from './texte.ts';

export function OrganisationPage({ search, setSearch }: { search: OrganisationSearch; setSearch: SetOrganisationSearch }) {
  const { can } = useSession();
  const feiertage = search.ansicht === 'feiertage';
  const canWrite = can('stammdaten:write');
  const zeige = (ansicht?: 'feiertage') => setSearch({ ansicht, o: undefined, q: undefined, aktiv: undefined, jahr: undefined });
  // Kopf-Button fehlt nur bei geladener, leerer Liste: sie bietet die erste Aktion selbst an (Z2). Gleiche Abfragen wie die Ansichten.
  const einheiten = useOrgAlle();
  const tage = useFeiertage(search.jahr ?? new Date().getFullYear());
  const leer = feiertage ? !!tage.data && !tage.data.pages.some(p => p.items.length) : !!einheiten.data && !einheiten.data.length;

  return (
    <section aria-labelledby="page-title">
      <header className="mh">
        <div className="mh-row">
          <div className="mh-title">
            <div className="type-ico neutral"><Icon name="building" /></div>
            <div className="minw0">
              <h1 id="page-title">{TS.org.title}</h1>
              <div className="sub">{TS.org.sub}</div>
            </div>
          </div>
          {canWrite && !leer ? (
            <div className="acts">
              <button type="button" className="btn primary" onClick={() => setSearch({ o: 'neu' })}>
                <Icon name="plus" />{feiertage ? TS.feiertag.create : TS.org.create}
              </button>
            </div>
          ) : null}
        </div>
        <nav className="tabs" aria-label={TS.org.title}>
          <button type="button" className={`tab${feiertage ? '' : ' on'}`} aria-current={feiertage ? undefined : 'page'} onClick={() => zeige()}>{TS.ansicht.einheiten}</button>
          <button type="button" className={`tab${feiertage ? ' on' : ''}`} aria-current={feiertage ? 'page' : undefined} onClick={() => zeige('feiertage')}>{TS.ansicht.feiertage}</button>
        </nav>
      </header>
      {feiertage ? <Feiertage search={search} setSearch={setSearch} canWrite={canWrite} /> : <Einheiten search={search} setSearch={setSearch} canWrite={canWrite} />}
    </section>
  );
}

function Einheiten({ search, setSearch, canWrite }: { search: OrganisationSearch; setSearch: SetOrganisationSearch; canWrite: boolean }) {
  const searchId = useId();
  const [text, setText] = useState(search.q ?? '');
  const q = search.q ?? '';
  const nurAktive = search.aktiv !== 'alle';
  // Suche erst nach einer kurzen Pause in die Adresse übernehmen (ohne neuen Verlaufseintrag)
  useEffect(() => {
    const t = setTimeout(() => { if (text.trim() !== q) setSearch({ q: text.trim() || undefined }, { replace: true }); }, 250);
    return () => clearTimeout(t);
  }, [text, q, setSearch]);
  const list = useOrgList(q, nurAktive);
  const alle = useOrgAlle();
  const items = list.data?.pages.flatMap(p => p.items) ?? [];
  const kuerzel = useMemo(() => new Map((alle.data ?? []).map(o => [o.id, o.kuerzel])), [alle.data]);

  const spalten: Spalte<OrgEinheit>[] = [
    { key: 'kuerzel', titel: TS.org.kuerzel, art: 'name', zelle: o => <span className="mono">{o.kuerzel}</span> },
    { key: 'name', titel: TS.org.name, karte: true, zelle: o => o.name },
    { key: 'art', titel: TS.org.art, karte: true, zelle: o => TS.org.arten[o.art] ?? o.art },
    { key: 'parent', titel: TS.org.parent, zelle: o => (o.parentId ? <span className="mono">{kuerzel.get(o.parentId) ?? '…'}</span> : <span className="empty">–</span>) },
    { key: 'stand', titel: TS.org.stand, zelle: o => (o.aktiv ? null : <Stand familie="ruhend" label={TS.org.inaktiv} />) },
  ];

  return (
    <>
      <div className="toolbar" role="search">
        <label className="search">
          <Icon name="search" />
          <span className="sr">{TS.org.search}</span>
          <input id={searchId} type="search" value={text} onChange={e => setText(e.target.value)} placeholder={TS.org.search} />
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={nurAktive} onChange={e => setSearch({ aktiv: e.target.checked ? undefined : 'alle' }, { replace: true })} />
          {TS.org.nurAktive}
        </label>
      </div>
      <div className="body">
        <Datenliste<OrgEinheit> titel={TS.ansicht.einheiten} spalten={spalten} zeilen={items} schluessel={o => o.id} name={o => `${o.kuerzel} ${o.name}`}
          oeffnen={o => setSearch({ o: o.id })} aktuell={search.o} laedt={list.isPending} fehler={list.error} erneut={() => void list.refetch()}
          leer={TS.org.empty} leerAktion={canWrite ? <button type="button" className="btn primary" onClick={() => setSearch({ o: 'neu' })}><Icon name="plus" />{TS.org.create}</button> : undefined}
          gefiltert={!!q || (nurAktive && items.length === 0 && (alle.data?.length ?? 0) > 0)} leerGefiltert={TS.org.emptySearch}
          zuruecksetzen={() => { setText(''); setSearch({ q: undefined, aktiv: 'alle' }, { replace: true }); }}
          mehr={{ vorhanden: list.hasNextPage, laedt: list.isFetchingNextPage, laden: () => void list.fetchNextPage() }} />
      </div>
      {search.o ? <OrgEinheitDrawer id={search.o} alle={alle.data ?? []} onClose={() => setSearch({ o: undefined })} onOpen={id => setSearch({ o: id }, { replace: true })} /> : null}
    </>
  );
}

function Feiertage({ search, setSearch, canWrite }: { search: OrganisationSearch; setSearch: SetOrganisationSearch; canWrite: boolean }) {
  const jahr = search.jahr ?? new Date().getFullYear();
  const list = useFeiertage(jahr);
  const items = list.data?.pages.flatMap(p => p.items) ?? [];
  const spalten: Spalte<Feiertag>[] = [
    { key: 'label', titel: TS.feiertag.label, art: 'name', zelle: f => f.label },
    { key: 'datum', titel: TS.feiertag.datum, karte: true, zelle: f => fmtDatum(f.datum, new Date(jahr, 0, 1)) },
  ];
  return (
    <>
      <div className="toolbar">
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {TS.feiertag.jahr}
          <select value={jahr} onChange={e => setSearch({ jahr: Number(e.target.value), o: undefined }, { replace: true })}>
            {jahre(jahr).map(j => <option key={j} value={j}>{j}</option>)}
          </select>
        </label>
      </div>
      <div className="body">
        <Datenliste<Feiertag> titel={`${TS.ansicht.feiertage} ${jahr}`} spalten={spalten} zeilen={items} schluessel={f => f.id}
          oeffnen={f => setSearch({ o: f.id })} aktuell={search.o} laedt={list.isPending} fehler={list.error} erneut={() => void list.refetch()}
          leer={search.jahr ? TS.feiertag.emptyJahr(jahr) : TS.feiertag.empty}
          leerAktion={canWrite ? <button type="button" className="btn primary" onClick={() => setSearch({ o: 'neu' })}><Icon name="plus" />{TS.feiertag.create}</button> : undefined}
          mehr={{ vorhanden: list.hasNextPage, laedt: list.isFetchingNextPage, laden: () => void list.fetchNextPage() }} />
      </div>
      {search.o ? <FeiertagDrawer id={search.o} jahr={jahr} onClose={() => setSearch({ o: undefined })} onOpen={(id, j) => setSearch({ o: id, jahr: j }, { replace: true })} /> : null}
    </>
  );
}

/** Auswahl der Jahre: zwei zurück bis drei voraus ab heute, dazu das gewählte. */
function jahre(gewaehlt: number): number[] {
  const heute = new Date().getFullYear();
  const set = new Set([gewaehlt, ...Array.from({ length: 6 }, (_, i) => heute - 2 + i)]);
  return [...set].sort((a, b) => a - b);
}
