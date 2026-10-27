/**
 * Seite «Portfolios und Gremien» im Arbeitsraum «Administration» (UI-47; BC AM.02.04; UC-017 Schritt 4, A1), Seitentyp
 * Liste + Schublade: Portfolios mit Kategorie, Pflichten und entscheidendem Gremium; Schublade des Portfolios über
 * `?o=<schlüssel>` mit Gremien und Gremienweg, darin das Gremium über `&g=<kürzel>` mit Sitzungsterminen.
 */
import { useSession } from '../../auth/index.ts';
import { Datenliste, Drawer, Empty, Icon, Loading, type Spalte } from '../../ui/index.ts';
import { useGremien, usePortfolioList, type Gremium, type Portfolio } from './api.ts';
import { GremiumDrawer } from './GremiumDrawer.tsx';
import { PortfolioCreateDrawer, PortfolioDrawer } from './PortfolioDrawer.tsx';
import type { PortfoliosSearch, SetPortfoliosSearch } from './search.ts';
import { TP } from './texte.ts';

function spalten(gremien: readonly Gremium[]): Spalte<Portfolio>[] {
  return [
    { key: 'name', titel: TP.name, art: 'name', zelle: p => p.name },
    { key: 'kategorie', titel: TP.kategorie, karte: true, zelle: p => TP.kategorien[p.kategorie] },
    { key: 'pflichten', titel: TP.pflichten, zelle: p => TP.pflichtKurz(p.pflichten) },
    {
      key: 'gremium', titel: TP.entscheidet, karte: true,
      zelle: p => gremien.find(g => g.portfolioId === p.id && g.art === 'entscheidend')?.name ?? <span className="empty">{TP.keinGremium}</span>,
    },
  ];
}

export function PortfoliosPage({ search, setSearch }: { search: PortfoliosSearch; setSearch: SetPortfoliosSearch }) {
  const { can } = useSession();
  const list = usePortfolioList();
  const gremien = useGremien();
  const items = list.data?.pages.flatMap(p => p.items) ?? [];
  const canAdmin = can('portfolio:admin');
  const close = () => setSearch({ o: undefined, g: undefined });

  return (
    <section aria-labelledby="page-title">
      <header className="mh">
        <div className="mh-row">
          <div className="mh-title">
            <div className="type-ico neutral"><Icon name="grid" /></div>
            <div className="minw0">
              <h1 id="page-title">{TP.title}</h1>
              <div className="sub">{TP.sub}</div>
            </div>
          </div>
          {canAdmin ? <div className="acts"><button type="button" className="btn primary" onClick={() => setSearch({ o: 'neu', g: undefined })}><Icon name="plus" />{TP.create}</button></div> : null}
        </div>
      </header>
      <div className="body">
        <Datenliste<Portfolio> titel={TP.title} spalten={spalten(gremien.data ?? [])} zeilen={items} schluessel={p => p.schluessel}
          oeffnen={p => setSearch({ o: p.schluessel, g: undefined })} aktuell={search.o} laedt={list.isPending} fehler={list.error} erneut={() => void list.refetch()}
          leer={TP.empty}
          leerAktion={canAdmin ? <button type="button" className="btn primary" onClick={() => setSearch({ o: 'neu' })}><Icon name="plus" />{TP.create}</button> : undefined}
          mehr={{ vorhanden: list.hasNextPage, laedt: list.isFetchingNextPage, laden: () => void list.fetchNextPage() }} />
      </div>
      {search.o === 'neu'
        ? <PortfolioCreateDrawer onClose={close} onCreated={p => setSearch({ o: p.schluessel }, { replace: true })} />
        : search.o ? (() => {
          // Portfolio aus der Liste nach Schlüssel (I-N5); bis die Liste da ist, lädt die Schublade
          const p = items.find(x => x.schluessel === search.o);
          if (list.isPending) return <Drawer title={TP.one} onClose={close}><Loading /></Drawer>;
          if (!p) return <Drawer title={TP.one} onClose={close}><Empty>{TP.gone}</Empty></Drawer>;
          return search.g
            ? <GremiumDrawer portfolio={p} kuerzel={search.g} onClose={close} onBack={() => setSearch({ g: undefined })} onOpen={k => setSearch({ g: k }, { replace: true })} />
            : <PortfolioDrawer id={p.id} onClose={close} onGremium={k => setSearch({ g: k })} />;
        })() : null}
    </section>
  );
}
