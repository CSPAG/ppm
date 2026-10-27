/**
 * Portfolio-Roadmap (UI-31, K6 Schritt 8; UC-011 Schritt 8; BC PP.04.03). Seitentyp Bericht unter
 * `/portfolio/roadmap?jahr=2027`: je Handlungsfeld die strategischen Ziele mit Jahreszielen, Metrik, Zielwert,
 * Hauptaktivitäten und beitragenden Projekten (Stand bei Publikation). Lesen alle angemeldeten Personen (A-35,
 * UX-OF-14); die UE (ziel:freigabe) sieht die Vorschau mit Wirkung und publiziert (I-R1 Stufe 3).
 */
import { useId } from 'react';
import './Freigabe.css';
import { useSession } from '../../auth/index.ts';
import { Empty, ErrorState, Hinweis, Icon, PhaseKurz, Skelett, useToast, useVerzoegert, type Phase } from '../../ui/index.ts';
import { usePublizieren, useRoadmap, useRoadmapListe, useRoadmapVorschau, type RoadmapInhalt } from './RoadmapApi.ts';
import type { RoadmapSearch, SetRoadmapSearch } from './RoadmapSearch.ts';
import { TR } from './RoadmapTexte.ts';

export interface RoadmapPageProps {
  search: RoadmapSearch;
  setSearch: SetRoadmapSearch;
  /** Projektakte öffnen (`/projekte/<nummer>`). */
  projektOeffnen(nummer: string): void;
}

export function RoadmapPage({ search, setSearch, projektOeffnen }: RoadmapPageProps) {
  const { can } = useSession();
  const darfPublizieren = can('ziel:freigabe');
  const jahrId = useId();
  const liste = useRoadmapListe();
  // Vorgabe: neueste publizierte Roadmap, sonst der Zielzyklus des Folgejahres
  const jahr = search.jahr ? Number(search.jahr) : liste.data?.[0]?.jahr ?? (liste.isPending ? undefined : new Date().getFullYear() + 1);
  const roadmap = useRoadmap(jahr);
  const vorschauAktiv = darfPublizieren && search.ansicht === 'vorschau' && jahr !== undefined;
  const vorschau = useRoadmapVorschau(jahr ?? 0, vorschauAktiv);
  const verzoegert = useVerzoegert(liste.isPending || roadmap.isPending);
  const jahre = [...new Set([...(liste.data ?? []).map(r => r.jahr), ...(jahr ? [jahr] : [])])].sort((a, b) => b - a);

  return (
    <section aria-labelledby="page-title" className="rm">
      <header className="mh">
        <div className="mh-row">
          <div className="mh-title">
            <div className="type-ico neutral"><Icon name="layers" /></div>
            <div className="minw0">
              <h1 id="page-title">{jahr ? TR.titel(jahr) : TR.bereich}</h1>
              <div className="sub">{roadmap.data ? TR.publiziert(roadmap.data.publiziertAt as string) : roadmap.data === null ? TR.nichtPubliziert : null}</div>
            </div>
          </div>
          {darfPublizieren && jahr && !vorschauAktiv
            ? <div className="acts"><button type="button" className="btn primary" onClick={() => setSearch({ ansicht: 'vorschau' })}><Icon name="send" />{TR.publizieren}</button></div>
            : null}
        </div>
      </header>
      <div className="toolbar">
        <label htmlFor={jahrId} className="muted">{TR.jahr}</label>
        <select id={jahrId} className="rm-jahr" value={jahr ?? ''} onChange={e => setSearch({ jahr: e.target.value, ansicht: undefined })}>
          {jahre.map(j => <option key={j} value={j}>{j}</option>)}
        </select>
      </div>
      {/* scrollbar auch ohne Eingabefelder (nur lesen) mit der Tastatur erreichbar (axe scrollable-region-focusable) */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- beschriftete, scrollbare Region (WCAG 2.1.1) */}
      <div className="body pad" tabIndex={0} role="region" aria-label={TR.inhalt(jahr ?? null)}>
        {vorschauAktiv && jahr ? <Vorschau jahr={jahr} q={vorschau} onFertig={() => setSearch({ ansicht: undefined })} projektOeffnen={projektOeffnen} />
          : liste.isPending || roadmap.isPending ? (verzoegert ? <Skelett zeilen={8} /> : null)
          : liste.error || roadmap.error ? <ErrorState error={liste.error ?? roadmap.error} onRetry={() => { void liste.refetch(); void roadmap.refetch(); }} />
          : roadmap.data ? <Inhalt inhalt={roadmap.data.inhalt} projektOeffnen={projektOeffnen} />
          : <Empty>{TR.leer(jahr!)}{darfPublizieren ? <> {TR.leerUe}</> : null}</Empty>}
      </div>
    </section>
  );
}

function Vorschau({ jahr, q, onFertig, projektOeffnen }: {
  jahr: number; q: ReturnType<typeof useRoadmapVorschau>; onFertig(): void; projektOeffnen(nr: string): void;
}) {
  const toast = useToast();
  const m = usePublizieren(jahr);
  if (q.isPending) return <Skelett zeilen={8} />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const v = q.data;
  return (
    <>
      <h2 className="grp-h"><Icon name="eye" /> {TR.vorschau}</h2>
      {v.can.publizieren
        ? <Hinweis stufe="warnung" aktion={<span className="acts">
            <button type="button" className="btn" onClick={onFertig}>{TR.abbrechen}</button>
            <button type="button" className="btn primary" disabled={m.isPending}
              onClick={() => m.mutate(undefined, { onSuccess: () => { toast.show(TR.publiziertToast(jahr)); onFertig(); }, onError: e => toast.error(e) })}>
              <Icon name="send" />{TR.publizieren}
            </button>
          </span>}>
            {TR.wirkung(jahr)}{v.publiziertAt ? ` ${TR.ersetzt(v.publiziertAt as string)}` : ''}
          </Hinweis>
        : <Hinweis stufe="sperre" aktion={<button type="button" className="btn" onClick={onFertig}>{TR.abbrechen}</button>}>{TR.nichtInKraft(jahr)}</Hinweis>}
      <Inhalt inhalt={v.inhalt} projektOeffnen={projektOeffnen} />
    </>
  );
}

/** Inhalt: je Handlungsfeld die strategischen Ziele mit Tabelle der Jahresziele (mobil Karten, I-L6). */
function Inhalt({ inhalt, projektOeffnen }: { inhalt: RoadmapInhalt; projektOeffnen(nr: string): void }) {
  const projekte = (liste: RoadmapInhalt['handlungsfelder'][number]['ziele'][number]['projekte']) => (liste.length ? (
    <ul className="rm-liste">
      {liste.map(p => (
        <li key={p.nummer}>
          <button type="button" className="linkbtn" aria-label={TR.projektOeffnen(p.nummer, p.name)} onClick={() => projektOeffnen(p.nummer)}><span className="mono">{p.nummer}</span> {p.name}</button>
          {' '}<PhaseKurz phase={p.phase as Phase} />
        </li>
      ))}
    </ul>
  ) : TR.keine);
  if (!inhalt.handlungsfelder.length) return <Empty>{TR.keineZiele}</Empty>;
  return (
    <>
      {inhalt.handlungsfelder.map(h => (
        <section key={h.id} className="rm-feld" aria-labelledby={`rm-${h.id}`}>
          <h2 id={`rm-${h.id}`}>{h.label}</h2>
          {h.ziele.map(z => (
            <div key={z.nummer} className="rm-ziel">
              <h3>{z.nummer} {z.text}</h3>
              {z.jahresziele.length ? (
                <div className="rm-tabelle-wrap">
                  <table className="rm-tabelle">
                    <thead><tr><th scope="col">{TR.jahresziel}</th><th scope="col">{TR.metrik}</th><th scope="col">{TR.zielwert}</th><th scope="col">{TR.hauptaktivitaeten}</th><th scope="col">{TR.projekte}</th></tr></thead>
                    <tbody>
                      {z.jahresziele.map(j => (
                        <tr key={j.nummer}>
                          <td><span className="mono">{j.nummer}</span> {j.text}</td>
                          <td>{j.metrik || TR.keine}</td>
                          <td>{j.zielwert || TR.keine}</td>
                          <td>{j.hauptaktivitaeten.length ? <ul className="rm-liste">{j.hauptaktivitaeten.map((a, i) => <li key={i}>{a.text}{a.verantwortlich ? <span className="muted small"> · {TR.verantwortlich(a.verantwortlich)}</span> : null}</li>)}</ul> : TR.keine}</td>
                          <td>{projekte(j.projekte)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {z.projekte.length ? <p className="small">{TR.ohneJahresziel}:</p> : null}
              {z.projekte.length ? projekte(z.projekte) : null}
            </div>
          ))}
        </section>
      ))}
    </>
  );
}
