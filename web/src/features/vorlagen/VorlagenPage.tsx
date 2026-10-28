/**
 * Seite «Vorlagen» in der Administration (UI-48; UC-018 Schritt 1; BC AM.03.01), Seitentyp Liste + Schublade: alle
 * Dokumentarten mit der heute gültigen Vorlage (Grundbestand oder eigene Version), Anzahl Versionen und Entwürfe und
 * ob ein Modul Daten liefert. `?o=<art>` öffnet die Schublade mit Versionen und Zuordnung (`VorlageDrawer`).
 */
import { Datenliste, Icon, Stand, type Spalte } from '../../ui/index.ts';
import { useVorlagen, type VorlageArt } from './api.ts';
import type { SetVorlagenSearch, VorlagenSearch } from './search.ts';
import { TV } from './texte.ts';
import { VorlageDrawer } from './VorlageDrawer.tsx';
import './vorlagen.css';

const gilt = (a: VorlageArt) => (a.aktiv ? TV.eigene(a.aktiv) : a.grundbestand ? TV.grundbestand(a.grundbestand.version) : TV.keine);

const SPALTEN: Spalte<VorlageArt>[] = [
  { key: 'art', titel: TV.art, art: 'name', zelle: a => a.name },
  { key: 'gilt', titel: TV.gilt, karte: true, zelle: a => (a.aktiv || a.grundbestand ? gilt(a) : <span className="muted">{TV.keine}</span>) },
  { key: 'versionen', titel: TV.versionen, art: 'zahl', karte: true, zelle: a => TV.anzahl(a.versionen, a.entwuerfe) },
  { key: 'daten', titel: TV.datenquelle, karte: true, zelle: a => (a.datenquelle ? TV.liefert : <Stand familie="ruhend" label={TV.vorbereitet} />) },
];

export function VorlagenPage({ search, setSearch }: { search: VorlagenSearch; setSearch: SetVorlagenSearch }) {
  const q = useVorlagen();
  const items = q.data ?? [];
  return (
    <section aria-labelledby="page-title">
      <header className="mh">
        <div className="mh-row">
          <div className="mh-title">
            <div className="type-ico neutral"><Icon name="doc" /></div>
            <div className="minw0">
              <h1 id="page-title">{TV.title}</h1>
              <div className="sub">{TV.sub}</div>
            </div>
          </div>
        </div>
      </header>
      <div className="body">
        <Datenliste<VorlageArt> titel={TV.title} spalten={SPALTEN} zeilen={items} schluessel={a => a.art} name={a => a.name}
          oeffnen={a => setSearch({ o: a.art, v: undefined })} aktuell={search.o} laedt={q.isPending} fehler={q.error} erneut={() => void q.refetch()}
          leer={TV.leer} />
      </div>
      {search.o ? (
        <VorlageDrawer art={search.o} version={search.v ?? null} arten={items} laedt={q.isPending}
          onVersion={v => setSearch({ v }, { replace: true })} onClose={() => setSearch({ o: undefined, v: undefined })} />
      ) : null}
    </section>
  );
}
