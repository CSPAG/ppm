/**
 * Seite «Strategische Ziele» im Arbeitsraum «Ziele» (BC ZM.01.02, UC-011 Schritt 2; Kernablauf K6 als Kontext, der
 * Zielzyklus folgt in Etappe E6): Liste nach Nummer mit Handlungsfeld, Metrik und Zielwert, Suche und «Mehr laden»,
 * Schublade über `?o=<nummer>`. Ohne Metrik ein Hinweis in der Zeile (K6 G4). Bearbeiten nach `can` der Antwort.
 */
import { useEffect, useId, useState } from 'react';
import { useSession } from '../../auth/index.ts';
import { Datenliste, Icon, type Spalte } from '../../ui/index.ts';
import { useHandlungsfelder, useZielList, type HandlungsfeldKurz, type StrategischesZiel } from './api.ts';
import type { SetZielSearch, ZielSearch } from './search.ts';
import { TZ } from './texte.ts';
import { ZielDrawer } from './ZielDrawer.tsx';

const spalten = (felder: HandlungsfeldKurz[] | undefined): Spalte<StrategischesZiel>[] => [
  { key: 'nummer', titel: TZ.nummer, art: 'name', zelle: z => z.nummer },
  { key: 'text', titel: TZ.text, karte: true, zelle: z => z.text },
  ...(felder ? [{ key: 'handlungsfeld', titel: TZ.handlungsfeld, karte: true, zelle: (z: StrategischesZiel) => felder.find(h => h.id === z.handlungsfeldId)?.label ?? '–' }] : []),
  { key: 'metrik', titel: TZ.metrik, karte: true, zelle: z => z.metrik || <span className="empty"><Icon name="info" /> {TZ.metrikFehlt}</span> },
  { key: 'zielwert', titel: TZ.zielwert, zelle: z => z.zielwert || <span className="empty">–</span> },
  { key: 'horizont', titel: TZ.horizont, art: 'zahl', zelle: z => z.horizont },
];

export function ZielePage({ search, setSearch }: { search: ZielSearch; setSearch: SetZielSearch }) {
  const { can } = useSession();
  const searchId = useId();
  const [text, setText] = useState(search.q ?? '');
  const q = search.q ?? '';
  // Suche erst nach einer kurzen Pause in die Adresse übernehmen (ohne neuen Verlaufseintrag)
  useEffect(() => {
    const t = setTimeout(() => { if (text.trim() !== q) setSearch({ q: text.trim() || undefined }, { replace: true }); }, 250);
    return () => clearTimeout(t);
  }, [text, q, setSearch]);
  const list = useZielList(q);
  const items = list.data?.pages.flatMap(p => p.items) ?? [];
  const canCreate = can('ziel:write');
  // Handlungsfelder nur mit Leserecht (sonst ohne diese Spalte)
  const canFelder = can('handlungsfeld:read');
  const felder = useHandlungsfelder(canFelder);

  return (
    <section aria-labelledby="page-title">
      <header className="mh">
        <div className="mh-row">
          <div className="mh-title">
            <div className="type-ico neutral"><Icon name="target" /></div>
            <div className="minw0">
              <h1 id="page-title">{TZ.title}</h1>
              <div className="sub">{TZ.sub}</div>
            </div>
          </div>
          {canCreate ? <div className="acts"><button type="button" className="btn primary" onClick={() => setSearch({ o: 'neu' })}><Icon name="plus" />{TZ.create}</button></div> : null}
        </div>
      </header>
      <div className="toolbar" role="search">
        <label className="search">
          <Icon name="search" />
          <span className="sr">{TZ.search}</span>
          <input id={searchId} type="search" value={text} onChange={e => setText(e.target.value)} placeholder={TZ.search} />
        </label>
      </div>
      <div className="body">
        <Datenliste<StrategischesZiel> titel={TZ.title} spalten={spalten(canFelder ? felder.data ?? [] : undefined)} zeilen={items} schluessel={z => z.nummer}
          name={z => `${z.nummer} ${z.text}`}
          oeffnen={z => setSearch({ o: z.nummer })} aktuell={search.o} laedt={list.isPending} fehler={list.error} erneut={() => void list.refetch()}
          leer={TZ.empty} gefiltert={!!q} leerGefiltert={TZ.emptySearch} zuruecksetzen={() => setText('')}
          mehr={{ vorhanden: list.hasNextPage, laedt: list.isFetchingNextPage, laden: () => void list.fetchNextPage() }} />
      </div>
      {search.o ? <ZielDrawer nummer={search.o} canRead={canFelder} onClose={() => setSearch({ o: undefined })} onOpen={n => setSearch({ o: n }, { replace: true })} /> : null}
    </section>
  );
}
