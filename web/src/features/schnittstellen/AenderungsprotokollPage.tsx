/**
 * Seite «Änderungsprotokoll» in der Administration (UI-50; BC AM.03.03; UC-018 Schritt 5; AP-E7-3), Seitentyp Bericht:
 * Filter oben (Objekt, Kennung, Zeitraum, in der Adresse), darunter die Änderungen mit Person, Zeitpunkt, altem und neuem
 * Wert; neueste zuerst, «Mehr laden»; Export aller Einträge zum Filter als CSV. Für ADM und UE (`audit:read`).
 */
import { useId, useState } from 'react';
import { Empty, ErrorState, fmtZeitpunkt, Icon, Skelett, T, useToast, useVerzoegert } from '../../ui/index.ts';
import { protokollExportieren, useProtokoll, useProtokollObjekte, type ProtokollEintrag } from './api.ts';
import type { ProtokollSearch, SetProtokollSearch } from './search.ts';
import { TX } from './texte.ts';
import './schnittstellen.css';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Wert eines Feldes lesbar: leer, ja/nein, Text; Listen und Objekte gekürzt als JSON. */
export function wert(v: unknown): string {
  if (v === null || v === undefined || v === '') return TX.p.leerWert;
  if (typeof v === 'boolean') return v ? TX.p.ja : TX.p.nein;
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  const j = JSON.stringify(v);
  return j.length > 160 ? `${j.slice(0, 157)}…` : j;
}

function person(e: ProtokollEintrag): string {
  if (!e.person) return TX.p.system;
  const name = e.person.name ?? '–';
  return e.person.art === 'client' ? TX.p.client(name) : name;
}

/** Verweis auf ein Objekt: Kennung oder `{ id, typ }`; sonst `null`. */
export function verweis(v: unknown): { id: string; typ?: string } | null {
  if (typeof v === 'string' && UUID.test(v)) return { id: v.toLowerCase() };
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    if (typeof o.id === 'string' && UUID.test(o.id) && Object.keys(o).every(k => k === 'id' || k === 'typ')) {
      return { id: o.id.toLowerCase(), typ: typeof o.typ === 'string' ? o.typ : undefined };
    }
  }
  return null;
}

/** Wert einer Änderung; ein Verweis erscheint kurz (wie in der Spalte «Objekt») und filtert das Protokoll auf dieses Objekt. */
function Wert({ v, filtern }: { v: unknown; filtern(id: string): void }) {
  const r = verweis(v);
  if (!r) return <>{wert(v)}</>;
  return (
    <>
      {r.typ ? `${r.typ} · ` : null}
      <button type="button" className="sx-ref mono" title={TX.p.verweis(r.id)} onClick={() => filtern(r.id)}>{r.id.slice(0, 8)}</button>
    </>
  );
}

function Aenderungen({ e, filtern }: { e: ProtokollEintrag; filtern(id: string): void }) {
  if (!e.aenderungen.length) return <span className="empty">{TX.p.keineAenderung}</span>;
  return (
    <ul className="sx-aend">
      {e.aenderungen.map(a => (
        <li key={a.feld}>
          <span className="feld mono">{a.feld}</span>{': '}
          {e.art === 'angelegt' ? <ins><Wert v={a.nachher} filtern={filtern} /></ins> : e.art === 'geloescht' ? <del><Wert v={a.vorher} filtern={filtern} /></del>
            : <><del><Wert v={a.vorher} filtern={filtern} /></del>{' → '}<ins><Wert v={a.nachher} filtern={filtern} /></ins></>}
        </li>
      ))}
    </ul>
  );
}

export function AenderungsprotokollPage({ search, setSearch }: { search: ProtokollSearch; setSearch: SetProtokollSearch }) {
  const id = useId();
  const zeitraumFalsch = !!(search.von && search.bis && search.von > search.bis);
  const q = useProtokoll(zeitraumFalsch ? { ...search, von: undefined, bis: undefined } : search);
  const objekte = useProtokollObjekte();
  const [kennung, setKennung] = useState(search.objektId ?? '');
  const kennungFalsch = !!kennung.trim() && !UUID.test(kennung.trim());
  const skelett = useVerzoegert(q.isPending);
  const items = q.data?.pages.flatMap(p => p.items) ?? [];
  const gefiltert = !!(search.objekt || search.objektId || search.von || search.bis);
  const zuruecksetzen = () => { setKennung(''); setSearch({ objekt: undefined, objektId: undefined, von: undefined, bis: undefined }); };
  const kennungUebernehmen = () => { if (!kennungFalsch) setSearch({ objektId: kennung.trim().toLowerCase() || undefined }, { replace: true }); };
  const toast = useToast();
  const [exportLaeuft, setExportLaeuft] = useState(false);
  // Export aller Einträge zum Filter (Seitentyp Bericht), nicht nur der geladenen Seiten; die Kennung so, wie sie im Feld
  // steht (beim Klick ist sie noch nicht übernommen), bei ungültiger Kennung gesperrt
  const exportieren = () => {
    if (kennungFalsch) return;
    setExportLaeuft(true);
    protokollExportieren({ ...search, objektId: kennung.trim().toLowerCase() || undefined }).then(name => toast.show(TX.p.exportiert(name)), e => toast.error(e)).finally(() => setExportLaeuft(false));
  };

  return (
    <section aria-labelledby="page-title">
      <header className="mh">
        <div className="mh-row">
          <div className="mh-title">
            <div className="type-ico neutral"><Icon name="clock" /></div>
            <div className="minw0">
              <h1 id="page-title">{TX.p.title}</h1>
              <div className="sub">{TX.p.sub}</div>
            </div>
          </div>
          {items.length ? (
            <div className="acts">
              <button type="button" className="btn" onClick={exportieren} disabled={exportLaeuft || zeitraumFalsch || kennungFalsch} aria-busy={exportLaeuft || undefined}>
                <Icon name="download" />{TX.p.exportieren}
              </button>
            </div>
          ) : null}
        </div>
      </header>
      <div className="body sx-body">
        <form className="sx-filter" role="search" aria-label={TX.p.filter} onSubmit={e => { e.preventDefault(); kennungUebernehmen(); }}>
          <label htmlFor={`${id}-objekt`}>{TX.p.objekt}
            <select id={`${id}-objekt`} value={search.objekt ?? ''} onChange={e => setSearch({ objekt: e.target.value || undefined }, { replace: true })}>
              <option value="">{TX.p.objektAlle}</option>
              {[...new Set([...(objekte.data ?? []), ...(search.objekt ? [search.objekt] : [])])].sort().map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
          <label htmlFor={`${id}-kennung`}>{TX.p.objektId}
            <input id={`${id}-kennung`} className="mono" value={kennung} onChange={e => setKennung(e.target.value)} onBlur={kennungUebernehmen} size={38}
              placeholder={TX.p.objektIdHint} aria-invalid={kennungFalsch || undefined} aria-describedby={kennungFalsch ? `${id}-kennung-e` : undefined} />
          </label>
          <label htmlFor={`${id}-von`}>{TX.p.von}
            <input id={`${id}-von`} type="date" value={search.von ?? ''} onChange={e => setSearch({ von: e.target.value || undefined }, { replace: true })}
              aria-invalid={zeitraumFalsch || undefined} aria-describedby={zeitraumFalsch ? `${id}-zeitraum-e` : undefined} />
          </label>
          <label htmlFor={`${id}-bis`}>{TX.p.bis}
            <input id={`${id}-bis`} type="date" value={search.bis ?? ''} onChange={e => setSearch({ bis: e.target.value || undefined }, { replace: true })}
              aria-invalid={zeitraumFalsch || undefined} aria-describedby={zeitraumFalsch ? `${id}-zeitraum-e` : undefined} />
          </label>
          {gefiltert ? <button type="button" className="btn sm" onClick={zuruecksetzen}>{TX.p.zuruecksetzen}</button> : null}
        </form>
        {kennungFalsch ? <p id={`${id}-kennung-e`} className="ferr">{TX.p.objektIdUngueltig}</p> : null}
        {zeitraumFalsch ? <p id={`${id}-zeitraum-e`} className="ferr" role="alert">{TX.p.vonNachBis}</p> : null}

        {q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} />
          : q.isPending ? (skelett ? <Skelett zeilen={6} /> : null)
          : !items.length ? (
            gefiltert ? (
              <Empty>{TX.p.leerGefiltert} <button type="button" className="btn sm" onClick={zuruecksetzen}>{TX.p.zuruecksetzen}</button></Empty>
            ) : <Empty>{TX.p.leer}</Empty>
          ) : (
            <table className="sx-tab">
              <caption className="sr">{TX.p.tabelle}</caption>
              <thead>
                <tr>
                  <th scope="col">{TX.p.spalte.zeit}</th><th scope="col">{TX.p.spalte.person}</th><th scope="col">{TX.p.spalte.objekt}</th>
                  <th scope="col">{TX.p.spalte.aenderungen}</th>
                </tr>
              </thead>
              <tbody>
                {items.map(e => (
                  <tr key={e.id}>
                    <th scope="row">{fmtZeitpunkt(e.zeit)}<div className="muted small">{TX.p.quelle[e.quelle] ?? e.quelle}</div></th>
                    <td>{person(e)}</td>
                    <td>
                      <span className="mono">{e.objekt.typ ?? '–'}</span> · {TX.p.art[e.art]}
                      {e.art === 'sonstig' ? <div className="muted small mono">{e.aktion}</div> : null}
                      {e.objekt.id ? (
                        <div><button type="button" className="btn sm mono" title={TX.p.objektId} onClick={() => { setKennung(e.objekt.id!); setSearch({ objekt: e.objekt.typ ?? undefined, objektId: e.objekt.id! }); }}>
                          {e.objekt.id.slice(0, 8)}
                        </button></div>
                      ) : null}
                    </td>
                    <td><Aenderungen e={e} filtern={objektId => { setKennung(objektId); setSearch({ objekt: undefined, objektId }); }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        {q.hasNextPage ? <button type="button" className="btn" onClick={() => void q.fetchNextPage()} disabled={q.isFetchingNextPage}>{T.common.more}</button> : null}
      </div>
    </section>
  );
}
