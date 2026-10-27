/**
 * Seite «Codetabellen» in der Administration (UI-45, UC-017 Schritt 2, BC AM.02.02), Seitentyp Liste + Schublade: die
 * festen Codetabellen mit Anzahl Werte; `?o=<tabelle>` öffnet die Werte. Leer beim ersten Mal: «Vorgabe laden» (Z2).
 */
import { useState } from 'react';
import { newIdempotencyKey } from '../../api/index.ts';
import { useSession } from '../../auth/index.ts';
import { Datenliste, Icon, useToast, type Spalte } from '../../ui/index.ts';
import { CodetabelleDrawer } from './CodetabelleDrawer.tsx';
import { useCodeMutations, useCodetabellen, type Codetabelle } from './api.ts';
import type { CodetabellenSearch, SetCodetabellenSearch } from './search.ts';
import { TS } from './texte.ts';

const SPALTEN: Spalte<Codetabelle>[] = [
  { key: 'label', titel: TS.code.tabelle, art: 'name', zelle: t => t.label },
  { key: 'beschreibung', titel: TS.code.beschreibung, karte: true, zelle: t => t.beschreibung },
  { key: 'anzahl', titel: TS.code.werte, art: 'zahl', karte: true, zelle: t => TS.code.anzahl(t.anzahlAktiv, t.anzahl) },
];

export function CodetabellenPage({ search, setSearch }: { search: CodetabellenSearch; setSearch: SetCodetabellenSearch }) {
  const { can } = useSession();
  const toast = useToast();
  const q = useCodetabellen();
  // Die Vorgabe gehört zu keiner einzelnen Tabelle; der Schlüssel der ersten genügt für den Hook
  const { vorgabe } = useCodeMutations('projektstatus');
  const [key, setKey] = useState(newIdempotencyKey);
  const canWrite = can('stammdaten:write');
  const items = q.data?.items ?? [];
  const leer = items.length > 0 && items.every(t => t.anzahl === 0);
  const laden = () => vorgabe.mutate({ key }, {
    onSuccess: r => { toast.show(TS.code.vorgabeGeladen(r.angelegt)); setKey(newIdempotencyKey()); },
    onError: e => toast.error(e),
  });
  const ladenKnopf = (primary: boolean) => (
    <button type="button" className={`btn${primary ? ' primary' : ''}`} onClick={laden} disabled={vorgabe.isPending} title={TS.code.vorgabeHint}>
      <Icon name="layers" />{TS.code.vorgabe}
    </button>
  );

  return (
    <section aria-labelledby="page-title">
      <header className="mh">
        <div className="mh-row">
          <div className="mh-title">
            <div className="type-ico neutral"><Icon name="table" /></div>
            <div className="minw0">
              <h1 id="page-title">{TS.code.title}</h1>
              <div className="sub">{TS.code.sub}</div>
            </div>
          </div>
          {canWrite && !leer ? <div className="acts">{ladenKnopf(false)}</div> : null}
        </div>
      </header>
      <div className="body">
        {leer ? (
          <div className="emptystate">
            <Icon name="table" />
            <div>{TS.code.empty}</div>
            {canWrite ? <>{ladenKnopf(true)}<p className="hint">{TS.code.vorgabeHint}</p></> : <p className="note">{TS.code.noRight}</p>}
          </div>
        ) : null}
        <Datenliste<Codetabelle> titel={TS.code.title} spalten={SPALTEN} zeilen={items} schluessel={t => t.schluessel}
          oeffnen={t => setSearch({ o: t.schluessel })} aktuell={search.o} laedt={q.isPending} fehler={q.error} erneut={() => void q.refetch()}
          leer={TS.code.empty} />
      </div>
      {search.o ? <CodetabelleDrawer schluessel={search.o} tabellen={items} laedt={q.isPending} onClose={() => setSearch({ o: undefined })} /> : null}
    </section>
  );
}
