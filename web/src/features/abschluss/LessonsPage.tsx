/**
 * Portfolio › Auswertungen › Lessons Learned (UI-32; BC PS.04.03; UC-015 Schritt 4, UC-013 Schritt 1; Seitentyp
 * Liste + Schublade): Erkenntnisse aller sichtbaren Projekte, neueste zuerst, mit Filter Jahr und Kategorie und Suche;
 * die Schublade zeigt die Erkenntnis mit Projekt und erlaubt der Projektleitung Ändern und Löschen.
 */
import { useEffect, useId, useState } from 'react';
import { Confirm, Datenliste, Drawer, Icon, T, useToast, type Spalte } from '../../ui/index.ts';
import { useLessonMutations, useLessons, type Lesson } from './api.ts';
import type { LessonsSearch, SetLessonsSearch } from './search.ts';
import { TA } from './texte.ts';
import './abschluss.css';

const L = TA.liste;

const spalten: Spalte<Lesson>[] = [
  { key: 'text', titel: L.erkenntnis, art: 'name', zelle: l => l.text.length > 140 ? `${l.text.slice(0, 139)}…` : l.text },
  { key: 'projekt', titel: L.projekt, karte: true, zelle: l => <><span className="mono">{l.projekt.nummer}</span> {l.projekt.name}</> },
  { key: 'kategorie', titel: L.kategorie, karte: true, zelle: l => l.kategorie || <span className="empty">{L.ohneKategorie}</span> },
  { key: 'jahr', titel: L.jahr, art: 'zahl', zelle: l => l.jahr },
];

export interface LessonsPageProps {
  search: LessonsSearch;
  setSearch: SetLessonsSearch;
  /** Projektakte › Abschluss öffnen (`/projekte/<nummer>/abschluss`). */
  projektOeffnen(nummer: string): void;
}

export function LessonsPage({ search, setSearch, projektOeffnen }: LessonsPageProps) {
  const id = useId();
  const [text, setText] = useState(search.q ?? '');
  const q = search.q ?? '';
  useEffect(() => {
    const t = setTimeout(() => { if (text.trim() !== q) setSearch({ q: text.trim() || undefined }, { replace: true }); }, 250);
    return () => clearTimeout(t);
  }, [text, q, setSearch]);
  const filter = { ...(search.jahr ? { jahr: Number(search.jahr) } : {}), ...(search.kategorie !== undefined ? { kategorie: search.kategorie } : {}), ...(q ? { q } : {}) };
  const list = useLessons(filter);
  const items = list.data?.pages.flatMap(p => p.items) ?? [];
  const kategorien = list.data?.pages[0]?.kategorien ?? [];
  const [offen, setOffen] = useState<string | null>(null);
  const aktuell = items.find(l => l.id === offen) ?? null;
  const jahrNun = new Date().getFullYear();
  const jahre = [...new Set([jahrNun, jahrNun - 1, jahrNun - 2, ...(search.jahr ? [Number(search.jahr)] : [])])].sort((a, b) => b - a);
  const gefiltert = !!(q || search.jahr || search.kategorie !== undefined);

  return (
    <section aria-labelledby="page-title">
      <header className="mh">
        <div className="mh-row">
          <div className="mh-title">
            <div className="type-ico neutral"><Icon name="bookmark" /></div>
            <div className="minw0">
              <h1 id="page-title">{L.titel}</h1>
              <div className="sub">{L.sub}</div>
            </div>
          </div>
        </div>
      </header>
      <div className="toolbar ab-filter" role="search">
        <label className="search">
          <Icon name="search" />
          <span className="sr">{L.suche}</span>
          <input type="search" value={text} onChange={e => setText(e.target.value)} placeholder={L.suche} />
        </label>
        <label htmlFor={`${id}-j`} className="muted">{L.jahr}</label>
        <select id={`${id}-j`} value={search.jahr ?? ''} onChange={e => setSearch({ jahr: e.target.value || undefined })}>
          <option value="">{L.alleJahre}</option>
          {jahre.map(j => <option key={j} value={j}>{j}</option>)}
        </select>
        <label htmlFor={`${id}-k`} className="muted">{L.kategorie}</label>
        <select id={`${id}-k`} value={search.kategorie === undefined ? '*' : search.kategorie} onChange={e => setSearch({ kategorie: e.target.value === '*' ? undefined : e.target.value })}>
          <option value="*">{L.alleKategorien}</option>
          <option value="">{L.ohneKategorie}</option>
          {[...new Set([...kategorien, ...(search.kategorie ? [search.kategorie] : [])])].map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>
      <div className="body">
        <Datenliste<Lesson> titel={L.titel} spalten={spalten} zeilen={items} schluessel={l => l.id} name={l => `${l.projekt.nummer} ${l.text}`}
          oeffnen={l => setOffen(l.id)} aktuell={offen ?? undefined} laedt={list.isPending} fehler={list.error} erneut={() => void list.refetch()}
          leer={L.leer} gefiltert={gefiltert} leerGefiltert={L.leerGefiltert}
          zuruecksetzen={() => { setText(''); setSearch({ q: undefined, jahr: undefined, kategorie: undefined }); }}
          mehr={{ vorhanden: list.hasNextPage, laedt: list.isFetchingNextPage, laden: () => void list.fetchNextPage() }} />
      </div>
      {aktuell ? <LessonDrawer l={aktuell} onClose={() => setOffen(null)} projektOeffnen={projektOeffnen} /> : null}
    </section>
  );
}

function LessonDrawer({ l, onClose, projektOeffnen }: { l: Lesson; onClose(): void; projektOeffnen(nr: string): void }) {
  const id = useId();
  const toast = useToast();
  const { aendern, loeschen } = useLessonMutations(l.projekt.id);
  const [edit, setEdit] = useState(false);
  const [frage, setFrage] = useState(false);
  const [text, setText] = useState(l.text);
  const [kategorie, setKategorie] = useState(l.kategorie);
  return (
    <Drawer title={L.eine} onClose={onClose}
      actions={l.can.write && !edit ? <>
        <button type="button" className="btn sm" onClick={() => setEdit(true)}><Icon name="edit" />{L.bearbeiten}</button>
        <button type="button" className="btn sm danger" onClick={() => setFrage(true)}><Icon name="trash" />{T.common.delete}</button>
      </> : null}
      footer={edit ? <>
        <button type="button" className="btn" onClick={() => { setEdit(false); setText(l.text); setKategorie(l.kategorie); }}>{T.common.cancel}</button>
        <button type="submit" form={`${id}-f`} className="btn primary" disabled={!text.trim() || aendern.isPending}>{L.speichern}</button>
      </> : null}>
      {edit ? (
        <form id={`${id}-f`} onSubmit={e => {
          e.preventDefault();
          aendern.mutate({ l, text: text.trim(), kategorie: kategorie.trim() }, { onSuccess: () => { setEdit(false); toast.show(L.gespeichert); }, onError: er => toast.error(er) });
        }}>
          <div className="field">
            <label htmlFor={`${id}-t`}>{TA.lessons.text}</label>
            <textarea id={`${id}-t`} rows={5} maxLength={5000} value={text} onChange={e => setText(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={`${id}-k`}>{TA.lessons.kategorie}</label>
            <input id={`${id}-k`} maxLength={100} value={kategorie} onChange={e => setKategorie(e.target.value)} />
          </div>
        </form>
      ) : (
        <>
          <p className="wrap">{l.text}</p>
          <dl className="attrs">
            <dt>{L.projekt}</dt>
            <dd><button type="button" className="linkbtn" onClick={() => projektOeffnen(l.projekt.nummer)}><span className="mono">{l.projekt.nummer}</span> {l.projekt.name}</button></dd>
            <dt>{L.kategorie}</dt><dd>{l.kategorie || <span className="empty">{L.ohneKategorie}</span>}</dd>
            <dt>{L.erfasst}</dt><dd>{TA.lessons.von(l.von, l.jahr)}</dd>
          </dl>
          {!l.can.write ? <p className="note">{L.nurLesen}</p> : null}
        </>
      )}
      {frage ? (
        <Confirm title={TA.lessons.loeschen(l.text.slice(0, 60))} text={l.text} confirm={T.common.delete} busy={loeschen.isPending} onClose={() => setFrage(false)}
          onConfirm={() => loeschen.mutate(l, { onSuccess: () => { toast.show(TA.lessons.geloescht); onClose(); }, onError: e => toast.error(e) })} />
      ) : null}
    </Drawer>
  );
}
