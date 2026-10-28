/**
 * Projektakte › Vertrag › Gate (UI-08 Gate-Modus; Kernablauf K2 Schritte 1–4; BC PS.02.01, PS.02.05, PC.03.02; UC-003
 * Schritte 1–4, A2): Ziel der Aufgabe «Gate vorbereiten» (I-B1). Ohne Entwurf die Schaltfläche mit Wirkung «Entwurf für
 * Phase P2 anlegen: übernimmt Version 1.0 …» (UC-003 Schritt 2); mit Entwurf die Leitfragen des Gates je Wertestrom mit
 * Fortschritt, die Standard-Lieferergebnisse der Phase mit Stand, die fehlenden Angaben für die nächste Phase mit Sprung
 * zum Kapitel (K2-4) und ab dem Gate P2–P3 die Nutzenprüfung. Antworten speichern beim Verlassen des Felds (I-R3),
 * bestätigt durch den Server (I-R2); die Kapitel bearbeitet die PL in der Projektakte (UI-07).
 */
import { describeError } from '@vollholz/iam-web';
import { useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { isConflict, statusOf } from '../../api/index.ts';
import { Empty, ErrorState, fmtDatum, fmtGate, fmtPhase, Hinweis, Icon, Skelett, Stand, T, useToast, useVerzoegert, type Phase } from '../../ui/index.ts';
import { usePflichtangaben, useProjekt, useVertrag, type Version } from './api.ts';
import { gateKey, useGate, useGateMutations, useWertestroeme, type Gate, type Leitfrage } from './GateApi.ts';
import { TG } from './GateTexte.ts';
import { TV } from './texte.ts';
import './Gate.css';

const NAECHSTE: Partial<Record<Phase, Phase>> = { P0: 'P1', P1: 'P2', P2: 'P3', P3: 'P4' };
const kapitelLink = (nr: string, kapitel?: number) => `/projekte/${nr}/vertrag?version=entwurf${kapitel ? `&kapitel=${kapitel}` : ''}`;

export function GatePage({ nummer }: { nummer: string }) {
  const projekt = useProjekt(nummer);
  const vertrag = useVertrag(projekt.data?.id);
  const skelett = useVerzoegert(projekt.isPending || vertrag.isPending);
  if (projekt.isPending || (projekt.data && vertrag.isPending)) {
    return <div aria-busy="true"><span className="sr" role="status">{T.common.loading}</span>{skelett ? <Skelett zeilen={6} /> : null}</div>;
  }
  const fehler = projekt.error ?? vertrag.error;
  if (fehler) return <ErrorState error={fehler} onRetry={() => { void projekt.refetch(); void vertrag.refetch(); }} />;
  if (!projekt.data || !vertrag.data) return <Empty>{TG.keinEntwurf}</Empty>;
  const entwurf = vertrag.data.versionen.find(v => v.id === vertrag.data.entwurf);
  if (entwurf && entwurf.anlass === 'aenderung') return <Hinweis stufe="hinweis">{TG.andererEntwurf(entwurf.nummer)}</Hinweis>;
  if (entwurf) return <GateModus nummer={nummer} projektId={projekt.data.id} version={entwurf} />;
  const baseline = vertrag.data.versionen.find(v => v.baseline);
  return <Anlegen nummer={nummer} projektId={projekt.data.id} phase={projekt.data.phase as Phase} baseline={baseline ?? null} moeglich={vertrag.data.can.entwerfen.includes('gate')} />;
}

/** Kein Entwurf: Wirkung und «Entwurf für Phase ‹n› anlegen» (K2 Schritt 1, Zustand «Kein Entwurf»). */
function Anlegen({ nummer, projektId, phase, baseline, moeglich }: { nummer: string; projektId: string; phase: Phase; baseline: Version | null; moeglich: boolean }) {
  const id = useId();
  const toast = useToast();
  const { anlegen } = useGateMutations(projektId);
  const [key] = useState(() => crypto.randomUUID());
  const ziel = NAECHSTE[phase];
  if (!ziel || !baseline || !moeglich) return <section className="gm"><Hinweis stufe="hinweis">{TG.nichtMoeglich}</Hinweis></section>;
  const neu = `${['P0', 'P1', 'P2', 'P3', 'P4'].indexOf(ziel)}.0`;
  return (
    <section className="gm" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="vt-h">{TG.titel(fmtGate(phase, ziel))}</h2>
      <p>{TG.keinEntwurf}</p>
      <p className="small" id={`${id}-w`}>{TG.anlegenWirkung(baseline.nummer, baseline.baselineAt ? fmtDatum(baseline.baselineAt) : '–', neu)}</p>
      {anlegen.error ? <ErrorState error={anlegen.error} /> : null}
      <button type="button" className="btn primary" aria-describedby={`${id}-w`} disabled={anlegen.isPending}
        onClick={() => void anlegen.mutateAsync({ key }).then(l => toast.show(TG.angelegt(l.detail.version.nummer)), () => undefined)}>
        <Icon name="plus" />{TG.anlegen(ziel)}
      </button>
      <p><a className="btn sm" href={`/projekte/${nummer}/vertrag`}><Icon name="doc" />{TG.kapitelBearbeiten}</a></p>
    </section>
  );
}

function GateModus({ nummer, projektId, version }: { nummer: string; projektId: string; version: Version }) {
  const id = useId();
  const gate = useGate(version.id);
  const pflicht = usePflichtangaben(version.id);
  const ws = useWertestroeme();
  const skelett = useVerzoegert(gate.isPending);
  if (gate.isPending) return <div aria-busy="true"><span className="sr" role="status">{T.common.loading}</span>{skelett ? <Skelett zeilen={6} /> : null}</div>;
  if (gate.error) return <ErrorState error={gate.error} onRetry={() => void gate.refetch()} />;
  const g = gate.data;
  const label = (k: string) => ws.data?.get(k) ?? k;
  const fehlend = (pflicht.data?.angaben ?? []).filter(a => !a.erfuellt);
  const erreicht = g.lieferergebnisse.filter(l => l.erreichtAm).length;
  const offen = g.leitfragen.filter(f => !f.antwort);
  const gruppen = [...new Set(g.leitfragen.map(f => f.wertestrom))];
  const offenJe = gruppen.map(w => [label(w), offen.filter(f => f.wertestrom === w).length] as const).filter(([, n]) => n > 0);
  return (
    <section className="gm" aria-labelledby={`${id}-h`}>
      <header className="gm-kopf">
        <h2 id={`${id}-h`} className="vt-h">{TG.titel(fmtGate(g.gate.von, g.gate.nach))}</h2>
        <p className="small">{TG.version(g.nummer, fmtPhase(g.gate.nach))}</p>
        <Stand familie={g.stand === 'in_arbeit' ? 'entwurf' : g.stand === 'traktandiert' ? 'traktandiert' : g.stand === 'abgenommen' ? 'positiv' : 'wartet'} label={TV.stand[g.stand]} />
        <p className="small">
          {g.gremienweg ? <>{TG.gremium(g.gremienweg.gremium.kuerzel)}{g.gremienweg.viaSns ? ` · ${TG.viaSns}` : ''}</> : TG.keinGremium}
        </p>
        <p className="gm-summe">{TG.zusammenfassung(TG.vonGesamt(g.fortschritt.beantwortet, g.fortschritt.gesamt), TG.vonGesamt(erreicht, g.lieferergebnisse.length), fehlend.length)}</p>
        <a className="btn sm" href={kapitelLink(nummer)}><Icon name="doc" />{TG.kapitelBearbeiten}</a>
      </header>

      {g.entscheid ? <Hinweis stufe="hinweis">{g.entscheid.ergebnis === 'freigegeben' ? TG.entscheid.freigegeben(g.nummer, fmtPhase(g.gate.nach)) : TG.entscheid[g.entscheid.ergebnis]}</Hinweis> : null}
      {g.stand !== 'in_arbeit' ? <Hinweis stufe="hinweis">{TG.gesperrt(TV.stand[g.stand])}</Hinweis> : null}

      <div className="gm-flaeche">
        <section aria-labelledby={`${id}-l`} className="gm-block">
          <h3 id={`${id}-l`} className="grp-h">{TG.leitfragenFortschritt(g.fortschritt.beantwortet, g.fortschritt.gesamt)}</h3>
          {!g.leitfragen.length ? <p className="muted">{TG.keineLeitfragen}</p> : null}
          {g.can.antworten && offen.length ? (
            <Hinweis stufe="warnung">{TG.unbeantwortet(offen.length, g.leitfragen.length, offenJe.map(([l, n]) => `${l} ${n}`).join(', '))}</Hinweis>
          ) : null}
          {gruppen.map(w => {
            const fragen = g.leitfragen.filter(f => f.wertestrom === w);
            return (
              <details key={w} className="gm-ws" open>
                <summary>{label(w)} · {TG.vonGesamt(fragen.filter(f => f.antwort).length, fragen.length)}</summary>
                <ol className="gm-fragen">
                  {fragen.map(f => <li key={f.id}><LeitfrageFeld versionId={version.id} projektId={projektId} frage={f} darf={g.can.antworten} /></li>)}
                </ol>
              </details>
            );
          })}
        </section>

        <aside className="gm-panel">
          <section aria-labelledby={`${id}-e`} className="gm-block">
            <h3 id={`${id}-e`} className="grp-h">{TG.lieferergebnisse(g.gate.von)} · {TG.vonGesamt(erreicht, g.lieferergebnisse.length)}</h3>
            {g.lieferergebnisse.length ? (
              <ul className="gm-liste">
                {g.lieferergebnisse.map(l => (
                  <li key={`${l.art}-${l.text}`}>
                    <Icon name={l.erreichtAm ? 'check' : 'clock'} />
                    <span>{l.text}</span> <span className="small muted">{l.erreichtAm ? TG.erreicht(fmtDatum(l.erreichtAm)) : TG.offen}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="muted">{TG.keineErgebnisse}</p>}
          </section>
          <section aria-labelledby={`${id}-a`} className="gm-block">
            <h3 id={`${id}-a`} className="grp-h">{TG.angaben}</h3>
            {pflicht.isPending ? <p className="muted">{T.common.loading}</p> : fehlend.length ? (
              <ul className="gm-liste">
                {fehlend.map(a => <li key={`${a.kapitel}-${a.feld}`}><Icon name="warn" /><a href={kapitelLink(nummer, a.kapitel)}>{TG.zurAngabe(a.text, a.kapitel)}</a></li>)}
              </ul>
            ) : <p className="muted"><Icon name="check" />{TG.angabenVollstaendig}</p>}
          </section>
        </aside>
      </div>

      {g.nutzen ? <Nutzen versionId={version.id} projektId={projektId} gate={g} /> : null}
    </section>
  );
}

/** Eine Leitfrage: Antwort als Text, «trifft nicht zu» mit Begründung; speichert beim Verlassen (I-R3). */
function LeitfrageFeld({ versionId, projektId, frage, darf }: { versionId: string; projektId: string; frage: Leitfrage; darf: boolean }) {
  const id = useId();
  const qc = useQueryClient();
  const { antworten } = useGateMutations(projektId);
  const [text, setText] = useState(frage.antwort?.text ?? '');
  const [nichtZu, setNichtZu] = useState(frage.antwort ? !frage.antwort.zutreffend : false);
  const [fehlt, setFehlt] = useState(false);
  const [gespeichert, setGespeichert] = useState(false);

  const speichern = (t: string, zutreffend: boolean) => {
    setGespeichert(false);
    if (!zutreffend && !t.trim()) { setFehlt(true); return; }
    setFehlt(false);
    if (t.trim() === (frage.antwort?.text ?? '') && zutreffend === (frage.antwort?.zutreffend ?? true)) return;
    void antworten.mutateAsync({ versionId, frage, antwort: t.trim(), zutreffend }).then(() => setGespeichert(true), () => undefined);
  };
  const konflikt = isConflict(antworten.error);
  const server = antworten.error && !konflikt && statusOf(antworten.error) !== 422 ? describeError(antworten.error) : null;
  const err = fehlt ? TG.begruendungFehlt : statusOf(antworten.error) === 422 ? TG.begruendungFehlt : null;

  if (!darf) {
    return (
      <div className="gm-frage">
        <p className="gm-text">{frage.text}</p>
        <p className={frage.antwort ? '' : 'muted'}>{frage.antwort ? `${frage.antwort.zutreffend ? '' : `${TG.trifftNichtZu}: `}${frage.antwort.text}` : TG.offen}</p>
      </div>
    );
  }
  return (
    <div className="gm-frage">
      <label htmlFor={`${id}-t`} className="gm-text">{frage.text}</label>
      <div className="field">
        <textarea id={`${id}-t`} rows={2} maxLength={5000} value={text} placeholder={nichtZu ? TG.begruendung : TG.antwort}
          aria-invalid={err ? true : undefined} aria-describedby={`${id}-s${err ? ` ${id}-e` : ''}`}
          onChange={e => setText(e.target.value)} onBlur={() => speichern(text, !nichtZu)} />
        {err ? <p id={`${id}-e`} className="ferr" role="alert">{err}</p> : null}
      </div>
      <div className="gm-zeile">
        <label className="gm-check">
          <input type="checkbox" checked={nichtZu} onChange={e => { setNichtZu(e.target.checked); speichern(text, !e.target.checked); }} />
          {TG.trifftNichtZu}
        </label>
        <span id={`${id}-s`} className="small muted" role="status">{antworten.isPending ? TG.speichert : gespeichert ? TG.gespeichert : ''}</span>
      </div>
      {konflikt ? (
        <Hinweis stufe="warnung" live aktion={<button type="button" className="btn sm" onClick={() => { antworten.reset(); void qc.invalidateQueries({ queryKey: gateKey(versionId) }); }}>{TG.neuLaden}</button>}>
          {TG.konflikt}
        </Hinweis>
      ) : null}
      {server ? <Hinweis stufe="sperre" live>{server.detail ?? server.title}</Hinweis> : null}
    </div>
  );
}

/** Nutzenprüfung am Gate ab P3 (UC-003 A2): erreichte Werte je KPI und Beurteilung. */
function Nutzen({ versionId, projektId, gate }: { versionId: string; projektId: string; gate: Gate }) {
  const id = useId();
  const toast = useToast();
  const { nutzen } = useGateMutations(projektId);
  const n = gate.nutzen!;
  const [werte, setWerte] = useState<Record<string, { wert: string; bemerkung: string }>>(
    () => Object.fromEntries(n.werte.map(w => [w.kpiId, { wert: w.wert, bemerkung: w.bemerkung }])));
  const [beurteilung, setBeurteilung] = useState(n.beurteilung);
  const darf = gate.can.nutzen;
  const senden = () => {
    const liste = n.kpis.map(k => ({ kpiId: k.id, wert: werte[k.id]?.wert ?? '', bemerkung: werte[k.id]?.bemerkung ?? '' })).filter(w => w.wert.trim() || w.bemerkung.trim());
    void nutzen.mutateAsync({ versionId, version: n.version, body: { beurteilung, werte: liste } }).then(() => toast.show(TG.nutzenGespeichert), () => undefined);
  };
  const setze = (kpi: string, feld: 'wert' | 'bemerkung', v: string) => setWerte({ ...werte, [kpi]: { wert: '', bemerkung: '', ...werte[kpi], [feld]: v } });
  return (
    <section aria-labelledby={`${id}-h`} className="gm-block">
      <h3 id={`${id}-h`} className="grp-h">{TG.nutzen}</h3>
      <p className="small">{TG.nutzenHinweis}</p>
      {!n.kpis.length ? <p className="muted">{TG.keineKpis}</p> : (
        <div className="gm-tabelle">
          <table>
            <thead><tr><th scope="col">{TG.kpi}</th><th scope="col">{TG.zielwert}</th><th scope="col">{TG.erreichterWert}</th><th scope="col">{TG.bemerkung}</th></tr></thead>
            <tbody>
              {n.kpis.map(k => (
                <tr key={k.id}>
                  <th scope="row">{k.text}</th>
                  <td>{k.zielwert ?? '–'} {k.einheit}</td>
                  <td><input aria-label={`${TG.erreichterWert}: ${k.text}`} value={werte[k.id]?.wert ?? ''} disabled={!darf} maxLength={200} onChange={e => setze(k.id, 'wert', e.target.value)} /></td>
                  <td><input aria-label={`${TG.bemerkung}: ${k.text}`} value={werte[k.id]?.bemerkung ?? ''} disabled={!darf} maxLength={1000} onChange={e => setze(k.id, 'bemerkung', e.target.value)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="field">
        <label htmlFor={`${id}-b`}>{TG.beurteilung}</label>
        <textarea id={`${id}-b`} rows={3} maxLength={5000} value={beurteilung} disabled={!darf} onChange={e => setBeurteilung(e.target.value)} />
      </div>
      {isConflict(nutzen.error) ? <Hinweis stufe="warnung" live>{TG.konflikt}</Hinweis> : nutzen.error ? <ErrorState error={nutzen.error} /> : null}
      {darf ? <button type="button" className="btn primary" disabled={nutzen.isPending} onClick={senden}>{TG.nutzenSpeichern}</button> : null}
    </section>
  );
}
