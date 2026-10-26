/**
 * Liste der Projekte: Suche (`?q=`), Cursor-Paginierung («Mehr laden»), Detail als Schublade (`?o=<id>`) und
 * Anlegen (`?neu=true`). Die Seite kennt den Router nicht: `router.tsx` reicht die Suchparameter und das Navigieren
 * herein.
 */
import { ClassificationBadge } from '@vollholz/iam-web';
import { useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { idempotencyKey } from '../../api/client.ts';
import { useSession } from '../../auth/session.tsx';
import type { ProjekteSearch } from '../../search.ts';
import { Icon } from '../../ui/Icons.tsx';
import { Overlay } from '../../ui/Overlay.tsx';
import { Empty, ErrorState, SkeletonList } from '../../ui/states.tsx';
import { useToast } from '../../ui/Toasts.tsx';
import { useCreateProjekt, useProjektList } from './api.ts';
import { fmtZeitraum } from './format.ts';
import { ProjektDrawer } from './ProjektDrawer.tsx';
import { emptyValues, ProjektForm } from './ProjektForm.tsx';
import { asLevel } from './types.ts';
import type { ProjektValues } from './validate.ts';

export interface ProjektePageProps {
  search: ProjekteSearch;
  /** Neue Suchparameter (vollständig); `replace` ersetzt den Eintrag im Verlauf (Tippen in der Suche). */
  onSearch: (next: ProjekteSearch, opts?: { replace?: boolean }) => void;
}

/** Adresse eines Projekts in der Liste (für echte Links, Mittelklick öffnet einen neuen Tab). */
const href = (s: ProjekteSearch) => {
  const p = new URLSearchParams();
  if (s.q) p.set('q', s.q);
  if (s.o) p.set('o', s.o);
  if (s.neu) p.set('neu', 'true');
  const str = p.toString();
  return `/projekte${str ? `?${str}` : ''}`;
};

export function ProjektePage({ search, onSearch }: ProjektePageProps) {
  const session = useSession();
  const q = search.q ?? '';
  const list = useProjektList(q);
  const items = list.data?.pages.flatMap(p => p.items) ?? [];
  const canCreate = session.can('projekt:write');
  const searchId = useId();

  const open = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onSearch({ ...search, o: id, neu: undefined });
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Projekte</h1>
          <p className="muted">Projekte der Organisation {session.orgName}, die du sehen darfst.</p>
        </div>
        {canCreate ? (
          <button type="button" className="btn btn-primary" onClick={() => onSearch({ ...search, o: undefined, neu: true })}>
            <Icon name="plus" />Neues Projekt
          </button>
        ) : null}
      </header>

      <SearchBox id={searchId} value={q} onChange={value => onSearch({ ...search, q: value || undefined }, { replace: true })} />

      <section aria-labelledby={`${searchId}-res`} className="list-wrap">
        <h2 id={`${searchId}-res`} className="sr-only">Ergebnis</h2>
        {list.isPending ? <SkeletonList />
          : list.error && !items.length ? <ErrorState error={list.error} onRetry={() => void list.refetch()} />
          : !items.length ? (
            <Empty title={q ? 'Keine Treffer' : 'Noch keine Projekte'}>
              {q ? `Kein Projekt enthält «${q}» in der Bezeichnung.` : canCreate ? 'Lege das erste Projekt an.' : 'Sobald dir jemand ein Projekt freigibt, erscheint es hier.'}
            </Empty>
          ) : (
            <>
              <p className="muted small" aria-live="polite">{items.length} {items.length === 1 ? 'Projekt' : 'Projekte'}{list.hasNextPage ? ' (weitere vorhanden)' : ''}</p>
              <ul className="rows">
                {items.map(p => (
                  <li key={p.id}>
                    <a className={`row${search.o === p.id ? ' row-on' : ''}`} href={href({ ...search, o: p.id, neu: undefined })} onClick={e => open(e, p.id)}
                      aria-current={search.o === p.id ? 'true' : undefined}>
                      <span className="row-main">
                        <span className="row-title">{p.label}</span>
                        <span className="row-sub muted">{fmtZeitraum(p.beginn, p.ende)}</span>
                      </span>
                      <ClassificationBadge level={asLevel(p.classification)} />
                      <Icon name="chevron" className="row-go" />
                    </a>
                  </li>
                ))}
              </ul>
              {list.error ? <ErrorState error={list.error} onRetry={() => void list.fetchNextPage()} /> : null}
              {list.hasNextPage ? (
                <div className="more">
                  <button type="button" className="btn" onClick={() => void list.fetchNextPage()} disabled={list.isFetchingNextPage} aria-busy={list.isFetchingNextPage || undefined}>
                    {list.isFetchingNextPage ? 'Wird geladen …' : 'Mehr laden'}
                  </button>
                </div>
              ) : null}
            </>
          )}
      </section>

      {search.o ? <ProjektDrawer id={search.o} onClose={() => onSearch({ ...search, o: undefined })} /> : null}
      {search.neu && canCreate ? (
        <CreateDialog onClose={() => onSearch({ ...search, neu: undefined })} onCreated={id => onSearch({ ...search, neu: undefined, o: id }, { replace: true })} />
      ) : null}
    </div>
  );
}

/** Suche mit kurzer Verzögerung beim Tippen; Enter sucht sofort. */
function SearchBox({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  const last = useRef(value);
  const change = useRef(onChange);
  useEffect(() => { change.current = onChange; });
  useEffect(() => {
    if (text.trim() === last.current) return;
    const t = setTimeout(() => { last.current = text.trim(); change.current(text.trim()); }, 250);
    return () => clearTimeout(t);
  }, [text]);
  return (
    <form role="search" className="searchbox" onSubmit={e => { e.preventDefault(); last.current = text.trim(); onChange(text.trim()); }}>
      <label htmlFor={id} className="sr-only">Projekte durchsuchen</label>
      <Icon name="search" />
      <input id={id} type="search" placeholder="Projekte durchsuchen" value={text} onChange={e => setText(e.target.value)} autoComplete="off" />
    </form>
  );
}

function CreateDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const session = useSession();
  const toast = useToast();
  const create = useCreateProjekt();
  // Ein Schlüssel je Eingabe: erneutes Senden derselben Eingabe legt kein zweites Projekt an, eine geänderte Eingabe
  // bekommt einen neuen Schlüssel (sonst 409 wegen abweichendem Inhalt)
  const keys = useRef(new Map<string, string>());
  const submit = (v: ProjektValues) => {
    const body = { label: v.label, beschreibung: v.beschreibung, beginn: v.beginn || null, ende: v.ende || null, classification: v.classification };
    const sig = JSON.stringify(body);
    const key = keys.current.get(sig) ?? idempotencyKey();
    keys.current.set(sig, key);
    create.mutate({ key, body }, { onSuccess: p => { toast.show(`Projekt «${p.label}» angelegt.`); onCreated(p.id); } });
  };
  return (
    <Overlay title="Neues Projekt" onClose={onClose}>
      <ProjektForm initial={emptyValues} clearance={session.clearance} submitLabel="Anlegen" busy={create.isPending} error={create.error ?? undefined}
        onSubmit={submit} onCancel={onClose} />
    </Overlay>
  );
}
