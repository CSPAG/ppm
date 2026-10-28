/**
 * Einstieg «Gremien › Sitzungen» (UI-33, UC-006 Schritt 1; K3): je entscheidendem Gremium, dessen Sitzungen die Person
 * sieht, die nächsten Termine mit Stand und Zahl der Traktanden. Ein Termin öffnet die Sitzung
 * (`/gremien/<kuerzel>/sitzungen/<datum>`, I-N5). Gremien ohne Recht entfallen (I-N2). Das Gremium steht im Kopf und in
 * der Adresse (`/gremien/prat/sitzungen`, IA «Kontext im Kopf»); `/gremien/sitzungen` zeigt alle oder führt auf das
 * einzige bzw. zuletzt gewählte Gremium.
 */
import { useEffect } from 'react';
import { Empty, ErrorState, Icon, Loading, Stand, fmtDatum } from '../../ui/index.ts';
import { useGremien, useSitzungsliste, type Gremium } from './api.ts';
import { GremiumWahl, gremiumMerken, vorgabeGremium } from './GremiumWahl.tsx';
import { gremiumSitzungenPfad, sitzungPfad } from './search.ts';
import { standFamilie } from './Traktandenliste.tsx';
import { TS } from './texte.ts';
import './sitzung.css';

function GremiumSitzungen({ g, gehe }: { g: Gremium; gehe(pfad: string): void }) {
  const q = useSitzungsliste(g.kuerzel);
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (!q.data) return null;
  const kurz = g.kuerzel.toUpperCase();
  return (
    <section className="sz-gremium" aria-labelledby={`sz-g-${g.id}`}>
      <h2 id={`sz-g-${g.id}`} className="sz-h">{kurz} <span className="sz-sub">{g.name}</span></h2>
      {q.data.items.length ? (
        <ul className="sz-termine">
          {q.data.items.map(s => (
            <li key={s.datum}>
              <button type="button" className="sz-termin" onClick={() => gehe(sitzungPfad(g.kuerzel, s.datum))} aria-label={TS.oeffnen(kurz, fmtDatum(s.datum))}>
                <Icon name="calendar" />
                <span className="sz-termin-d">{fmtDatum(s.datum)}</span>
                <Stand familie={standFamilie(s.stand)} label={TS.stand[s.stand] ?? s.stand} />
                <span className="sz-sub">{s.traktanden} {TS.spalten.traktanden}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="empty">{TS.keineTermine}</p>}
    </section>
  );
}

export function SitzungenPage({ kuerzel, gehe }: { kuerzel?: string; gehe(pfad: string, o?: { replace?: boolean }): void }) {
  const gremien = useGremien();
  const liste = gremien.data;
  const gewaehlt = kuerzel ? liste?.find(g => g.kuerzel === kuerzel) : undefined;
  // ohne Gremium in der Adresse: das einzige bzw. zuletzt gewählte setzen (ersetzt den Eintrag im Verlauf, I-N7)
  const vorgabe = !kuerzel && liste ? vorgabeGremium(liste) : undefined;
  useEffect(() => { if (vorgabe) gehe(gremiumSitzungenPfad(vorgabe), { replace: true }); }, [vorgabe, gehe]);
  useEffect(() => { if (gewaehlt) gremiumMerken(gewaehlt.kuerzel); }, [gewaehlt]);
  const sichtbar = kuerzel ? (gewaehlt ? [gewaehlt] : []) : liste ?? [];
  return (
    <section aria-labelledby="page-title">
      <header className="mh">
        <div className="mh-row">
          <div className="mh-title">
            <div className="type-ico neutral"><Icon name="gavel" /></div>
            <div className="minw0">
              <h1 id="page-title">{TS.title}</h1>
              <div className="sub">{TS.sub}</div>
            </div>
          </div>
          <div className="acts">
            <GremiumWahl gremien={liste} wert={kuerzel} onWahl={k => gehe(k ? gremiumSitzungenPfad(k) : '/gremien/sitzungen')} />
          </div>
        </div>
      </header>
      <div className="body sz-uebersicht">
        {gremien.isPending || vorgabe ? <Loading /> : gremien.error ? <ErrorState error={gremien.error} onRetry={() => void gremien.refetch()} />
          : !gremien.data.length ? <Empty>{TS.keineGremien}</Empty>
          : kuerzel && !gewaehlt ? (
            <Empty action={<button type="button" className="btn" onClick={() => { gremiumMerken(undefined); gehe('/gremien/sitzungen'); }}>{TS.zuAllenGremien}</button>}>{TS.gremiumUnbekannt}</Empty>
          )
          : sichtbar.map(g => <GremiumSitzungen key={g.id} g={g} gehe={gehe} />)}
      </div>
    </section>
  );
}
