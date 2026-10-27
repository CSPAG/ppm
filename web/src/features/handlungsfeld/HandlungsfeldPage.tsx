/**
 * Seite «Handlungsfelder» im Arbeitsraum «Ziele» (BC ZM.01.01): Liste in ihrer Reihenfolge mit Suche und Cursor
 * («Mehr laden»), Schublade über `?o=`. Bearbeiten nach `can` der Antwort; «Neues Handlungsfeld» nur mit dem Recht.
 */
import { useEffect, useId, useState } from 'react';
import { useSession } from '../../auth/index.ts';
import { Empty, ErrorState, Icon, Loading, T } from '../../ui/index.ts';
import { useHandlungsfeldList } from './api.ts';
import { HandlungsfeldDrawer } from './HandlungsfeldDrawer.tsx';
import type { HandlungsfeldSearch, SetHandlungsfeldSearch } from './search.ts';

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
        {list.isPending ? <Loading /> : list.error ? <ErrorState error={list.error} onRetry={() => void list.refetch()} /> : items.length === 0 ? (
          <Empty>{q ? T.handlungsfeld.emptySearch : T.handlungsfeld.empty}</Empty>
        ) : (
          <>
            <table>
              <caption className="sr">{T.handlungsfeld.title}</caption>
              <thead><tr><th scope="col"><span className="th">{T.handlungsfeld.label}</span></th><th scope="col"><span className="th">{T.handlungsfeld.leitsatz}</span></th><th scope="col"><span className="th">{T.handlungsfeld.stossrichtungen}</span></th></tr></thead>
              <tbody>
                {items.map(h => (
                  <tr key={h.id} className={search.o === h.id ? 'cur' : undefined} aria-current={search.o === h.id ? 'true' : undefined} onClick={() => setSearch({ o: h.id })}>
                    <td className="nm"><button type="button" className="rowlink" onClick={e => { e.stopPropagation(); setSearch({ o: h.id }); }}>{h.label}</button></td>
                    <td>{h.leitsatz || <span className="empty">{T.handlungsfeld.noLeitsatz}</span>}</td>
                    <td className="num">{h.stossrichtungen.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {list.hasNextPage ? (
              <div className="list-foot">
                <button type="button" className="btn" onClick={() => void list.fetchNextPage()} disabled={list.isFetchingNextPage}>{T.common.more}</button>
              </div>
            ) : null}
          </>
        )}
      </div>
      {search.o ? <HandlungsfeldDrawer id={search.o} onClose={() => setSearch({ o: undefined })} onOpen={id => setSearch({ o: id }, { replace: true })} /> : null}
    </section>
  );
}
