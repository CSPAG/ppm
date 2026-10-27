/**
 * Startseite «Eingang» (UI-01, Seitentyp Startseite; UX-E3, G1; informationsarchitektur.md «Startseite je Rolle»):
 * Kopf mit dem Wichtigsten jetzt (Aufgaben, Vertretung, Kopfkarten der Rollen), darunter «Zu tun» mit allen Aufgaben
 * der Person aus allen Rollen nach Frist, je mit Direktaktion (I-B1), dann Mitteilungen. Zustände Z1 (Skelett nach
 * 300 ms), Z2, Z3 (Filter «Nur mit Frist»), Z5.
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
            <div className="minw0">
              <h1 id={titleId}>{E.titel}</h1>
              <div className="sub">{E.sub}</div>
            </div>
          </div>
        </div>
      </header>
      <div className="body eg-body">
        <Kopf gehe={gehe} kopfkarten={kopfkarten} />
        <ZuTun filter={search.filter} setSearch={setSearch} gehe={gehe} />
        <Mitteilungen gehe={gehe} />
      </div>
    </section>
  );
}

function Kopf({ gehe, kopfkarten }: { gehe: Gehe; kopfkarten: readonly KopfKarte[] }) {
  const { canSomewhere } = useSession();
  const anzahl = useAnzahl();
  const vertretungen = useVertretungen();
  const karten = kopfkarten.filter(k => canSomewhere(k.recht));
  const n = anzahl.data;
  const aktiv = (vertretungen.data ?? []).filter(v => v.aktiv);
  return (
    <section className="eg-kopf" aria-label={E.kopf.titel}>
      <div className="eg-karten">
        <article className="eg-karte" aria-live="polite">
          <h2>{E.kopf.titel}</h2>
          {n ? (
            <p className="eg-zahl">
              <strong>{E.kopf.offen(n.offen)}</strong>
              {n.ueberfaellig ? <span className="eg-ueber"> · {E.kopf.ueberfaellig(n.ueberfaellig)}</span> : null}
              {n.naechsteFrist ? <span> · {E.kopf.naechsteFrist(fmtFrist(n.naechsteFrist))}</span> : null}
            </p>
          ) : anzahl.error ? <ErrorState error={anzahl.error} onRetry={() => void anzahl.refetch()} /> : <span className="sk" aria-hidden="true" />}
        </article>
        {karten.map(k => (
          <article key={k.id} className="eg-karte">
            <Suspense fallback={<span className="sk" aria-hidden="true" />}><k.Karte /></Suspense>
          </article>
        ))}
      </div>
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
  const skelett = useVerzoegert(q.isPending);
  const { erledigen } = useEingangMutations();
  const toast = useToast();
  const items = q.data?.pages.flatMap(p => p.items) ?? [];
  return (
    <section aria-labelledby={id} className="eg-sektion">
      <div className="eg-sektion-kopf">
        <h2 id={id}>{E.zuTun.titel}</h2>
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
          <ul className="eg-liste">
            {items.map(a => {
              const f = frist(a);
              const ueber = a.frist ? tageBis(a.frist) < 0 : false;
              return (
                <li key={a.id} className={`eg-aufgabe${ueber ? ' ueber' : ''}`}>
                  <div className="eg-a-text">
                    <Ziel pfad={a.link} gehe={gehe} className="eg-a-titel">{a.titel}</Ziel>
                    <div className="eg-a-meta">
                      {f ? <span className={ueber ? 'eg-ueber' : undefined}><Icon name="clock" /> {f}</span> : <span className="muted">{E.zuTun.ohneFrist}</span>}
                      {a.kontext ? <span>{a.kontext}</span> : null}
                      {a.vertretung ? <span className="eg-vertretung">{E.zuTun.inVertretung(a.vertretung.person.name)}</span> : null}
                      {a.empfaenger === 'recht' ? <span className="muted">{E.zuTun.anAlle}</span> : null}
                    </div>
                  </div>
                  <div className="eg-a-akt">
                    {a.can.erledigen ? (
                      <button type="button" className="btn sm" aria-label={E.zuTun.erledigtAria(a.titel)} disabled={erledigen.isPending}
                        onClick={() => erledigen.mutate(a.id, { onSuccess: () => toast.show(E.zuTun.erledigtToast(a.titel)) })}>
                        <Icon name="check" />{E.zuTun.erledigt}
                      </button>
                    ) : null}
                    <Ziel pfad={a.link} gehe={gehe} className="btn sm primary" label={E.zuTun.oeffnenAria(a.titel)}>{E.zuTun.oeffnen}</Ziel>
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
        <h2 id={id}>{E.mitteilungen.titel}</h2>
        {ungelesen ? <span className="muted small">{E.mitteilungen.ungelesen(ungelesen)}</span> : null}
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
                    <p>{m.gelesenAt ? null : <span className="eg-neu">{E.mitteilungen.neu}</span>}{m.text}</p>
                    <div className="eg-a-meta"><span className="muted">{fmtZeitpunkt(m.createdAt)}</span></div>
                  </div>
                  <div className="eg-a-akt">
                    {!m.gelesenAt ? (
                      <button type="button" className="btn sm" aria-label={E.mitteilungen.gelesenAria(m.text)} disabled={gelesen.isPending} onClick={() => gelesen.mutate(m.id)}>
                        <Icon name="check" />{E.mitteilungen.gelesen}
                      </button>
                    ) : null}
                    {m.link ? <Ziel pfad={m.link} gehe={gehe} className="btn sm" onGo={() => { if (!m.gelesenAt) gelesen.mutate(m.id); }}>{E.mitteilungen.oeffnen}</Ziel> : null}
                  </div>
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
