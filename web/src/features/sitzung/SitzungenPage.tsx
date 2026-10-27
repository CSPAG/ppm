/**
 * Einstieg «Gremien › Sitzungen» (UI-33, UC-006 Schritt 1; K3): je entscheidendem Gremium, dessen Sitzungen die Person
 * sieht, die nächsten Termine mit Stand und Zahl der Traktanden. Ein Termin öffnet die Sitzung
 * (`/gremien/<kuerzel>/sitzungen/<datum>`, I-N5). Gremien ohne Recht entfallen (I-N2).
 */
import { Empty, ErrorState, Icon, Loading, Stand, fmtDatum } from '../../ui/index.ts';
import { useGremien, useSitzungsliste, type Gremium } from './api.ts';
import { sitzungPfad } from './search.ts';
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

export function SitzungenPage({ gehe }: { gehe(pfad: string): void }) {
  const gremien = useGremien();
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
        </div>
      </header>
      <div className="body sz-uebersicht">
        {gremien.isPending ? <Loading /> : gremien.error ? <ErrorState error={gremien.error} onRetry={() => void gremien.refetch()} />
          : !gremien.data.length ? <Empty>{TS.keineGremien}</Empty>
          : gremien.data.map(g => <GremiumSitzungen key={g.id} g={g} gehe={gehe} />)}
      </div>
    </section>
  );
}
