/**
 * «Meine Ideen» im Arbeitsraum Portfolio › Ideen (K4 «Stand verfolgen», BC DM.01.01): Antragstellende sehen nur ihre
 * eigenen Ideen mit Stand und letztem Ereignis, Entwürfe mit «Weiter bearbeiten», Ideen in Ergänzung mit den offenen
 * Rückfragen. Seitentyp Liste (Zeile öffnet die Idee), Zustände Z1, Z2 (mit «Projektidee einreichen»), Z5. Mit
 * `eingereicht` die eingereichten Ideen aller Mitglieder (Master Entscheid 14, AP-E8-3); den Pool der UE zeigt `PoolSeite`.
 */
import { useId, type ReactNode } from 'react';
import { Datenliste, fmtDatum, Icon, type Spalte } from '../../ui/index.ts';
import { useEigeneIdeen, useEingereichteIdeen, type IdeeZeile } from './api.ts';
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

export function IdeenPage({ gehe, eingereicht = false, ansichten }: { gehe: Gehe; eingereicht?: boolean; ansichten?: ReactNode }) {
  const titleId = useId();
  const eigene = useEigeneIdeen(!eingereicht);
  const alle = useEingereichteIdeen(eingereicht);
  const list = eingereicht ? alle : eigene;
  const T = eingereicht ? TI.alleEingereichten : TI;
  const items = list.data?.pages.flatMap(p => p.items) ?? [];
  const einreichen = <Verweis pfad={ideeNeuPfad()} gehe={gehe} className="btn primary"><Icon name="plus" />{TI.einreichen}</Verweis>;
  return (
    <section aria-labelledby={titleId}>
      <header className="mh">
        <div className="mh-row">
          <div className="mh-title">
            <div className="type-ico neutral"><Icon name="grid" /></div>
            <div className="minw0">
              <h1 id={titleId}>{T.titel}</h1>
              <div className="sub">{T.sub}</div>
            </div>
          </div>
          <div className="acts">{einreichen}</div>
        </div>
        {ansichten}
      </header>
      <div className="body">
        <Datenliste<IdeeZeile> titel={T.titel} spalten={spalten} zeilen={items} schluessel={i => String(i.nummer)}
          name={i => `${i.titel || TI.ohneTitel}, ${TI.stand[i.stand] ?? i.stand}`}
          oeffnen={i => gehe(ideePfad(i.nummer))} laedt={list.isPending} fehler={list.error} erneut={() => void list.refetch()}
          leer={T.leer} leerAktion={eingereicht ? undefined : einreichen}
          mehr={{ vorhanden: list.hasNextPage, laedt: list.isFetchingNextPage, laden: () => void list.fetchNextPage() }} />
      </div>
    </section>
  );
}
