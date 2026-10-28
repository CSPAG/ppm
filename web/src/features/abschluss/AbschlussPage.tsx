/**
 * Projektakte › Abschluss (UI-14; BC PS.04.01–03, PC.03.02, PC.03.04; UC-015; Seitentyp Arbeitsfläche): oben die
 * Ausgangslage aus Vertrag und Register (Schritt 1), darunter der Bericht – am Exit-Gate P4 Zielerreichung mit Werten je
 * KPI, Business Case Abschluss, Übergabe, offene Punkte (Schritte 2, 4), bei Sistierung oder Abbruch Stand und offene
 * Punkte (A1.1) –, die Beurteilung der Nutzenrealisierung durch Sponsor und UE (Schritt 3) und die Lessons Learned.
 * Rechts das Seitenpanel «Bereit zum Einreichen» (I-P4) mit Sprung zur fehlenden Angabe; Einreichen mit Vorschau der
 * Wirkung (I-R1 Stufe 3). Automatisches Speichern (I-R3); eingereicht, beim Gremium und abgeschlossen nur lesbar (Z8,
 * Z9). Wiederaufnahme sistierter Projekte als Antrag an das Gremium (A-09).
 */
import { describeError } from '@vollholz/iam-web';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, ApiError, isConflict } from '../../api/index.ts';
import { Dialog, Empty, ErrorState, fmtBetragKurz, fmtDatum, fmtPhase, Hinweis, Icon, Skelett, T, useToast, useVerzoegert, type Phase } from '../../ui/index.ts';
import {
  newIdempotencyKey, useAbschluss, useEinreichen, useLessonMutations, useNutzen, useProjekt, useSpeichern, useWiederaufnahme,
  type Abschluss, type AbschlussIn, type Geladen, type OffenerPunkt,
} from './api.ts';
import { TA } from './texte.ts';
import './abschluss.css';

const SPEICHERN_NACH_MS = 600;

type Felder = AbschlussIn;
const LEER: Felder = { projektstand: '', zielerreichung: '', kpiWerte: [], businessCase: '', uebergabe: '', offenePunkte: [] };
const felderVon = (b: Abschluss['bericht']): Felder => (b
  ? { projektstand: b.projektstand, zielerreichung: b.zielerreichung, kpiWerte: b.kpiWerte, businessCase: b.businessCase, uebergabe: b.uebergabe, offenePunkte: b.offenePunkte }
  : LEER);
/** Leere offene Punkte (gerade hinzugefügt) gehen nicht an den Server. */
const body = (f: Felder): Felder => ({ ...f, offenePunkte: f.offenePunkte.filter(o => o.text.trim()) });

const feldId = (feld: string) => `ab-${feld}`;
const springe = (feld: string) => { const el = document.getElementById(feldId(feld)); el?.scrollIntoView?.({ block: 'center' }); el?.focus(); };
const tag = (iso: string) => fmtDatum(iso.slice(0, 10));

/** Pflichtangaben wie der Server (I-P6): Abschluss Zielerreichung, Business Case, Übergabe; sonst Stand des Vorhabens. */
function fehlend(art: string, f: Felder): { feld: string; text: string }[] {
  const l: { feld: string; text: string }[] = [];
  if (art === 'abschluss') {
    if (!f.zielerreichung.trim()) l.push({ feld: 'zielerreichung', text: TA.felder.zielerreichung });
    if (!f.businessCase.trim()) l.push({ feld: 'businessCase', text: TA.felder.businessCase });
    if (!f.uebergabe.trim()) l.push({ feld: 'uebergabe', text: TA.felder.uebergabe });
  } else if (!f.projektstand.trim()) {
    l.push({ feld: 'projektstand', text: TA.felder.projektstand });
  }
  return l;
}

function Abschnitt({ id, titel, children }: { id: string; titel: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grp ab-abschnitt">
      <h2 id={id} className="grp-h">{titel}</h2>
      {children}
    </section>
  );
}

export function AbschlussPage({ nummer }: { nummer: string }) {
  const projekt = useProjekt(nummer);
  const p = projekt.data ?? undefined;
  const q = useAbschluss(p?.id);
  const skelett = useVerzoegert(projekt.isPending || (!!p && q.isPending));
  if (projekt.isPending || (p && q.isPending)) return <div aria-busy="true"><span className="sr" role="status">{T.common.loading}</span>{skelett ? <Skelett zeilen={5} /> : null}</div>;
  if (projekt.error) return <ErrorState error={projekt.error} onRetry={() => void projekt.refetch()} />;
  if (!p) return <Empty>{TA.projektFehlt}</Empty>;
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  return <Arbeitsflaeche key={p.id} projektId={p.id} geladen={q.data!} refetch={() => q.refetch()} />;
}

function Arbeitsflaeche({ projektId, geladen, refetch }: { projektId: string; geladen: Geladen; refetch(): Promise<unknown> }) {
  const a = geladen.abschluss;
  const b = a.bericht;
  const toast = useToast();
  const speichern = useSpeichern(projektId);
  const einreichen = useEinreichen(projektId);
  const [f, setF] = useState<Felder>(() => felderVon(b));
  const offen = useRef(false);
  const etag = useRef(geladen.etag);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aktuell = useRef(f);
  const [zustand, setZustand] = useState<'gespeichert' | 'speichert' | 'ungespeichert'>('gespeichert');
  const [frage, setFrage] = useState(false);
  const [versucht, setVersucht] = useState(false);
  const bearbeitbar = a.can.bearbeiten;
  const art = b?.art ?? (a.lage === 'sistierung' ? 'sistierung' : a.lage === 'abbruch' ? 'abbruch' : 'abschluss');

  // Neue Fassung vom Server (Einreichen, Entscheid, Neuladen) übernehmen, solange nichts offen ist
  useEffect(() => {
    etag.current = geladen.etag;
    if (!offen.current) { const neu = felderVon(geladen.abschluss.bericht); aktuell.current = neu; setF(neu); }
  }, [geladen]);

  // Höchstens ein Speichern zugleich: ein weiteres wartet auf das laufende und nimmt dessen ETag (sonst 412 und Verlust)
  const laufend = useRef<Promise<boolean> | null>(null);
  const sichern = useCallback(async (): Promise<boolean> => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    while (laufend.current) await laufend.current;
    if (!offen.current) return true;
    const lauf = (async () => {
      offen.current = false;
      setZustand('speichert');
      try {
        const l = await speichern.mutateAsync({ etag: etag.current, body: body(aktuell.current) });
        etag.current = l.etag;
        setZustand(offen.current ? 'ungespeichert' : 'gespeichert');
        return true;
      } catch (e) {
        setZustand('ungespeichert');
        if (isConflict(e)) { toast.show(TA.konflikt, { tone: 'error' }); await refetch(); return false; }
        offen.current = true;
        toast.error(e);
        return false;
      } finally {
        laufend.current = null;
      }
    })();
    laufend.current = lauf;
    return lauf;
  }, [speichern, refetch, toast]);
  const sichernRef = useRef(sichern);
  useEffect(() => { sichernRef.current = sichern; }, [sichern]);

  const setze = useCallback((patch: Partial<Felder>) => {
    const neu = { ...aktuell.current, ...patch };
    aktuell.current = neu;
    setF(neu);
    offen.current = true;
    setZustand('ungespeichert');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void sichern(); }, SPEICHERN_NACH_MS);
  }, [sichern]);

  // Beim Verlassen der Seite (anderer Reiter, andere Adresse) offene Eingaben noch speichern statt verwerfen
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (offen.current) void sichernRef.current();
  }, []);

  const liste = useMemo(() => fehlend(art, f), [art, f]);
  const reichEin = async () => {
    setFrage(false);
    if (!(await sichern())) return;
    einreichen.mutate({ etag: etag.current }, {
      onSuccess: l => { etag.current = l.etag; toast.show(l.abschluss.bericht?.stand === 'traktandiert' ? TA.panel.eingereichtGremium : TA.panel.eingereicht); },
      onError: e => {
        const err = e instanceof ApiError ? e.fieldErrors : [];
        if (err[0]) springe(err[0].path.slice(1));
        toast.error(e);
      },
    });
  };
  const versuchen = () => {
    if (liste.length) { setVersucht(true); springe(liste[0]!.feld); return; }
    setFrage(true);
  };

  if (a.lage === 'keine' && !b) {
    return (
      <div className="ab-wrap">
        <div className="ab-leer"><Empty><strong>{TA.keine.titel}</strong><br />{TA.keine.text(fmtPhase(a.projekt.phase as Phase))}</Empty></div>
        <div className="ab-haupt"><Grundlagen a={a} /><LessonsAbschnitt a={a} projektId={projektId} /></div>
      </div>
    );
  }

  const banner = a.lage === 'abgeschlossen' && b?.abgenommenAt ? TA.banner.abgeschlossen(tag(b.abgenommenAt))
    : b?.stand === 'traktandiert' ? TA.banner.traktandiert
      : b?.stand === 'nacharbeit' ? TA.banner.nacharbeit
        : b?.stand === 'eingereicht' && b.eingereichtAt ? TA.banner.eingereicht(tag(b.eingereichtAt))
          : a.lage === 'sistierung' ? TA.banner.sistiert
            : a.lage === 'abbruch' ? TA.banner.abgebrochen
              : !bearbeitbar ? TA.banner.nurLesen : null;

  return (
    <div className="ab-wrap">
      <div className="toolbar ab-tools">
        <h2 className="ab-titel">{TA.titel[art]}</h2>
        {b ? <span className="pill">{TA.stand[b.stand]}</span> : null}
        <span className="spacer" />
        {bearbeitbar ? <span className="muted small" role="status">{TA[zustand]}</span> : null}
        {a.can.wiederaufnahme ? <Wiederaufnahme projektId={projektId} /> : null}
        {a.can.dokument ? <Dokument projektId={projektId} nummer={a.projekt.nummer} /> : null}
      </div>
      {banner ? <div className="ab-banner"><Hinweis stufe="hinweis">{banner}</Hinweis></div> : null}
      <div className="ab-flaeche">
        <div className="ab-haupt">
          {a.entscheid ? <p className="small muted">{TA.letzterEntscheid(TA.entscheid[a.entscheid.ergebnis] ?? a.entscheid.ergebnis, tag(a.entscheid.at))}</p> : null}
          <Grundlagen a={a} />
          {art === 'abschluss' ? (
            <>
              <Abschnitt id="ab-h-ziel" titel={TA.abschnitte.zielerreichung}>
                <Textfeld feld="zielerreichung" label={TA.felder.zielerreichung} hint={TA.felder.zielerreichungHint} f={f} setze={setze} dis={!bearbeitbar} />
                <KpiWerte a={a} f={f} setze={setze} dis={!bearbeitbar} />
              </Abschnitt>
              <Abschnitt id="ab-h-bc" titel={TA.abschnitte.businessCase}>
                <Textfeld feld="businessCase" label={TA.felder.businessCase} hint={TA.felder.businessCaseHint} f={f} setze={setze} dis={!bearbeitbar} />
              </Abschnitt>
              <Abschnitt id="ab-h-ueb" titel={TA.abschnitte.uebergabe}>
                <Textfeld feld="uebergabe" label={TA.felder.uebergabe} hint={TA.felder.uebergabeHint} f={f} setze={setze} dis={!bearbeitbar} />
              </Abschnitt>
            </>
          ) : (
            <Abschnitt id="ab-h-stand" titel={TA.abschnitte.projektstand}>
              <Textfeld feld="projektstand" label={TA.felder.projektstand} hint={TA.felder.projektstandHint} f={f} setze={setze} dis={!bearbeitbar} />
            </Abschnitt>
          )}
          <Abschnitt id="ab-h-op" titel={TA.abschnitte.offenePunkte}>
            <OffenePunkte punkte={f.offenePunkte} setze={p => setze({ offenePunkte: p })} dis={!bearbeitbar} />
          </Abschnitt>
          {art === 'abschluss' && b ? <Nutzen a={a} projektId={projektId} etag={() => etag.current} /> : null}
          <LessonsAbschnitt a={a} projektId={projektId} />
          {a.berichte.length > 1 ? (
            <Abschnitt id="ab-h-fr" titel={TA.abschnitte.berichte}>
              <ul className="ab-liste">
                {a.berichte.filter(x => x.id !== b?.id).map(x => (
                  <li key={x.id}>{TA.titel[x.art]} · {TA.stand[x.stand]}{x.eingereichtAt ? ` · ${tag(x.eingereichtAt)}` : ''}</li>
                ))}
              </ul>
            </Abschnitt>
          ) : null}
        </div>
        <aside className="ab-panel" aria-labelledby="ab-panel-h">
          <h2 id="ab-panel-h" className="grp-h">{TA.panel.titel}</h2>
          {/* Vor dem ersten Speichern gibt es noch keinen Bericht: die Projektleitung sieht trotzdem, was fehlt */}
          {a.can.einreichen || (!b && bearbeitbar) ? (
            <>
              {liste.length ? (
                <>
                  {versucht ? <Hinweis stufe="sperre" live>{TA.panel.sperre(liste.map(x => x.text).join(', '))}</Hinweis> : <p className="small"><strong>{TA.panel.fehlt(liste.length)}</strong></p>}
                  <ul className="ab-fehlt">
                    {liste.map(x => <li key={x.feld}><button type="button" className="btn sm ghost" onClick={() => springe(x.feld)}>{x.text}</button></li>)}
                  </ul>
                </>
              ) : <p className="small"><Icon name="check" /> {TA.panel.bereit}</p>}
              <p className="muted small">{art === 'abschluss' ? TA.panel.wirkungAbschluss : TA.panel.wirkungAnderer}</p>
              <button type="button" className="btn primary" onClick={versuchen} disabled={einreichen.isPending || (!a.can.einreichen && !liste.length)}>{TA.panel.einreichen}</button>
            </>
          ) : <p className="muted small">{b ? TA.panel.nichtBearbeitbar(TA.stand[b.stand] ?? b.stand) : TA.banner.nurLesen}</p>}
        </aside>
      </div>
      {frage ? (
        <Dialog title={TA.panel.frage} onClose={() => setFrage(false)} footer={<>
          <button type="button" className="btn" onClick={() => setFrage(false)} data-autofocus>{T.common.cancel}</button>
          <button type="button" className="btn primary" onClick={() => void reichEin()} disabled={einreichen.isPending}>{TA.panel.einreichen}</button>
        </>}>
          <p>{art === 'abschluss' ? TA.panel.wirkungAbschluss : TA.panel.wirkungAnderer}</p>
        </Dialog>
      ) : null}
    </div>
  );
}

function Textfeld({ feld, label, hint, f, setze, dis }: {
  feld: 'projektstand' | 'zielerreichung' | 'businessCase' | 'uebergabe'; label: string; hint: string; f: Felder; setze(p: Partial<Felder>): void; dis: boolean;
}) {
  return (
    <div className="field">
      <label htmlFor={feldId(feld)}>{label}</label>
      <textarea id={feldId(feld)} value={f[feld]} disabled={dis} rows={4} maxLength={10000} aria-describedby={`${feldId(feld)}-h`}
        onChange={e => setze({ [feld]: e.target.value })} />
      <span id={`${feldId(feld)}-h`} className="hint">{hint}</span>
    </div>
  );
}

/** Ausgangslage (UC-015 Schritt 1): Ziele und Business Case der Baseline, KPIs, Kosten, offene Meilensteine. */
function Grundlagen({ a }: { a: Abschluss }) {
  const g = a.grundlagen;
  const text = (t: string) => (t.trim() ? <span className="wrap">{t}</span> : <span className="empty">{TA.grundlagen.leer}</span>);
  return (
    <Abschnitt id="ab-h-grund" titel={TA.abschnitte.grundlagen}>
      <p className="muted small">{TA.grundlagen.baseline(g.baseline)}</p>
      <dl className="attrs ab-attrs">
        <dt>{TA.grundlagen.ziele}</dt><dd>{text(g.ziele)}</dd>
        <dt>{TA.grundlagen.nutzen}</dt><dd>{text(g.nutzen)}</dd>
        <dt>{TA.grundlagen.businessCase}</dt><dd>{text(g.businessCase)}</dd>
        {g.nutzenpruefung ? <><dt>{TA.grundlagen.nutzenpruefung(g.nutzenpruefung.version)}</dt><dd>{text(g.nutzenpruefung.beurteilung)}</dd></> : null}
        <dt>{TA.grundlagen.kosten}</dt>
        <dd>{g.kosten ? TA.grundlagen.kostenWerte(fmtBetragKurz(g.kosten.budgetBaseline), fmtBetragKurz(g.kosten.prognose), fmtBetragKurz(g.kosten.ist)) : <span className="muted">{TA.grundlagen.keineBetraege}</span>}</dd>
      </dl>
      {g.offeneMeilensteine.length ? (
        <>
          <p className="small"><Icon name="info" /> {TA.grundlagen.offeneMeilensteine(g.offeneMeilensteine.length)}</p>
          <ul className="ab-liste">
            {g.offeneMeilensteine.map(m => <li key={m.id}>{m.phase} · {m.text}{(m.terminAktuell ?? m.terminBaseline) ? <span className="muted small"> · {fmtDatum((m.terminAktuell ?? m.terminBaseline)!)}</span> : null}</li>)}
          </ul>
        </>
      ) : <p className="small"><Icon name="check" /> {TA.grundlagen.alleErreicht}</p>}
    </Abschnitt>
  );
}

/** Erreichte Werte je KPI am Abschluss mit Zielwert und letztem Ist-Wert (UC-015 Schritt 2: Vergleich mit den Zielwerten). */
function KpiWerte({ a, f, setze, dis }: { a: Abschluss; f: Felder; setze(p: Partial<Felder>): void; dis: boolean }) {
  const kpis = a.grundlagen.kpis;
  const gate = a.grundlagen.nutzenpruefung;
  if (!kpis.length) return <p className="empty">{TA.kpi.leer}</p>;
  const wert = (id: string) => f.kpiWerte.find(w => w.kpiId === id) ?? { kpiId: id, wert: '', bemerkung: '' };
  const aendern = (id: string, patch: { wert?: string; bemerkung?: string }) => {
    const neu = { ...wert(id), ...patch };
    const rest = f.kpiWerte.filter(w => w.kpiId !== id);
    setze({ kpiWerte: neu.wert.trim() || neu.bemerkung.trim() ? [...rest, neu] : rest });
  };
  return (
    <div className="ab-tab-wrap">
      <table className="ab-tab">
        <thead><tr><th scope="col">{TA.kpi.kpi}</th><th scope="col">{TA.kpi.ziel}</th><th scope="col">{TA.kpi.ist}</th>{gate ? <th scope="col">{TA.grundlagen.gateWert}</th> : null}<th scope="col">{TA.kpi.erreicht}</th><th scope="col">{TA.kpi.bemerkung}</th></tr></thead>
        <tbody>
          {kpis.map(k => (
            <tr key={k.id}>
              <td>{k.text}{k.einheit ? <span className="muted small"> ({k.einheit})</span> : null}</td>
              <td>{k.zielwert || '–'}</td>
              <td>{k.ist ? String(k.ist.wert) : '–'}</td>
              {gate ? <td>{gate.werte.find(w => w.kpiId === k.id)?.wert || '–'}</td> : null}
              <td><input className="ab-in" aria-label={TA.kpi.erreichtVon(k.text)} value={wert(k.id).wert} disabled={dis} maxLength={200} onChange={e => aendern(k.id, { wert: e.target.value })} /></td>
              <td><input className="ab-in" aria-label={TA.kpi.bemerkungVon(k.text)} value={wert(k.id).bemerkung} disabled={dis} maxLength={1000} onChange={e => aendern(k.id, { bemerkung: e.target.value })} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Offene Punkte mit Verantwortlichen und Termin (UC-015 Schritt 4, A1.1). */
function OffenePunkte({ punkte, setze, dis }: { punkte: OffenerPunkt[]; setze(p: OffenerPunkt[]): void; dis: boolean }) {
  const aendern = (i: number, patch: Partial<OffenerPunkt>) => setze(punkte.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return (
    <>
      {punkte.length ? (
        <ul className="ab-punkte">
          {punkte.map((p, i) => (
            <li key={i} className="ab-punkt">
              <input className="ab-in ab-gross" aria-label={TA.punkt.textVon(i + 1)} placeholder={TA.punkt.text} value={p.text} disabled={dis} maxLength={2000} onChange={e => aendern(i, { text: e.target.value })} />
              <input className="ab-in" aria-label={TA.punkt.verantwortlichVon(i + 1)} placeholder={TA.punkt.verantwortlich} value={p.verantwortlich} disabled={dis} maxLength={200} onChange={e => aendern(i, { verantwortlich: e.target.value })} />
              <input className="ab-in" type="date" aria-label={TA.punkt.terminVon(i + 1)} value={p.termin ?? ''} disabled={dis} onChange={e => aendern(i, { termin: e.target.value || null })} />
              {!dis ? <button type="button" className="iconbtn" aria-label={TA.punkt.entfernen(p.text)} onClick={() => setze(punkte.filter((_, j) => j !== i))}><Icon name="trash" /></button> : null}
            </li>
          ))}
        </ul>
      ) : <p className="empty">{TA.punkt.leer}</p>}
      {!dis ? <button type="button" className="btn sm" onClick={() => setze([...punkte, { text: '', verantwortlich: '', termin: null }])}><Icon name="plus" />{TA.punkt.neu}</button> : null}
    </>
  );
}

/** Beurteilung der Nutzenrealisierung durch Sponsor und UE (UC-015 Schritt 3, PC.03.02). */
function Nutzen({ a, projektId, etag }: { a: Abschluss; projektId: string; etag(): string }) {
  const b = a.bericht!;
  return (
    <Abschnitt id="ab-h-nutzen" titel={TA.abschnitte.nutzen}>
      <p className="muted small">{TA.nutzen.hint}</p>
      {/* neu aufgebaut, wenn sich die gespeicherte Beurteilung ändert */}
      <NutzenRolle key={`sp-${b.nutzen.sp?.at ?? ''}`} rolle="sp" label={TA.nutzen.sp} wert={b.nutzen.sp} darf={a.can.nutzenSp} projektId={projektId} etag={etag} />
      <NutzenRolle key={`ue-${b.nutzen.ue?.at ?? ''}`} rolle="ue" label={TA.nutzen.ue} wert={b.nutzen.ue} darf={a.can.nutzenUe} projektId={projektId} etag={etag} />
    </Abschnitt>
  );
}

function NutzenRolle({ rolle, label, wert, darf, projektId, etag }: {
  rolle: 'sp' | 'ue'; label: string; wert: { text: string; at: string; von: string } | null; darf: boolean; projektId: string; etag(): string;
}) {
  const id = useId();
  const [text, setText] = useState(wert?.text ?? '');
  const m = useNutzen(projektId);
  const toast = useToast();
  if (!darf) {
    return (
      <div className="ab-nutzen">
        <strong>{label}</strong>
        <p className="wrap">{wert ? <>{wert.text} <span className="muted small">({TA.nutzen.von(wert.von, tag(wert.at))})</span></> : <span className="empty">{TA.nutzen.offen}</span>}</p>
      </div>
    );
  }
  return (
    <div className="field ab-nutzen">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} rows={3} maxLength={5000} value={text} onChange={e => setText(e.target.value)} />
      {wert ? <span className="hint">{TA.nutzen.von(wert.von, tag(wert.at))}</span> : null}
      <div>
        <button type="button" className="btn sm" disabled={m.isPending || text === (wert?.text ?? '')}
          onClick={() => m.mutate({ etag: etag(), rolle, beurteilung: text }, { onSuccess: () => toast.show(TA.nutzen.gespeichert), onError: e => toast.error(e) })}>
          {TA.nutzen.speichern}
        </button>
      </div>
    </div>
  );
}

/** Lessons Learned des Projekts (PS.04.03; UC-015 Schritt 4, A1.1), auch nach Abschluss erfassbar (UC-013 A1). */
function LessonsAbschnitt({ a, projektId }: { a: Abschluss; projektId: string }) {
  const id = useId();
  const toast = useToast();
  const { anlegen, loeschen } = useLessonMutations(projektId);
  const [text, setText] = useState('');
  const [kategorie, setKategorie] = useState('');
  const [key, setKey] = useState(newIdempotencyKey);
  const erfassen = () => anlegen.mutate({ text: text.trim(), kategorie: kategorie.trim(), key }, {
    onSuccess: () => { setText(''); setKategorie(''); setKey(newIdempotencyKey()); toast.show(TA.lessons.erfasst); },
    onError: e => toast.error(e),
  });
  return (
    <Abschnitt id="ab-h-ll" titel={TA.abschnitte.lessons}>
      {a.lessonsLearned.length ? (
        <ul className="ab-lessons">
          {a.lessonsLearned.map(l => (
            <li key={l.id} className="ab-lesson">
              <div className="minw0">
                {l.kategorie ? <span className="pill">{l.kategorie}</span> : null} <span className="wrap">{l.text}</span>
                <div className="muted small">{TA.lessons.von(l.von, l.jahr)}</div>
              </div>
              {l.can.write ? (
                <button type="button" className="iconbtn" aria-label={TA.lessons.loeschen(l.text)}
                  onClick={() => loeschen.mutate(l, { onSuccess: () => toast.show(TA.lessons.geloescht), onError: e => toast.error(e) })}><Icon name="trash" /></button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : <p className="empty">{TA.lessons.leer}</p>}
      {a.can.lessons ? (
        <form className="ab-lesson-neu" onSubmit={e => { e.preventDefault(); if (text.trim()) erfassen(); }}>
          <div className="field">
            <label htmlFor={`${id}-t`}>{TA.lessons.text}</label>
            <textarea id={`${id}-t`} rows={2} maxLength={5000} value={text} onChange={e => setText(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={`${id}-k`}>{TA.lessons.kategorie}</label>
            <input id={`${id}-k`} className="ab-in" maxLength={100} value={kategorie} onChange={e => setKategorie(e.target.value)} />
          </div>
          <div><button type="submit" className="btn sm" disabled={!text.trim() || anlegen.isPending}><Icon name="plus" />{TA.lessons.erfassen}</button></div>
        </form>
      ) : null}
    </Abschnitt>
  );
}

/** Antrag auf Wiederaufnahme an das Gremium (A-09, K10) mit Begründung und Wirkung. */
function Wiederaufnahme({ projektId }: { projektId: string }) {
  const id = useId();
  const toast = useToast();
  const m = useWiederaufnahme(projektId);
  const [offen, setOffen] = useState(false);
  const [text, setText] = useState('');
  const [fehler, setFehler] = useState(false);
  const [key] = useState(newIdempotencyKey);
  const senden = () => {
    if (!text.trim()) { setFehler(true); return; }
    m.mutate({ begruendung: text.trim(), key }, { onSuccess: () => { setOffen(false); toast.show(TA.wiederaufnahme.gesendet); }, onError: e => toast.error(e) });
  };
  return (
    <>
      <button type="button" className="btn sm" onClick={() => setOffen(true)}><Icon name="reply" />{TA.wiederaufnahme.aktion}</button>
      {offen ? (
        <Dialog title={TA.wiederaufnahme.titel} onClose={() => setOffen(false)} footer={<>
          <button type="button" className="btn" onClick={() => setOffen(false)}>{T.common.cancel}</button>
          <button type="button" className="btn primary" onClick={senden} disabled={m.isPending}>{TA.wiederaufnahme.senden}</button>
        </>}>
          <p>{TA.wiederaufnahme.wirkung}</p>
          <div className="field">
            <label htmlFor={id}>{TA.wiederaufnahme.begruendung}</label>
            <textarea id={id} rows={4} maxLength={2000} value={text} data-autofocus aria-invalid={fehler && !text.trim()} aria-describedby={fehler ? `${id}-f` : undefined}
              onChange={e => setText(e.target.value)} />
            {fehler && !text.trim() ? <span id={`${id}-f`} className="err">{TA.wiederaufnahme.fehlt}</span> : null}
          </div>
        </Dialog>
      ) : null}
    </>
  );
}

/** Bericht als Dokument (PDF, Word) über die Vorlage «Abschlussbericht»; Hinweis auf Personendaten (G12). */
function Dokument({ projektId, nummer }: { projektId: string; nummer: string }) {
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState('');
  const laden = async (format: 'pdf' | 'docx') => {
    setLaeuft(true);
    setMeldung('');
    try {
      const { data, response } = await api.GET('/v1/projekte/{id}/abschluss/dokument', { params: { path: { id: projektId }, query: { format } }, parseAs: 'blob' });
      const name = /filename="([^"]+)"/.exec(response.headers.get('content-disposition') ?? '')?.[1] ?? `Abschlussbericht-${nummer}.${format}`;
      const url = URL.createObjectURL(data as unknown as Blob);
      const el = document.createElement('a');
      el.href = url; el.download = name;
      document.body.append(el); el.click(); el.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setMeldung(TA.dokument.bereit(name));
    } catch (e) {
      const d = describeError(e);
      setMeldung(d.detail || d.title);
    } finally {
      setLaeuft(false);
    }
  };
  return (
    <span className="ab-dok" role="group" aria-label={`${TA.dokument.aktion}. ${TA.dokument.personendaten}`}>
      <Icon name="download" />
      <button type="button" className="btn sm" disabled={laeuft} onClick={() => void laden('pdf')}>{TA.dokument.pdf}</button>
      <button type="button" className="btn sm" disabled={laeuft} onClick={() => void laden('docx')}>{TA.dokument.word}</button>
      <span className="sr" role="status">{meldung}</span>
    </span>
  );
}
