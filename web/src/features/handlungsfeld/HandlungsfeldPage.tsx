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
    <section className="page" aria-labelledby="page-title">
      <header className="page-h">
        <h1 id="page-title">{T.handlungsfeld.title}</h1>
        {canCreate ? <button type="button" className="btn btn-primary" onClick={() => setSearch({ o: 'neu' })}><Icon name="plus" />{T.handlungsfeld.create}</button> : null}
      </header>
      <div className="toolbar" role="search">
        <label htmlFor={searchId} className="sr-only">{T.handlungsfeld.search}</label>
        <Icon name="search" />
        <input id={searchId} type="search" value={text} onChange={e => setText(e.target.value)} placeholder={T.handlungsfeld.search} />
      </div>
      {list.isPending ? <Loading /> : list.error ? <ErrorState error={list.error} onRetry={() => void list.refetch()} /> : items.length === 0 ? (
        <Empty>{q ? T.handlungsfeld.emptySearch : T.handlungsfeld.empty}</Empty>
      ) : (
        <>
          <table className="table">
            <caption className="sr-only">{T.handlungsfeld.title}</caption>
            <thead><tr><th scope="col">{T.handlungsfeld.label}</th><th scope="col">{T.handlungsfeld.leitsatz}</th><th scope="col">{T.handlungsfeld.stossrichtungen}</th></tr></thead>
            <tbody>
              {items.map(h => (
                <tr key={h.id} aria-current={search.o === h.id ? 'true' : undefined}>
                  <td><button type="button" className="link" onClick={() => setSearch({ o: h.id })}>{h.label}</button></td>
                  <td>{h.leitsatz || <span className="muted">{T.handlungsfeld.noLeitsatz}</span>}</td>
                  <td>{h.stossrichtungen.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.hasNextPage ? (
            <button type="button" className="btn" onClick={() => void list.fetchNextPage()} disabled={list.isFetchingNextPage}>{T.common.more}</button>
          ) : null}
        </>
      )}
      {search.o ? <HandlungsfeldDrawer id={search.o} onClose={() => setSearch({ o: undefined })} onOpen={id => setSearch({ o: id }, { replace: true })} /> : null}
    </section>
  );
}
