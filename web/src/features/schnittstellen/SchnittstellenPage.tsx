/**
 * Seite «Schnittstellen» in der Administration (UI-49; BC AM.03.02; UC-018 Schritte 3–4, A1; AP-E7-3), Seitentyp Liste +
 * Schublade: eingerichtete Schnittstellen mit Richtung, Rhythmus und letztem Lauf; `?o=<id>` öffnet die Schnittstelle mit
 * Laufprotokoll, `?o=neu` das Einrichten. Nur ADM (`schnittstelle:admin`).
 */
import { Datenliste, Icon, type Spalte } from '../../ui/index.ts';
import { useSchnittstellen, type Schnittstelle } from './api.ts';
import { LaufStand } from './LaufStand.tsx';
import { SchnittstelleDrawer } from './SchnittstelleDrawer.tsx';
import type { SchnittstellenSearch, SetSchnittstellenSearch } from './search.ts';
import { TX } from './texte.ts';
import './schnittstellen.css';

const SPALTEN: Spalte<Schnittstelle>[] = [
  { key: 'name', titel: TX.s.spalte.name, art: 'name', zelle: s => s.name },
  { key: 'richtung', titel: TX.s.spalte.richtung, zelle: s => TX.s.richtung[s.richtung] ?? s.richtung },
  { key: 'rhythmus', titel: TX.s.spalte.rhythmus, zelle: s => TX.s.rhythmus[s.rhythmus] ?? s.rhythmus },
  { key: 'lauf', titel: TX.s.spalte.lauf, karte: true, zelle: s => <LaufStand l={s.letzterLauf} /> },
  { key: 'aktiv', titel: TX.s.spalte.aktiv, karte: true, zelle: s => (s.aktiv ? TX.s.aktivJa : <span className="empty">{TX.s.inaktiv}</span>) },
];

export function SchnittstellenPage({ search, setSearch }: { search: SchnittstellenSearch; setSearch: SetSchnittstellenSearch }) {
  const q = useSchnittstellen();
  const items = q.data?.items ?? [];
  const katalog = q.data?.katalog ?? [];
  const frei = katalog.some(k => !items.some(s => s.umsystem === k.umsystem && s.daten === k.daten));
  const einrichten = (primary: boolean) => (
    <button type="button" className={`btn${primary ? ' primary' : ''}`} onClick={() => setSearch({ o: 'neu' })}><Icon name="plus" />{TX.aktion.einrichten}</button>
  );
  return (
    <section aria-labelledby="page-title">
      <header className="mh">
        <div className="mh-row">
          <div className="mh-title">
            <div className="type-ico neutral"><Icon name="plug" /></div>
            <div className="minw0">
              <h1 id="page-title">{TX.s.title}</h1>
              <div className="sub">{TX.s.sub}</div>
            </div>
          </div>
          {items.length && frei ? <div className="acts">{einrichten(false)}</div> : null}
        </div>
      </header>
      <div className="body">
        <Datenliste<Schnittstelle> titel={TX.s.tabelle} spalten={SPALTEN} zeilen={q.data?.items} schluessel={s => s.id}
          oeffnen={s => setSearch({ o: s.id })} aktuell={search.o} laedt={q.isPending} fehler={q.error} erneut={() => void q.refetch()}
          leer={TX.s.empty} leerAktion={einrichten(true)} />
      </div>
      {search.o ? (
        <SchnittstelleDrawer id={search.o} schnittstellen={items} katalog={katalog} laedt={q.isPending}
          onClose={() => setSearch({ o: undefined })} onOpen={id => setSearch({ o: id }, { replace: true })} />
      ) : null}
    </section>
  );
}
