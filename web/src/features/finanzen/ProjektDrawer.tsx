/**
 * Projekt in der Schublade (UI-26/UI-27; UC-010 Schritte 2–4, A1): Prognose, Budget und Ist, Werte je Phase und
 * CAPEX/OPEX, Verlauf der Ist-Kosten je Monat, Kostenträger im ERP (FI ordnet zu, A-16, A1.1) und Begründungen der
 * Abweichung je Periode (PL, UE oder FI halten sie fest; If-Match, Konflikt Z7).
 */
import { useId, useState, type FormEvent } from 'react';
import { isConflict, statusOf } from '../../api/index.ts';
import { Drawer, ErrorState, fmtDatum, fmtPeriode, Hinweis, Skelett, useToast } from '../../ui/index.ts';
import { abweichung, ist, lang } from './anzeige.ts';
import { useBegruenden, useBegruendungen, useKostentraeger, type FinanzProjekt } from './api.ts';
import { TF } from './texte.ts';

const KT = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,39}$/;

/** Laufende Periode «JJJJ-MM» in Zürich (wie der Server). */
export const laufendePeriode = (jetzt = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit' }).format(jetzt).slice(0, 7);

export function ProjektDrawer({ projekt: p, nummer, canWrite, onClose }: { projekt: FinanzProjekt | undefined; nummer: string; canWrite: boolean; onClose(): void }) {
  return (
    <Drawer title={p ? `${p.nummer} ${p.name}` : nummer} onClose={onClose}>
      {!p ? <p className="empty">{TF.projektUnbekannt}</p> : (
        <div className="fi-drawer">
          <dl className="fi-dl">
            <dt>{TF.prognose}</dt><dd>{lang(p.prognose)}</dd>
            <dt>{TF.budget}</dt><dd>{lang(p.budget)}</dd>
            <dt>{TF.ist}</dt><dd>{ist(p.ist, { lang: true })}{p.istBis ? ` (${TF.istBis(fmtPeriode(p.istBis))})` : ''}</dd>
            <dt>{TF.abweichung}</dt>
            <dd>{abweichung(p.abweichung)}{p.abweichung.wesentlich && p.toleranzProzent !== null ? ` · ${TF.wesentlichLang(p.toleranzProzent)}` : ''}</dd>
          </dl>
          {p.abweichung.wesentlich ? <Hinweis stufe="warnung">{TF.wesentlichLang(p.toleranzProzent ?? 0)}: {abweichung(p.abweichung)}</Hinweis> : null}
          {p.toleranzProzent === null ? <p className="fi-hint">{TF.ohneToleranz}</p> : null}

          <h3 className="fi-h3">{TF.jePhase}</h3>
          {p.phasen.length ? (
            <table className="fi-tab fi-klein">
              <thead><tr><th scope="col">{TF.phase}</th><th scope="col">{TF.art}</th><th scope="col" className="num">{TF.prognose}</th><th scope="col" className="num">{TF.budget}</th></tr></thead>
              <tbody>
                {p.phasen.map(x => (
                  <tr key={`${x.phase}-${x.art}`}><td>{x.phase}</td><td>{TF[x.art]}</td><td className="num">{lang(x.prognose)}</td><td className="num">{lang(x.budget)}</td></tr>
                ))}
              </tbody>
            </table>
          ) : <p className="empty">–</p>}

          <h3 className="fi-h3">{TF.istJeArt}</h3>
          <dl className="fi-dl">
            <dt>{TF.capex}</dt><dd>{ist(p.istJeArt.capex, { lang: true })}</dd>
            <dt>{TF.opex}</dt><dd>{ist(p.istJeArt.opex, { lang: true })}</dd>
          </dl>
          <h3 className="fi-h3">{TF.verlauf}</h3>
          {p.verlauf.length ? (
            <table className="fi-tab fi-klein">
              <thead><tr><th scope="col">{TF.monat}</th><th scope="col" className="num">{TF.capex}</th><th scope="col" className="num">{TF.opex}</th></tr></thead>
              <tbody>{p.verlauf.map(v => <tr key={v.monat}><td>{fmtPeriode(v.monat)}</td><td className="num">{lang(v.capex)}</td><td className="num">{lang(v.opex)}</td></tr>)}</tbody>
            </table>
          ) : <p className="empty">{p.kostentraeger ? TF.verlaufLeer : TF.ohneKostentraeger}</p>}

          <Kostentraeger projekt={p} canWrite={canWrite} />
          <Begruendungen projekt={p} />
        </div>
      )}
    </Drawer>
  );
}

function Kostentraeger({ projekt: p, canWrite }: { projekt: FinanzProjekt; canWrite: boolean }) {
  const id = useId();
  const toast = useToast();
  const m = useKostentraeger(p.id);
  const [wert, setWert] = useState(p.kostentraeger ?? '');
  const [fehler, setFehler] = useState<string | null>(null);
  const senden = (e: FormEvent) => {
    e.preventDefault();
    const n = wert.trim();
    if (n && !KT.test(n)) { setFehler(TF.kostentraegerUngueltig); return; }
    setFehler(null);
    m.mutate(n || null, {
      onSuccess: () => toast.show(n ? TF.zugeordnet : TF.aufgehoben),
      onError: e2 => (statusOf(e2) === 409 ? setFehler(TF.vergeben) : toast.error(e2)),
    });
  };
  return (
    <section aria-labelledby={`${id}-t`}>
      <h3 id={`${id}-t`} className="fi-h3">{TF.kostentraeger}</h3>
      {!canWrite ? <p>{p.kostentraeger ?? <span className="empty">{TF.ohneKostentraeger}</span>}</p> : (
        <form className="fi-form" onSubmit={senden} noValidate>
          <label htmlFor={`${id}-kt`}>{TF.kostentraegerFeld}</label>
          <div className="fi-zeile">
            <input id={`${id}-kt`} value={wert} maxLength={40} autoComplete="off" onChange={e => setWert(e.target.value)}
              aria-invalid={fehler ? true : undefined} aria-describedby={`${id}-kt-h${fehler ? ` ${id}-kt-e` : ''}`} />
            <button type="submit" className="btn" disabled={m.isPending || wert.trim() === (p.kostentraeger ?? '')}>{wert.trim() ? TF.zuordnen : TF.aufheben}</button>
          </div>
          <p id={`${id}-kt-h`} className="fi-hint">{TF.kostentraegerHilfe}</p>
          {fehler ? <p id={`${id}-kt-e`} className="ferr" role="alert">{fehler}</p> : null}
        </form>
      )}
    </section>
  );
}

function Begruendungen({ projekt: p }: { projekt: FinanzProjekt }) {
  const id = useId();
  const toast = useToast();
  const liste = useBegruendungen(p.id);
  const m = useBegruenden(p.id);
  const periode = laufendePeriode();
  const aktuell = liste.data?.items.find(b => b.periode === periode);
  const [text, setText] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [konflikt, setKonflikt] = useState(false);
  const bearbeiten = text !== null;
  const senden = (e: FormEvent) => {
    e.preventDefault();
    if (!text?.trim()) { setFehler(TF.begruendungPflicht); return; }
    setFehler(null);
    m.mutate({ periode, text: text.trim(), version: aktuell?.version ?? 0 }, {
      onSuccess: () => { toast.show(TF.festgehalten); setText(null); void liste.refetch(); },
      onError: e2 => (isConflict(e2) ? setKonflikt(true) : toast.error(e2)),
    });
  };
  return (
    <section aria-labelledby={`${id}-t`}>
      <h3 id={`${id}-t`} className="fi-h3">{TF.begruendungen}</h3>
      {liste.error ? <ErrorState error={liste.error} onRetry={() => void liste.refetch()} /> : null}
      {liste.isPending ? <Skelett zeilen={2} /> : null}
      {konflikt ? <Hinweis stufe="warnung" live aktion={<button type="button" className="btn sm" onClick={() => { setKonflikt(false); void liste.refetch(); }}>{TF.neuLaden}</button>}>{TF.konflikt}</Hinweis> : null}
      {liste.data && !liste.data.items.length && !bearbeiten ? <p className="empty">{TF.begruendungenLeer}</p> : null}
      {liste.data?.items.length ? (
        <ul className="fi-begr">
          {liste.data.items.map(b => (
            <li key={b.periode}><strong>{fmtPeriode(b.periode)}</strong> <span className="fi-hint">({fmtDatum(b.geaendertAt)})</span><p>{b.text}</p></li>
          ))}
        </ul>
      ) : null}
      {liste.data?.can.write && !bearbeiten ? (
        <button type="button" className="btn sm" onClick={() => setText(aktuell?.text ?? '')}>{aktuell ? TF.aendern : TF.festhalten}</button>
      ) : null}
      {bearbeiten ? (
        <form className="fi-form" onSubmit={senden} noValidate>
          <label htmlFor={`${id}-b`}>{TF.begruendungFuer(fmtPeriode(periode))}</label>
          <textarea id={`${id}-b`} rows={3} maxLength={2000} value={text} onChange={e => setText(e.target.value)}
            aria-invalid={fehler ? true : undefined} aria-describedby={`${id}-b-h${fehler ? ` ${id}-b-e` : ''}`} />
          <p id={`${id}-b-h`} className="fi-hint">{TF.begruendungHilfe}</p>
          {fehler ? <p id={`${id}-b-e`} className="ferr" role="alert">{fehler}</p> : null}
          <div className="fi-akt">
            <button type="submit" className="btn primary" disabled={m.isPending}>{TF.speichern}</button>
            <button type="button" className="btn" onClick={() => { setText(null); setFehler(null); }}>{TF.abbrechen}</button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
