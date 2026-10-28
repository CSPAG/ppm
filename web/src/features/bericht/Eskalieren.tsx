/**
 * «Eskalieren» an der Warnung «wesentliche Abweichung» (UC-004 A1.2, K1 Schritt 2 und Regeln): öffnet den Dialog in
 * eigenem Kontext mit der Wirkung davor (I-R1: Traktandenvorschlag an die nächste Sitzung des entscheidenden Gremiums,
 * K3), Grund vorbelegt mit der Abweichung, Massnahme freiwillig. Der Bericht bleibt Entwurf und ist mit der Eskalation
 * verknüpft; danach steht an der Warnung, dass und wann eskaliert wurde. Nur, wenn die Person jetzt eskalieren darf.
 */
import { describeError } from '@vollholz/iam-web';
import { useId, useRef, useState } from 'react';
import { newIdempotencyKey, statusOf } from '../../api/index.ts';
import { Dialog, fmtDatum, Hinweis, Icon, T, useToast } from '../../ui/index.ts';
import { useEskalieren, type Bericht } from './api.ts';
import { TB } from './texte.ts';

export interface EskalationLage {
  /** `can.eskalieren` des Berichts. */
  kann: boolean;
  eskalation: Bericht['eskalation'];
  projektId: string;
  periode: string;
  /** Offene Änderungen des Berichts vorher speichern (sonst passt die Version nicht mehr). */
  sichern(): Promise<boolean>;
}

export function Eskalieren({ lage, grund }: { lage: EskalationLage; grund: string }) {
  const [offen, setOffen] = useState(false);
  const e = lage.eskalation;
  if (e) return <span className="muted small">{TB.wesentlich.eskaliert(fmtDatum(e.angelegtAt.slice(0, 10)), TB.wesentlich.eskalationStand(e.stand, e.vorgeschlagen))}</span>;
  if (!lage.kann) return null;
  return (
    <>
      <button type="button" className="btn sm" onClick={() => setOffen(true)}><Icon name="gavel" />{TB.wesentlich.eskalieren}</button>
      {offen ? <EskalierenDialog lage={lage} grund={grund} onClose={() => setOffen(false)} /> : null}
    </>
  );
}

function EskalierenDialog({ lage, grund: vorbelegt, onClose }: { lage: EskalationLage; grund: string; onClose(): void }) {
  const id = useId();
  const key = useRef(newIdempotencyKey());
  const toast = useToast();
  const eskalieren = useEskalieren(lage.projektId, lage.periode);
  const [grund, setGrund] = useState(vorbelegt);
  const [massnahme, setMassnahme] = useState('');
  const [versucht, setVersucht] = useState(false);
  const leer = !grund.trim();
  const err = versucht && leer ? TB.wesentlich.grundFehlt : statusOf(eskalieren.error) === 422 ? describeError(eskalieren.error).detail : undefined;
  const konflikt = statusOf(eskalieren.error) === 409 ? describeError(eskalieren.error).detail : null;
  const senden = async () => {
    setVersucht(true);
    if (leer || !(await lage.sichern())) return;
    eskalieren.mutate({ key: key.current, grund: grund.trim(), massnahme: massnahme.trim() }, {
      onSuccess: l => { toast.show(TB.wesentlich.eskaliertOk(l.bericht.eskalation?.vorgeschlagen ?? true)); onClose(); },
    });
  };
  return (
    <Dialog title={TB.wesentlich.eskalierenTitel} onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose}>{T.common.cancel}</button>
      <button type="submit" form={`${id}-f`} className="btn primary" disabled={eskalieren.isPending}>{TB.wesentlich.eskalieren}</button>
    </>}>
      <p>{TB.wesentlich.eskalierenWirkung}</p>
      {konflikt ? <Hinweis stufe="sperre" live>{konflikt}</Hinweis> : null}
      <form id={`${id}-f`} className="form" noValidate onSubmit={ev => { ev.preventDefault(); void senden(); }}>
        <div className="field">
          <label htmlFor={`${id}-g`}>{TB.wesentlich.grund}</label>
          <textarea id={`${id}-g`} value={grund} onChange={ev => setGrund(ev.target.value)} rows={4} maxLength={4000} data-autofocus
            aria-invalid={err ? true : undefined} aria-describedby={`${id}-gh${err ? ` ${id}-ge` : ''}`} />
          <p id={`${id}-gh`} className="hint">{TB.wesentlich.grundHint}</p>
          {err ? <p id={`${id}-ge`} className="ferr" role="alert">{err}</p> : null}
        </div>
        <div className="field">
          <label htmlFor={`${id}-m`}>{TB.wesentlich.massnahme}</label>
          <textarea id={`${id}-m`} value={massnahme} onChange={ev => setMassnahme(ev.target.value)} rows={3} maxLength={4000} aria-describedby={`${id}-mh`} />
          <p id={`${id}-mh`} className="hint">{TB.wesentlich.massnahmeHint}</p>
        </div>
      </form>
    </Dialog>
  );
}
