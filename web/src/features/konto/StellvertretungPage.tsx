/**
 * Profil mit Stellvertretung (UI-43, Seitentyp Liste + Schublade; BC AM.01.03, UC-016 Schritt 4): Profil der Person,
 * laufende und künftige Stellvertretungen (wer dich vertritt, wen du vertrittst), Erfassen in der Schublade (`?o=neu`)
 * mit Wirkung vor dem Absenden (I-F5), Beenden mit Rückfrage, weil es auf die Vertretung wirkt (I-R1).
 */
import { describeError } from '@vollholz/iam-web';
import { useId, useState, type FormEvent } from 'react';
import { useSession } from '../../auth/index.ts';
import { Confirm, Datenliste, Drawer, ErrorState, fmtDatum, Icon, Stand, T, useToast, type Spalte } from '../../ui/index.ts';
import { usePersonen, useStellvertretungen, useStellvertretungMutations, type Stellvertretung } from './api.ts';
import type { KontoSearch, SetKontoSearch } from './search.ts';
import { K } from './texte.ts';
import './konto.css';

/** Heute als Kalendertag (YYYY-MM-DD) in lokaler Zeit (Vorbelegung «Von», I-F2). */
const heute = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export function StellvertretungPage({ search, setSearch }: { search: KontoSearch; setSearch: SetKontoSearch }) {
  const titleId = useId();
  const { person, orgName } = useSession();
  const list = useStellvertretungen();
  const { remove } = useStellvertretungMutations();
  const toast = useToast();
  const [beenden, setBeenden] = useState<Stellvertretung | null>(null);

  const spalten: Spalte<Stellvertretung>[] = [
    {
      key: 'wer', titel: K.liste.vertretung, art: 'text', karte: true,
      zelle: s => (s.richtung === 'eigene' ? K.liste.eigene(s.vertreter.name) : K.liste.fuerAndere(s.vertretene.name)),
    },
    { key: 'unterschriften', titel: K.liste.unterschriften, zelle: s => (s.unterschriften ? K.liste.ja : K.liste.nein) },
    // Stand mit Zeitraum in einer Spalte: auf dem Telefon höchstens drei Felder je Karte (I-L6), Beenden inbegriffen
    {
      key: 'stand', titel: K.liste.zeitraum, karte: true,
      zelle: s => <Stand familie={s.aktiv ? 'positiv' : 'wartet'} label={s.aktiv ? K.liste.aktiv : K.liste.geplant} detail={K.liste.von(fmtDatum(s.von), fmtDatum(s.bis))} /> },
    {
      // Beenden auch auf dem Telefon in der Karte
      key: 'akt', titel: '', karte: true, zelle: s => (s.can.beenden
        ? <button type="button" className="btn sm" aria-label={K.beendenAria(s.vertreter.name)} onClick={() => setBeenden(s)}>{K.beenden}</button>
        : null),
    },
  ];

  return (
    <section aria-labelledby={titleId}>
      <header className="mh">
        <div className="mh-row">
          <div className="mh-title">
            <div className="type-ico neutral"><Icon name="user" /></div>
            <div className="minw0">
              <h1 id={titleId}>{K.titel}</h1>
              <div className="sub">{K.sub}</div>
            </div>
          </div>
          {/* Kopf-Button fehlt nur bei geladener, leerer Liste: sie bietet die erste Aktion selbst an (Z2) */}
          {!list.data || list.data.length ? <div className="acts"><button type="button" className="btn primary" onClick={() => setSearch({ o: 'neu' })}><Icon name="plus" />{K.erfassen}</button></div> : null}
        </div>
      </header>
      <div className="body">
        <dl className="kv" aria-label={K.profil.titel}>
          <dt>{K.profil.name}</dt><dd>{person.name ?? K.profil.keineAngabe}</dd>
          <dt>{K.profil.email}</dt><dd>{person.email ?? K.profil.keineAngabe}</dd>
          <dt>{K.profil.organisation}</dt><dd>{orgName ?? K.profil.keineAngabe}</dd>
        </dl>
        <h2 className="sr">{K.liste.titel}</h2>
        <Datenliste<Stellvertretung> titel={K.liste.titel} spalten={spalten} zeilen={list.data} schluessel={s => s.id}
          laedt={list.isPending} fehler={list.error} erneut={() => void list.refetch()} leer={K.liste.leer}
          leerAktion={<button type="button" className="btn primary" onClick={() => setSearch({ o: 'neu' })}><Icon name="plus" />{K.erfassen}</button>} />
      </div>
      {search.o === 'neu' ? <ErfassenDrawer onClose={() => setSearch({ o: undefined })} /> : null}
      {beenden ? (
        <Confirm title={K.beendenFrage(beenden.vertreter.name)} text={K.beendenText(beenden.vertreter.name)} confirm={K.beenden} busy={remove.isPending}
          onClose={() => setBeenden(null)}
          onConfirm={() => remove.mutate(beenden.id, { onSuccess: () => { setBeenden(null); toast.show(K.beendet); } })} />
      ) : null}
      {remove.error ? <ErrorState error={remove.error} /> : null}
    </section>
  );
}

interface Werte { person: { id: string; name: string } | null; von: string; bis: string; unterschriften: boolean }

function pruefen(v: Werte): Partial<Record<'person' | 'von' | 'bis', string>> {
  const e: Partial<Record<'person' | 'von' | 'bis', string>> = {};
  if (!v.person) e.person = K.form.personFehlt;
  if (!v.von) e.von = K.form.datumFehlt;
  if (!v.bis) e.bis = K.form.datumFehlt;
  else if (v.von && v.bis < v.von) e.bis = K.form.bisVorVon;
  else if (v.bis < heute()) e.bis = K.form.vergangen;
  return e;
}

function ErfassenDrawer({ onClose }: { onClose(): void }) {
  const id = useId();
  const formId = `${id}-form`;
  const toast = useToast();
  const { create, newKey } = useStellvertretungMutations();
  // Ein Schlüssel je geöffnetes Formular: Doppelklick legt nicht doppelt an
  const [key] = useState(newKey);
  const [v, setV] = useState<Werte>({ person: null, von: heute(), bis: '', unterschriften: false });
  const [q, setQ] = useState('');
  const [geprueft, setGeprueft] = useState(false);
  const personen = usePersonen(q);
  const server = Object.fromEntries((describeError(create.error).fields ?? []).map(f => [f.path.replace(/^\//, ''), f.message])) as Record<string, string | undefined>;
  const fehler = { ...server, ...(geprueft ? pruefen(v) : {}), ...(server.vertreter ? { person: server.vertreter } : {}) } as Partial<Record<string, string>>;

  const absenden = (e: FormEvent) => {
    e.preventDefault();
    setGeprueft(true);
    const f = pruefen(v);
    if (Object.keys(f).length) {
      // I-F3: Fokus aufs erste fehlerhafte Feld
      document.getElementById(`${id}-${f.person ? 'q' : f.von ? 'von' : 'bis'}`)?.focus();
      return;
    }
    create.mutate({ body: { vertreter: v.person!.id, von: v.von, bis: v.bis, unterschriften: v.unterschriften }, key }, {
      onSuccess: () => { toast.show(K.erfasst); onClose(); },
    });
  };
  const err = (k: string) => (fehler[k] ? <p id={`${id}-${k}-e`} className="ferr">{fehler[k]}</p> : null);

  return (
    <Drawer title={K.erfassen} onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose}>{T.common.cancel}</button>
      <button type="submit" form={formId} className="btn primary" disabled={create.isPending}>{K.form.speichern}</button>
    </>}>
      {create.error && !describeError(create.error).fields?.length ? <ErrorState error={create.error} /> : null}
      <form id={formId} className="form" onSubmit={absenden} noValidate aria-busy={create.isPending}>
        <div className="field">
          <label htmlFor={`${id}-q`}>{K.form.person}</label>
          {v.person ? (
            <p className="kv-wahl">
              <span role="status">{K.form.gewaehlt(v.person.name)}</span>{' '}
              <button type="button" className="btn sm" onClick={() => { setV({ ...v, person: null }); setQ(''); }}>{K.form.aendern}</button>
            </p>
          ) : (
            <>
              <input id={`${id}-q`} type="search" value={q} onChange={e => setQ(e.target.value)} autoComplete="off" data-autofocus
                aria-describedby={`${id}-q-h${fehler.person ? ` ${id}-person-e` : ''}`} aria-invalid={fehler.person ? true : undefined} />
              <p id={`${id}-q-h`} className="hint">{K.form.personHint}</p>
              {q.trim().length >= 2 ? (
                personen.isPending ? <p className="hint" role="status">{T.common.loading}</p>
                  : personen.error ? <ErrorState error={personen.error} onRetry={() => void personen.refetch()} />
                  : personen.data.length === 0 ? <p className="hint" role="status">{K.form.keineTreffer}</p>
                  : (
                    <ul className="kv-treffer" aria-label={K.form.suchen}>
                      {personen.data.map(p => (
                        <li key={p.id}>
                          <button type="button" className="btn sm" onClick={() => setV({ ...v, person: { id: p.id, name: p.name } })}>
                            <Icon name="user" />{p.name}{p.email ? <span className="muted"> · {p.email}</span> : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )
              ) : null}
            </>
          )}
          {err('person')}
        </div>
        <div className="field">
          <label htmlFor={`${id}-von`}>{K.form.von}</label>
          <input id={`${id}-von`} type="date" value={v.von} onChange={e => setV({ ...v, von: e.target.value })} required
            aria-invalid={fehler.von ? true : undefined} aria-describedby={fehler.von ? `${id}-von-e` : undefined} />
          {err('von')}
        </div>
        <div className="field">
          <label htmlFor={`${id}-bis`}>{K.form.bis}</label>
          <input id={`${id}-bis`} type="date" value={v.bis} min={v.von || undefined} onChange={e => setV({ ...v, bis: e.target.value })} required
            aria-invalid={fehler.bis ? true : undefined} aria-describedby={fehler.bis ? `${id}-bis-e` : undefined} />
          {err('bis')}
        </div>
        <div className="kv-check">
          <label>
            <input type="checkbox" checked={v.unterschriften} onChange={e => setV({ ...v, unterschriften: e.target.checked })} aria-describedby={`${id}-u-h`} />
            {' '}{K.form.unterschriften}
          </label>
          <p id={`${id}-u-h`} className="hint">{K.form.unterschriftenHint}</p>
        </div>
        {v.person ? <p className="note">{K.form.wirkung(v.person.name)}</p> : null}
      </form>
    </Drawer>
  );
}
