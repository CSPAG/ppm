/**
 * Seite «Phasenmodell» in der Administration (UI-46, BC AM.02.03, UC-017 Schritte 3 und 5): Version wählen (`?v=`),
 * Abschnitt (`?e=`), Entwurf aus der Version in Kraft bzw. der Vorgabe des PM-Handbuchs anlegen, bearbeiten, verwerfen,
 * in Kraft setzen. Ohne Bearbeitungsrecht nur lesend (Z8); eine Version in Kraft ist gesperrt (Z9).
 */
import { useQueryClient } from '@tanstack/react-query';
import { useId } from 'react';
import { newIdempotencyKey, statusOf } from '../../api/index.ts';
import { Empty, ErrorState, Hinweis, Icon, Loading, Stand, T, useToast } from '../../ui/index.ts';
import { phasenmodellKeys, usePhasenmodell, usePhasenmodellMutations, useVersionen, type Loaded, type PhasenmodellKurz } from './api.ts';
import { Arbeitsflaeche } from './Arbeitsflaeche.tsx';
import type { PhasenmodellSearch, SetPhasenmodellSearch } from './search.ts';
import './phasenmodell.css';

const P = T.phasenmodell;

/** Angezeigte Version: gewählt, sonst der Entwurf (wer bearbeiten darf), sonst die Version in Kraft. */
function waehle(items: PhasenmodellKurz[], v: string | undefined, bearbeiten: boolean): string | null {
  if (v && items.some(x => x.id === v)) return v;
  const entwurf = items.find(x => x.stand === 'entwurf');
  const inKraft = items.find(x => x.stand === 'in_kraft');
  return (bearbeiten && entwurf ? entwurf.id : inKraft?.id ?? entwurf?.id ?? items[0]?.id) ?? null;
}

const familie = (stand: string) => (stand === 'entwurf' ? 'entwurf' : stand === 'in_kraft' ? 'positiv' : 'ruhend') as 'entwurf' | 'positiv' | 'ruhend';

export function PhasenmodellPage({ search, setSearch }: { search: PhasenmodellSearch; setSearch: SetPhasenmodellSearch }) {
  const selId = useId();
  const qc = useQueryClient();
  const toast = useToast();
  const versionen = useVersionen();
  const items = versionen.data?.items ?? [];
  const darfAnlegen = versionen.data?.can.create ?? false;
  const id = versionen.data ? waehle(items, search.v, darfAnlegen) : null;
  const q = usePhasenmodell(id);
  const { create } = usePhasenmodellMutations();
  const entwurf = items.find(x => x.stand === 'entwurf');
  const inKraft = items.find(x => x.stand === 'in_kraft');

  const anlegen = (quelle?: 'vorgabe') => create.mutate({ quelle, key: newIdempotencyKey() }, {
    onSuccess: l => { toast.show(P.angelegt); setSearch({ v: l.item.id, e: undefined }); },
    onError: async e => {
      // Ein Entwurf besteht schon (409): ihn öffnen statt eines zweiten
      if (statusOf(e) === 409) { await versionen.refetch(); return; }
      toast.error(e);
    },
  });
  const neuLaden = async (): Promise<Loaded | undefined> => {
    await qc.invalidateQueries({ queryKey: phasenmodellKeys.list });
    return (await q.refetch()).data;
  };

  const aktionen = (
    <>
      {items.length > 1 ? (
        <label className="pm-version">
          <span className="sr">{P.versionWaehlen}</span>
          <select id={selId} className="pm-in" value={id ?? ''} onChange={e => setSearch({ v: e.target.value })}>
            {items.map(x => <option key={x.id} value={x.id}>{`${P.version(x.nummer)} · ${P.stand[x.stand] ?? x.stand}`}</option>)}
          </select>
        </label>
      ) : null}
      {darfAnlegen && entwurf && entwurf.id !== id ? <button type="button" className="btn" onClick={() => setSearch({ v: entwurf.id })}><Icon name="edit" />{P.entwurfOeffnen}</button> : null}
      {darfAnlegen && !entwurf && items.length ? (
        <button type="button" className="btn primary" onClick={() => anlegen()} disabled={create.isPending}><Icon name="plus" />{P.entwurfAnlegen}</button>
      ) : null}
    </>
  );

  const m = q.data?.item;
  return (
    <section aria-labelledby="page-title" className="pm-seite">
      <header className="mh">
        <div className="mh-row">
          <div className="mh-title">
            <div className="type-ico neutral"><Icon name="layers" /></div>
            <div className="minw0">
              <h1 id="page-title">{P.title}{m ? <> <span className="pm-nr">{P.version(m.nummer)}</span></> : null}</h1>
              <div className="sub">{m ? <Stand familie={familie(m.stand)} label={P.stand[m.stand] ?? m.stand} detail={m.beschreibung || undefined} /> : P.sub}</div>
            </div>
          </div>
          <div className="acts">{aktionen}</div>
        </div>
      </header>
      <div className="body pm-body">
        {versionen.isPending ? <Loading /> : versionen.error ? <ErrorState error={versionen.error} onRetry={() => void versionen.refetch()} /> : !items.length ? (
          <Empty action={darfAnlegen ? <button type="button" className="btn primary" onClick={() => anlegen('vorgabe')} disabled={create.isPending}><Icon name="plus" />{P.vorgabeLaden}</button> : undefined}>
            {darfAnlegen ? P.leer : P.leerLesen}
          </Empty>
        ) : q.isPending ? <Loading /> : q.error ? (
          statusOf(q.error) === 404 ? <Empty>{P.gone}</Empty> : <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : (
          <>
            {q.data.item.stand === 'in_kraft' ? (
              <div className="pm-banner"><Hinweis stufe="hinweis">{P.gesperrt(q.data.item.nummer)}</Hinweis></div>
            ) : q.data.item.stand === 'abgeloest' ? (
              <div className="pm-banner"><Hinweis stufe="hinweis">{P.abgeloestBanner(q.data.item.nummer)}</Hinweis></div>
            ) : !q.data.item.can.write ? (
              <div className="pm-banner"><Hinweis stufe="hinweis">{P.nurLesen}</Hinweis></div>
            ) : null}
            <Arbeitsflaeche key={q.data.item.id} loaded={q.data} abschnitt={search.e ?? 'version'} setAbschnitt={e => setSearch({ e }, { replace: true })}
              inKraftNummer={inKraft && inKraft.id !== q.data.item.id ? inKraft.nummer : null} neuLaden={neuLaden}
              onVerworfen={() => setSearch({ v: undefined, e: undefined })} />
          </>
        )}
      </div>
    </section>
  );
}
