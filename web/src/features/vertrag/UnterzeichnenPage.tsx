/**
 * Projektakte › Vertrag › Unterzeichnen (UI-12; Kernablauf K2 Schritt 8; DM.02.06; UC-002 Schritt 10, UC-003 Schritt 8,
 * A5): Zusammenfassung für Sponsor, Projektleitung und CTL, primär auf dem Telefon. Stand der Unterschriften («2 von
 * 3»), Wirkung vor dem Klick (I-R1 Stufe 3), «Unterzeichnen» in der Daumenzone (I-M1), bestätigt durch den Server
 * (I-R2). «Nicht unterzeichnen» mit Pflichtbegründung im Dialog. Abnahme K2-1: ab der Aufgabe höchstens 3 Interaktionen.
 */
import { describeError, PersonName } from '@vollholz/iam-web';
import { useId, useState } from 'react';
import { isConflict, statusOf } from '../../api/index.ts';
import { Dialog, Empty, ErrorState, fmtDateTime, fmtPhase, Hinweis, Icon, Skelett, Stand, T, useToast, useVerzoegert, type Phase } from '../../ui/index.ts';
import { useProjekt, useVertrag, type Version } from './api.ts';
import { usePruefung, usePruefungMutations, type Funktion, type Pruefung, type PruefungLoaded } from './PruefenApi.ts';
import { TP } from './PruefenTexte.ts';
import { useNeuLaden } from './neuLaden.ts';
import { TV } from './texte.ts';
import './Pruefen.css';

export function UnterzeichnenPage({ nummer }: { nummer: string }) {
  const projekt = useProjekt(nummer);
  const vertrag = useVertrag(projekt.data?.id);
  const entwurf = vertrag.data?.entwurf ?? null;
  const pruefung = usePruefung(entwurf);
  const skelett = useVerzoegert(projekt.isPending || vertrag.isPending || (!!entwurf && pruefung.isPending));
  if (projekt.isPending || vertrag.isPending || (entwurf && pruefung.isPending)) {
    return <div aria-busy="true"><span className="sr" role="status">{T.common.loading}</span>{skelett ? <Skelett zeilen={5} /> : null}</div>;
  }
  // ein gescheitertes Neuladen behält den geladenen Stand (und die Eingaben); nur ohne Daten der Fehler (Z5)
  const fehler = projekt.error ?? vertrag.error ?? pruefung.error;
  if (fehler && !(projekt.data && vertrag.data && (!entwurf || pruefung.data))) return <ErrorState error={fehler} onRetry={() => { void projekt.refetch(); void vertrag.refetch(); void pruefung.refetch(); }} />;
  const version = vertrag.data?.versionen.find(v => v.id === entwurf);
  if (!projekt.data || !version || !pruefung.data) return <Empty>{TP.keinEntwurf}</Empty>;
  return <Zusammenfassung nummer={nummer} projektId={projekt.data.id} projektName={projekt.data.name} version={version} geladen={pruefung.data} neuLaden={() => pruefung.refetch()} />;
}

/** Funktionen ohne Unterschrift als Text («Lea Brunner (CTL)» geht nur mit Namen; hier die Funktion). */
const fehlendText = (p: Pruefung, ohne: readonly Funktion[]) =>
  (p.unterzeichnung?.funktionen ?? []).filter(f => !f.unterschrift && !ohne.includes(f.funktion)).map(f => TP.funktion[f.funktion]).join(', ');

function Zusammenfassung({ nummer, projektId, projektName, version, geladen, neuLaden }: {
  nummer: string; projektId: string; projektName: string; version: Version; geladen: PruefungLoaded; neuLaden(): Promise<{ error: unknown }>;
}) {
  const id = useId();
  const toast = useToast();
  const { unterschrift } = usePruefungMutations(projektId);
  const laden = useNeuLaden(neuLaden, () => unterschrift.reset());
  const konflikt = isConflict(unterschrift.error);
  const [nicht, setNicht] = useState(false);
  const p = geladen.pruefung;
  const offen = p.can.unterzeichnen;
  const eigene = offen.map(o => o.funktion);
  const vertretung = offen.find(o => o.inVertretungVon);
  const rest = fehlendText(p, eigene);
  const phase = fmtPhase(version.zielphase as Phase);

  const unterzeichnen = () => {
    unterschrift.mutate({ id: p.versionId, etag: geladen.etag, body: { ergebnis: 'unterzeichnet' } }, {
      onSuccess: r => toast.show(r.unterzeichnung?.vollstaendig ? TP.toastVollstaendig : TP.toastFehlt(fehlendText(r, []))),
    });
  };

  return (
    <section className="uz" aria-labelledby={`${id}-h`}>
      <header className="uz-kopf">
        <h2 id={`${id}-h`} className="uz-h">{TP.unterzeichnenTitel}</h2>
        <p className="uz-projekt"><span className="mono">{nummer}</span> {projektName}</p>
        <p className="small">{TP.version(p.nummer, phase)} · {TP.anlass[version.anlass] ?? version.anlass}</p>
        <Stand familie={p.stand === 'unterzeichnet' ? 'positiv' : 'wartet'} label={TV.stand[p.stand]} />
      </header>

      {vertretung ? <Hinweis stufe="hinweis">{TP.vertretungBanner}</Hinweis> : null}
      {p.stand !== 'zur_unterzeichnung' && p.stand !== 'unterzeichnet' ? <Hinweis stufe="hinweis">{TP.nichtZurUnterzeichnung(TV.stand[p.stand])}</Hinweis> : null}

      {p.unterzeichnung ? (
        <section aria-labelledby={`${id}-u`} className="uz-block">
          <h3 id={`${id}-u`} className="grp-h">{TP.unterschriften} · {TP.stand(p.unterzeichnung.anzahl)}</h3>
          <ul className="uz-liste">
            {p.unterzeichnung.funktionen.map(f => {
              const u = f.unterschrift;
              const zeichen = !u ? 'clock' : u.ergebnis === 'unterzeichnet' ? 'check' : 'ban';
              return (
                <li key={f.funktion} className={`uz-u ${u ? u.ergebnis : 'offen'}`}>
                  <Icon name={zeichen} />
                  <span className="uz-f">{TP.funktion[f.funktion]}</span>
                  <span className="uz-wer">
                    {u ? <><PersonName id={u.personId} />{u.inVertretungVon ? <> ({TP.inVertretung} <PersonName id={u.inVertretungVon} />)</> : null}</>
                      : f.personen.map((x, i) => <span key={x}>{i ? ', ' : ''}<PersonName id={x} /></span>)}
                  </span>
                  <span className="uz-s">{u ? `${u.ergebnis === 'unterzeichnet' ? TP.unterzeichnet : TP.verweigert} · ${fmtDateTime(u.at)}` : TP.ausstehend}</span>
                  {u?.begruendung ? <span className="uz-b">{u.begruendung}</span> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <p><a className="btn" href={`/projekte/${nummer}/vertrag?version=entwurf`}><Icon name="doc" />{TP.zurueckZumVertrag}</a></p>

      {unterschrift.error && !isConflict(unterschrift.error) ? <ErrorState error={unterschrift.error} /> : null}
      {isConflict(unterschrift.error) ? (
        <Hinweis stufe="warnung" live aktion={<button type="button" className="btn sm" disabled={laden.laedt} onClick={() => void laden.laden()}>{TP.neuLaden}</button>}>{TP.konfliktUnterzeichnen}</Hinweis>
      ) : null}

      {offen.length ? (
        <div className="uz-aktion">
          <p className="uz-wirkung" id={`${id}-w`}>{rest ? TP.wirkungWeitere(rest) : TP.wirkungLetzte}</p>
          <button type="button" className="btn primary uz-gross" aria-describedby={`${id}-w`} onClick={unterzeichnen} disabled={unterschrift.isPending || konflikt}>
            <Icon name="check" />{unterschrift.isPending ? T.common.loading : TP.unterzeichnen}
          </button>
          <button type="button" className="btn" onClick={() => setNicht(true)} disabled={unterschrift.isPending}>{TP.nichtUnterzeichnen}</button>
        </div>
      ) : p.stand === 'unterzeichnet' ? <Hinweis stufe="hinweis">{TP.vollstaendig}</Hinweis>
        : p.stand === 'zur_unterzeichnung' ? <p className="muted">{TP.keineOffene}</p> : null}

      {nicht ? <NichtDialog onClose={() => setNicht(false)} busy={unterschrift.isPending || laden.laedt} fehler={unterschrift.error} onNeuLaden={() => void laden.laden()}
        onSenden={begruendung => unterschrift.mutate({ id: p.versionId, etag: geladen.etag, body: { ergebnis: 'verweigert', begruendung } }, {
          onSuccess: () => { setNicht(false); toast.show(TP.toastNicht); },
        })} /> : null}
    </section>
  );
}

function NichtDialog({ onClose, onSenden, onNeuLaden, busy, fehler }: { onClose(): void; onSenden(b: string): void; onNeuLaden(): void; busy: boolean; fehler: unknown }) {
  const id = useId();
  const [text, setText] = useState('');
  const [versucht, setVersucht] = useState(false);
  const leer = !text.trim();
  const server = statusOf(fehler) === 422 ? describeError(fehler).fields.find(f => f.path === '/begruendung')?.message : undefined;
  const err = versucht && leer ? TP.begruendungFehlt : server;
  return (
    <Dialog title={TP.nichtFrage} onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose}>{TP.abbrechen}</button>
      <button type="submit" form={`${id}-f`} className="btn primary" disabled={busy || isConflict(fehler)}>{TP.nichtUnterzeichnen}</button>
    </>}>
      <p>{TP.nichtWirkung}</p>
      {/* Konflikt im Dialog selbst, nicht verdeckt dahinter; die Begründung bleibt (Z7) */}
      {isConflict(fehler) ? (
        <Hinweis stufe="warnung" live aktion={<button type="button" className="btn sm" disabled={busy} onClick={onNeuLaden}>{TP.neuLaden}</button>}>{TP.konfliktUnterzeichnen}</Hinweis>
      ) : null}
      <form id={`${id}-f`} className="form" noValidate onSubmit={e => { e.preventDefault(); setVersucht(true); if (!leer) onSenden(text.trim()); }}>
        <div className="field">
          <label htmlFor={`${id}-b`}>{TP.begruendung}</label>
          <textarea id={`${id}-b`} value={text} onChange={e => setText(e.target.value)} rows={4} maxLength={2000} data-autofocus
            aria-invalid={err ? true : undefined} aria-describedby={err ? `${id}-e` : undefined} />
          {err ? <p id={`${id}-e`} className="ferr" role="alert">{err}</p> : null}
        </div>
      </form>
    </Dialog>
  );
}
