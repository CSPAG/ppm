/**
 * Arbeitsfläche des Phasenmodells (UI-46, Seitentyp «Arbeitsfläche»): Abschnitte links, Editor in der Mitte, Prüfbericht
 * rechts (I-P4). Automatisches Speichern mit Anzeige (I-R3), Rückgängig/Wiederholen (Strg+Z, Strg+Umschalt+Z), Konflikt
 * (Z7) mit beiden Wegen, Lesemodus (Z8) und gesperrte Version (Z9). Mobil: Abschnitte als Auswahl, Prüfbericht unten.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { isConflict, statusOf } from '../../api/index.ts';
import { Dialog, ErrorState, Hinweis, Icon, T, useToast } from '../../ui/index.ts';
import { usePhasenmodellMutations, type Loaded } from './api.ts';
import { abschnitte, alsPatch, dokAus, pruefeLokal, type Dok } from './dokument.ts';
import { FristenEditor, GateEditor, PhaseEditor, VersionEditor, WirkungEditor } from './Editoren.tsx';

const P = T.phasenmodell;
const PAUSE_MS = 800;
const ZUSAMMENFASSEN_MS = 1500;
const MAX_VERLAUF = 100;

type Status = 'gespeichert' | 'speichert' | 'ungespeichert' | 'fehler' | 'konflikt' | 'gesperrt';

export interface ArbeitsflaecheProps {
  loaded: Loaded;
  abschnitt: string;
  setAbschnitt(key: string): void;
  /** Nummer der Version in Kraft (für die Wirkung beim In-Kraft-Setzen). */
  inKraftNummer: number | null;
  /** Neu laden vom Server (Konflikt, nicht mehr bearbeitbar). */
  neuLaden(): Promise<Loaded | undefined>;
  onVerworfen(): void;
}

export function Arbeitsflaeche({ loaded, abschnitt, setAbschnitt, inKraftNummer, neuLaden, onVerworfen }: ArbeitsflaecheProps) {
  const modell = loaded.item;
  const ro = !modell.can.write;
  const toast = useToast();
  const { update, activate, remove } = usePhasenmodellMutations();

  const [doc, setDoc] = useState<Dok>(() => dokAus(modell));
  const [verlauf, setVerlauf] = useState<{ zurueck: Dok[]; vor: Dok[] }>({ zurueck: [], vor: [] });
  const [status, setStatus] = useState<Status>('gespeichert');
  const [fehler, setFehler] = useState<unknown>(null);
  const [gespeichertAt, setGespeichertAt] = useState<number | null>(null);
  const [dialog, setDialog] = useState<'inkraft' | 'verwerfen' | null>(null);

  const docRef = useRef(doc);
  const etagRef = useRef(loaded.etag);
  const dirty = useRef(false);
  const laeuft = useRef<Promise<boolean> | null>(null);
  const letzte = useRef<{ feld: string; at: number } | null>(null);
  /** Stand setzen: Ref sofort (für das Speichern), Zustand fürs Zeichnen. */
  const setze = useCallback((d: Dok) => { docRef.current = d; setDoc(d); }, []);

  const lokal = useMemo(() => pruefeLokal(doc), [doc]);

  /** Speichert den aktuellen Stand (wartet auf einen laufenden Aufruf); true, wenn danach nichts mehr offen ist. */
  const speichern = useCallback(async (): Promise<boolean> => {
    if (ro) return true;
    while (laeuft.current) await laeuft.current;
    if (!dirty.current) return true;
    if (Object.keys(pruefeLokal(docRef.current)).length) { setStatus('ungespeichert'); return false; }
    const stand = docRef.current;
    dirty.current = false;
    setStatus('speichert');
    const p = update.mutateAsync({ id: modell.id, etag: etagRef.current, body: alsPatch(stand) }).then(
      l => {
        etagRef.current = l.etag;
        setGespeichertAt(Date.now());
        setFehler(null);
        if (docRef.current === stand) setStatus('gespeichert');
        return !dirty.current;
      },
      (e: unknown) => {
        dirty.current = true;
        setFehler(e);
        setStatus(isConflict(e) ? 'konflikt' : statusOf(e) === 409 || statusOf(e) === 404 ? 'gesperrt' : 'fehler');
        return false;
      },
    );
    laeuft.current = p;
    try { return await p; } finally { laeuft.current = null; }
  }, [ro, update, modell.id]);

  // Automatisch speichern nach einer kurzen Pause (I-R3); nicht im Konflikt, dort entscheidet die Person
  useEffect(() => {
    if (!dirty.current || status === 'konflikt' || status === 'gesperrt') return;
    const t = setTimeout(() => { void speichern(); }, PAUSE_MS);
    return () => clearTimeout(t);
  }, [doc, speichern, status]);

  // Eingaben gehen nicht verloren (I-F7): beim Verlassen nachfragen, solange etwas offen ist
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current || laeuft.current) e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  // «Gespeichert vor 5 s»: Anzeige alle 5 Sekunden nachführen
  const [jetzt, setJetzt] = useState(() => Date.now());
  useEffect(() => {
    if (!gespeichertAt) return;
    const t = setInterval(() => setJetzt(Date.now()), 5000);
    return () => clearInterval(t);
  }, [gespeichertAt]);

  const aendere = useCallback((neu: Dok, feld: string) => {
    const vorher = docRef.current;
    const l = letzte.current;
    const zusammen = l && l.feld === feld && Date.now() - l.at < ZUSAMMENFASSEN_MS;
    letzte.current = { feld, at: Date.now() };
    if (!zusammen) setVerlauf(v => ({ zurueck: [...v.zurueck, vorher].slice(-MAX_VERLAUF), vor: [] }));
    else setVerlauf(v => ({ ...v, vor: [] }));
    dirty.current = true;
    setStatus(s => (s === 'konflikt' || s === 'gesperrt' ? s : 'ungespeichert'));
    setze(neu);
  }, [setze]);

  const rueckgaengig = () => {
    const vorher = verlauf.zurueck[verlauf.zurueck.length - 1];
    if (!vorher) return;
    setVerlauf(v => ({ zurueck: v.zurueck.slice(0, -1), vor: [docRef.current, ...v.vor] }));
    letzte.current = null;
    dirty.current = true;
    setze(vorher);
  };
  const wiederholen = () => {
    const nach = verlauf.vor[0];
    if (!nach) return;
    setVerlauf(v => ({ zurueck: [...v.zurueck, docRef.current], vor: v.vor.slice(1) }));
    letzte.current = null;
    dirty.current = true;
    setze(nach);
  };

  // Strg+Z / Strg+Umschalt+Z (bzw. ⌘) in der Arbeitsfläche: Rückgängig und Wiederholen des Dokuments statt des Felds
  const wrapRef = useRef<HTMLDivElement>(null);
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

  // Konflikt (Z7): eigene Fassung auf den neuen Stand speichern oder die Fassung der anderen übernehmen
  const meineFassung = async () => {
    const neu = await neuLaden();
    if (!neu) return;
    etagRef.current = neu.etag;
    dirty.current = true;
    setStatus('ungespeichert');
    await speichern();
  };
  const andereFassung = async () => {
    const neu = await neuLaden();
    if (!neu) return;
    etagRef.current = neu.etag;
    dirty.current = false;
    setVerlauf({ zurueck: [], vor: [] });
    setze(dokAus(neu.item));
    setStatus('gespeichert');
    setFehler(null);
  };

  const liste = abschnitte(doc);
  const aktiv = liste.find(a => a.key === abschnitt) ?? liste[0]!;
  const pruefung = modell.pruefung;
  const anzahl = (key: string) => pruefung.filter(p => p.ort.code === key || (key === 'fristen' && (p.ort.art === 'frist' || p.ort.art === 'toleranz')) || (key === 'wirkung' && p.ort.art === 'wirkung')).length;
  const warnungen = pruefung.filter(p => p.stufe === 'warnung').length;
  const navId = useId();

  const inKraftSetzen = async () => {
    if (!(await speichern())) { setDialog(null); return; }
    activate.mutate({ id: modell.id, etag: etagRef.current }, {
      onSuccess: l => { setDialog(null); toast.show(P.inKraft(l.item.nummer)); },
      onError: e => { setDialog(null); toast.error(e); },
    });
  };
  const verwerfen = () => {
    dirty.current = false;
    remove.mutate({ id: modell.id, etag: etagRef.current }, {
      onSuccess: () => { setDialog(null); toast.show(P.verworfen); onVerworfen(); },
      onError: e => { setDialog(null); toast.error(e); },
    });
  };

  const sek = gespeichertAt ? Math.max(0, Math.round((jetzt - gespeichertAt) / 1000)) : null;
  const statusText = status === 'speichert' ? P.speichert : status === 'ungespeichert' && Object.keys(lokal).length ? P.ungespeichert
    : status === 'gespeichert' && sek !== null ? P.gespeichertVor(sek) : status === 'gespeichert' ? P.gespeichert : '';

  return (
    <div className="pm-wrap" ref={wrapRef}>
      {!ro ? (
        <div className="toolbar pm-tools">
          <button type="button" className="btn sm ghost" onClick={rueckgaengig} disabled={!verlauf.zurueck.length} title={P.rueckgaengigTitel} aria-keyshortcuts="Control+Z">{P.rueckgaengig}</button>
          <button type="button" className="btn sm ghost" onClick={wiederholen} disabled={!verlauf.vor.length} title={P.wiederholenTitel} aria-keyshortcuts="Control+Shift+Z">{P.wiederholen}</button>
          <span className="pm-status muted small" role="status" aria-live="polite">{statusText}</span>
          <span className="spacer" />
          <button type="button" className="btn danger" onClick={() => setDialog('verwerfen')}><Icon name="trash" />{P.verwerfen}</button>
          {modell.can.activate ? <button type="button" className="btn primary" onClick={() => setDialog('inkraft')}><Icon name="check" />{P.inKraftSetzen}</button> : null}
        </div>
      ) : null}
      {status === 'konflikt' ? (
        <div className="notice pm-banner" role="alert">
          <p>{P.konflikt}</p>
          <button type="button" className="btn" onClick={() => void meineFassung()}>{P.konfliktMeine}</button>
          <button type="button" className="btn" onClick={() => void andereFassung()}>{P.konfliktAndere}</button>
        </div>
      ) : status === 'gesperrt' ? (
        <div className="notice pm-banner" role="alert">
          <p>{P.nichtMehrEntwurf}</p>
          <button type="button" className="btn" onClick={() => void neuLaden()}>{T.common.reload}</button>
        </div>
      ) : status === 'fehler' ? (
        <div className="pm-banner">
          <ErrorState error={fehler} />
          <p className="small">{P.fehlerSpeichern} <button type="button" className="btn sm" onClick={() => { dirty.current = true; void speichern(); }}>{P.erneutSpeichern}</button></p>
        </div>
      ) : null}
      <div className="pm-flaeche">
        <nav className="pm-nav" aria-labelledby={`${navId}-h`}>
          <h2 id={`${navId}-h`} className="sr">{P.elemente}</h2>
          <label className="pm-nav-sel">
            <span className="sr">{P.element}</span>
            <select className="pm-in" value={aktiv.key} onChange={e => setAbschnitt(e.target.value)}>
              {liste.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
            </select>
          </label>
          <ul className="pm-nav-l">
            {liste.map(a => {
              const n = anzahl(a.key);
              return (
                <li key={a.key}>
                  <button type="button" className={`nav pm-nav-i pm-${a.art}${a.key === aktiv.key ? ' on' : ''}`} aria-current={a.key === aktiv.key ? 'true' : undefined} onClick={() => setAbschnitt(a.key)}>
                    {a.art === 'gate' ? <Icon name="chev" /> : null}
                    <span className="lbl">{a.label}</span>
                    {n ? <span className="cnt" aria-label={P.pruefAnzahl(n)}>{n}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        <section className="pm-haupt" aria-labelledby={`${navId}-a`}>
          <h2 id={`${navId}-a`} className="pm-titel">
            {aktiv.art === 'phase' ? <span className="muted small">{P.phase} · </span> : null}
            {aktiv.label}
          </h2>
          <Editor art={aktiv.art} schluessel={aktiv.key} doc={doc} aendere={aendere} ro={ro} fehler={lokal} modell={modell} />
        </section>
        <aside className="pm-panel" aria-labelledby={`${navId}-p`}>
          <h2 id={`${navId}-p`} className="grp-h">{P.pruefbericht}</h2>
          {pruefung.length === 0 ? <p className="muted small">{P.pruefLeer}</p> : (
            <ul className="pm-pruef">
              {pruefung.map((p, i) => {
                const ziel = p.ort.art === 'frist' || p.ort.art === 'toleranz' ? 'fristen' : p.ort.art === 'wirkung' ? 'wirkung' : p.ort.code;
                return (
                  <li key={i}>
                    <Hinweis stufe={p.stufe} aktion={ziel && ziel !== aktiv.key ? <button type="button" className="btn sm" onClick={() => setAbschnitt(ziel)}>{P.zumObjekt}</button> : undefined}>{p.text}</Hinweis>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>
      {dialog === 'inkraft' ? (
        <Dialog title={P.inKraftFrage(modell.nummer)} onClose={() => setDialog(null)} footer={<>
          <button type="button" className="btn" onClick={() => setDialog(null)} data-autofocus>{P.weiterBearbeiten}</button>
          <button type="button" className="btn primary" onClick={() => void inKraftSetzen()} disabled={activate.isPending}>{P.inKraftSetzen}</button>
        </>}>
          <p>{P.inKraftWirkung}</p>
          {inKraftNummer ? <p>{P.inKraftAbloesung(inKraftNummer)}</p> : null}
          {warnungen ? <Hinweis stufe="warnung">{P.inKraftWarnungen(warnungen)}</Hinweis> : null}
        </Dialog>
      ) : null}
      {dialog === 'verwerfen' ? (
        <Dialog title={P.verwerfenFrage(modell.nummer)} onClose={() => setDialog(null)} footer={<>
          <button type="button" className="btn" onClick={() => setDialog(null)} data-autofocus>{P.weiterBearbeiten}</button>
          <button type="button" className="btn danger solid" onClick={verwerfen} disabled={remove.isPending}>{P.verwerfen}</button>
        </>}>
          <p>{P.verwerfenText}</p>
        </Dialog>
      ) : null}
    </div>
  );
}

function Editor({ art, schluessel, doc, aendere, ro, fehler, modell }: {
  art: string; schluessel: string; doc: Dok; aendere(d: Dok, feld: string): void; ro: boolean; fehler: Record<string, string>; modell: Loaded['item'];
}) {
  if (art === 'version') return <VersionEditor modell={modell} beschreibung={doc.beschreibung} onChange={beschreibung => aendere({ ...doc, beschreibung }, 'beschreibung')} ro={ro} />;
  if (art === 'fristen') {
    return <FristenEditor fristen={doc.fristen} toleranzen={doc.toleranzen} ro={ro} fehler={fehler}
      onFristen={fristen => aendere({ ...doc, fristen }, 'fristen')} onToleranzen={toleranzen => aendere({ ...doc, toleranzen }, 'toleranzen')} />;
  }
  if (art === 'wirkung') return <WirkungEditor wirkung={doc.kapitelWirkung} onChange={kapitelWirkung => aendere({ ...doc, kapitelWirkung }, 'wirkung')} ro={ro} />;
  const pi = doc.phasen.findIndex(p => p.code === schluessel);
  if (art === 'phase' && pi >= 0) {
    return <PhaseEditor phase={doc.phasen[pi]!} index={pi} ro={ro} fehler={fehler}
      onChange={p => aendere({ ...doc, phasen: doc.phasen.map((x, i) => (i === pi ? p : x)) }, `phase:${schluessel}`)} />;
  }
  const gi = doc.gates.findIndex(g => g.code === schluessel);
  if (art === 'gate' && gi >= 0) {
    return <GateEditor gate={doc.gates[gi]!} index={gi} ro={ro} fehler={fehler}
      onChange={g => aendere({ ...doc, gates: doc.gates.map((x, i) => (i === gi ? g : x)) }, `gate:${schluessel}`)} />;
  }
  return null;
}
