/**
 * Schublade einer Codetabelle (`?o=<tabelle>`), UC-017 Schritt 2: Werte mit Schlüssel, Text, Reihenfolge und Stand;
 * Wert hinzufügen, Text und Reihenfolge ändern, deaktivieren statt löschen. Deaktivieren ist umkehrbar und wird sofort
 * ausgeführt, mit «Rückgängig» im Toast (I-R1 Stufe 1). Bei 412 lädt «Neu laden» den Wert neu, die Eingaben im Formular
 * bleiben (Z7); gespeichert wird immer mit der Version aus der Liste.
 */
import { describeError } from '@vollholz/iam-web';
import { useId, useState, type FormEvent } from 'react';
import { isConflict, newIdempotencyKey } from '../../api/index.ts';
import { useSession } from '../../auth/index.ts';
import { Drawer, Empty, ErrorState, Icon, Loading, Stand, T, useToast } from '../../ui/index.ts';
import { useCodeMutations, useWerte, type Codetabelle, type Codewert, type TabelleKey } from './api.ts';
import { TS } from './texte.ts';

export function CodetabelleDrawer({ schluessel, tabellen, laedt, onClose }: { schluessel: string; tabellen: Codetabelle[]; laedt: boolean; onClose(): void }) {
  const tabelle = tabellen.find(t => t.schluessel === schluessel);
  if (laedt) return <Drawer title={TS.code.tabelle} onClose={onClose}><Loading /></Drawer>;
  if (!tabelle) return <Drawer title={TS.code.tabelle} onClose={onClose}><Empty>{TS.code.gone}</Empty></Drawer>;
  return <Werte tabelle={tabelle} onClose={onClose} />;
}

type Modus = { art: 'liste' } | { art: 'neu' } | { art: 'bearbeiten'; wert: Codewert };

function Werte({ tabelle, onClose }: { tabelle: Codetabelle; onClose(): void }) {
  const key = tabelle.schluessel as TabelleKey;
  const q = useWerte(key);
  const toast = useToast();
  const m = useCodeMutations(key);
  const [modus, setModus] = useState<Modus>({ art: 'liste' });
  // Recht an der Organisation (auch für leere Tabellen); die Werte tragen dasselbe in `can.write`
  const canWrite = useSession().can('stammdaten:write');

  const umschalten = (wert: Codewert, aktiv: boolean) => m.umschalten.mutate({ wert, aktiv }, {
    onSuccess: neu => toast.show(aktiv ? TS.code.aktiviert(neu.label) : TS.code.deaktiviert(neu.label), {
      action: { label: TS.code.rueckgaengig, run: () => m.umschalten.mutate({ wert: neu, aktiv: !aktiv }, { onError: e => toast.error(e) }) },
    }),
    onError: e => toast.error(e, isConflict(e) ? TS.code.conflict : undefined),
  });

  if (modus.art !== 'liste') {
    return <WertFormular tabelle={tabelle} modus={modus} onDone={() => setModus({ art: 'liste' })} />;
  }
  return (
    <Drawer title={tabelle.label} onClose={onClose} actions={canWrite ? (
      <button type="button" className="btn sm" onClick={() => setModus({ art: 'neu' })}><Icon name="plus" />{TS.code.neu}</button>
    ) : undefined}>
      <p className="sub">{tabelle.beschreibung}</p>
      {q.isPending ? <Loading /> : q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : q.data.length === 0 ? <Empty>{TS.code.leer}</Empty> : (
        <table className="dl">
          <caption className="sr">{tabelle.label}</caption>
          <thead>
            <tr>
              <th scope="col">{TS.code.label}</th>
              <th scope="col">{TS.code.schluessel}</th>
              <th scope="col" className="num">{TS.code.position}</th>
              <th scope="col">{TS.code.stand}</th>
              {canWrite ? <th scope="col"><span className="sr">{T.common.edit}</span></th> : null}
            </tr>
          </thead>
          <tbody>
            {q.data.map(w => (
              <tr key={w.id} className="static">
                <td data-label={TS.code.label} className="nm karte">{w.label}</td>
                <td data-label={TS.code.schluessel} className="mono karte">{w.schluessel}</td>
                <td data-label={TS.code.position} className="num">{w.position}</td>
                <td data-label={TS.code.stand} className="karte">{w.aktiv ? TS.code.aktiv : <Stand familie="ruhend" label={TS.code.inaktiv} />}</td>
                {canWrite ? (
                  <td className="karte">
                    <button type="button" className="btn sm" aria-label={TS.code.bearbeiten(w.label)} onClick={() => setModus({ art: 'bearbeiten', wert: w })}><Icon name="edit" /></button>
                    {' '}
                    <button type="button" className="btn sm" disabled={m.umschalten.isPending} onClick={() => umschalten(w, !w.aktiv)}
                      aria-label={`${w.aktiv ? TS.code.deaktivieren : TS.code.aktivieren}: ${w.label}`}>
                      {w.aktiv ? TS.code.deaktivieren : TS.code.aktivieren}
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="hint">{TS.code.deaktiviertHint}</p>
      {!canWrite && q.data?.length ? <p className="note">{TS.code.noRight}</p> : null}
    </Drawer>
  );
}

interface FormValues { schluessel: string; label: string; position: string }

function validate(v: FormValues, neu: boolean): Partial<Record<keyof FormValues, string>> {
  const e: Partial<Record<keyof FormValues, string>> = {};
  if (neu && !/^[A-Za-z0-9_]{1,40}$/.test(v.schluessel.trim())) e.schluessel = TS.code.schluesselInvalid;
  if (!v.label.trim()) e.label = TS.code.labelMissing;
  if (!/^\d{1,3}$/.test(v.position.trim())) e.position = TS.code.positionInvalid;
  return e;
}

function WertFormular({ tabelle, modus, onDone }: { tabelle: Codetabelle; modus: Exclude<Modus, { art: 'liste' }>; onDone(): void }) {
  const formId = useId();
  const id = useId();
  const toast = useToast();
  const m = useCodeMutations(tabelle.schluessel as TabelleKey);
  const [key] = useState(newIdempotencyKey);
  const neu = modus.art === 'neu';
  const werte = useWerte(tabelle.schluessel as TabelleKey);
  // aktueller Stand des Werts (nach «Neu laden» mit neuer Version), sonst der beim Öffnen
  const w = modus.art === 'bearbeiten' ? werte.data?.find(x => x.id === modus.wert.id) ?? modus.wert : undefined;
  const [v, setV] = useState<FormValues>({ schluessel: w?.schluessel ?? '', label: w?.label ?? '', position: String(w?.position ?? 0) });
  const [touched, setTouched] = useState(false);
  const mutation = neu ? m.create : m.update;
  const errors = {
    ...Object.fromEntries((describeError(mutation.error).fields ?? []).map(x => [x.path.replace(/^\//, '').split('/')[0], x.message])),
    ...(touched ? validate(v, neu) : {}),
  } as Partial<Record<string, string>>;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    const fehler = validate(v, neu);
    if (Object.keys(fehler).length) { document.getElementById(`${id}-${Object.keys(fehler)[0]}`)?.focus(); return; }
    const fertig = { onSuccess: () => { toast.show(neu ? TS.code.created : TS.code.saved); onDone(); } };
    if (neu) m.create.mutate({ body: { schluessel: v.schluessel.trim(), label: v.label.trim(), position: Number(v.position) }, key }, fertig);
    else m.update.mutate({ wert: w!, body: { label: v.label.trim(), position: Number(v.position) } }, fertig);
  };
  const describedBy = (k: keyof FormValues, hint?: boolean) =>
    [hint ? `${id}-${k}-h` : '', errors[k] ? `${id}-${k}-e` : ''].filter(Boolean).join(' ') || undefined;
  const error = (k: keyof FormValues) => errors[k] ? <p id={`${id}-${k}-e`} className="ferr">{errors[k]}</p> : null;
  return (
    <Drawer title={neu ? `${tabelle.label}: ${TS.code.neu}` : TS.code.bearbeiten(w!.label)} onClose={onDone} footer={<>
      <button type="button" className="btn" onClick={onDone}>{T.common.cancel}</button>
      <button type="submit" form={formId} className="btn primary" disabled={mutation.isPending || isConflict(mutation.error)}>{T.common.save}</button>
    </>}>
      {isConflict(mutation.error) ? (
        <div className="notice" role="alert">
          <p>{TS.code.conflict}</p>
          <button type="button" className="btn" onClick={async () => { await werte.refetch(); mutation.reset(); }}>{T.common.reload}</button>
        </div>
      ) : mutation.error && !describeError(mutation.error).fields?.length ? <ErrorState error={mutation.error} /> : null}
      <form id={formId} className="form" onSubmit={submit} noValidate aria-busy={mutation.isPending}>
        <div className="field">
          <label htmlFor={`${id}-label`}>{TS.code.label}</label>
          <input id={`${id}-label`} value={v.label} onChange={e => setV({ ...v, label: e.target.value })} maxLength={100} autoComplete="off" data-autofocus
            aria-invalid={errors.label ? true : undefined} aria-describedby={describedBy('label')} />
          {error('label')}
        </div>
        <div className="field">
          <label htmlFor={`${id}-schluessel`}>{TS.code.schluessel}</label>
          <input id={`${id}-schluessel`} className="mono" value={v.schluessel} onChange={e => setV({ ...v, schluessel: e.target.value })} maxLength={40} autoComplete="off"
            readOnly={!neu} aria-invalid={errors.schluessel ? true : undefined} aria-describedby={describedBy('schluessel', true)} />
          <p id={`${id}-schluessel-h`} className="hint">{TS.code.schluesselHint}</p>
          {error('schluessel')}
        </div>
        <div className="field">
          <label htmlFor={`${id}-position`}>{TS.code.position}</label>
          <input id={`${id}-position`} inputMode="numeric" value={v.position} onChange={e => setV({ ...v, position: e.target.value })}
            aria-invalid={errors.position ? true : undefined} aria-describedby={describedBy('position')} />
          {error('position')}
        </div>
      </form>
    </Drawer>
  );
}
