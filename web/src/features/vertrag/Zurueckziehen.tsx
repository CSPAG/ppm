/**
 * Projekt zurückziehen (DM.02.04; UC-002 A4; K2 Schritt 6 «Zurückziehen», nur SP): Aktion im Kopf des Reiters
 * «Vertrag» mit Dialog. Unumkehrbar und wirkt auf andere (I-R1 Stufe 3): die Wirkung steht vor der Handlung, die
 * Begründung ist Pflicht (K2 «Regeln»).
 */
import { useId, useState } from 'react';
import { describeError } from '@vollholz/iam-web';
import { statusOf } from '../../api/index.ts';
import { Dialog, Hinweis, Icon, useToast } from '../../ui/index.ts';
import { useVertragMutations, type VersionLoaded } from './api.ts';
import { TV } from './texte.ts';

export function Zurueckziehen({ projektId, projektName, loaded }: { projektId: string; projektName: string; loaded: VersionLoaded }) {
  const [offen, setOffen] = useState(false);
  if (!loaded.detail.version.can.zurueckziehen) return null;
  return (
    <>
      <button type="button" className="btn danger" onClick={() => setOffen(true)}><Icon name="ban" />{TV.zurueckziehen}</button>
      {offen ? <ZurueckziehenDialog projektId={projektId} projektName={projektName} loaded={loaded} onClose={() => setOffen(false)} /> : null}
    </>
  );
}

function ZurueckziehenDialog({ projektId, projektName, loaded, onClose }: { projektId: string; projektName: string; loaded: VersionLoaded; onClose(): void }) {
  const id = useId();
  const toast = useToast();
  const { zurueckziehen } = useVertragMutations(projektId);
  const [text, setText] = useState('');
  const [versucht, setVersucht] = useState(false);
  const leer = !text.trim();
  const err = versucht && leer ? TV.zurueckziehenBegruendungFehlt : statusOf(zurueckziehen.error) === 422 ? describeError(zurueckziehen.error).detail : undefined;
  const sperre = zurueckziehen.error && statusOf(zurueckziehen.error) !== 422 ? describeError(zurueckziehen.error).detail : null;
  return (
    <Dialog title={TV.zurueckziehenFrage(projektName)} onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose} data-autofocus>{TV.abbrechen}</button>
      <button type="submit" form={`${id}-f`} className="btn danger solid" disabled={zurueckziehen.isPending}>{TV.zurueckziehen}</button>
    </>}>
      <p>{TV.zurueckziehenWirkung}</p>
      {sperre ? <Hinweis stufe="sperre" live>{sperre}</Hinweis> : null}
      <form id={`${id}-f`} className="form" noValidate onSubmit={e => {
        e.preventDefault();
        setVersucht(true);
        if (leer) return;
        zurueckziehen.mutate({ id: loaded.detail.version.id, etag: loaded.etag, begruendung: text.trim() }, {
          onSuccess: () => { onClose(); toast.show(TV.zurueckgezogen); },
        });
      }}>
        <div className="field">
          <label htmlFor={`${id}-b`}>{TV.zurueckziehenBegruendung}</label>
          <textarea id={`${id}-b`} value={text} onChange={e => setText(e.target.value)} rows={4} maxLength={5000}
            aria-invalid={err ? true : undefined} aria-describedby={`${id}-h${err ? ` ${id}-e` : ''}`} />
          <p id={`${id}-h`} className="hint">{TV.zurueckziehenHint}</p>
          {err ? <p id={`${id}-e`} className="ferr" role="alert">{err}</p> : null}
        </div>
      </form>
    </Dialog>
  );
}
