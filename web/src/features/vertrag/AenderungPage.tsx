/**
 * Projektakte › Vertrag › Änderung entscheiden (UI-09; Kernablauf K2 Schritt 9; UC-007 Schritt 4, A1, A2; PS.03.02):
 * Ziel der Aufgabe «Änderung entscheiden» (I-B1), primär auf dem Telefon. Zusammenfassung mit Begründung, Hauptänderungen
 * und Sprung zum Versionsvergleich. «Änderung freigeben» mit Wirkung davor (I-R1 Stufe 3); betrifft die Änderung Scope,
 * Budget oder Ressourcen, ersetzt «Antrag an den PRAT unterstützen» die Freigabe, mit Hinweis (K2 Regel). «Ablehnen» mit
 * Pflichtbegründung im Dialog. Aktionen in der Daumenzone (I-M1), bestätigt durch den Server (I-R2).
 */
import { describeError } from '@vollholz/iam-web';
import { useId, useState } from 'react';
import { isConflict, statusOf } from '../../api/index.ts';
import { Dialog, Empty, ErrorState, fmtDatum, fmtPhase, Hinweis, Icon, Skelett, Stand, T, useToast, useVerzoegert, type Phase, type StandFamilie } from '../../ui/index.ts';
import { useAenderung, useAenderungMutations, useHauptaenderungen, type AenderungLoaded } from './AenderungApi.ts';
import { HauptaenderungenBlock } from './AenderungPanel.tsx';
import { TA } from './AenderungTexte.ts';
import { useProjekt, useVertrag, type Version } from './api.ts';
import { TV } from './texte.ts';
import './Aenderung.css';
import './Pruefen.css';

const FAMILIE: Partial<Record<Version['stand'], StandFamilie>> = { in_arbeit: 'entwurf', in_pruefung: 'wartet', traktandiert: 'traktandiert', abgenommen: 'positiv', abgelehnt: 'negativ' };

export function AenderungPage({ nummer }: { nummer: string }) {
  const projekt = useProjekt(nummer);
  const vertrag = useVertrag(projekt.data?.id);
  // jüngster Änderungsantrag (Versionen neueste zuerst): offen oder schon entschieden
  const version = vertrag.data?.versionen.find(v => v.anlass === 'aenderung') ?? null;
  const antrag = useAenderung(version?.id ?? null);
  const pending = projekt.isPending || vertrag.isPending || (!!version && antrag.isPending);
  const skelett = useVerzoegert(pending);
  if (pending) return <div aria-busy="true"><span className="sr" role="status">{T.common.loading}</span>{skelett ? <Skelett zeilen={5} /> : null}</div>;
  const fehler = projekt.error ?? vertrag.error ?? antrag.error;
  if (fehler) return <ErrorState error={fehler} onRetry={() => { void projekt.refetch(); void vertrag.refetch(); void antrag.refetch(); }} />;
  if (!projekt.data || !version || !antrag.data) return <Empty>{TA.keinAntrag}</Empty>;
  return <Entscheid nummer={nummer} projektId={projekt.data.id} projektName={projekt.data.name} version={version} geladen={antrag.data} />;
}

function Entscheid({ nummer, projektId, projektName, version, geladen }: { nummer: string; projektId: string; projektName: string; version: Version; geladen: AenderungLoaded }) {
  const id = useId();
  const toast = useToast();
  const a = geladen.aenderung;
  const haupt = useHauptaenderungen(a.versionId);
  const { entscheiden } = useAenderungMutations(projektId);
  const [ablehnen, setAblehnen] = useState(false);
  const phase = fmtPhase(version.zielphase as Phase);
  const kannEntscheiden = a.can.freigeben || a.can.anPrat || a.can.ablehnen;

  const senden = (ergebnis: 'freigegeben' | 'an_prat' | 'abgelehnt', begruendung?: string) => {
    entscheiden.mutate({ id: a.versionId, etag: geladen.etag, body: { ergebnis, ...(begruendung ? { begruendung } : {}) } }, {
      onSuccess: () => {
        setAblehnen(false);
        toast.show(ergebnis === 'freigegeben' ? TA.toastFreigegeben(a.nummer) : ergebnis === 'an_prat' ? TA.toastAnPrat : TA.toastAbgelehnt);
      },
    });
  };
  const fehlerText = entscheiden.error && !isConflict(entscheiden.error) && statusOf(entscheiden.error) !== 422 && statusOf(entscheiden.error) !== 409 ? entscheiden.error : null;

  return (
    <section className="uz" aria-labelledby={`${id}-h`}>
      <header className="uz-kopf">
        <h2 id={`${id}-h`} className="uz-h">{TA.entscheidTitel}</h2>
        <p className="uz-projekt"><span className="mono">{nummer}</span> {projektName}</p>
        <p className="small">{TA.version(a.nummer, a.basisNummer)} · {phase}</p>
        <Stand familie={FAMILIE[a.stand] ?? 'ruhend'} label={TV.stand[a.stand]} />
      </header>

      {a.entscheid ? <Hinweis stufe="hinweis">{TA.entschieden[a.entscheid.ergebnis](fmtDatum(a.entscheid.at))}{a.entscheid.begruendung ? ` ${a.entscheid.begruendung}` : ''}</Hinweis> : null}
      {a.stand === 'traktandiert' ? <Hinweis stufe="hinweis">{TA.traktandiert}</Hinweis> : null}
      {a.stand === 'in_arbeit' ? <Hinweis stufe="hinweis">{TA.inArbeit}</Hinweis> : null}

      <section className="uz-block" aria-labelledby={`${id}-b`}>
        <h3 id={`${id}-b`} className="grp-h">{TA.begruendungPl}</h3>
        <p className="ae-text">{a.begruendung}</p>
      </section>

      {haupt.error ? <ErrorState error={haupt.error} onRetry={() => void haupt.refetch()} /> : haupt.data ? <HauptaenderungenBlock geladen={haupt.data} /> : null}

      <p className="ae-links">
        <a className="btn" href={`/projekte/${nummer}/versionen?vergleich=${a.basisVersionId ?? 'baseline'}...${a.versionId}`}><Icon name="columns" />{TA.vergleich}</a>
        <a className="btn" href={`/projekte/${nummer}/vertrag?version=${version.stand === 'abgenommen' ? 'baseline' : 'entwurf'}`}><Icon name="doc" />{TA.ganzerVertrag}</a>
      </p>

      {isConflict(entscheiden.error) ? <Hinweis stufe="warnung" live>{TA.konflikt}</Hinweis> : null}
      {statusOf(entscheiden.error) === 409 ? <Hinweis stufe="sperre" live>{describeError(entscheiden.error).detail}</Hinweis> : null}
      {fehlerText ? <ErrorState error={fehlerText} /> : null}

      {kannEntscheiden ? (
        <div className="uz-aktion">
          {a.wirkung.prat ? <Hinweis stufe="sperre">{a.wirkung.hinweis}</Hinweis> : null}
          <p className="uz-wirkung" id={`${id}-w`}>{a.can.anPrat ? TA.anPratWirkung : TA.freigebenWirkung(a.nummer)}</p>
          {a.can.freigeben ? (
            <button type="button" className="btn primary uz-gross" aria-describedby={`${id}-w`} onClick={() => senden('freigegeben')} disabled={entscheiden.isPending}>
              <Icon name="check" />{entscheiden.isPending ? T.common.loading : TA.freigeben}
            </button>
          ) : null}
          {a.can.anPrat ? (
            <button type="button" className="btn primary uz-gross" aria-describedby={`${id}-w`} onClick={() => senden('an_prat')} disabled={entscheiden.isPending}>
              <Icon name="gavel" />{entscheiden.isPending ? T.common.loading : TA.anPrat}
            </button>
          ) : null}
          {a.can.ablehnen ? <button type="button" className="btn" onClick={() => setAblehnen(true)} disabled={entscheiden.isPending}>{TA.ablehnen}</button> : null}
        </div>
      ) : a.stand === 'in_pruefung' ? <p className="muted">{TA.nurSponsor}</p> : null}

      {ablehnen ? <AblehnenDialog onClose={() => setAblehnen(false)} busy={entscheiden.isPending} fehler={entscheiden.error} onSenden={b => senden('abgelehnt', b)} /> : null}
    </section>
  );
}

function AblehnenDialog({ onClose, onSenden, busy, fehler }: { onClose(): void; onSenden(b: string): void; busy: boolean; fehler: unknown }) {
  const id = useId();
  const [text, setText] = useState('');
  const [versucht, setVersucht] = useState(false);
  const leer = !text.trim();
  const server = statusOf(fehler) === 422 ? describeError(fehler).fields.find(f => f.path === '/begruendung')?.message : undefined;
  const err = versucht && leer ? TA.ablehnenFehlt : server;
  return (
    <Dialog title={TA.ablehnenFrage} onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose}>{TA.abbrechen}</button>
      <button type="submit" form={`${id}-f`} className="btn primary" disabled={busy}>{TA.ablehnen}</button>
    </>}>
      <p>{TA.ablehnenWirkung}</p>
      <form id={`${id}-f`} className="form" noValidate onSubmit={e => { e.preventDefault(); setVersucht(true); if (!leer) onSenden(text.trim()); }}>
        <div className="field">
          <label htmlFor={`${id}-b`}>{TA.begruendung}</label>
          <textarea id={`${id}-b`} value={text} onChange={e => setText(e.target.value)} rows={4} maxLength={5000} data-autofocus
            aria-invalid={err ? true : undefined} aria-describedby={err ? `${id}-e` : undefined} />
          {err ? <p id={`${id}-e`} className="ferr" role="alert">{err}</p> : null}
        </div>
      </form>
    </Dialog>
  );
}
