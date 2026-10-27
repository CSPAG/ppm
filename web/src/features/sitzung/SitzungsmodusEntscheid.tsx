/**
 * Entscheidmaske (UI-34; UC-006 Schritt 7, A1, A3, A4; K3 Schritt 8): Optionen der Art, Begründung (Pflicht, Sperre
 * mit Text aus K3), Auflagen mit Text, Termin und Verantwortlichen, Weiterleitung an den VR und die Wirkung vor dem
 * Erfassen (I-F5). Erfassen ist bestätigt (I-R2): erledigt erst nach der Antwort des Servers. Korrektur bis zum
 * Schliessen (A-30). Nach dem Schliessen: Entscheid des SNS-VR nachtragen (A1, A-02).
 */
import { useId, useState, type FormEvent } from 'react';
import { Hinweis, Icon, fmtDatum } from '../../ui/index.ts';
import type { EntscheidPut, ModusTraktandum, Person } from './Sitzungsmodus.api.ts';
import { TM } from './Sitzungsmodus.texte.ts';

const MIT_AUFLAGEN = 'mit_auflagen';

interface AuflageWert { text: string; termin: string; verantwortlich: string }

export interface EntscheidmaskeProps {
  t: ModusTraktandum;
  personen: Person[];
  /** Vorschlag für «Verantwortlich»: Projektleitung des Geschäfts */
  vorschlagVerantwortlich?: string;
  busy: boolean;
  onErfassen(body: EntscheidPut): void;
}

/** Fehler der Eingabe nach K3 «Regeln und Rückmeldungen» (Sperre mit Regel und Ausweg). */
function pruefe(ergebnis: string, begruendung: string, auflagen: AuflageWert[]): string[] {
  const f: string[] = [];
  if (!ergebnis) f.push(TM.ergebnisFehlt);
  if (!begruendung.trim()) f.push(TM.begruendungFehlt);
  const unvollstaendig = auflagen.some(a => !a.text.trim() || !a.termin || !a.verantwortlich);
  if ((ergebnis === MIT_AUFLAGEN && !auflagen.length) || unvollstaendig) f.push(TM.auflagenFehlen);
  return f;
}

export function Entscheidmaske({ t, personen, vorschlagVerantwortlich, busy, onErfassen }: EntscheidmaskeProps) {
  const id = useId();
  const e = t.entscheid;
  const [ergebnis, setErgebnis] = useState(e?.ergebnis ?? '');
  const [begruendung, setBegruendung] = useState(e?.begruendung ?? '');
  const [anVr, setAnVr] = useState(e?.anVr ?? false);
  const [auflagen, setAuflagen] = useState<AuflageWert[]>(e?.auflagen.map(a => ({ text: a.text, termin: a.termin, verantwortlich: a.verantwortlich.id })) ?? []);
  const [geprueft, setGeprueft] = useState(false);
  const fehler = geprueft ? pruefe(ergebnis, begruendung, auflagen) : [];
  const label = t.optionen.find(o => o.schluessel === ergebnis)?.label;

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    setGeprueft(true);
    if (pruefe(ergebnis, begruendung, auflagen).length) return;
    onErfassen({ ergebnis, begruendung: begruendung.trim(), anVr, auflagen: auflagen.map(a => ({ text: a.text.trim(), termin: a.termin, verantwortlich: a.verantwortlich })) });
  };
  const setAuflage = (i: number, k: keyof AuflageWert, v: string) => setAuflagen(auflagen.map((a, j) => (i === j ? { ...a, [k]: v } : a)));

  return (
    <form className="smo-maske" onSubmit={submit} noValidate aria-busy={busy} aria-labelledby={`${id}-t`}>
      <h3 id={`${id}-t`} className="smo-h">{t.viaSns ? TM.stellungnahme : TM.maske}</h3>
      {t.viaSns ? <Hinweis stufe="hinweis">{TM.snsHinweis}</Hinweis> : null}
      <fieldset className="smo-optionen" aria-describedby={fehler.includes(TM.ergebnisFehlt) ? `${id}-f` : undefined}>
        <legend>{TM.ergebnis}</legend>
        {t.optionen.map((o, i) => (
          <label key={o.schluessel} className={`smo-option${ergebnis === o.schluessel ? ' on' : ''}`}>
            <input type="radio" name={`${id}-ergebnis`} value={o.schluessel} checked={ergebnis === o.schluessel}
              onChange={() => setErgebnis(o.schluessel)} data-maske={i === 0 ? 'start' : undefined} />
            {o.label}
          </label>
        ))}
      </fieldset>
      <div className="field">
        <label htmlFor={`${id}-b`}>{TM.begruendung}</label>
        <textarea id={`${id}-b`} rows={3} value={begruendung} maxLength={4000} onChange={x => setBegruendung(x.target.value)} required
          aria-invalid={fehler.includes(TM.begruendungFehlt) ? true : undefined} aria-describedby={`${id}-bh`} />
        <p id={`${id}-bh`} className="hint">{TM.begruendungHinweis}</p>
      </div>
      <fieldset className="smo-auflagen">
        <legend>{TM.auflagen}</legend>
        {auflagen.map((a, i) => (
          <div key={i} className="smo-auflage">
            <div className="field smo-a-text">
              <label htmlFor={`${id}-a${i}-t`}>{TM.auflageText} {i + 1}</label>
              <input id={`${id}-a${i}-t`} value={a.text} maxLength={1000} onChange={x => setAuflage(i, 'text', x.target.value)} />
            </div>
            <div className="field">
              <label htmlFor={`${id}-a${i}-d`}>{TM.auflageTermin}</label>
              <input id={`${id}-a${i}-d`} type="date" value={a.termin} onChange={x => setAuflage(i, 'termin', x.target.value)} />
            </div>
            <div className="field">
              <label htmlFor={`${id}-a${i}-p`}>{TM.auflageVerantwortlich}</label>
              <select id={`${id}-a${i}-p`} value={a.verantwortlich} onChange={x => setAuflage(i, 'verantwortlich', x.target.value)}>
                <option value="">{TM.auflageWaehlen}</option>
                {personen.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                {a.verantwortlich && !personen.some(p => p.id === a.verantwortlich)
                  ? <option value={a.verantwortlich}>{e?.auflagen.find(x => x.verantwortlich.id === a.verantwortlich)?.verantwortlich.name ?? '–'}</option> : null}
              </select>
            </div>
            <button type="button" className="iconbtn smo-a-weg" onClick={() => setAuflagen(auflagen.filter((_, j) => j !== i))} aria-label={TM.auflageEntfernen(i + 1)}><Icon name="x" /></button>
          </div>
        ))}
        <button type="button" className="btn" onClick={() => setAuflagen([...auflagen, { text: '', termin: '', verantwortlich: vorschlagVerantwortlich ?? '' }])}>
          <Icon name="plus" />{TM.auflageNeu}
        </button>
      </fieldset>
      <label className="smo-check"><input type="checkbox" checked={anVr} onChange={x => setAnVr(x.target.checked)} />{TM.anVr}</label>
      {label ? (
        <div className="smo-wirkung"><strong>{TM.wirkung}: </strong>{TM.wirkungText(t.titel, label, auflagen.length, t.viaSns)}</div>
      ) : null}
      {fehler.length ? <div id={`${id}-f`} role="alert"><Hinweis stufe="sperre">{fehler.join(' ')}</Hinweis></div> : null}
      <div className="smo-acts">
        <button type="submit" className="btn primary" disabled={busy}><Icon name="check" />{busy ? TM.speichertNoch : e ? TM.korrigieren : TM.erfassen}</button>
      </div>
    </form>
  );
}

/** Entscheid des SNS-VR nach dem Schliessen (UC-006 A1; die UE erfasst ihn, A-02). */
export function SnsMaske({ t, busy, onErfassen }: { t: ModusTraktandum; busy: boolean; onErfassen(b: { ergebnis: string; begruendung: string }): void }) {
  const id = useId();
  const [ergebnis, setErgebnis] = useState('');
  const [begruendung, setBegruendung] = useState('');
  const [geprueft, setGeprueft] = useState(false);
  const fehler = geprueft ? [!ergebnis ? TM.ergebnisFehlt : '', !begruendung.trim() ? TM.begruendungFehlt : ''].filter(Boolean) : [];
  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    setGeprueft(true);
    if (!ergebnis || !begruendung.trim()) return;
    onErfassen({ ergebnis, begruendung: begruendung.trim() });
  };
  return (
    <form className="smo-maske" onSubmit={submit} noValidate aria-labelledby={`${id}-t`}>
      <h3 id={`${id}-t`} className="smo-h">{TM.snsTitel}</h3>
      <div className="field">
        <label htmlFor={`${id}-e`}>{TM.ergebnis}</label>
        <select id={`${id}-e`} value={ergebnis} onChange={x => setErgebnis(x.target.value)}>
          <option value="">{TM.ergebnisWaehlen}</option>
          {t.optionen.map(o => <option key={o.schluessel} value={o.schluessel}>{o.label}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${id}-b`}>{TM.begruendung}</label>
        <textarea id={`${id}-b`} rows={2} value={begruendung} onChange={x => setBegruendung(x.target.value)} />
      </div>
      {fehler.length ? <div role="alert"><Hinweis stufe="sperre">{fehler.join(' ')}</Hinweis></div> : null}
      <div className="smo-acts"><button type="submit" className="btn primary" disabled={busy}>{TM.snsErfassen}</button></div>
    </form>
  );
}

/** Erfasster Entscheid, lesend (Mitglieder, nach dem Schliessen). */
export function EntscheidAnzeige({ t }: { t: ModusTraktandum }) {
  const e = t.entscheid;
  if (!e) return <p className="smo-leise">{TM.offen}</p>;
  return (
    <div className="smo-entscheid">
      <p className="smo-ergebnis">{e.stellungnahme ? `${TM.stellungnahmeKurz}: ` : ''}{e.label}</p>
      <p>{e.begruendung}</p>
      {e.auflagen.length ? (
        <ul className="smo-al">{e.auflagen.map(a => <li key={a.id}>{TM.auflageZeile(a.text, a.verantwortlich.name, fmtDatum(a.termin))}</li>)}</ul>
      ) : null}
      {e.anVr ? <p className="smo-leise">{TM.weitergeleitet}</p> : null}
      {e.stellungnahme ? <p className="smo-leise">{e.sns ? TM.sns(e.sns.label) : TM.snsAusstehend}</p> : null}
    </div>
  );
}
