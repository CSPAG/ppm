/**
 * Administration › Zugänge › Neubesetzung (UC-016 A1, Ziel der Aufgabe «Rollen von ‹Person› neu besetzen»): Rollen der
 * Person, die neu zu besetzen sind, mit Stand aus den Tupeln und Weg zum Ort, wo sie vergeben werden; offene Aufgaben,
 * die noch an die Person gehen. Erledigt wird die Aufgabe im Eingang (von Hand, sobald alles neu besetzt ist).
 */
import { useId } from 'react';
import { Datenliste, ErrorState, fmtDatum, fmtFrist, Hinweis, Icon, Skelett, Stand, useVerzoegert, type Spalte } from '../../ui/index.ts';
import { useNeubesetzung, useOrt, type NeuRolle } from './api.ts';
import { Z } from './texte.ts';
import { OrtName, Ziel, type Gehe } from './teile.tsx';
import './zugang.css';

function OrtLink({ r, gehe }: { r: NeuRolle; gehe: Gehe }) {
  const ort = useOrt(r.ort.typ, r.ort.id);
  return ort.data?.pfad
    ? <Ziel pfad={ort.data.pfad} gehe={gehe} className="btn sm">{Z.detail.oeffnen}</Ziel>
    : null;
}

export function NeubesetzungPage({ id, gehe }: { id: string; gehe: Gehe }) {
  const titleId = useId();
  const rollenId = useId();
  const aufgabenId = useId();
  const q = useNeubesetzung(id);
  const skelett = useVerzoegert(q.isPending);
  const d = q.data;

  const spalten: Spalte<NeuRolle>[] = [
    { key: 'ort', titel: Z.detail.ort, art: 'name', karte: true, zelle: r => <OrtName typ={r.ort.typ} id={r.ort.id} /> },
    { key: 'rolle', titel: Z.detail.rolle, karte: true, zelle: r => r.rolleName },
    { key: 'stand', titel: Z.detail.stand, karte: true, zelle: r => <Stand familie={r.besetzt ? 'positiv' : 'wartet'} label={r.besetzt ? Z.detail.besetzt : Z.detail.offen} /> },
    { key: 'akt', titel: Z.detail.aktion, karte: true, zelle: r => <OrtLink r={r} gehe={gehe} /> },
  ];

  if (q.error) {
    return (
      <section className="body">
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        <p><Ziel pfad="/administration/zugaenge" gehe={gehe}>{Z.detail.zurueck}</Ziel></p>
      </section>
    );
  }

  return (
    <section aria-labelledby={titleId} aria-busy={q.isPending}>
      <header className="mh">
        <div className="mh-row">
          <div className="mh-title">
            <div className="type-ico neutral"><Icon name="user" /></div>
            <div className="minw0">
              <h1 id={titleId}>{d ? Z.detail.titel(d.neubesetzung.person.name) : Z.titel}</h1>
              {d ? <div className="sub">{Z.detail.sub(fmtDatum(d.neubesetzung.entzogenAt.slice(0, 10)), d.neubesetzung.entzogenVon?.name ?? null)}</div> : null}
            </div>
          </div>
          <div className="acts"><Ziel pfad="/administration/zugaenge" gehe={gehe} className="btn">{Z.detail.zurueck}</Ziel></div>
        </div>
      </header>
      <div className="body">
        {!d ? (skelett ? <Skelett zeilen={4} /> : null) : (
          <>
            {d.neubesetzung.erledigt
              ? <Hinweis stufe="hinweis">{Z.detail.erledigt}</Hinweis>
              : <Hinweis stufe="hinweis" aktion={<Ziel pfad="/eingang" gehe={gehe} className="btn sm">{Z.detail.zumEingang}</Ziel>}>{Z.detail.offenHint}</Hinweis>}
            <section aria-labelledby={rollenId} className="zg-sektion">
              <h2 id={rollenId}>{Z.detail.rollen}</h2>
              <Datenliste<NeuRolle> titel={Z.detail.rollen} spalten={spalten} zeilen={d.rollen} schluessel={r => `${r.ort.typ}:${r.ort.id}:${r.rolle}`}
                laedt={false} leer={Z.detail.rollenLeer} />
            </section>
            <section aria-labelledby={aufgabenId} className="zg-sektion">
              <h2 id={aufgabenId}>{Z.detail.aufgaben}</h2>
              {d.aufgaben.length ? (
                <>
                  <p className="hint">{Z.detail.aufgabenHint}</p>
                  <ul className="zg-liste">
                    {d.aufgaben.map(a => (
                      <li key={a.id}>
                        <Ziel pfad={a.link} gehe={gehe}>{a.titel}</Ziel>
                        {a.kontext ? <span className="muted"> · {a.kontext}</span> : null}
                        {a.frist ? <span className="muted"> · {fmtFrist(a.frist)}</span> : null}
                      </li>
                    ))}
                  </ul>
                </>
              ) : <p className="muted">{Z.detail.aufgabenLeer}</p>}
            </section>
          </>
        )}
      </div>
    </section>
  );
}
