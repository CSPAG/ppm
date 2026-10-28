/**
 * Schubladen der Matrix (UI-21, K5 Schritt 3–4): Projekt mit Lage, Werten und Abhängigkeiten («Abhängigkeit hinzufügen»,
 * PP.02.03; die aus den Verträgen erscheinen hier, weil sie im selben Register liegen), Portfoliorisiken mit «Portfoliorisiko
 * erfassen» (PC.02.01) und die Regel der Einordnung «Wie wird das berechnet?» (A-39, ohne Score A-01).
 */
import { useId, useState, type FormEvent } from 'react';
import { Drawer, Empty, ErrorState, fmtBetrag, Skelett, useToast } from '../../ui/index.ts';
import type { Ansicht } from './matrix.ts';
import { useAbhaengigkeitAnlegen, useAbhaengigkeiten, useRisiken, useRisikoErfassen, type Matrix, type MatrixProjekt, type RisikoNeu } from './matrix-api.ts';
import { TM } from './matrix-texte.ts';

export function MatrixProjektDrawer({ m, nummer, portfolioId, ansicht, lageText, onBewertung, onClose }: {
  m: Matrix; nummer: string; portfolioId: string; ansicht: Ansicht; lageText(p: MatrixProjekt, a: Ansicht): string; onBewertung(): void; onClose(): void;
}) {
  const p = m.projekte.find(x => x.nummer === nummer);
  const achse = (a: MatrixProjekt['nutzen']) => (a.stufe ? `${TM.stufe[a.stufe]} (${a.wert!.toLocaleString('de-CH', { maximumFractionDigits: 2 })}; ${TM.bewertetVon(a.bewertet, a.von)})` : TM.nichtBewertet);
  return (
    <Drawer title={p ? `${p.nummer} ${p.name}` : nummer} onClose={onClose}
      actions={p ? <button type="button" className="btn sm" onClick={onBewertung}>{TM.zurBewertung}</button> : undefined}>
      {!p ? <p className="empty">{TM.keineProjekte}</p> : (
        <>
          <h3 className="mx-h3">{TM.lageTitel}</h3>
          <p>{lageText(p, ansicht)}</p>
          <dl className="mx-dl">
            <dt>{TM.spalten.phase}</dt><dd>{p.phase}</dd>
            <dt>{TM.achse.nutzen}</dt><dd>{achse(p.nutzen)}</dd>
            <dt>{TM.achse.risiko}</dt><dd>{achse(p.risiko)}</dd>
            <dt>{TM.spalten.feld}</dt><dd>{p.feld ? TM.felder[p.feld] : TM.ohneFeld}</dd>
            <dt>{TM.spalten.ressourcen}</dt><dd>{p.ressourcen.fteMonate !== null ? `${p.ressourcen.fteMonate.toLocaleString('de-CH', { maximumFractionDigits: 1 })} FTE-Monate` : p.ressourcen.groesse ? `${p.ressourcen.groesse} (${TM.geschaetzt})` : TM.ohneRessourcen}</dd>
            {m.kostenSichtbar ? <><dt>{TM.spalten.kosten}</dt><dd>{p.kosten !== null ? fmtBetrag(p.kosten) : '–'}</dd></> : null}
            <dt>{TM.spalten.rang}</dt><dd>{p.rangEntwurf ?? p.rang ?? TM.ohneRang}</dd>
          </dl>
          <Abhaengigkeiten projekt={p} m={m} portfolioId={portfolioId} />
        </>
      )}
    </Drawer>
  );
}

function Abhaengigkeiten({ projekt, m, portfolioId }: { projekt: MatrixProjekt; m: Matrix; portfolioId: string }) {
  const liste = useAbhaengigkeiten(projekt.id);
  const anlegen = useAbhaengigkeitAnlegen(projekt.id, portfolioId);
  const toast = useToast();
  const id = useId();
  const [offen, setOffen] = useState(false);
  const [zu, setZu] = useState('');
  const [text, setText] = useState('');
  const [geprueft, setGeprueft] = useState(false);
  const andere = m.projekte.filter(x => x.id !== projekt.id);
  const senden = (e: FormEvent) => {
    e.preventDefault();
    setGeprueft(true);
    if (!zu || !text.trim()) return;
    anlegen.mutate({ zuProjektId: zu, text: text.trim() }, {
      onSuccess: () => { toast.show(TM.abhaengigkeitGespeichert); setOffen(false); setZu(''); setText(''); setGeprueft(false); },
      onError: err => toast.error(err),
    });
  };
  return (
    <section aria-labelledby={`${id}-t`}>
      <h3 id={`${id}-t`} className="mx-h3">{TM.abhaengigkeiten}</h3>
      {liste.error ? <ErrorState error={liste.error} onRetry={() => void liste.refetch()} /> : null}
      {liste.isPending ? <Skelett zeilen={2} /> : null}
      {liste.data && !liste.data.items.length ? <p className="empty">{TM.abhaengigkeitenLeer}</p> : null}
      {liste.data?.items.length ? (
        <ul className="mx-abh">
          {liste.data.items.map(a => (
            <li key={a.id}>
              <span className="pr-hint">{a.richtung === 'ausgehend' ? TM.braucht : TM.wirdGebraucht}</span>{' '}
              {a.anderesProjekt ? <><span className="mono">{a.anderesProjekt.nummer}</span> {a.anderesProjekt.name}</> : TM.ausserhalb}
              <div className="pr-hint">{a.text}</div>
            </li>
          ))}
        </ul>
      ) : null}
      {liste.data?.can.write && !offen ? <button type="button" className="btn sm" onClick={() => setOffen(true)}>{TM.abhaengigkeitHinzufuegen}</button> : null}
      {offen ? (
        <form className="pr-editor mx-form" onSubmit={senden} noValidate>
          <label htmlFor={`${id}-zu`}>{TM.zuProjekt}</label>
          <select id={`${id}-zu`} className="pr-in" value={zu} onChange={e => setZu(e.target.value)} aria-invalid={geprueft && !zu} aria-describedby={geprueft && !zu ? `${id}-zu-f` : undefined}>
            <option value="">{TM.projektWaehlen}</option>
            {andere.map(x => <option key={x.id} value={x.id}>{`${x.nummer} ${x.name}`}</option>)}
          </select>
          {geprueft && !zu ? <p id={`${id}-zu-f`} className="ferr">{TM.pflicht}</p> : null}
          <label htmlFor={`${id}-text`}>{TM.artAbhaengigkeit}</label>
          <input id={`${id}-text`} maxLength={1000} value={text} placeholder={TM.artHinweis} onChange={e => setText(e.target.value)}
            aria-invalid={geprueft && !text.trim()} aria-describedby={geprueft && !text.trim() ? `${id}-text-f` : undefined} />
          {geprueft && !text.trim() ? <p id={`${id}-text-f`} className="ferr">{TM.pflicht}</p> : null}
          <div className="pr-akt">
            <button type="submit" className="btn primary" disabled={anlegen.isPending}>{TM.hinzufuegen}</button>
            <button type="button" className="btn" onClick={() => { setOffen(false); setGeprueft(false); }}>{TM.abbrechen}</button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

const STUFEN = ['hoch', 'mittel', 'tief'] as const;

export function MatrixRisiken({ portfolioId, onClose }: { portfolioId: string; onClose(): void }) {
  const liste = useRisiken(portfolioId);
  const erfassen = useRisikoErfassen(portfolioId);
  const toast = useToast();
  const id = useId();
  const leer: RisikoNeu = { text: '', wahrscheinlichkeit: 'mittel', auswirkung: 'mittel', massnahme: '', verantwortlich: '' };
  const [neu, setNeu] = useState<RisikoNeu | null>(null);
  const [geprueft, setGeprueft] = useState(false);
  const senden = (e: FormEvent) => {
    e.preventDefault();
    setGeprueft(true);
    if (!neu || !neu.text.trim()) return;
    erfassen.mutate({ ...neu, text: neu.text.trim() }, {
      onSuccess: () => { toast.show(TM.risikoGespeichert); setNeu(null); setGeprueft(false); },
      onError: err => toast.error(err),
    });
  };
  const feld = <K extends keyof RisikoNeu>(k: K, v: RisikoNeu[K]) => setNeu(n => (n ? { ...n, [k]: v } : n));
  return (
    <Drawer title={TM.risiken} onClose={onClose}
      actions={liste.data?.can.write && !neu ? <button type="button" className="btn sm primary" onClick={() => setNeu(leer)}>{TM.risikoErfassen}</button> : undefined}>
      {neu ? (
        <form className="pr-editor mx-form" onSubmit={senden} noValidate aria-label={TM.risikoErfassen}>
          <label htmlFor={`${id}-t`}>{TM.risiko}</label>
          <textarea id={`${id}-t`} rows={2} maxLength={1000} value={neu.text} onChange={e => feld('text', e.target.value)}
            aria-invalid={geprueft && !neu.text.trim()} aria-describedby={geprueft && !neu.text.trim() ? `${id}-t-f` : undefined} />
          {geprueft && !neu.text.trim() ? <p id={`${id}-t-f`} className="ferr">{TM.pflicht}</p> : null}
          {(['wahrscheinlichkeit', 'auswirkung'] as const).map(k => (
            <fieldset key={k} className="pr-kriterium">
              <legend>{TM[k]}</legend>
              <div className="seg" role="radiogroup" aria-label={TM[k]}>
                {STUFEN.map(s => <button key={s} type="button" role="radio" aria-checked={neu[k] === s} className={neu[k] === s ? 'on' : ''} onClick={() => feld(k, s)}>{TM.einschaetzung[s]}</button>)}
              </div>
            </fieldset>
          ))}
          <label htmlFor={`${id}-m`}>{TM.massnahme}</label>
          <textarea id={`${id}-m`} rows={2} maxLength={1000} value={neu.massnahme ?? ''} onChange={e => feld('massnahme', e.target.value)} />
          <label htmlFor={`${id}-v`}>{TM.verantwortlich}</label>
          <input id={`${id}-v`} maxLength={200} value={neu.verantwortlich ?? ''} onChange={e => feld('verantwortlich', e.target.value)} />
          <div className="pr-akt">
            <button type="submit" className="btn primary" disabled={erfassen.isPending}>{TM.risikoErfassen}</button>
            <button type="button" className="btn" onClick={() => { setNeu(null); setGeprueft(false); }}>{TM.abbrechen}</button>
          </div>
        </form>
      ) : null}
      {liste.error ? <ErrorState error={liste.error} onRetry={() => void liste.refetch()} /> : null}
      {liste.isPending ? <Skelett zeilen={3} /> : null}
      {liste.data && !liste.data.items.length ? <Empty>{TM.risikenLeer}</Empty> : null}
      {liste.data && !liste.data.can.write ? <p className="pr-hint">{TM.risikenNurLesen}</p> : null}
      {liste.data?.items.length ? (
        <ul className="mx-abh">
          {liste.data.items.map(r => (
            <li key={r.id}>
              <strong>{r.text}</strong>
              <div className="pr-hint">{TM.risikoKurz(TM.einschaetzung[r.wahrscheinlichkeit]!, TM.einschaetzung[r.auswirkung]!)}{r.massnahme ? ` · ${TM.massnahme}: ${r.massnahme}` : ''}{r.verantwortlich ? ` · ${r.verantwortlich}` : ''}</div>
            </li>
          ))}
        </ul>
      ) : null}
    </Drawer>
  );
}

export function MatrixBerechnung({ m, onClose }: { m: Matrix | undefined; onClose(): void }) {
  return (
    <Drawer title={TM.berechnung} onClose={onClose}>
      <h3 className="mx-h3">{TM.regelTitel}</h3>
      <ul className="mx-regel">{TM.regel.map(r => <li key={r}>{r}</li>)}</ul>
      <p>{TM.regelFelder}</p>
      <p>{TM.regelRessourcen}</p>
      {m?.modell ? (
        <>
          <h3 className="mx-h3">{TM.zuordnung} ({TM.modell(m.modell.nummer)})</h3>
          <table className="pr-tab">
            <thead><tr><th scope="col">{TM.kriterium}</th><th scope="col">{TM.achseTitel}</th></tr></thead>
            <tbody>
              {m.modell.kriterien.map(k => (
                <tr key={k.schluessel}><td>{k.text}</td><td>{k.dimension ? TM.achse[k.dimension] : TM.ohneDimension}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </Drawer>
  );
}
