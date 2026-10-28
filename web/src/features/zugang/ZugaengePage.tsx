/**
 * Administration › Zugänge (UI-42, Seitentyp Liste + Schublade; AM.01.01, UC-016 A1): entzogene Zugänge mit dem Stand
 * der Neubesetzung, Entziehen in der Schublade (`?o=entziehen`) mit Wirkung vor dem Absenden (I-F5) und Rückfrage, weil
 * es nicht rückgängig zu machen ist (I-R1).
 */
import { useId, useState } from 'react';
import { useSession } from '../../auth/index.ts';
import { Confirm, Datenliste, Drawer, ErrorState, fmtDatum, Hinweis, Icon, Stand, T, useToast, type Spalte } from '../../ui/index.ts';
import { newIdempotencyKey, useEntziehen, useNeubesetzungen, usePersonen, useVorschau, type Neubesetzung, type Vorschau } from './api.ts';
import type { SetZugaengeSearch, ZugaengeSearch } from './search.ts';
import { OrtName, Ziel, type Gehe } from './teile.tsx';
import { Z } from './texte.ts';
import './zugang.css';

export const neubesetzungPfad = (id: string) => `/administration/neubesetzungen/${id}`;

export function ZugaengePage({ search, setSearch, gehe }: { search: ZugaengeSearch; setSearch: SetZugaengeSearch; gehe: Gehe }) {
  const titleId = useId();
  const offen = !!search.offen;
  // Z8: ohne «Mitglieder und Rollen verwalten» keine Aktionen (die Liste antwortet dann 403)
  const darf = useSession().can('members:admin');
  const list = useNeubesetzungen(offen);

  const spalten: Spalte<Neubesetzung>[] = [
    { key: 'person', titel: Z.liste.person, art: 'name', karte: true, zelle: n => <Ziel pfad={neubesetzungPfad(n.id)} gehe={gehe}>{n.person.name}</Ziel> },
    { key: 'entzogen', titel: Z.liste.entzogen, zelle: n => <>{fmtDatum(n.entzogenAt.slice(0, 10))}{n.entzogenVon ? <span className="muted"> · {Z.liste.von(n.entzogenVon.name)}</span> : null}</> },
    { key: 'rollen', titel: Z.liste.rollen, karte: true, zelle: n => Z.liste.rollenText(n.offeneRollen, n.rollen) },
    {
      key: 'stand', titel: Z.liste.stand, karte: true,
      zelle: n => <Stand familie={n.erledigt ? 'positiv' : 'wartet'} label={n.erledigt ? (n.rollen ? Z.liste.erledigt : Z.liste.nichts) : Z.liste.offen} />,
    },
  ];

  return (
    <section aria-labelledby={titleId}>
      <header className="mh">
        <div className="mh-row">
          <div className="mh-title">
            <div className="type-ico neutral"><Icon name="user" /></div>
            <div className="minw0">
              <h1 id={titleId}>{Z.titel}</h1>
              <div className="sub">{Z.sub}</div>
            </div>
          </div>
          {darf ? <div className="acts"><button type="button" className="btn primary" onClick={() => setSearch({ o: 'entziehen' })}>{Z.entziehen}</button></div> : null}
        </div>
      </header>
      <div className="body">
        <div className="zg-filter" role="group" aria-label={Z.filter.titel}>
          <button type="button" className="btn sm" aria-pressed={!offen} onClick={() => setSearch({ offen: undefined })}>{Z.filter.alle}</button>
          <button type="button" className="btn sm" aria-pressed={offen} onClick={() => setSearch({ offen: true })}>{Z.filter.offen}</button>
        </div>
        <Datenliste<Neubesetzung> titel={Z.liste.titel} spalten={spalten} zeilen={list.data?.items} schluessel={n => n.id}
          laedt={list.isPending} fehler={list.error} erneut={() => void list.refetch()}
          leer={Z.liste.leer} leerAktion={darf ? <button type="button" className="btn primary" onClick={() => setSearch({ o: 'entziehen' })}>{Z.entziehen}</button> : undefined}
          gefiltert={offen} leerGefiltert={Z.liste.leerOffen} />
      </div>
      {darf && search.o === 'entziehen'
        ? <EntziehenDrawer person={search.person} setSearch={setSearch} onClose={() => setSearch({ o: undefined, person: undefined })} onDone={id => gehe(neubesetzungPfad(id))} />
        : null}
    </section>
  );
}

function EntziehenDrawer({ person, setSearch, onClose, onDone }: { person?: string; setSearch: SetZugaengeSearch; onClose(): void; onDone(id: string): void }) {
  const id = useId();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [geprueft, setGeprueft] = useState(false);
  const [frage, setFrage] = useState(false);
  const [key] = useState(newIdempotencyKey);
  const personen = usePersonen(q);
  const vorschau = useVorschau(person);
  const entziehen = useEntziehen();
  const v = vorschau.data;
  const fehlt = geprueft && !person ? Z.form.personFehlt : null;
  const selbst = v && !v.can.entziehen ? Z.form.selbst : null;

  const absenden = () => {
    setGeprueft(true);
    if (!person) { document.getElementById(`${id}-q`)?.focus(); return; }
    if (v?.can.entziehen) setFrage(true);
  };

  return (
    <Drawer title={Z.entziehen} onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose}>{T.common.cancel}</button>
      <button type="button" className="btn danger" onClick={absenden} disabled={entziehen.isPending || !!selbst || (!!person && !v)}>{Z.entziehen}</button>
    </>}>
      {entziehen.error ? <ErrorState error={entziehen.error} /> : null}
      <div className="form">
        <div className="field">
          <label htmlFor={`${id}-q`}>{Z.form.person}</label>
          {person && v ? (
            <p className="zg-wahl">
              <span role="status">{Z.form.gewaehlt(v.person.name)}</span>{' '}
              <button type="button" className="btn sm" onClick={() => { setSearch({ person: undefined }, { replace: true }); setQ(''); }}>{Z.form.aendern}</button>
            </p>
          ) : (
            <>
              <input id={`${id}-q`} type="search" value={q} onChange={e => setQ(e.target.value)} autoComplete="off" data-autofocus
                aria-describedby={`${id}-q-h${fehlt ? ` ${id}-q-e` : ''}`} aria-invalid={fehlt ? true : undefined} />
              <p id={`${id}-q-h`} className="hint">{Z.form.personHint}</p>
              {q.trim().length >= 2 ? (
                personen.isPending ? <p className="hint" role="status">{T.common.loading}</p>
                  : personen.error ? <ErrorState error={personen.error} onRetry={() => void personen.refetch()} />
                  : personen.data.length === 0 ? <p className="hint" role="status">{Z.form.keineTreffer}</p>
                  : (
                    <ul className="zg-treffer" aria-label={Z.form.suchen}>
                      {personen.data.map(p => (
                        <li key={p.id}>
                          <button type="button" className="btn sm" onClick={() => setSearch({ person: p.id }, { replace: true })}>
                            <Icon name="user" />{p.name}{p.email ? <span className="muted"> · {p.email}</span> : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )
              ) : null}
            </>
          )}
          {fehlt ? <p id={`${id}-q-e`} className="ferr">{fehlt}</p> : null}
        </div>
        {person ? (
          vorschau.isPending ? <p className="hint" role="status">{T.common.loading}</p>
            : vorschau.error ? <ErrorState error={vorschau.error} onRetry={() => void vorschau.refetch()} />
            : <VorschauAnzeige v={vorschau.data} selbst={selbst} />
        ) : null}
      </div>
      {frage && v ? (
        <Confirm title={Z.frage(v.person.name)} text={Z.frageText} confirm={Z.entziehen} busy={entziehen.isPending}
          onClose={() => setFrage(false)}
          onConfirm={() => entziehen.mutate({ person: v.person.id, key }, {
            onSuccess: r => { setFrage(false); toast.show(Z.entzogen(v.person.name)); onDone(r.neubesetzung); },
            onError: () => setFrage(false),
          })} />
      ) : null}
    </Drawer>
  );
}

function VorschauAnzeige({ v, selbst }: { v: Vorschau; selbst: string | null }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="zg-vorschau">
      <h2 id={id}>{Z.vorschau.titel}</h2>
      {selbst ? <Hinweis stufe="warnung">{selbst}</Hinweis> : null}
      <h3>{Z.vorschau.orgRollen}</h3>
      {v.orgRollen.length ? <ul className="zg-liste">{v.orgRollen.map(r => <li key={r.rolle}>{r.rolleName}</li>)}</ul> : <p className="muted">{Z.vorschau.keine}</p>}
      <h3>{Z.vorschau.rollen}</h3>
      {v.rollen.length
        ? <ul className="zg-liste">{v.rollen.map(r => <li key={`${r.ort.typ}:${r.ort.id}:${r.rolle}`}><OrtName typ={r.ort.typ} id={r.ort.id} /> · {r.rolleName}</li>)}</ul>
        : <p className="muted">{Z.vorschau.keine}</p>}
      <h3>{Z.vorschau.aufgaben}</h3>
      {v.aufgaben.length
        ? <ul className="zg-liste">{v.aufgaben.map(a => <li key={a.id}>{a.titel}{a.kontext ? <span className="muted"> · {a.kontext}</span> : null}</li>)}</ul>
        : <p className="muted">{Z.vorschau.keine}</p>}
      {!selbst ? <p className="note">{Z.vorschau.wirkung(v.person.name, v.rollen.length, v.aufgaben.length)}</p> : null}
    </section>
  );
}
