/**
 * Entscheid über die Initialisierung (K4 Schritte 8–10, UI-04; AP-E4-3; UC-001 Schritte 6–7, A4, A5) als Abschnitt der
 * Prüfansicht: Die UE erfasst Sponsor und Projektleitung (A-05) und legt die Idee dem Gremium vor (Kategorie A, B) oder
 * übergibt sie der Direktion (C); die Direktion gibt frei oder weist zurück. Nach der Freigabe Verweis auf das Projekt.
 * Wirkung steht vor der Handlung (I-R1); 412 → neu laden (Z7).
 */
import { PersonName, PersonPick } from '@vollholz/iam-web';
import { useId, useState } from 'react';
import { isConflict } from '../../api/index.ts';
import { Dialog, ErrorState, Hinweis, Icon, Loading, T, useToast } from '../../ui/index.ts';
import type { Idee } from './api.ts';
import { useFreigabe, useFreigabeMutations, type FreigabeLoaded } from './FreigabeApi.ts';
import { TF } from './FreigabeTexte.ts';
import { Verweis, type Gehe } from './stand.tsx';
import { TI } from './texte.ts';

export function FreigabeAbschnitt({ idee, gehe, titleId }: { idee: Idee; gehe: Gehe; titleId: string }) {
  const f = useFreigabe(idee.id);
  const toast = useToast();
  const m = useFreigabeMutations(idee.id);
  const [ablehnen, setAblehnen] = useState(false);
  const hId = `${titleId}-fr`;
  if (f.isPending) return <Loading />;
  if (f.error) return <ErrorState error={f.error} onRetry={() => void f.refetch()} />;
  const { item, etag } = f.data;
  const fehler = (e: unknown) => {
    if (isConflict(e)) { toast.error(e, TF.konflikt); void f.refetch(); } else toast.error(e);
  };
  const titel = idee.titel || TI.ohneTitel;
  const wer = item.zustaendig ?? '';
  return (
    <section aria-labelledby={hId} className="idee-abschnitt">
      <h2 id={hId}>{TF.titel}</h2>
      {!item.weg ? <p className="muted">{TF.ohneKategorie}</p> : <p className="muted">{TF.zustaendig(wer)}</p>}

      {item.projekt ? (
        <Hinweis stufe="hinweis" aktion={<Verweis pfad={`/projekte/${item.projekt.nummer}`} gehe={gehe} className="btn sm">{TF.zumProjekt}</Verweis>}>
          {TF.freigegeben(item.projekt.nummer, item.projekt.name)}
        </Hinweis>
      ) : idee.stand === 'traktandiert' && item.weg === 'gremium' ? <Hinweis stufe="hinweis">{TF.vorgelegt(wer)}</Hinweis>
        : idee.stand === 'traktandiert' && item.weg === 'direktion' && !item.can.entscheiden ? <Hinweis stufe="hinweis">{TF.beiDirektion(wer)}</Hinweis>
          : idee.stand === 'zurueckgestellt' ? <Hinweis stufe="hinweis">{TF.zurueckgestellt}</Hinweis> : null}

      {item.can.angaben ? (
        <Angaben key={etag} freigabe={f.data} busy={m.angaben.isPending}
          speichern={body => m.angaben.mutate({ etag, body }, { onSuccess: () => toast.show(TF.gespeichert), onError: fehler })} />
      ) : item.weg === 'gremium' && (item.sponsor || item.projektleitung) ? (
        <dl className="attrs idee-attrs">
          <div className="idee-attr"><dt>{TF.sponsor}</dt><dd>{item.sponsor ? <PersonName id={item.sponsor} /> : <span className="muted">{TI.leerWert}</span>}</dd></div>
          <div className="idee-attr"><dt>{TF.projektleitung}</dt><dd>{item.projektleitung ? <PersonName id={item.projektleitung} /> : <span className="muted">{TI.leerWert}</span>}</dd></div>
        </dl>
      ) : null}

      {item.can.traktandieren ? (
        <div className="idee-form">
          <p className="hint">{item.weg === 'gremium' ? TF.traktandierenWirkung(wer) : TF.uebergebenWirkung(wer)}</p>
          <div className="acts">
            <button type="button" className="btn primary" aria-busy={m.traktandieren.isPending} disabled={m.traktandieren.isPending}
              onClick={() => m.traktandieren.mutate({ etag }, { onSuccess: () => toast.show(TF.vorgelegtToast), onError: fehler })}>
              {item.weg === 'gremium' ? TF.traktandieren : TF.uebergeben(wer)}
            </button>
          </div>
        </div>
      ) : null}

      {item.can.entscheiden ? (
        <Freigeben key={etag} freigabe={f.data} titel={titel} busy={m.freigeben.isPending} onAblehnen={() => setAblehnen(true)}
          freigeben={body => m.freigeben.mutate({ etag, body }, { onSuccess: () => toast.show(TF.freigegebenToast), onError: fehler })} />
      ) : null}

      {ablehnen ? (
        <AblehnenDialog titel={titel} busy={m.ablehnen.isPending} onClose={() => setAblehnen(false)}
          ablehnen={begruendung => m.ablehnen.mutate({ etag, begruendung }, {
            onSuccess: () => { setAblehnen(false); toast.show(TF.zurueckgewiesenToast); }, onError: e => { setAblehnen(false); fehler(e); },
          })} />
      ) : null}
    </section>
  );
}

function Angaben({ freigabe, speichern, busy }: { freigabe: FreigabeLoaded; busy: boolean; speichern(body: { sponsor: string | null; projektleitung: string | null }): void }) {
  const id = useId();
  const { item } = freigabe;
  const [sponsor, setSponsor] = useState<string | null>(item.sponsor ?? item.vorgesehenerSponsor);
  const [pl, setPl] = useState<string | null>(item.projektleitung);
  return (
    <form className="form idee-form" onSubmit={e => { e.preventDefault(); speichern({ sponsor, projektleitung: pl }); }}>
      <div className="field">
        <label htmlFor={`${id}-sp`}>{TF.sponsor}</label>
        <PersonPick id={`${id}-sp`} value={sponsor ?? ''} onChange={v => setSponsor(v || null)} />
      </div>
      <div className="field">
        <label htmlFor={`${id}-pl`}>{TF.projektleitung}</label>
        <PersonPick id={`${id}-pl`} value={pl ?? ''} onChange={v => setPl(v || null)} />
      </div>
      <p className="hint">{TF.angabenHilfe}</p>
      <div className="acts"><button type="submit" className="btn" aria-busy={busy} disabled={busy}>{TF.angabenSpeichern}</button></div>
    </form>
  );
}

function Freigeben({ freigabe, titel, freigeben, onAblehnen, busy }: {
  freigabe: FreigabeLoaded; titel: string; busy: boolean; onAblehnen(): void;
  freigeben(body: { sponsor: string; projektleitung: string; begruendung: string }): void;
}) {
  const id = useId();
  const { item } = freigabe;
  const [sponsor, setSponsor] = useState<string>(item.sponsor ?? item.vorgesehenerSponsor ?? '');
  const [pl, setPl] = useState<string>(item.projektleitung ?? '');
  const [begruendung, setBegruendung] = useState('');
  const [fehlt, setFehlt] = useState<{ sponsor: boolean; pl: boolean }>({ sponsor: false, pl: false });
  return (
    <form className="form idee-form" onSubmit={e => {
      e.preventDefault();
      if (!sponsor || !pl) { setFehlt({ sponsor: !sponsor, pl: !pl }); return; }
      freigeben({ sponsor, projektleitung: pl, begruendung: begruendung.trim() });
    }}>
      <div className="field">
        <label htmlFor={`${id}-sp`}>{TF.sponsor}</label>
        <PersonPick id={`${id}-sp`} value={sponsor} onChange={v => { setSponsor(v); setFehlt(x => ({ ...x, sponsor: false })); }} />
        {fehlt.sponsor ? <p className="ferr" role="alert">{TF.sponsorFehlt}</p> : null}
      </div>
      <div className="field">
        <label htmlFor={`${id}-pl`}>{TF.projektleitung}</label>
        <PersonPick id={`${id}-pl`} value={pl} onChange={v => { setPl(v); setFehlt(x => ({ ...x, pl: false })); }} />
        {fehlt.pl ? <p className="ferr" role="alert">{TF.plFehlt}</p> : null}
      </div>
      <div className="field">
        <label htmlFor={`${id}-b`}>{TF.begruendung} <span className="muted">({TF.optional})</span></label>
        <textarea id={`${id}-b`} rows={2} maxLength={4000} value={begruendung} onChange={e => setBegruendung(e.target.value)} />
      </div>
      <p className="idee-wirkung"><Icon name="info" /> {TF.freigebenWirkung(titel)}</p>
      <div className="acts">
        <button type="button" className="btn danger" onClick={onAblehnen}>{TF.zurueckweisen}</button>
        <button type="submit" className="btn primary" aria-busy={busy} disabled={busy}>{TF.freigeben}</button>
      </div>
    </form>
  );
}

function AblehnenDialog({ titel, ablehnen, onClose, busy }: { titel: string; ablehnen(b: string): void; onClose(): void; busy: boolean }) {
  const id = useId();
  const [begruendung, setBegruendung] = useState('');
  const [fehlt, setFehlt] = useState(false);
  return (
    <Dialog title={TF.zurueckweisenFrage(titel)} onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose}>{T.common.cancel}</button>
      <button type="button" className="btn danger solid" disabled={busy} onClick={() => {
        if (!begruendung.trim()) { setFehlt(true); return; }
        ablehnen(begruendung.trim());
      }}>{TF.zurueckweisen}</button>
    </>}>
      <div className="form">
        <div className="field">
          <label htmlFor={`${id}-b`}>{TF.begruendung}</label>
          <textarea id={`${id}-b`} rows={3} maxLength={4000} value={begruendung} data-autofocus onChange={e => { setBegruendung(e.target.value); setFehlt(false); }}
            aria-invalid={fehlt || undefined} aria-describedby={fehlt ? `${id}-e` : undefined} />
          {fehlt ? <p id={`${id}-e`} className="ferr" role="alert">{TF.begruendungFehlt}</p> : null}
        </div>
        <p className="hint">{TF.zurueckweisenWirkung}</p>
      </div>
    </Dialog>
  );
}
