/**
 * «Meine Ideen» im Arbeitsraum Portfolio › Ideen (K4 «Stand verfolgen», BC DM.01.01): Antragstellende sehen nur ihre
 * eigenen Ideen mit Stand und letztem Ereignis, Entwürfe mit «Weiter bearbeiten», Ideen in Ergänzung mit den offenen
 * Rückfragen. Seitentyp Liste (Zeile öffnet die Idee), Zustände Z1, Z2 (mit «Projektidee einreichen»), Z5. Der
 * Ideenpool der UE folgt mit AP-E4-2 (`Pool*`).
 */
import { useId } from 'react';
import { Datenliste, fmtDatum, Icon, type Spalte } from '../../ui/index.ts';
import { useEigeneIdeen, type IdeeZeile } from './api.ts';
import { ideePfad, IdeeStandBadge, Verweis, type Gehe } from './stand.tsx';
import { ideeNeuPfad } from './search.ts';
import { TI } from './texte.ts';
import './idee.css';

const spalten: Spalte<IdeeZeile>[] = [
  { key: 'titel', titel: TI.spalten.titel, art: 'name', zelle: i => i.titel || TI.ohneTitel },
  {
    key: 'stand', titel: TI.spalten.stand, karte: true,
    zelle: i => (
      <span className="idee-stand">
        <IdeeStandBadge stand={i.stand} standAt={i.standAt} updatedAt={i.updatedAt} />
        {i.stand === 'in_ergaenzung' && i.rueckfragenOffen ? <span className="idee-offen"><Icon name="warn" /> {TI.rueckfragenOffen(i.rueckfragenOffen)}</span> : null}
      </span>
    ),
  },
  { key: 'nummer', titel: TI.spalten.nummer, art: 'zahl', zelle: i => i.nummer },
  { key: 'geaendert', titel: TI.spalten.geaendert, karte: true, zelle: i => fmtDatum(i.updatedAt) },
];

export function IdeenPage({ gehe }: { gehe: Gehe }) {
  const titleId = useId();
  const list = useEigeneIdeen();
  const items = list.data?.pages.flatMap(p => p.items) ?? [];
  const einreichen = <Verweis pfad={ideeNeuPfad()} gehe={gehe} className="btn primary"><Icon name="plus" />{TI.einreichen}</Verweis>;
  return (
    <section aria-labelledby={titleId}>
      <header className="mh">
        <div className="mh-row">
          <div className="mh-title">
            <div className="type-ico neutral"><Icon name="grid" /></div>
            <div className="minw0">
              <h1 id={titleId}>{TI.titel}</h1>
              <div className="sub">{TI.sub}</div>
            </div>
          </div>
          {/* Kopf-Button nur mit Einträgen; die leere Liste bietet die erste Aktion selbst an (Z2) */}
          {items.length ? <div className="acts">{einreichen}</div> : null}
        </div>
      </header>
      <div className="body">
        <Datenliste<IdeeZeile> titel={TI.titel} spalten={spalten} zeilen={items} schluessel={i => String(i.nummer)}
          name={i => `${i.titel || TI.ohneTitel}, ${TI.stand[i.stand] ?? i.stand}`}
          oeffnen={i => gehe(ideePfad(i.nummer))} laedt={list.isPending} fehler={list.error} erneut={() => void list.refetch()}
          leer={TI.leer} leerAktion={einreichen}
          mehr={{ vorhanden: list.hasNextPage, laedt: list.isFetchingNextPage, laden: () => void list.fetchNextPage() }} />
      </div>
    </section>
  );
}
