/**
 * Startseite «Eingang» (UI-01, Seitentyp Startseite; UX-E3, G1; informationsarchitektur.md «Startseite je Rolle»):
 * Kopf mit dem Wichtigsten jetzt (Vertretung, Kopfkarten der Rollen), darunter «Zu tun» mit allen Aufgaben der Person
 * aus allen Rollen nach Frist (Anzahl offen und überfällig im Kopf der Liste), dann Mitteilungen; auf breiten
 * Bildschirmen stehen Mitteilungen neben «Zu tun». Ganze Zeile öffnet die Aufgabe (I-L2), in der Zeile nur «Erledigt»
 * für manuelle Aufgaben. Zustände Z1 (Skelett nach 300 ms), Z2, Z3 (Filter «Nur mit Frist»), Z5.
 */
import { Suspense, useId, type MouseEvent, type ReactNode } from 'react';
import { useSession } from '../../auth/index.ts';
import {
  Empty, ErrorState, fmtDatum, fmtFrist, fmtFristArbeitstage, fmtZeitpunkt, Hinweis, Icon, Skelett, T, tageBis, useToast, useVerzoegert,
} from '../../ui/index.ts';
import { useAnzahl, useAufgaben, useEingangMutations, useMitteilungen, useVertretungen, type Aufgabe, type Mitteilung } from './api.ts';
import type { KopfKarte } from './kopf.ts';
import type { EingangSearch, SetEingangSearch } from './search.ts';
import { E } from './texte.ts';
import './eingang.css';

/** Navigation innerhalb der App (der Router gibt sie hinein; Features kennen den Router nicht). */
export type Gehe = (pfad: string) => void;

const frist = (a: Aufgabe) => (a.frist ? (a.fristArt === 'arbeitstage' ? fmtFristArbeitstage(a.frist) : fmtFrist(a.frist)) : null);

/** Link mit Adresse (öffnen in neuem Tab möglich), Klick navigiert in der App. */
function Ziel({ pfad, gehe, className, label, children, onGo }: { pfad: string; gehe: Gehe; className?: string; label?: string; children: ReactNode; onGo?(): void }) {
  const klick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    onGo?.();
    gehe(pfad);
  };
  return <a href={pfad} className={className} aria-label={label} onClick={klick}>{children}</a>;
}

export function EingangPage({ search, setSearch, gehe, kopfkarten = [] }: {
  search: EingangSearch; setSearch: SetEingangSearch; gehe: Gehe;
  /** Kopfkarten der Module (src/kopfkarten.ts), je nach Recht sichtbar. */
  kopfkarten?: readonly KopfKarte[];
}) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="eingang">
      <header className="mh">
        <div className="mh-row">
          <div className="mh-title">
            <div className="type-ico neutral"><Icon name="inbox" /></div>
            <h1 id={titleId}>{E.titel}</h1>
          </div>
        </div>
      </header>
      <div className="body eg-body">
        <Kopf gehe={gehe} kopfkarten={kopfkarten} />
        <div className="eg-spalten">
          <ZuTun filter={search.filter} setSearch={setSearch} gehe={gehe} />
          <Mitteilungen gehe={gehe} />
        </div>
      </div>
    </section>
  );
}

function Kopf({ gehe, kopfkarten }: { gehe: Gehe; kopfkarten: readonly KopfKarte[] }) {
  const { canSomewhere } = useSession();
  const vertretungen = useVertretungen();
  const karten = kopfkarten.filter(k => canSomewhere(k.recht));
  const aktiv = (vertretungen.data ?? []).filter(v => v.aktiv);
  if (!karten.length && !aktiv.length) return null;
  return (
    <section className="eg-kopf" aria-label={E.kopf.titel}>
      {karten.length ? (
        <div className="eg-karten">
          {karten.map(k => (
            <article key={k.id} className="eg-karte">
              <Suspense fallback={<span className="sk" aria-hidden="true" />}><k.Karte /></Suspense>
            </article>
          ))}
        </div>
      ) : null}
      {aktiv.map(v => (
        <Hinweis key={v.id} stufe="hinweis" aktion={<Ziel pfad="/konto/stellvertretung" gehe={gehe} className="btn sm">{E.vertretung.verwalten}</Ziel>}>
          {v.richtung === 'fuer_andere'
            ? <>{E.vertretung.sieVertreten(v.vertretene.name, fmtDatum(v.bis))}{v.unterschriften ? ` ${E.vertretung.mitUnterschriften}` : ''}</>
            : E.vertretung.werdenVertreten(v.vertreter.name, fmtDatum(v.von), fmtDatum(v.bis))}
        </Hinweis>
      ))}
    </section>
  );
}

function ZuTun({ filter, setSearch, gehe }: { filter: 'frist' | undefined; setSearch: SetEingangSearch; gehe: Gehe }) {
  const id = useId();
  const q = useAufgaben(filter);
  const n = useAnzahl().data;
  const skelett = useVerzoegert(q.isPending);
  const { erledigen, wiederOeffnen } = useEingangMutations();
  const toast = useToast();
  const items = q.data?.pages.flatMap(p => p.items) ?? [];
  return (
    <section aria-labelledby={id} className="eg-sektion">
      <div className="eg-sektion-kopf">
        <div className="eg-sektion-titel">
          <h2 id={id}>{E.zuTun.titel}</h2>
          <span className="eg-anzahl" aria-live="polite">
            {n?.offen ? <>{E.zuTun.offen(n.offen)}{n.ueberfaellig ? <span className="eg-ueber"> · {E.zuTun.ueberfaellig(n.ueberfaellig)}</span> : null}</> : null}
          </span>
        </div>
        <div className="eg-filter" role="group" aria-label={E.zuTun.filter}>
          <button type="button" className="btn sm" aria-pressed={!filter} onClick={() => setSearch({ filter: undefined })}>{E.zuTun.alle}</button>
          <button type="button" className="btn sm" aria-pressed={filter === 'frist'} onClick={() => setSearch({ filter: 'frist' })}>{E.zuTun.nurFrist}</button>
        </div>
      </div>
      {q.isPending ? (
        <div aria-busy="true"><span className="sr" role="status">{T.common.loading}</span>{skelett ? <Skelett zeilen={3} /> : null}</div>
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : items.length === 0 ? (
        filter
          ? <Empty action={<button type="button" className="btn" onClick={() => setSearch({ filter: undefined })}>{T.liste.filterZuruecksetzen}</button>}><span role="status">{E.zuTun.leerFrist}</span></Empty>
          : <Empty>{E.zuTun.leer}</Empty>
      ) : (
        <>
          <ul className="eg-liste eg-aufgaben">
            {items.map(a => {
              const f = frist(a);
              const ueber = a.frist ? tageBis(a.frist) < 0 : false;
              const meta = [
                a.kontext ? <span key="k">{a.kontext}</span> : null,
                a.vertretung ? <span key="v" className="eg-vertretung">{E.zuTun.inVertretung(a.vertretung.person.name)}</span> : null,
                a.empfaenger === 'recht' ? <span key="r" className="muted">{E.zuTun.anAlle}</span> : null,
              ].filter(Boolean);
              return (
                <li key={a.id} className={`eg-aufgabe${ueber ? ' ueber' : ''}`}>
                  <div className="eg-a-text">
                    <Ziel pfad={a.link} gehe={gehe} className="eg-a-titel eg-zeile">{a.titel}</Ziel>
                    {meta.length ? <div className="eg-a-meta">{meta}</div> : null}
                  </div>
                  <div className={`eg-a-frist${ueber ? ' eg-ueber' : ''}`}>{f ? <><Icon name="clock" /> {f}</> : null}</div>
                  <div className="eg-a-akt">
                    {a.can.erledigen ? (
                      <button type="button" className="btn sm" aria-label={E.zuTun.erledigtAria(a.titel)} disabled={erledigen.isPending}
                        onClick={() => erledigen.mutate(a.id, {
                          onSuccess: () => toast.show(E.zuTun.erledigtToast(a.titel), {
                            action: { label: E.zuTun.rueckgaengig, run: () => wiederOeffnen.mutate(a.id, { onSuccess: () => toast.show(E.zuTun.wiederOffen(a.titel)), onError: e => toast.error(e) }) },
                          }),
                        })}>
                        <Icon name="check" />{E.zuTun.erledigt}
                      </button>
                    ) : null}
                    <Icon name="chev" className="eg-chev" />
                  </div>
                </li>
              );
            })}
          </ul>
          {erledigen.error ? <ErrorState error={erledigen.error} /> : null}
          {q.hasNextPage ? (
            <div className="list-foot">
              <button type="button" className="btn" onClick={() => void q.fetchNextPage()} disabled={q.isFetchingNextPage}>{q.isFetchingNextPage ? T.common.loading : T.common.more}</button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function Mitteilungen({ gehe }: { gehe: Gehe }) {
  const id = useId();
  const q = useMitteilungen();
  const { gelesen } = useEingangMutations();
  const items: Mitteilung[] = q.data?.pages.flatMap(p => p.items) ?? [];
  const ungelesen = q.data?.pages[0]?.ungelesen ?? 0;
  return (
    <section aria-labelledby={id} className="eg-sektion">
      <div className="eg-sektion-kopf">
        <div className="eg-sektion-titel">
          <h2 id={id}>{E.mitteilungen.titel}</h2>
          {ungelesen ? <span className="eg-anzahl">{E.mitteilungen.ungelesen(ungelesen)}</span> : null}
        </div>
      </div>
      {q.isPending ? <div aria-busy="true"><span className="sr" role="status">{T.common.loading}</span></div>
        : q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        : items.length === 0 ? <Empty>{E.mitteilungen.leer}</Empty>
        : (
          <>
            <ul className="eg-liste">
              {items.map(m => (
                <li key={m.id} className={`eg-mitteilung${m.gelesenAt ? '' : ' neu'}`}>
                  <div className="eg-a-text">
                    <p>
                      {m.gelesenAt ? null : <span className="eg-neu">{E.mitteilungen.neu}</span>}
                      {m.link ? <Ziel pfad={m.link} gehe={gehe} className="eg-zeile" onGo={() => { if (!m.gelesenAt) gelesen.mutate(m.id); }}>{m.text}</Ziel> : m.text}
                    </p>
                    <div className="eg-a-meta"><span className="muted">{fmtZeitpunkt(m.createdAt)}</span></div>
                  </div>
                  {!m.gelesenAt ? (
                    <div className="eg-a-akt">
                      <button type="button" className="iconbtn" aria-label={E.mitteilungen.gelesenAria(m.text)} title={E.mitteilungen.gelesen} disabled={gelesen.isPending} onClick={() => gelesen.mutate(m.id)}>
                        <Icon name="check" />
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            {q.hasNextPage ? (
              <div className="list-foot">
                <button type="button" className="btn" onClick={() => void q.fetchNextPage()} disabled={q.isFetchingNextPage}>{q.isFetchingNextPage ? T.common.loading : T.common.more}</button>
              </div>
            ) : null}
          </>
        )}
    </section>
  );
}
