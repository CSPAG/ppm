/**
 * Freigabe der Jahresziele (UI-39, K6 Schritte 6–7; UC-011 Schritte 6–7, A2; BC ZM.02.02). Seitentyp Assistent
 * unter `/ziele/<jahr>/freigabe`:
 * - GL, Stand «in Arbeit»: Prüfung (Sperre ohne Metrik mit Sprung zum Ziel, I-P4), Zusammenfassung je Handlungsfeld mit
 *   Vorjahr, Wirkung und «Zur Freigabe vorlegen» (I-F5, I-R1 Stufe 3).
 * - UE, Stand «zur Freigabe»: Entscheid des VR erfassen (freigegeben / Anpassungen verlangt mit Rückmeldungen).
 * - sonst: Stand mit Weg zurück (Z8). Der Server entscheidet (I-P6): seine Meldung (409, 412) erscheint am Schritt.
 */
import { describeError } from '@vollholz/iam-web';
import { useId, useState, type FormEvent } from 'react';
import './Freigabe.css';
import { isConflict } from '../../api/index.ts';
import { ErrorState, Hinweis, Icon, Skelett, Stand, useToast, useVerzoegert, type StandFamilie } from '../../ui/index.ts';
import { useFreigabeMutations, useVorlage, type Vorlage } from './FreigabeApi.ts';
import { TF } from './FreigabeTexte.ts';
import { TZZ } from './ZielzyklusTexte.ts';

const FAMILIE: Record<string, StandFamilie> = { in_arbeit: 'entwurf', zur_freigabe: 'wartet', in_kraft: 'positiv' };

export interface FreigabePageProps {
  jahr: number;
  /** Zurück zum Zielzyklus, optional mit geöffnetem Jahresziel (`?o=ziel:<nummer>`). */
  zumZyklus(nummer?: string): void;
}

export function FreigabePage({ jahr, zumZyklus }: FreigabePageProps) {
  const q = useVorlage(jahr);
  const verzoegert = useVerzoegert(q.isPending);
  const v = q.data;
  return (
    <section aria-labelledby="page-title" className="fg">
      <header className="mh">
        <div className="mh-row">
          <div className="mh-title">
            <div className="type-ico neutral"><Icon name="send" /></div>
            <div className="minw0">
              <h1 id="page-title">{TF.titel(jahr)}</h1>
              <div className="sub">{v ? <Stand familie={FAMILIE[v.stand] ?? 'entwurf'} label={TZZ.stand[v.stand] ?? v.stand} /> : null}</div>
            </div>
          </div>
          <div className="acts"><button type="button" className="btn sm" onClick={() => zumZyklus()}><Icon name="chev" className="zz-zurueck" />{TF.zumZyklus(jahr)}</button></div>
        </div>
      </header>
      <div className="body pad">
        {q.isPending ? (verzoegert ? <Skelett zeilen={6} /> : null)
          : q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} />
          : q.data.can.vorlegen ? <Vorlegen v={q.data} jahr={jahr} zumZyklus={zumZyklus} />
          : q.data.can.freigabe ? <Erfassen v={q.data} jahr={jahr} zumZyklus={zumZyklus} />
          : <p className="note">{TF.nichtsZuTun[q.data.stand]?.(jahr)}</p>}
      </div>
    </section>
  );
}

/** Fehler des Servers am Schritt (I-P6); 412 mit Weg zum Neuladen (Z7). */
function ServerMeldung({ error, onReload }: { error: unknown; onReload(): void }) {
  if (!error) return null;
  if (isConflict(error)) {
    return <div className="notice" role="alert"><p>{TF.konflikt}</p><button type="button" className="btn" onClick={onReload}>{TF.neuLaden}</button></div>;
  }
  const e = describeError(error);
  return <Hinweis stufe="sperre" live>{e.detail || e.title}</Hinweis>;
}

function Vorlegen({ v, jahr, zumZyklus }: { v: Vorlage; jahr: number; zumZyklus(nummer?: string): void }) {
  const [schritt, setSchritt] = useState(0);
  const toast = useToast();
  const m = useFreigabeMutations(jahr);
  const sperre = v.anzahl === 0 || v.ohneMetrik.length > 0;
  const total = v.jeHandlungsfeld.reduce((n, f) => n + f.anzahlVorjahr, 0);
  return (
    <div className="fg-assistent">
      <ol className="fg-schritte" aria-label={TF.schritt(schritt + 1, TF.schritte.length)}>
        {TF.schritte.map((s, i) => <li key={s} aria-current={i === schritt ? 'step' : undefined} className={i === schritt ? 'on' : i < schritt ? 'fertig' : ''}>{s}</li>)}
      </ol>
      {schritt === 0 ? (
        <section aria-labelledby="fg-h">
          <h2 id="fg-h">{TF.schritte[0]}</h2>
          {v.anzahl === 0 ? <Hinweis stufe="sperre">{TF.leer}</Hinweis> : null}
          {v.ohneMetrik.length ? (
            <Hinweis stufe="sperre" aktion={<span className="fg-sprung">{v.ohneMetrik.map(x => (
              <button key={x.id} type="button" className="linkbtn" aria-label={TF.zumZiel(x.nummer)} onClick={() => zumZyklus(x.nummer)}>{x.nummer}</button>
            ))}</span>}>{TF.metrikFehlt(v.ohneMetrik.map(x => x.nummer))}</Hinweis>
          ) : v.anzahl ? <Hinweis stufe="hinweis">{TF.pruefungOk}</Hinweis> : null}
          {v.ohneUmsetzung.map(x => (
            <Hinweis key={x.id} stufe="hinweis" aktion={<button type="button" className="linkbtn" aria-label={TF.zumZiel(x.nummer)} onClick={() => zumZyklus(x.nummer)}>{x.nummer}</button>}>{TF.ohneUmsetzung(x.nummer)}</Hinweis>
          ))}
        </section>
      ) : schritt === 1 ? (
        <section aria-labelledby="fg-h">
          <h2 id="fg-h">{TF.zusammenfassung}</h2>
          <table className="fg-tabelle">
            <thead><tr><th scope="col">{TF.handlungsfeld}</th><th scope="col" className="num">{TF.anzahl(jahr)}</th>{v.anzahlVorjahr !== null ? <th scope="col" className="num">{TF.vorjahr(jahr - 1)}</th> : null}</tr></thead>
            <tbody>
              {v.jeHandlungsfeld.map(f => (
                <tr key={f.handlungsfeldId}><td>{f.label ?? TF.ohneHandlungsfeld}</td><td className="num">{f.anzahl}</td>{v.anzahlVorjahr !== null ? <td className="num">{f.anzahlVorjahr}</td> : null}</tr>
              ))}
            </tbody>
            <tfoot><tr><th scope="row">{TF.total}</th><td className="num">{v.anzahl}</td>{v.anzahlVorjahr !== null ? <td className="num">{total}</td> : null}</tr></tfoot>
          </table>
          {v.anzahlVorjahr === null ? <p className="note">{TF.keinVorjahr(jahr - 1)}</p> : null}
          <div className="acts"><button type="button" className="btn" onClick={() => window.print()}><Icon name="printer" />{TF.drucken}</button></div>
        </section>
      ) : (
        <section aria-labelledby="fg-h">
          <h2 id="fg-h">{TF.schritte[2]}</h2>
          {sperre
            ? <Hinweis stufe="sperre">{v.anzahl === 0 ? TF.leer : TF.metrikFehlt(v.ohneMetrik.map(x => x.nummer))}</Hinweis>
            : <Hinweis stufe="warnung">{TF.wirkungVorlegen(v.anzahl)}</Hinweis>}
          <ServerMeldung error={m.vorlegen.error} onReload={() => { m.vorlegen.reset(); zumZyklus(); }} />
        </section>
      )}
      <div className="acts fg-nav">
        {schritt > 0 ? <button type="button" className="btn" onClick={() => setSchritt(schritt - 1)}>{TF.zurueck}</button> : null}
        {schritt < 2
          ? <button type="button" className="btn primary" onClick={() => setSchritt(schritt + 1)}>{TF.weiter}</button>
          : (
            <button type="button" className="btn primary" disabled={sperre || m.vorlegen.isPending}
              onClick={() => m.vorlegen.mutate({ version: v.version }, { onSuccess: () => { toast.show(TF.vorgelegt(jahr)); zumZyklus(); } })}>
              <Icon name="send" />{TF.vorlegen}
            </button>
          )}
      </div>
    </div>
  );
}

function Erfassen({ v, jahr, zumZyklus }: { v: Vorlage; jahr: number; zumZyklus(nummer?: string): void }) {
  const id = useId();
  const toast = useToast();
  const m = useFreigabeMutations(jahr);
  const [entscheid, setEntscheid] = useState<'freigegeben' | 'anpassungen'>('freigegeben');
  const [datum, setDatum] = useState(() => new Date().toISOString().slice(0, 10));
  const [text, setText] = useState('');
  const [fehler, setFehler] = useState<{ datum?: string; text?: string }>({});
  const absenden = (e: FormEvent) => {
    e.preventDefault();
    const f = { datum: datum ? undefined : TF.datumFehlt, text: entscheid === 'anpassungen' && !text.trim() ? TF.textFehlt : undefined };
    setFehler(f);
    if (f.datum || f.text) { document.getElementById(f.datum ? `${id}-d` : `${id}-t`)?.focus(); return; }
    m.erfassen.mutate({ version: v.version, body: { entscheid, datum, ...(text.trim() ? { text } : {}) } }, {
      onSuccess: () => { toast.show(TF.erfasst[entscheid](jahr)); zumZyklus(); },
    });
  };
  return (
    <form className="form fg-form" onSubmit={absenden} aria-labelledby="fg-h" noValidate>
      <h2 id="fg-h">{TF.erfassen}</h2>
      <p className="note">{TF.erfassenSub}</p>
      <div className="field">
        <label htmlFor={`${id}-d`}>{TF.datum}</label>
        <input id={`${id}-d`} type="date" value={datum} aria-invalid={!!fehler.datum} aria-describedby={fehler.datum ? `${id}-de` : undefined} onChange={e => setDatum(e.target.value)} />
        {fehler.datum ? <div id={`${id}-de`} className="ferr">{fehler.datum}</div> : null}
      </div>
      <fieldset className="field fg-entscheid">
        <legend>{TF.entscheid}</legend>
        {(['freigegeben', 'anpassungen'] as const).map(e => (
          <label key={e}><input type="radio" name={`${id}-e`} value={e} checked={entscheid === e} onChange={() => setEntscheid(e)} /> {TF[e]}</label>
        ))}
      </fieldset>
      <div className="field">
        <label htmlFor={`${id}-t`}>{TF.text} {entscheid === 'freigegeben' ? <span className="muted">{TF.textOptional}</span> : null}</label>
        <textarea id={`${id}-t`} rows={4} maxLength={4000} value={text} aria-invalid={!!fehler.text} aria-describedby={fehler.text ? `${id}-te` : undefined}
          onChange={e => { setText(e.target.value); setFehler({ ...fehler, text: undefined }); }} />
        {fehler.text ? <div id={`${id}-te`} className="ferr">{fehler.text}</div> : null}
      </div>
      <Hinweis stufe={entscheid === 'freigegeben' ? 'hinweis' : 'warnung'}>{entscheid === 'freigegeben' ? TF.wirkungFreigegeben(jahr) : TF.wirkungAnpassungen(jahr)}</Hinweis>
      <ServerMeldung error={m.erfassen.error} onReload={() => { m.erfassen.reset(); zumZyklus(); }} />
      <div className="acts"><button type="submit" className="btn primary" disabled={m.erfassen.isPending}><Icon name="check" />{TF.erfassen}</button></div>
    </form>
  );
}
