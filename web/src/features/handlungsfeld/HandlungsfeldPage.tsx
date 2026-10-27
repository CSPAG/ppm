/**
 * Seite «Handlungsfelder» im Arbeitsraum «Ziele» (BC ZM.01.01): Liste in ihrer Reihenfolge mit Suche und Cursor
 * («Mehr laden») als Datenliste, Schublade über `?o=`. Bearbeiten nach `can` der Antwort; «Neues Handlungsfeld» nur mit dem Recht.
 */
import { useEffect, useId, useState } from 'react';
import { useSession } from '../../auth/index.ts';
import { Datenliste, Icon, T, type Spalte } from '../../ui/index.ts';
import { useHandlungsfeldList, type Handlungsfeld } from './api.ts';
import { HandlungsfeldDrawer } from './HandlungsfeldDrawer.tsx';
import type { HandlungsfeldSearch, SetHandlungsfeldSearch } from './search.ts';

const SPALTEN: Spalte<Handlungsfeld>[] = [
  { key: 'label', titel: T.handlungsfeld.label, art: 'name', zelle: h => h.label },
  { key: 'leitsatz', titel: T.handlungsfeld.leitsatz, karte: true, zelle: h => h.leitsatz || <span className="empty">{T.handlungsfeld.noLeitsatz}</span> },
  { key: 'stossrichtungen', titel: T.handlungsfeld.stossrichtungen, art: 'zahl', zelle: h => h.stossrichtungen.length },
];

export function HandlungsfeldPage({ search, setSearch }: { search: HandlungsfeldSearch; setSearch: SetHandlungsfeldSearch }) {
  const { can } = useSession();
  const searchId = useId();
  const [text, setText] = useState(search.q ?? '');
  const q = search.q ?? '';
  // Suche erst nach einer kurzen Pause in die Adresse übernehmen (ohne neuen Verlaufseintrag)
  useEffect(() => {
    const t = setTimeout(() => { if (text.trim() !== q) setSearch({ q: text.trim() || undefined }, { replace: true }); }, 250);
    return () => clearTimeout(t);
  }, [text, q, setSearch]);
  const list = useHandlungsfeldList(q);
  const items = list.data?.pages.flatMap(p => p.items) ?? [];
  const canCreate = can('handlungsfeld:write');

  return (
    <section aria-labelledby="page-title">
      <header className="mh">
        <div className="mh-row">
          <div className="mh-title">
            <div className="type-ico neutral"><Icon name="target" /></div>
            <div className="minw0">
              <h1 id="page-title">{T.handlungsfeld.title}</h1>
              <div className="sub">{T.handlungsfeld.sub}</div>
            </div>
          </div>
          {canCreate ? <div className="acts"><button type="button" className="btn primary" onClick={() => setSearch({ o: 'neu' })}><Icon name="plus" />{T.handlungsfeld.create}</button></div> : null}
        </div>
      </header>
      <div className="toolbar" role="search">
        <label className="search">
          <Icon name="search" />
          <span className="sr">{T.handlungsfeld.search}</span>
          <input id={searchId} type="search" value={text} onChange={e => setText(e.target.value)} placeholder={T.handlungsfeld.search} />
        </label>
      </div>
      <div className="body">
        <Datenliste<Handlungsfeld> titel={T.handlungsfeld.title} spalten={SPALTEN} zeilen={items} schluessel={h => h.id}
          oeffnen={h => setSearch({ o: h.id })} aktuell={search.o} laedt={list.isPending} fehler={list.error} erneut={() => void list.refetch()}
          leer={T.handlungsfeld.empty} gefiltert={!!q} leerGefiltert={T.handlungsfeld.emptySearch} zuruecksetzen={() => setText('')}
          mehr={{ vorhanden: list.hasNextPage, laedt: list.isFetchingNextPage, laden: () => void list.fetchNextPage() }} />
      </div>
      {search.o ? <HandlungsfeldDrawer id={search.o} onClose={() => setSearch({ o: undefined })} onOpen={id => setSearch({ o: id }, { replace: true })} /> : null}
    </section>
  );
}
