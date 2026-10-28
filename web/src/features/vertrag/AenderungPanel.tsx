/**
 * Änderungsantrag in der Projektakte › Vertrag (UI-09; Kernablauf K2 Schritte 1, 5 und 6; UC-007 Schritte 1–3):
 * «Änderung beantragen» mit Begründung legt den Entwurf aus der Baseline an; im Seitenpanel des Entwurfs stehen Begründung,
 * Hauptänderungen in fünf Rubriken (erzeugt aus dem Vergleich, umformulierbar, dazu «Andere»), der Sprung zum Vergleich und
 * «Änderung einreichen» mit Wirkung davor (I-R1 Stufe 3). Die Änderung geht direkt an den Sponsor, ohne Quality-Check.
 */
import { describeError } from '@vollholz/iam-web';
import { useId, useRef, useState } from 'react';
import { newIdempotencyKey, statusOf } from '../../api/index.ts';
import { Dialog, ErrorState, Hinweis, Icon, T, useToast } from '../../ui/index.ts';
import { useAenderung, useAenderungMutations, useHauptaenderungen, type Hauptaenderungen, type HauptaenderungenLoaded, type Rubrik } from './AenderungApi.ts';
import { TA } from './AenderungTexte.ts';
import { useVertrag, type Version } from './api.ts';
import './Aenderung.css';

/**
 * «Änderung beantragen» (K2 Zustand «Kein Entwurf»): nur mit Baseline und ohne Entwurf, mit Pflichtbegründung. `oeffnen`:
 * Dialog gleich offen (Sprung aus der Warnung im Statusbericht, UC-004 A1); `onGeschlossen` meldet das Schliessen.
 */
export function AenderungBeantragen({ projektId, oeffnen = false, onAngelegt, onGeschlossen }: {
  projektId: string; oeffnen?: boolean; onAngelegt(): void; onGeschlossen?(): void;
}) {
  const vertrag = useVertrag(projektId);
  const [offen, setOffen] = useState(oeffnen);
  if (!vertrag.data?.can.entwerfen.includes('aenderung')) return null;
  const schliessen = () => { setOffen(false); onGeschlossen?.(); };
  return (
    <>
      <button type="button" className="btn" onClick={() => setOffen(true)}><Icon name="edit" />{TA.beantragen}</button>
      {offen ? <BeantragenDialog projektId={projektId} onClose={schliessen} onAngelegt={() => { setOffen(false); onAngelegt(); }} /> : null}
    </>
  );
}

function BeantragenDialog({ projektId, onClose, onAngelegt }: { projektId: string; onClose(): void; onAngelegt(): void }) {
  const id = useId();
  const key = useRef(newIdempotencyKey());
  const { beantragen } = useAenderungMutations(projektId);
  const [text, setText] = useState('');
  const [versucht, setVersucht] = useState(false);
  const leer = !text.trim();
  const err = versucht && leer ? TA.begruendungFehlt : statusOf(beantragen.error) === 422 ? describeError(beantragen.error).detail : undefined;
  const konflikt = statusOf(beantragen.error) === 409 ? describeError(beantragen.error).detail : null;
  return (
    <Dialog title={TA.beantragenFrage} onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose}>{TA.abbrechen}</button>
      <button type="submit" form={`${id}-f`} className="btn primary" disabled={beantragen.isPending}>{TA.anlegen}</button>
    </>}>
      <p>{TA.beantragenWirkung}</p>
      {konflikt ? <Hinweis stufe="sperre" live>{konflikt}</Hinweis> : null}
      <form id={`${id}-f`} className="form" noValidate onSubmit={e => {
        e.preventDefault();
        setVersucht(true);
        if (!leer) beantragen.mutate({ key: key.current, begruendung: text.trim() }, { onSuccess: onAngelegt });
      }}>
        <div className="field">
          <label htmlFor={`${id}-b`}>{TA.begruendung}</label>
          <textarea id={`${id}-b`} value={text} onChange={e => setText(e.target.value)} rows={4} maxLength={5000} data-autofocus
            aria-invalid={err ? true : undefined} aria-describedby={`${id}-h${err ? ` ${id}-e` : ''}`} />
          <p id={`${id}-h`} className="hint">{TA.begruendungHint}</p>
          {err ? <p id={`${id}-e`} className="ferr" role="alert">{err}</p> : null}
        </div>
      </form>
    </Dialog>
  );
}

/** Seitenpanel eines Änderungsentwurfs: Begründung, Hauptänderungen, Vergleich, Einreichen. */
export function AenderungPanel({ projektId, nummer, version: v, speichern }: { projektId: string; nummer: string; version: Version; speichern(): Promise<boolean> }) {
  const id = useId();
  const toast = useToast();
  const antrag = useAenderung(v.id);
  const haupt = useHauptaenderungen(v.id);
  const { einreichen } = useAenderungMutations(projektId);
  const [dialog, setDialog] = useState(false);
  const a = antrag.data?.aenderung;
  const sperre = einreichen.error && (statusOf(einreichen.error) === 422 || statusOf(einreichen.error) === 409) ? describeError(einreichen.error).detail : null;

  // erst einreichen, wenn das offene Kapitel gespeichert ist (sonst ginge der alte Stand an den Sponsor)
  const start = async () => { if (await speichern()) setDialog(true); };
  const jetzt = () => {
    if (!antrag.data) return;
    einreichen.mutate({ id: v.id, etag: antrag.data.etag }, {
      onSuccess: () => { setDialog(false); toast.show(TA.eingereicht); },
      onError: () => setDialog(false),
    });
  };

  return (
    <section className="ae-panel" aria-labelledby={`${id}-h`}>
      <h3 id={`${id}-h`} className="grp-h">{TA.antrag}</h3>
      <div>
        <p className="ae-l">{TA.begruendung}</p>
        <p className="ae-text">{v.begruendung}</p>
      </div>
      {a?.wirkung.prat ? <Hinweis stufe="hinweis">{TA.wirkungPrat}</Hinweis> : null}
      {haupt.error ? <ErrorState error={haupt.error} onRetry={() => void haupt.refetch()} />
        : haupt.data ? <HauptaenderungenBlock geladen={haupt.data} projektId={projektId} /> : <p className="muted small" role="status">{T.common.loading}</p>}
      <p><a className="btn sm" href={`/projekte/${nummer}/versionen?vergleich=${v.basisVersionId ?? 'baseline'}...${v.id}`}><Icon name="doc" />{TA.vergleichAnsehen}</a></p>
      {a?.can.einreichen ? (
        <div className="vt-einreichen">
          {sperre ? <Hinweis stufe="sperre" live>{sperre}</Hinweis> : null}
          <button type="button" className="btn primary" onClick={() => void start()}><Icon name="send" />{TA.einreichen}</button>
        </div>
      ) : null}
      {dialog ? (
        <Dialog title={TA.einreichenFrage(v.nummer)} onClose={() => setDialog(false)} footer={<>
          <button type="button" className="btn" onClick={() => setDialog(false)} data-autofocus>{TA.weiterBearbeiten}</button>
          <button type="button" className="btn primary" onClick={jetzt} disabled={einreichen.isPending}>{TA.einreichen}</button>
        </>}>
          <p>{TA.einreichenWirkung}</p>
        </Dialog>
      ) : null}
    </section>
  );
}

/** Text einer Rubrik: Umformulierung der PL oder die erzeugten Sätze. */
const anzeige = (r: Hauptaenderungen['rubriken'][number]) => r.text ?? r.erzeugt.join('\n');

/** Hauptänderungen lesen und umformulieren (K2 Schritt 5); auch in der Entscheid-Ansicht (nur lesen). */
export function HauptaenderungenBlock({ geladen, projektId }: { geladen: HauptaenderungenLoaded; projektId?: string }) {
  const id = useId();
  const toast = useToast();
  const { hauptSpeichern } = useAenderungMutations(projektId);
  const h = geladen.h;
  const [bearbeiten, setBearbeiten] = useState(false);
  const [werte, setWerte] = useState<Record<Rubrik | 'andere', string>>({} as Record<Rubrik | 'andere', string>);
  const oeffnen = () => {
    setWerte({ ...Object.fromEntries(h.rubriken.map(r => [r.rubrik, anzeige(r)])), andere: h.andere } as Record<Rubrik | 'andere', string>);
    setBearbeiten(true);
  };
  const speichern = () => {
    // nur geänderte Rubriken senden (unveränderte bleiben, auch Ressourcen/Budget ohne Recht auf Beträge);
    // leer oder gleich den erzeugten Sätzen: null (die erzeugten Sätze gelten wieder)
    const rubriken = Object.fromEntries(h.rubriken.filter(r => (werte[r.rubrik] ?? '').trim() !== anzeige(r).trim()).map(r => {
      const w = (werte[r.rubrik] ?? '').trim();
      return [r.rubrik, !w || w === r.erzeugt.join('\n') ? null : w];
    })) as Partial<Record<Rubrik, string | null>>;
    hauptSpeichern.mutate({ id: h.versionId, etag: geladen.etag, body: { rubriken, andere: werte.andere.trim() } }, {
      onSuccess: () => { setBearbeiten(false); toast.show(TA.gespeichert); },
    });
  };

  if (bearbeiten) {
    return (
      <form className="form ae-haupt" noValidate onSubmit={e => { e.preventDefault(); speichern(); }} aria-labelledby={`${id}-h`}>
        <h4 id={`${id}-h`} className="ae-l">{TA.hauptaenderungen}</h4>
        {h.rubriken.map(r => (
          <div className="field" key={r.rubrik}>
            <label htmlFor={`${id}-${r.rubrik}`}>{TA.rubrik[r.rubrik]}</label>
            <textarea id={`${id}-${r.rubrik}`} rows={3} maxLength={5000} value={werte[r.rubrik] ?? ''} onChange={e => setWerte(w => ({ ...w, [r.rubrik]: e.target.value }))} />
          </div>
        ))}
        <div className="field">
          <label htmlFor={`${id}-andere`}>{TA.andere}</label>
          <textarea id={`${id}-andere`} rows={3} maxLength={5000} value={werte.andere} onChange={e => setWerte(w => ({ ...w, andere: e.target.value }))} aria-describedby={`${id}-ah`} />
          <p id={`${id}-ah`} className="hint">{TA.andereHint}</p>
        </div>
        {hauptSpeichern.error ? <ErrorState error={hauptSpeichern.error} /> : null}
        <div className="ae-knoepfe">
          <button type="button" className="btn" onClick={() => setBearbeiten(false)}>{TA.abbrechen}</button>
          <button type="submit" className="btn primary" disabled={hauptSpeichern.isPending}>{TA.speichern}</button>
        </div>
      </form>
    );
  }
  return (
    <section className="ae-haupt" aria-labelledby={`${id}-h`}>
      <h4 id={`${id}-h`} className="ae-l">{TA.hauptaenderungen}</h4>
      <dl className="ae-rubriken">
        {h.rubriken.map(r => (
          <div key={r.rubrik} className="ae-rubrik">
            <dt>{TA.rubrik[r.rubrik]}</dt>
            <dd className={anzeige(r) ? 'ae-text' : 'muted'}>{anzeige(r) || TA.keineAenderung}</dd>
          </div>
        ))}
        {h.andere ? <div className="ae-rubrik"><dt>{TA.andere}</dt><dd className="ae-text">{h.andere}</dd></div> : null}
      </dl>
      {h.can.write ? <button type="button" className="btn sm" onClick={oeffnen}><Icon name="edit" />{TA.umformulieren(TA.hauptaenderungen)}</button> : null}
      {h.can.write ? <p className="hint">{TA.hauptaenderungenHint}</p> : null}
    </section>
  );
}

/** Banner eines eingereichten Änderungsantrags (statt «In Prüfung bei der Unternehmensentwicklung»). */
export const aenderungBanner = (v: Version, datum: string) => (v.anlass === 'aenderung' && v.stand === 'in_pruefung' ? TA.beimSponsor(datum) : null);
