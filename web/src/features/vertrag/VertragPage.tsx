/**
 * Projektakte › Vertrag (UI-07, Kernablauf K2 Schritte 1–3 und 6; Seitentyp «Arbeitsfläche»): links die Kapitel 1–13
 * der Vorlage mit «geändert gegenüber Baseline» (Punkt) und «Angaben fehlen» (Symbol), Mitte das Kapitel, rechts das
 * Seitenpanel mit den Pflichtangaben der Zielphase – jede fehlende Angabe führt mit einem Klick zur Stelle (K2-4) – und
 * «Zur Prüfung einreichen» mit Wirkung davor (I-R1 Stufe 3). Automatisches Speichern (I-R3), Rückgängig/Wiederholen,
 * Konflikt (Z7), Lesemodus (Z8) und gesperrte Version (Z9). Tastatur: ↑/↓ in der Kapitelnavigation, Alt+N springt zur
 * nächsten fehlenden Angabe.
 *
 * Beim ersten Öffnen legt das System den Entwurf 0.1 ohne Rückfrage an (UC-002 Schritt 1), wenn die Person ihn
 * erstellen darf.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { describeError } from '@vollholz/iam-web';
import { isConflict, newIdempotencyKey, statusOf } from '../../api/index.ts';
import { Dialog, Empty, ErrorState, fmtDatum, fmtPhase, Hinweis, Icon, Skelett, Stand, T, useToast, useVerzoegert, type Phase, type StandFamilie } from '../../ui/index.ts';
import {
  kapitelLaden, useKapitel, usePflichtangaben, useProjekt, useVersion, useVertrag, useVertragMutations, type Angabe, type Inhalt, type KapitelLoaded,
  type Version, type VersionLoaded,
} from './api.ts';
import { AenderungBeantragen, aenderungBanner, AenderungPanel } from './AenderungPanel.tsx';
import { DokumentAusgabe } from './DokumentAusgabe.tsx';
import { feldId, KAPITEL, pruefeLokal } from './felder.ts';
import { KapitelEditor } from './KapitelEditor.tsx';
import type { SetVertragSearch, VertragSearch } from './search.ts';
import { TV } from './texte.ts';
import './vertrag.css';

const PAUSE_MS = 800;
/** Bearbeitungsstand der Version als Familie (darstellung.md, UX-E6). */
const FAMILIE: Record<Version['stand'], StandFamilie> = {
  in_arbeit: 'entwurf', in_pruefung: 'wartet', zur_unterzeichnung: 'wartet', unterzeichnet: 'wartet', traktandiert: 'traktandiert',
  abgenommen: 'positiv', abgelehnt: 'negativ', verworfen: 'ruhend', zurueckgezogen: 'ruhend',
};
const ZUSAMMENFASSEN_MS = 1500;
const MAX_VERLAUF = 100;

export function VertragPage({ nummer, search, setSearch }: { nummer: string; search: VertragSearch; setSearch: SetVertragSearch }) {
  const projekt = useProjekt(nummer);
  const vertrag = useVertrag(projekt.data?.id);
  const { anlegen } = useVertragMutations(projekt.data?.id);
  const skelett = useVerzoegert(projekt.isPending || vertrag.isPending);
  const key = useRef(newIdempotencyKey());
  const v = vertrag.data;
  const ohneVersion = !!v && v.versionen.length === 0;
  const darfAnlegen = !!v?.can.entwerfen.includes('initial');

  // Erster Vertrag ohne Rückfrage (UC-002 Schritt 1)
  useEffect(() => {
    if (ohneVersion && darfAnlegen && anlegen.isIdle) anlegen.mutate({ key: key.current });
  }, [ohneVersion, darfAnlegen, anlegen]);

  if (projekt.isPending || vertrag.isPending || (ohneVersion && darfAnlegen && !anlegen.isError)) {
    return <div aria-busy="true"><span className="sr" role="status">{ohneVersion ? TV.legtAn : T.common.loading}</span>{skelett ? <Skelett zeilen={6} /> : null}</div>;
  }
  if (projekt.error) return <ErrorState error={projekt.error} onRetry={() => void projekt.refetch()} />;
  if (vertrag.error) return <ErrorState error={vertrag.error} onRetry={() => void vertrag.refetch()} />;
  if (anlegen.error) return <ErrorState error={anlegen.error} onRetry={() => anlegen.mutate({ key: key.current })} />;
  if (!v || !projekt.data) return null;
  if (ohneVersion) return <Empty>{TV.leer}</Empty>;
  const versionId = search.version === 'baseline' ? v.baseline ?? v.entwurf : v.entwurf ?? v.baseline;
  return <Akte nummer={nummer} projektId={projekt.data.id} versionId={versionId!} search={search} setSearch={setSearch} />;
}

function Akte({ nummer, projektId, versionId, search, setSearch }: { nummer: string; projektId: string; versionId: string; search: VertragSearch; setSearch: SetVertragSearch }) {
  const version = useVersion(versionId);
  const pflicht = usePflichtangaben(versionId);
  const skelett = useVerzoegert(version.isPending);
  if (version.isPending) return <div aria-busy="true"><span className="sr" role="status">{T.common.loading}</span>{skelett ? <Skelett zeilen={6} /> : null}</div>;
  if (version.error) return <ErrorState error={version.error} onRetry={() => void version.refetch()} />;
  return <Arbeitsflaeche nummer={nummer} projektId={projektId} loaded={version.data} angaben={pflicht.data?.angaben ?? []} search={search} setSearch={setSearch} />;
}

function Arbeitsflaeche({ nummer, projektId, loaded, angaben, search, setSearch }: {
  nummer: string; projektId: string; loaded: VersionLoaded; angaben: Angabe[]; search: VertragSearch; setSearch: SetVertragSearch;
}) {
  const toast = useToast();
  const v = loaded.detail.version;
  const nr = search.kapitel ?? 1;
  const navId = useId();
  const fehlend = angaben.filter(a => !a.erfuellt);
  const phase = fmtPhase(v.zielphase as Phase);
  const { einreichen } = useVertragMutations(projektId);
  const [dialog, setDialog] = useState(false);
  const [sperre, setSperre] = useState(false);
  /** Offenes speichern, bevor die Ansicht wechselt (Kapitel, Einreichen); vom Kapitel gesetzt. */
  const speichernRef = useRef<() => Promise<boolean>>(async () => true);

  const wechsle = useCallback(async (kapitel: number, feld?: string) => {
    await speichernRef.current();
    setSearch({ kapitel, feld }, { replace: kapitel === nr });
  }, [setSearch, nr]);

  // Alt+N: nächste fehlende Angabe (K2 «Barrierefreiheit und Tastatur»)
  const naechste = useCallback(() => {
    if (!fehlend.length) return;
    const nach = fehlend.find(a => a.kapitel > nr || (a.kapitel === nr && a.feld !== search.feld)) ?? fehlend[0]!;
    void wechsle(nach.kapitel, nach.feld);
  }, [fehlend, nr, search.feld, wechsle]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'n') { e.preventDefault(); naechste(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [naechste]);

  // ↑/↓ in der Kapitelnavigation (Listener am Element wie in der Arbeitsfläche des Phasenmodells)
  const navRef = useRef<HTMLUListElement>(null);
  const navTasten = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    navTasten.current = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const ziel = Math.min(13, Math.max(1, nr + (e.key === 'ArrowDown' ? 1 : -1)));
      void wechsle(ziel).then(() => document.getElementById(`${navId}-k${ziel}`)?.focus());
    };
  });
  useEffect(() => {
    const el = navRef.current;
    const h = (e: KeyboardEvent) => navTasten.current(e);
    el?.addEventListener('keydown', h);
    return () => el?.removeEventListener('keydown', h);
  }, []);

  const einreichenStart = async () => {
    await speichernRef.current();
    if (fehlend.length) { setSperre(true); return; }
    setSperre(false);
    setDialog(true);
  };
  const einreichenJetzt = () => {
    einreichen.mutate({ id: v.id, etag: loaded.etag }, {
      onSuccess: () => { setDialog(false); toast.show(TV.eingereicht); },
      onError: e => { setDialog(false); if (statusOf(e) === 422) setSperre(true); else toast.error(e); },
    });
  };
  const serverSperre = statusOf(einreichen.error) === 422 ? describeError(einreichen.error).detail : null;
  const k = loaded.detail.kapitel.find(x => x.kapitel === nr);
  const ro = !v.can.write;
  const banner = aenderungBanner(v, v.eingereichtAt ? fmtDatum(v.eingereichtAt) : '') ?? (v.stand === 'in_pruefung' ? TV.inPruefung(v.eingereichtAt ? fmtDatum(v.eingereichtAt) : '')
    : v.baseline && v.baselineAt ? TV.baselineSeit(v.nummer, fmtDatum(v.baselineAt))
      : v.stand !== 'in_arbeit' ? TV.gesperrt(TV.stand[v.stand]) : ro ? TV.nurLesen : null);

  return (
    <div className="vt-wrap">
      <div className="vt-kopf">
        <h2 className="vt-h">{TV.titel} · {TV.versionFuer(v.nummer, phase)}</h2>
        <Stand familie={FAMILIE[v.stand]} label={v.baseline ? TV.baseline : TV.stand[v.stand]} />
        {/* Als Dokument herunterladen (K2 Schritt 11, AP-E3-5) */}
        <DokumentAusgabe versionId={v.id} nummer={v.nummer} />
        {/* Änderung beantragen (UC-007 Schritt 1, AP-E3-4) */}
        <AenderungBeantragen projektId={projektId} onAngelegt={() => setSearch({ version: 'entwurf', kapitel: undefined, feld: undefined })} />
      </div>
      {banner ? <div className="vt-banner"><Hinweis stufe="hinweis">{banner}</Hinweis></div> : null}
      <div className="vt-flaeche">
        <nav className="vt-nav" aria-labelledby={`${navId}-h`}>
          <h3 id={`${navId}-h`} className="sr">{TV.kapitel}</h3>
          <label className="vt-nav-sel">
            <span className="sr">{TV.kapitelWahl}</span>
            <select value={nr} onChange={e => void wechsle(Number(e.target.value))}>
              {KAPITEL.map(x => <option key={x.nr} value={x.nr}>{`${x.nr} ${x.titel}`}</option>)}
            </select>
          </label>
          <ul className="vt-nav-l" ref={navRef}>
            {KAPITEL.map(x => {
              const kk = loaded.detail.kapitel.find(y => y.kapitel === x.nr);
              const n = kk?.fehlend ?? 0;
              return (
                <li key={x.nr}>
                  <button type="button" id={`${navId}-k${x.nr}`} className={`nav vt-nav-i${x.nr === nr ? ' on' : ''}`} aria-current={x.nr === nr ? 'true' : undefined}
                    tabIndex={x.nr === nr ? 0 : -1} onClick={() => void wechsle(x.nr)}>
                    <span className="vt-nr">{x.nr}</span>{' '}
                    <span className="lbl">{x.titel}</span>
                    {kk?.geaendert ? <span className="vt-punkt" role="img" aria-label={TV.geaendert} title={TV.geaendert} /> : null}
                    {n ? <span className="vt-fehlt" title={TV.fehlt(n)}><Icon name="warn" /><span className="sr">{TV.fehlt(n)}</span></span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        <section className="vt-haupt" aria-labelledby={`${navId}-t`}>
          <h3 id={`${navId}-t`} className="vt-titel"><span className="muted">{nr}</span> {k?.titel ?? KAPITEL[nr - 1]!.titel}</h3>
          <KapitelArbeit key={`${v.id}-${nr}`} versionId={v.id} nr={nr} versionRo={ro} feld={search.feld} speichernRef={speichernRef}
            projektId={projektId} onFokussiert={() => setSearch({ feld: undefined }, { replace: true })} />
        </section>
        <aside className="vt-panel" aria-labelledby={`${navId}-p`}>
          <h3 id={`${navId}-p`} className="grp-h">{TV.pflicht} {TV.pflichtFuer(phase)}</h3>
          {angaben.length === 0 ? <p className="muted small">{TV.pflichtKeine}</p>
            : fehlend.length === 0 ? <Hinweis stufe="hinweis">{TV.pflichtVollstaendig}</Hinweis> : (
              <>
                <p className="small" role="status">{TV.pflichtFehlen(fehlend.length, phase)}</p>
                <ul className="vt-pflicht">
                  {fehlend.map(a => (
                    <li key={`${a.kapitel}.${a.feld}`}>
                      <button type="button" className="btn sm vt-sprung" onClick={() => void wechsle(a.kapitel, a.feld)} aria-keyshortcuts={a === fehlend[0] ? 'Alt+N' : undefined}>
                        <Icon name="warn" />{TV.pflichtSprung(a.text, a.kapitel)}
                      </button>
                      {a.grund ? <p className="hint">{a.grund}</p> : null}
                    </li>
                  ))}
                </ul>
              </>
            )}
          {v.can.einreichen ? (
            <div className="vt-einreichen">
              {sperre && fehlend.length ? (
                <Hinweis stufe="sperre" live>{serverSperre ?? TV.einreichenGesperrt(phase, fehlend.map(a => `${a.text} (Kap. ${a.kapitel})`).join(', '))}</Hinweis>
              ) : null}
              <button type="button" className="btn primary" onClick={() => void einreichenStart()}><Icon name="send" />{TV.einreichen}</button>
            </div>
          ) : null}
          {v.anlass === 'aenderung' ? <AenderungPanel projektId={projektId} nummer={nummer} version={v} speichern={() => speichernRef.current()} /> : null}
        </aside>
      </div>
      {dialog ? (
        <Dialog title={TV.einreichenFrage(v.nummer)} onClose={() => setDialog(false)} footer={<>
          <button type="button" className="btn" onClick={() => setDialog(false)} data-autofocus>{TV.weiterBearbeiten}</button>
          <button type="button" className="btn primary" onClick={einreichenJetzt} disabled={einreichen.isPending}>{TV.einreichen}</button>
        </>}>
          <p>{TV.einreichenWirkung}</p>
        </Dialog>
      ) : null}
    </div>
  );
}

type Status = 'gespeichert' | 'speichert' | 'ungespeichert' | 'fehler' | 'konflikt' | 'gesperrt';

/** Ein Kapitel mit automatischem Speichern (I-R3), Rückgängig/Wiederholen und Konflikt (Z7). */
function KapitelArbeit({ versionId, nr, versionRo, feld, speichernRef, projektId, onFokussiert }: {
  versionId: string; nr: number; versionRo: boolean; feld?: string; speichernRef: MutableRefObject<() => Promise<boolean>>;
  projektId: string; onFokussiert(): void;
}) {
  const q = useKapitel(versionId, nr);
  const skelett = useVerzoegert(q.isPending);
  if (q.isPending) return <div aria-busy="true"><span className="sr" role="status">{T.common.loading}</span>{skelett ? <Skelett zeilen={4} /> : null}</div>;
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  return <KapitelForm geladen={q.data} versionId={versionId} nr={nr} ro={versionRo || !q.data.kapitel.can.write} feld={feld} speichernRef={speichernRef}
    projektId={projektId} onFokussiert={onFokussiert} betraegeVerborgen={nr === 9 && !versionRo && !q.data.kapitel.can.write} />;
}

function KapitelForm({ geladen, versionId, nr, ro, feld, speichernRef, projektId, onFokussiert, betraegeVerborgen }: {
  geladen: KapitelLoaded; versionId: string; nr: number; ro: boolean; feld?: string; speichernRef: MutableRefObject<() => Promise<boolean>>;
  projektId: string; onFokussiert(): void; betraegeVerborgen: boolean;
}) {
  const { speichern: speicherMut } = useVertragMutations(undefined);
  const [inhalt, setInhalt] = useState<Inhalt>(geladen.kapitel.inhalt as Inhalt);
  const [verlauf, setVerlauf] = useState<{ zurueck: Inhalt[]; vor: Inhalt[] }>({ zurueck: [], vor: [] });
  const [status, setStatus] = useState<Status>('gespeichert');
  const [fehler, setFehler] = useState<unknown>(null);
  const [gespeichertAt, setGespeichertAt] = useState<number | null>(null);
  const inhaltRef = useRef(inhalt);
  const etagRef = useRef(geladen.etag);
  const dirty = useRef(false);
  const laeuft = useRef<Promise<boolean> | null>(null);
  const letzte = useRef<{ feld: string; at: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const setze = useCallback((i: Inhalt) => { inhaltRef.current = i; setInhalt(i); }, []);
  const lokal = useMemo(() => pruefeLokal(nr, inhalt), [nr, inhalt]);
  const server = useMemo(() => Object.fromEntries((describeError(fehler).fields ?? []).map(f => [f.path.replace(/^\/inhalt\//, ''), f.message])), [fehler]);

  const speichern = useCallback(async (): Promise<boolean> => {
    if (ro) return true;
    while (laeuft.current) await laeuft.current;
    if (!dirty.current) return true;
    if (Object.keys(pruefeLokal(nr, inhaltRef.current)).length) { setStatus('ungespeichert'); return false; }
    const stand = inhaltRef.current;
    dirty.current = false;
    setStatus('speichert');
    const p = speicherMut.mutateAsync({ id: versionId, nr, etag: etagRef.current, inhalt: stand }).then(
      l => {
        etagRef.current = l.etag;
        setGespeichertAt(Date.now());
        setFehler(null);
        if (inhaltRef.current === stand) setStatus('gespeichert');
        return !dirty.current;
      },
      (e: unknown) => {
        dirty.current = true;
        setFehler(e);
        setStatus(isConflict(e) ? 'konflikt' : statusOf(e) === 409 ? 'gesperrt' : 'fehler');
        return false;
      },
    );
    laeuft.current = p;
    try { return await p; } finally { laeuft.current = null; }
  }, [ro, nr, versionId, speicherMut]);
  useEffect(() => { speichernRef.current = speichern; }, [speichern, speichernRef]);

  useEffect(() => {
    if (!dirty.current || status === 'konflikt' || status === 'gesperrt') return;
    const t = setTimeout(() => { void speichern(); }, PAUSE_MS);
    return () => clearTimeout(t);
  }, [inhalt, speichern, status]);

  // Eingaben gehen nicht verloren (I-F7)
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current || laeuft.current) e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  // Sprung zur Angabe (K2-4): Fokus auf das erste Bedienelement des Felds
  useEffect(() => {
    if (!feld) return;
    const el = document.getElementById(feldId(nr, feld)) ?? wrapRef.current;
    const ziel = el?.querySelector<HTMLElement>('textarea, input, select, button, [tabindex]') ?? el;
    ziel?.focus();
    el?.scrollIntoView?.({ block: 'center' });
    onFokussiert();
  }, [feld, nr, onFokussiert]);

  const [jetzt, setJetzt] = useState(() => Date.now());
  useEffect(() => {
    if (!gespeichertAt) return;
    const t = setInterval(() => setJetzt(Date.now()), 5000);
    return () => clearInterval(t);
  }, [gespeichertAt]);

  const aendere = useCallback((neu: Inhalt, f: string) => {
    const vorher = inhaltRef.current;
    const l = letzte.current;
    const zusammen = l && l.feld === f && Date.now() - l.at < ZUSAMMENFASSEN_MS;
    letzte.current = { feld: f, at: Date.now() };
    setVerlauf(v => (zusammen ? { ...v, vor: [] } : { zurueck: [...v.zurueck, vorher].slice(-MAX_VERLAUF), vor: [] }));
    dirty.current = true;
    setStatus(s => (s === 'konflikt' || s === 'gesperrt' ? s : 'ungespeichert'));
    setze(neu);
  }, [setze]);
  const rueckgaengig = () => {
    const vorher = verlauf.zurueck[verlauf.zurueck.length - 1];
    if (!vorher) return;
    setVerlauf(v => ({ zurueck: v.zurueck.slice(0, -1), vor: [inhaltRef.current, ...v.vor] }));
    letzte.current = null;
    dirty.current = true;
    setze(vorher);
  };
  const wiederholen = () => {
    const nach = verlauf.vor[0];
    if (!nach) return;
    setVerlauf(v => ({ zurueck: [...v.zurueck, inhaltRef.current], vor: v.vor.slice(1) }));
    letzte.current = null;
    dirty.current = true;
    setze(nach);
  };
  // Strg+Z / Strg+Umschalt+Z (bzw. ⌘) im Kapitel: Rückgängig und Wiederholen des Kapitels statt des Felds
  const tasten = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    tasten.current = (e: KeyboardEvent) => {
      if (ro || !(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); rueckgaengig(); }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); wiederholen(); }
    };
  });
  useEffect(() => {
    const el = wrapRef.current;
    const h = (e: KeyboardEvent) => tasten.current(e);
    el?.addEventListener('keydown', h);
    return () => el?.removeEventListener('keydown', h);
  }, []);

  // Konflikt (Z7): neu laden, eigene Änderungen behalten (und gegen den neuen Stand speichern) oder verwerfen
  const neuLaden = async (behalten: boolean) => {
    const l = await kapitelLaden(versionId, nr);
    etagRef.current = l.etag;
    setFehler(null);
    if (behalten) { dirty.current = true; setStatus('ungespeichert'); await speichern(); return; }
    dirty.current = false;
    setVerlauf({ zurueck: [], vor: [] });
    setze(l.kapitel.inhalt as Inhalt);
    setStatus('gespeichert');
  };

  const sek = gespeichertAt ? Math.max(0, Math.round((jetzt - gespeichertAt) / 1000)) : null;
  const statusText = status === 'speichert' ? TV.speichert : status === 'ungespeichert' && Object.keys(lokal).length ? TV.ungespeichert
    : status === 'gespeichert' && sek !== null ? TV.gespeichertVor(sek) : status === 'gespeichert' && !ro ? TV.gespeichert : '';

  return (
    <div className="vt-kapitel" ref={wrapRef}>
      {!ro ? (
        <div className="toolbar vt-tools">
          <button type="button" className="btn sm ghost" onClick={rueckgaengig} disabled={!verlauf.zurueck.length} title={TV.rueckgaengigTitel} aria-keyshortcuts="Control+Z">{TV.rueckgaengig}</button>
          <button type="button" className="btn sm ghost" onClick={wiederholen} disabled={!verlauf.vor.length} title={TV.wiederholenTitel} aria-keyshortcuts="Control+Shift+Z">{TV.wiederholen}</button>
          <span className="vt-status muted small" role="status" aria-live="polite">{statusText}</span>
        </div>
      ) : null}
      {betraegeVerborgen ? <Hinweis stufe="hinweis">{TV.ohneBetraege}</Hinweis> : null}
      {status === 'konflikt' ? (
        <div className="notice" role="alert">
          <p>{TV.konflikt(nr)}</p>
          <button type="button" className="btn" onClick={() => void neuLaden(true)}>{TV.konfliktLaden}</button>
          <button type="button" className="btn" onClick={() => void neuLaden(false)}>{TV.konfliktVerwerfen}</button>
        </div>
      ) : status === 'gesperrt' || status === 'fehler' ? (
        <div className="vt-fehler">
          <ErrorState error={fehler} />
          {status === 'fehler' ? <p className="small">{TV.fehlerSpeichern} <button type="button" className="btn sm" onClick={() => { dirty.current = true; void speichern(); }}>{TV.erneutSpeichern}</button></p> : null}
        </div>
      ) : null}
      <KapitelEditor nr={nr} inhalt={inhalt} basis={(geladen.kapitel.basis as Inhalt | null) ?? null} ro={ro} fehler={{ ...server, ...lokal }} onChange={aendere} projektId={projektId} />
    </div>
  );
}
