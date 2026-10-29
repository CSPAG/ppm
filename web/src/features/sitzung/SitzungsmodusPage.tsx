/**
 * Sitzungsmodus (UI-33/UI-34, Seitentyp «Arbeitsfläche» für die Projektion; UC-006 Schritte 6–8, A1, A3, A4; K3
 * Schritte 7–9): grosse Schrift, Traktandenliste links, rechts zuoberst der Antrag, darunter Unterlagen und die
 * Entscheidmaske. «Sitzung starten» nach dem Versand, «Sitzung schliessen» mit Hinweis auf Traktanden ohne Entscheid.
 * Tastatur: → / ← wechseln das Traktandum, E öffnet die Entscheidmaske (K3 «Barrierefreiheit und Tastatur»). Das
 * Erfassen wird angesagt (aria-live). Adresse `/gremien/<kuerzel>/sitzungen/<datum>/modus?traktandum=<position>` (I-N5).
 */
import { useEffect, useId, useState } from 'react';
import { isConflict, statusOf } from '../../api/index.ts';
import { Dialog, Empty, ErrorState, Hinweis, Icon, Loading, Stand, fmtDatum, fmtZeitpunkt, useToast } from '../../ui/index.ts';
import { useSitzung, type Traktandum } from './api.ts';
import type { SetSitzungSearch, SitzungSearch } from './search.ts';
import { useModusMutations, usePersonen, useSitzungsmodus, type ModusTraktandum, type Sitzungsmodus } from './Sitzungsmodus.api.ts';
import { TM } from './Sitzungsmodus.texte.ts';
import { EntscheidAnzeige, Entscheidmaske, SnsMaske } from './SitzungsmodusEntscheid.tsx';
import { sitzungPfad } from './search.ts';
import { standFamilie } from './Traktandenliste.tsx';
import { TS } from './texte.ts';
import './sitzung.css';
import './Sitzungsmodus.css';

/** Badge je Traktandum in der Liste: offen, entschieden, Kenntnisnahme, SNS-VR ausstehend. */
function standVon(t: ModusTraktandum): { familie: 'positiv' | 'wartet' | 'ruhend' | 'entwurf'; label: string } {
  if (!t.optionen.length) return { familie: 'ruhend', label: TM.kenntnis };
  if (!t.entscheid) return { familie: 'entwurf', label: TM.offen };
  if (t.entscheid.stellungnahme && !t.entscheid.sns) return { familie: 'wartet', label: TM.snsAusstehend };
  return { familie: 'positiv', label: t.entscheid.sns?.label ?? t.entscheid.label };
}

function SchliessenDialog({ m, busy, onClose, onSchliessen }: { m: Sitzungsmodus; busy: boolean; onClose(): void; onSchliessen(): void }) {
  return (
    <Dialog title={TM.schliessenTitel} onClose={onClose} footer={(
      <>
        <button type="button" className="btn" onClick={onClose} data-autofocus>{TS.weiterBearbeiten}</button>
        <button type="button" className="btn primary" disabled={busy} onClick={onSchliessen}><Icon name="calendar-check" />{TM.schliessen}</button>
      </>
    )}>
      <div className="sz-wirkung">
        <p>{TM.schliessenOhne(m.ohneEntscheid)}</p>
        <p>{TM.schliessenWirkung}</p>
      </div>
    </Dialog>
  );
}

export function SitzungsmodusPage({ kuerzel, datum, search, setSearch, gehe: zu }: {
  kuerzel: string; datum: string; search: SitzungSearch; setSearch: SetSitzungSearch;
  /** Navigation innerhalb der Oberfläche (Router) */
  gehe(pfad: string): void;
}) {
  const toast = useToast();
  const titelId = useId();
  const sq = useSitzung(kuerzel, datum);
  const mq = useSitzungsmodus(sq.data?.versendetAt ? sq.data.id : undefined);
  const personen = usePersonen();
  const mut = useModusMutations(kuerzel, datum, sq.data?.id);
  const [schliessen, setSchliessen] = useState(false);
  const [ansage, setAnsage] = useState('');
  const m = mq.data;
  const ts = m?.traktanden ?? [];
  const pos = search.traktandum ? Number(search.traktandum) : ts[0]?.position ?? undefined;
  const aktuell = ts.find(t => t.position === pos) ?? ts[0];
  const index = aktuell ? ts.indexOf(aktuell) : -1;
  const g = kuerzel.toUpperCase();

  const gehe = (i: number) => {
    const t = ts[i];
    if (t?.position) setSearch({ traktandum: String(t.position) }, { replace: true });
  };

  // → / ← wechseln das Traktandum, E öffnet die Entscheidmaske (nicht in Eingabefeldern)
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.altKey || e.ctrlKey || e.metaKey || (el && (el.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')))) return;
      if (e.key === 'ArrowRight' && index < ts.length - 1) { e.preventDefault(); gehe(index + 1); }
      else if (e.key === 'ArrowLeft' && index > 0) { e.preventDefault(); gehe(index - 1); }
      else if (e.key === 'e' || e.key === 'E') {
        const start = document.querySelector<HTMLElement>('[data-maske="start"]');
        if (start) { e.preventDefault(); start.focus(); }
      }
    };
    document.addEventListener('keydown', taste);
    return () => document.removeEventListener('keydown', taste);
  });

  const fehler = (e: unknown) => {
    if (isConflict(e) || statusOf(e) === 409) void mq.refetch();
    if (isConflict(e)) toast.show(TM.konflikt, { tone: 'error' }); else toast.error(e);
  };

  if (sq.isPending || (sq.data?.versendetAt && mq.isPending)) return <Loading />;
  if (sq.error || !sq.data) {
    return statusOf(sq.error) === 404 ? <Empty>{TS.gone}</Empty> : <ErrorState error={sq.error} onRetry={() => void sq.refetch()} />;
  }
  const s = sq.data;
  const zurueck = <button type="button" className="btn" onClick={() => zu(sitzungPfad(kuerzel, datum))}><Icon name="table" />{TM.zurVorbereitung}</button>;
  if (!s.versendetAt) {
    return (
      <section aria-labelledby={titelId}>
        <header className="mh"><div className="mh-row"><div className="mh-title"><h1 id={titelId}>{TM.modusTitel(g, fmtDatum(datum))}</h1></div><div className="acts">{zurueck}</div></div></header>
        <div className="body"><Empty>{TM.nochNichtVersendet}</Empty></div>
      </section>
    );
  }
  if (mq.error || !m) return <ErrorState error={mq.error} onRetry={() => void mq.refetch()} />;

  const unterlagen: Traktandum | undefined = s.traktanden.find(x => x.id === aktuell?.traktandumId);
  const geschlossen = m.stand === 'geschlossen' || m.stand === 'protokoll_versendet';
  const busy = mut.erfassen.isPending || mut.starten.isPending || mut.schliessen.isPending || mut.sns.isPending;
  const pl = unterlagen?.einladungen.find(x => x.funktion === 'pl')?.personId;

  return (
    <section aria-labelledby={titelId} className="smo-seite">
      <header className="mh">
        <div className="mh-row">
          <div className="mh-title">
            <div className="type-ico neutral"><Icon name="gavel" /></div>
            <div className="minw0">
              <h1 id={titelId}>{TM.modusTitel(g, fmtDatum(datum))}</h1>
              <div className="sub sz-kopf">
                <Stand familie={standFamilie(m.stand)} label={TS.stand[m.stand] ?? m.stand} />
                <span>{m.gremium.name}</span>
                {s.ort ? <span><Icon name="pin" />{s.ort}</span> : null}
              </div>
            </div>
          </div>
          <div className="acts">
            {zurueck}
            {geschlossen ? <button type="button" className="btn" onClick={() => zu(`${sitzungPfad(kuerzel, datum)}/protokoll`)}><Icon name="doc" />{TM.zumProtokoll}</button> : null}
            {m.can.starten ? (
              <button type="button" className="btn primary" disabled={busy} onClick={() => mut.starten.mutate(m, { onSuccess: () => toast.show(TM.gestartet), onError: fehler })}>
                <Icon name="bolt" />{TM.starten}
              </button>
            ) : null}
            {m.can.schliessen ? <button type="button" className="btn primary" disabled={busy} onClick={() => setSchliessen(true)}><Icon name="calendar-check" />{TM.schliessen}</button> : null}
          </div>
        </div>
      </header>
      <div className="body smo-body">
        <p className="sr" aria-live="polite">{ansage}</p>
        {m.stand === 'versendet' && m.can.starten ? <div className="sz-banner"><Hinweis stufe="hinweis">{TM.nichtGestartet}</Hinweis></div> : null}
        {m.stand === 'geschlossen' ? <div className="sz-banner"><Hinweis stufe="hinweis">{TM.geschlossenBanner(fmtZeitpunkt(m.geschlossenAt!))}</Hinweis></div> : null}
        {m.stand === 'protokoll_versendet' ? <div className="sz-banner"><Hinweis stufe="hinweis">{TM.protokollVersendetBanner(fmtZeitpunkt(m.geschlossenAt!))}</Hinweis></div> : null}
        {!m.can.erfassen && !geschlossen && !m.can.starten ? <div className="sz-banner"><Hinweis stufe="hinweis">{TM.nurLesen}</Hinweis></div> : null}
        <div className="smo-flaeche">
          <nav className="smo-nav" aria-label={TM.traktanden}>
            <ol className="smo-liste">
              {ts.map((t, i) => {
                const st = standVon(t);
                return (
                  <li key={t.traktandumId}>
                    <button type="button" className={`smo-tr${t === aktuell ? ' on' : ''}`} aria-current={t === aktuell ? 'true' : undefined} onClick={() => gehe(i)}>
                      <span className="sz-nr" aria-hidden="true">{t.position}</span>
                      <span className="smo-tr-b minw0">
                        <span className="smo-tr-t">{t.projekt ? `${t.projekt.nummer} ` : ''}{t.titel}</span>
                        <Stand familie={st.familie} label={st.label} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <p className="smo-leise smo-tasten">{TM.tastatur}</p>
          </nav>
          {aktuell ? (
            <article className="smo-detail" aria-labelledby={`${titelId}-t`}>
              <div className="smo-schritt">
                <button type="button" className="iconbtn" disabled={index <= 0} onClick={() => gehe(index - 1)} aria-label={TM.vorher}><Icon name="chev" /></button>
                <span className="smo-leise">{aktuell.artLabel}{aktuell.viaSns ? ` · ${TM.viaSns}` : ''}</span>
                <button type="button" className="iconbtn smo-vor" disabled={index >= ts.length - 1} onClick={() => gehe(index + 1)} aria-label={TM.weiter}><Icon name="chev" /></button>
              </div>
              <h2 id={`${titelId}-t`} className="smo-titel">{aktuell.position}. {aktuell.projekt ? `${aktuell.projekt.nummer} ` : ''}{aktuell.titel}</h2>
              {aktuell.antrag ? <p className="smo-antrag"><span className="smo-leise">{TM.antrag}: </span>{aktuell.antrag}</p> : null}
              <section className="smo-unterlagen" aria-label={TM.unterlagen}>
                <h3 className="smo-h">{TM.unterlagen}</h3>
                {unterlagen?.unterlagen.liste.length ? (
                  <ul>{unterlagen.unterlagen.liste.map((u, i) => <li key={i}><Icon name="doc" />{u.titel}{u.hinweis ? ` · ${u.hinweis}` : ''}</li>)}</ul>
                ) : <p className="smo-leise">{TM.keineUnterlagen}</p>}
              </section>
              {!aktuell.optionen.length ? <p className="smo-leise">{TM.kenntnisnahme}</p>
                : m.can.erfassen ? (
                  <Entscheidmaske key={`${aktuell.traktandumId}:${aktuell.entscheid?.version ?? 0}`} t={aktuell} personen={personen.data ?? []}
                    vorschlagVerantwortlich={pl} busy={mut.erfassen.isPending}
                    onErfassen={body => mut.erfassen.mutate({ t: aktuell, body }, {
                      onSuccess: e => {
                        const text = aktuell.entscheid ? TM.korrigiert(e.label) : TM.erfasst(e.label);
                        toast.show(text);
                        setAnsage(text);
                      },
                      onError: fehler,
                    })} />
                ) : (
                  <>
                    <EntscheidAnzeige t={aktuell} />
                    {geschlossen && aktuell.entscheid ? <p className="smo-leise">{TM.fest}</p> : null}
                    {aktuell.entscheid?.can.snsErfassen ? (
                      <SnsMaske t={aktuell} busy={mut.sns.isPending} onErfassen={body => mut.sns.mutate({ t: aktuell, body }, {
                        onSuccess: e => { const text = TM.snsErfasst(e.sns?.label ?? ''); toast.show(text); setAnsage(text); }, onError: fehler,
                      })} />
                    ) : null}
                  </>
                )}
            </article>
          ) : <Empty>{TS.leerLesen}</Empty>}
        </div>
      </div>
      {schliessen ? (
        <SchliessenDialog m={m} busy={mut.schliessen.isPending} onClose={() => setSchliessen(false)}
          onSchliessen={() => mut.schliessen.mutate(m, {
            onSuccess: () => { setSchliessen(false); toast.show(TM.geschlossen); setAnsage(TM.geschlossen); },
            onError: e => { setSchliessen(false); fehler(e); },
          })} />
      ) : null}
    </section>
  );
}

/** Einstieg aus der Sitzung (UI-33): ab dem Versand «Sitzungsmodus», nach dem Schliessen zusätzlich «Protokoll». */
export function SitzungsmodusEinstieg({ kuerzel, datum, stand, gehe }: { kuerzel: string; datum: string; stand: string; gehe?(pfad: string): void }) {
  if (!gehe || stand === 'geplant' || stand === 'in_vorbereitung') return null;
  const geschlossen = stand === 'geschlossen' || stand === 'protokoll_versendet';
  return (
    <>
      <button type="button" className={`btn${geschlossen ? '' : ' primary'}`} onClick={() => gehe(`${sitzungPfad(kuerzel, datum)}/modus`)}><Icon name="gavel" />{TM.zumModus}</button>
      {geschlossen ? <button type="button" className="btn primary" onClick={() => gehe(`${sitzungPfad(kuerzel, datum)}/protokoll`)}><Icon name="doc" />{TM.zumProtokoll}</button> : null}
    </>
  );
}
