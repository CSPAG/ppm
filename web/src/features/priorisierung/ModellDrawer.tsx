/**
 * Version des Bewertungsmodells in der Schublade (UI-19): Kriterien mit Zuordnung zur Matrix (A-39), Budgetrahmen je
 * Portfolio (A-18), Prüfbericht (I-P1); im Entwurf bearbeiten (Kriterien hinzufügen, ordnen, entfernen; Budgetrahmen),
 * verwerfen und mit dem Entscheid des Gremiums in Kraft setzen (UC-008 A1.2). Ein Modell in Kraft ist gesperrt (Z9).
 */
import { useId, useState } from 'react';
import { isConflict } from '../../api/index.ts';
import { Confirm, Dialog, Drawer, ErrorState, fmtBetrag, fmtDatum, Hinweis, Icon, Loading, T, useToast } from '../../ui/index.ts';
import { useModell, useModellMutations, usePortfolios, type Bewertungsmodell, type BewertungsmodellKurz, type Loaded } from './api.ts';
import { standAnzeige } from './anzeige.tsx';
import { TP } from './texte.ts';

type Dim = 'nutzen' | 'risiko' | null;
interface KritEntwurf { schluessel?: string; text: string; beschreibung: string; dimension: Dim }

/** Betrag aus der Eingabe: «12'000'000», «12000000.50»; leer → null; ungültig → undefined. */
export function betragAus(t: string): number | null | undefined {
  const s = t.replace(/[’'\s]/g, '').replace(',', '.');
  if (!s) return null;
  if (!/^[0-9]{1,13}(\.[0-9]{1,2})?$/.test(s)) return undefined;
  return Number(s);
}

export function ModellDrawer({ kurz, onClose }: { kurz: BewertungsmodellKurz | undefined; onClose(): void }) {
  const q = useModell(kurz?.id ?? null);
  const titel = kurz ? TP.version(kurz.nummer) : TP.modellUnbekannt;
  return (
    <Drawer title={titel} onClose={onClose} actions={kurz ? standAnzeige(kurz) : undefined}>
      {!kurz ? <p className="empty">{TP.modellUnbekannt}</p>
        : q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} />
          : !q.data ? <Loading />
            : <Inhalt key={q.data.etag} l={q.data} onClose={onClose} neuLaden={async () => { await q.refetch(); }} />}
    </Drawer>
  );
}

function Inhalt({ l, onClose, neuLaden }: { l: Loaded; onClose(): void; neuLaden(): Promise<void> }) {
  const m = l.item;
  const [bearbeiten, setBearbeiten] = useState(false);
  const [dialog, setDialog] = useState<'inkraft' | 'verwerfen' | null>(null);
  const toast = useToast();
  const { inKraft, verwerfen } = useModellMutations();
  const portfolios = usePortfolios();
  const name = (id: string) => portfolios.data?.find(p => p.id === id)?.name ?? '–';
  const sperren = m.pruefung.filter(p => p.stufe === 'sperre');

  if (bearbeiten) return <Editor l={l} onFertig={() => setBearbeiten(false)} neuLaden={neuLaden} />;

  return (
    <div className="pr-modell">
      {m.stand === 'in_kraft' ? (
        <Hinweis stufe="hinweis">{TP.modellNurLesen}{m.inKraftAt ? ` ${TP.inKraftSeitSatz(fmtDatum(m.inKraftAt), m.beschluss)}` : ''}</Hinweis>
      ) : null}
      {m.beschreibung ? <p>{m.beschreibung}</p> : null}
      {m.can.write ? (
        <div className="pr-akt">
          <button type="button" className="btn" onClick={() => setBearbeiten(true)}><Icon name="edit" />{TP.bearbeiten}</button>
          <button type="button" className="btn primary" onClick={() => setDialog('inkraft')}><Icon name="check" />{TP.inKraftSetzen}</button>
          <button type="button" className="btn danger" onClick={() => setDialog('verwerfen')}><Icon name="trash" />{TP.verwerfen}</button>
        </div>
      ) : null}
      <Pruefbericht m={m} />
      <h3>{TP.kriterien}</h3>
      <table className="pr-tab">
        <caption className="sr">{TP.kriterien}</caption>
        <thead><tr><th scope="col">{TP.kriterium}</th><th scope="col">{TP.zuordnung}</th></tr></thead>
        <tbody>
          {(m.kriterien as Bewertungsmodell['kriterien']).map(c => (
            <tr key={c.schluessel}>
              <td>{c.text}{c.beschreibung ? <div className="pr-hint">{c.beschreibung}</div> : null}</td>
              <td>{c.dimension ? TP.dimension[c.dimension] : <span className="empty">{TP.ohneDimension}</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>{TP.budgetrahmen}</h3>
      {m.budgetrahmen.length ? (
        <table className="pr-tab">
          <caption className="sr">{TP.budgetrahmen}</caption>
          <thead><tr><th scope="col">{TP.portfolio}</th><th scope="col" className="num">{TP.betrag}</th></tr></thead>
          <tbody>
            {m.budgetrahmen.map(b => <tr key={b.portfolioId}><td>{b.kategorie} · {name(b.portfolioId)}</td><td className="num">{fmtBetrag(b.betrag)}</td></tr>)}
          </tbody>
        </table>
      ) : <p className="empty">{TP.ohneRahmen}</p>}

      {dialog === 'inkraft' ? (
        <InKraftDialog m={m} sperren={sperren.map(s => s.text)} busy={inKraft.isPending} onClose={() => setDialog(null)}
          onConfirm={beschluss => inKraft.mutate({ id: m.id, etag: l.etag, beschluss }, {
            onSuccess: () => { setDialog(null); toast.show(TP.inKraftToast); },
            onError: e => { setDialog(null); toast.error(e); },
          })} />
      ) : null}
      {dialog === 'verwerfen' ? (
        <Confirm title={TP.verwerfen} text={TP.verwerfenFrage(m.nummer)} confirm={TP.verwerfen} busy={verwerfen.isPending} onClose={() => setDialog(null)}
          onConfirm={() => verwerfen.mutate({ id: m.id, etag: l.etag }, {
            onSuccess: () => { setDialog(null); toast.show(TP.verworfen); onClose(); },
            onError: e => { setDialog(null); toast.error(e); },
          })} />
      ) : null}
    </div>
  );
}

function Pruefbericht({ m }: { m: Bewertungsmodell }) {
  if (m.stand !== 'entwurf') return null;
  return (
    <section aria-label={TP.pruefbericht} className="pr-pruefung">
      <h3>{TP.pruefbericht}</h3>
      {m.pruefung.length ? m.pruefung.map(p => <Hinweis key={p.pfad} stufe={p.stufe}>{p.text}</Hinweis>) : <p className="empty">{TP.keineBefunde}</p>}
    </section>
  );
}

function InKraftDialog({ m, sperren, busy, onClose, onConfirm }: { m: Bewertungsmodell; sperren: string[]; busy: boolean; onClose(): void; onConfirm(beschluss: string): void }) {
  const id = useId();
  const [beschluss, setBeschluss] = useState('');
  const [fehlt, setFehlt] = useState(false);
  return (
    <Dialog title={TP.inKraftDialog(m.nummer)} onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose} data-autofocus={sperren.length ? true : undefined}>{T.common.cancel}</button>
      {sperren.length ? null : (
        <button type="button" className="btn primary" disabled={busy} onClick={() => { if (!beschluss.trim()) { setFehlt(true); document.getElementById(id)?.focus(); return; } onConfirm(beschluss.trim()); }}>{TP.inKraftSetzen}</button>
      )}
    </>}>
      {sperren.length ? sperren.map(s => <Hinweis key={s} stufe="sperre">{s}</Hinweis>) : (
        <>
          <p>{TP.inKraftWirkung}</p>
          <div className="field">
            <label htmlFor={id}>{TP.beschlussLabel}</label>
            <input id={id} type="text" maxLength={500} value={beschluss} aria-invalid={fehlt || undefined} aria-describedby={`${id}-h`} data-autofocus
              onChange={e => { setBeschluss(e.target.value); setFehlt(false); }} />
            <p id={`${id}-h`} className={fehlt ? 'ferr' : 'hint'}>{fehlt ? TP.beschlussFehlt : TP.beschlussHinweis}</p>
          </div>
        </>
      )}
    </Dialog>
  );
}

function Editor({ l, onFertig, neuLaden }: { l: Loaded; onFertig(): void; neuLaden(): Promise<void> }) {
  const m = l.item;
  const id = useId();
  const toast = useToast();
  const { aendern } = useModellMutations();
  const portfolios = usePortfolios();
  const [beschreibung, setBeschreibung] = useState(m.beschreibung);
  const [kriterien, setKriterien] = useState<KritEntwurf[]>((m.kriterien as Bewertungsmodell['kriterien']).map(c => ({ schluessel: c.schluessel, text: c.text, beschreibung: c.beschreibung, dimension: c.dimension as Dim })));
  const [budget, setBudget] = useState<Record<string, string>>(Object.fromEntries(m.budgetrahmen.map(b => [b.portfolioId, String(b.betrag)])));
  const [pruefen, setPruefen] = useState(false);
  const [konflikt, setKonflikt] = useState(false);

  const textFehler = (i: number) => pruefen && !kriterien[i]!.text.trim();
  const betragFehler = (pid: string) => pruefen && betragAus(budget[pid] ?? '') === undefined;
  const aendereK = (i: number, p: Partial<KritEntwurf>) => setKriterien(ks => ks.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const schiebe = (i: number, d: -1 | 1) => setKriterien(ks => {
    const n = [...ks];
    [n[i], n[i + d]] = [n[i + d]!, n[i]!];
    return n;
  });

  const speichern = () => {
    setPruefen(true);
    const ungueltigK = kriterien.findIndex(x => !x.text.trim());
    const ungueltigB = Object.keys(budget).find(pid => betragAus(budget[pid] ?? '') === undefined);
    if (ungueltigK >= 0) { document.getElementById(`${id}-k${ungueltigK}`)?.focus(); return; }
    if (ungueltigB) { document.getElementById(`${id}-b${ungueltigB}`)?.focus(); return; }
    const budgetrahmen = Object.entries(budget).flatMap(([portfolioId, t]) => {
      const b = betragAus(t);
      return b === null || b === undefined ? [] : [{ portfolioId, betrag: b }];
    });
    aendern.mutate({
      id: m.id, etag: l.etag,
      body: { beschreibung: beschreibung.trim(), kriterien: kriterien.map(x => ({ ...(x.schluessel ? { schluessel: x.schluessel } : {}), text: x.text.trim(), beschreibung: x.beschreibung.trim(), dimension: x.dimension })), budgetrahmen },
    }, {
      onSuccess: () => { toast.show(TP.gespeichertToast); onFertig(); },
      onError: e => (isConflict(e) ? setKonflikt(true) : toast.error(e)),
    });
  };

  return (
    <form className="pr-editor" onSubmit={e => { e.preventDefault(); speichern(); }} noValidate>
      {konflikt ? <Hinweis stufe="warnung" live aktion={<button type="button" className="btn" onClick={() => void neuLaden()}>{TP.neuLaden}</button>}>{TP.modellKonflikt}</Hinweis> : null}
      <div className="field">
        <label htmlFor={`${id}-b`}>{TP.beschreibung}</label>
        <textarea id={`${id}-b`} rows={2} maxLength={2000} value={beschreibung} onChange={e => setBeschreibung(e.target.value)} />
      </div>
      <fieldset className="pr-fs">
        <legend>{TP.kriterien}</legend>
        {kriterien.map((x, i) => (
          <div key={i} className="pr-krit">
            <div className="pr-krit-f">
              <label htmlFor={`${id}-k${i}`}>{TP.text} {i + 1}</label>
              <input id={`${id}-k${i}`} type="text" maxLength={200} value={x.text} aria-invalid={textFehler(i) || undefined} aria-describedby={textFehler(i) ? `${id}-k${i}-e` : undefined}
                onChange={e => aendereK(i, { text: e.target.value })} />
              {textFehler(i) ? <p id={`${id}-k${i}-e`} className="ferr">{TP.textFehlt}</p> : null}
            </div>
            <div className="pr-krit-f">
              <label htmlFor={`${id}-d${i}`}>{TP.zuordnung}</label>
              <select id={`${id}-d${i}`} className="pr-in" value={x.dimension ?? ''} onChange={e => aendereK(i, { dimension: (e.target.value || null) as Dim })}>
                <option value="">{TP.ohneDimension}</option>
                <option value="nutzen">{TP.dimension.nutzen}</option>
                <option value="risiko">{TP.dimension.risiko}</option>
              </select>
            </div>
            <div className="pr-krit-a">
              <button type="button" className="iconbtn" aria-label={TP.hoch_(x.text || String(i + 1))} disabled={i === 0} onClick={() => schiebe(i, -1)}><Icon name="up" /></button>
              <button type="button" className="iconbtn" aria-label={TP.runter(x.text || String(i + 1))} disabled={i === kriterien.length - 1} onClick={() => schiebe(i, 1)}><Icon name="down" /></button>
              <button type="button" className="iconbtn" aria-label={TP.kriteriumEntfernen(x.text || String(i + 1))} onClick={() => setKriterien(ks => ks.filter((_, j) => j !== i))}><Icon name="trash" /></button>
            </div>
          </div>
        ))}
        <button type="button" className="btn" onClick={() => setKriterien(ks => [...ks, { text: '', beschreibung: '', dimension: null }])}><Icon name="plus" />{TP.kriteriumNeu}</button>
      </fieldset>
      <fieldset className="pr-fs">
        <legend>{TP.budgetrahmen}</legend>
        <p className="pr-hint">{TP.budgetHinweis}</p>
        {(portfolios.data ?? []).map(p => (
          <div key={p.id} className="pr-krit-f">
            <label htmlFor={`${id}-b${p.id}`}>{`${p.kategorie} · ${p.name}`}</label>
            <input id={`${id}-b${p.id}`} type="text" inputMode="decimal" value={budget[p.id] ?? ''} placeholder={TP.ohneRahmen}
              aria-invalid={betragFehler(p.id) || undefined} aria-describedby={betragFehler(p.id) ? `${id}-b${p.id}-e` : undefined}
              onChange={e => setBudget(b => ({ ...b, [p.id]: e.target.value }))} />
            {betragFehler(p.id) ? <p id={`${id}-b${p.id}-e`} className="ferr">{TP.betragUngueltig}</p> : null}
          </div>
        ))}
      </fieldset>
      <div className="pr-akt">
        <button type="submit" className="btn primary" disabled={aendern.isPending}>{TP.speichern}</button>
        <button type="button" className="btn" onClick={onFertig}>{TP.abbrechen}</button>
      </div>
    </form>
  );
}
