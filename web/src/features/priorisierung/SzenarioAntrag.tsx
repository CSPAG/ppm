/**
 * Antrag ans Gremium (AP-E5-5; UC-008 Schritte 7–8, A2; K5 Schritte 7–8) im Szenario: Folgeentscheid je laufendem Projekt
 * unter der Wasserlinie beantragen («Zurückstellen», «Sistieren», «Abbrechen») und «Für das Gremium traktandieren» (K3).
 * Die Sperre ohne Antrag oder ohne Folgeentscheid kommt mit Regel, Ist-Wert und Ausweg vom Server (I-P2); nach dem
 * Entscheid nur lesen. Bearbeiten nur ab 1024 px (K5 «Mobil»).
 */
import { useId, useState } from 'react';
import { isConflict } from '../../api/index.ts';
import { ErrorState, Hinweis, Icon, Skelett, useToast, useVerzoegert } from '../../ui/index.ts';
import { useEntscheid, useEntscheidMutations, type Folge } from './EntscheidApi.ts';
import { TE } from './EntscheidTexte.ts';
import type { Szenario } from './SzenarioApi.ts';

const FOLGEN: Folge[] = ['zurueckstellen', 'sistieren', 'abbrechen'];
type Entwurf = Record<string, { folge: Folge | ''; begruendung: string }>;

export function SzenarioAntrag({ s, breit }: { s: Szenario; breit: boolean }) {
  const titelId = useId();
  const q = useEntscheid(s.id);
  const m = useEntscheidMutations(s);
  const toast = useToast();
  const [entwurf, setEntwurf] = useState<Entwurf | null>(null);
  const [konflikt, setKonflikt] = useState(false);
  const skelett = useVerzoegert(q.isPending);

  const kopf = <h2 id={titelId} className="grp-h"><Icon name="doc" /> {TE.titel}</h2>;
  if (q.isPending) return skelett ? <section aria-labelledby={titelId}>{kopf}<Skelett zeilen={3} /></section> : null;
  if (q.error) return <section aria-labelledby={titelId}>{kopf}<ErrorState error={q.error} onRetry={() => void q.refetch()} /></section>;
  const e = q.data;
  const entschieden = e.stand === 'entschieden';
  const darf = e.can.write && breit;
  const server: Entwurf = Object.fromEntries(e.unterWasserlinie.map(u => [u.projektId, { folge: u.folge ?? '', begruendung: u.begruendung }]));
  const sicht = entwurf ?? server;
  const geaendert = !!entwurf && e.unterWasserlinie.some(u => sicht[u.projektId]!.folge !== server[u.projektId]!.folge || sicht[u.projektId]!.begruendung !== server[u.projektId]!.begruendung);
  const setzen = (id: string, teil: Partial<Entwurf[string]>) => setEntwurf({ ...sicht, [id]: { ...sicht[id]!, ...teil } });

  const fehler = (x: unknown) => { if (isConflict(x)) setKonflikt(true); else toast.error(x); };
  const speichern = () => {
    const war = e.traktandiert;
    m.folgen.mutate(
      e.unterWasserlinie.flatMap(u => { const f = sicht[u.projektId]!; return f.folge ? [{ projektId: u.projektId, folge: f.folge, begruendung: f.begruendung.trim() }] : []; }),
      { onSuccess: neu => { setEntwurf(null); toast.show(war && !neu.traktandiert ? TE.zurueckgenommen : TE.gespeichert); }, onError: fehler },
    );
  };
  const traktandieren = () => m.traktandieren.mutate(undefined, { onSuccess: t => toast.show(TE.traktandiert(t.titel)), onError: fehler });

  return (
    <section className="sz-antrag" aria-labelledby={titelId}>
      {kopf}
      {entschieden ? <Hinweis stufe="hinweis">{TE.entschieden}</Hinweis> : null}
      {!entschieden && !e.can.write ? <Hinweis stufe="hinweis">{TE.nurLesen}</Hinweis> : null}
      {konflikt ? (
        <Hinweis stufe="warnung" live aktion={<button type="button" className="btn" onClick={() => { setKonflikt(false); setEntwurf(null); void q.refetch(); }}>{TE.neuLaden}</button>}>{TE.konflikt}</Hinweis>
      ) : null}
      <h3 className="sz-h3">{TE.folgenTitel}</h3>
      {e.unterWasserlinie.length ? (
        <>
          {darf && !entschieden ? <p className="note">{TE.folgenSub}</p> : null}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- beschriftete, scrollbare Region (WCAG 2.1.1) */}
          <div className="sz-scroll" tabIndex={0} role="region" aria-label={TE.folgenTitel}>
            <table className="sz-tab">
              <thead>
                <tr><th scope="col">{TE.projekt}</th><th scope="col">{TE.phase}</th><th scope="col">{TE.folge}</th><th scope="col">{TE.begruendung}</th></tr>
              </thead>
              <tbody>
                {e.unterWasserlinie.map(u => {
                  const f = sicht[u.projektId]!;
                  return (
                    <tr key={u.projektId}>
                      <th scope="row"><span className="mono">{u.nummer}</span> {u.name}</th>
                      <td>{u.phase}</td>
                      <td>
                        {darf && !entschieden ? (
                          <select className="pr-in" aria-label={TE.folgeLabel(u.nummer)} value={f.folge} onChange={x => setzen(u.projektId, { folge: x.target.value as Folge | '' })}>
                            <option value="">{TE.waehlen}</option>
                            {FOLGEN.map(k => <option key={k} value={k}>{TE.FOLGE[k]}</option>)}
                          </select>
                        ) : f.folge ? TE.FOLGE[f.folge] : <span className="muted">{TE.offen}</span>}
                      </td>
                      <td>
                        {darf && !entschieden ? (
                          <input className="pr-in sz-begr" aria-label={TE.begruendungLabel(u.nummer)} maxLength={1000} value={f.begruendung}
                            onChange={x => setzen(u.projektId, { begruendung: x.target.value })} />
                        ) : f.begruendung}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {darf && !entschieden ? (
            <div className="sz-acts">
              <button type="button" className="btn" disabled={!geaendert || m.folgen.isPending} onClick={speichern}>{TE.speichern}</button>
            </div>
          ) : null}
        </>
      ) : <p className="note">{TE.keineFolgen}</p>}
      {!entschieden ? (
        <>
          {e.stand !== 'beantragt' ? <Hinweis stufe="hinweis">{TE.nurAntrag}</Hinweis> : null}
          {e.stand === 'beantragt' ? e.pruefung.map(p => <Hinweis key={p} stufe="sperre">{p}</Hinweis>) : null}
          {e.traktandiert ? <Hinweis stufe="hinweis">{TE.istTraktandiert}</Hinweis> : null}
          {darf && e.stand === 'beantragt' ? (
            <div className="sz-acts">
              <button type="button" className="btn primary" disabled={!e.traktandierbar || geaendert || m.traktandieren.isPending} onClick={traktandieren}>
                <Icon name="send" />{e.traktandiert ? TE.aktualisieren : TE.traktandieren}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
