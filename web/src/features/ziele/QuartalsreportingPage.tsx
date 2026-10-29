/**
 * Seite «Quartalsreporting» im Arbeitsraum «Ziele» (UI-41; BC ZM.03.02, PC.04.02; UC-012 Schritte 3–6, A1; UC-006 A4;
 * Kernablauf K6 Schritte 11–14; AP-E6-4): Entwurf aus Zielerreichung, Portfolioberichten und Weiterleitungen mit
 * Kommentaren der UE je Abschnitt, «Im PRAT traktandieren», nach der Verabschiedung «Als Dokument herunterladen» und
 * Rückmeldungen und Aufträge des VR. Zustände: Z1 Laden, Z2 noch nicht erstellt, Z4 Hinweise (unvollständige Zahlen),
 * Z5 Fehler, Z7 Konflikt (412 beim Speichern: ungespeicherte Kommentare bleiben, «Neu laden» übernimmt sie), Z8 nur
 * lesen, Z9 traktandiert/verabschiedet. «Neu erstellen» und «Im PRAT traktandieren» fragen vorher mit der Wirkung (I-R1).
 */
import { describeError, PersonPick } from '@vollholz/iam-web';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { isConflict, statusOf } from '../../api/index.ts';
import { useSession } from '../../auth/index.ts';
import { Dialog, Empty, ErrorState, fmtDatum, fmtPeriode, fmtQuartal, Hinweis, Icon, Skelett, Stand, useToast, useVerzoegert, type StandFamilie } from '../../ui/index.ts';
import {
  dokumentLaden, useQuartalsbericht, useQuartalsberichtMutations, type Abschnitt, type Kommentare, type Quartalsbericht, type QuartalsberichtLoaded,
} from './QuartalsreportingApi.ts';
import { TQR } from './QuartalsreportingTexte.ts';
import { nachbarQuartal, quartalSchluessel, type QuartalNr, type SetZielerreichungQuartal } from './ZielerreichungSearch.ts';
import './Quartalsreporting.css';

export interface QuartalsreportingPageProps {
  jahr: number;
  quartal: QuartalNr;
  setQuartal: SetZielerreichungQuartal;
}

const qLabel = (q: string) => fmtQuartal(Number(q.slice(0, 4)), Number(q.slice(6)) as QuartalNr);
/** Stand des Berichts → Familie der Standanzeige */
const FAMILIE: Record<string, StandFamilie> = { in_arbeit: 'wartet', traktandiert: 'traktandiert', verabschiedet: 'positiv' };

export function QuartalsreportingPage({ jahr, quartal, setQuartal }: QuartalsreportingPageProps) {
  const schluessel = quartalSchluessel(jahr, quartal);
  const titel = fmtQuartal(jahr, quartal);
  const q = useQuartalsbericht(schluessel);
  const m = useQuartalsberichtMutations(schluessel);
  const { can } = useSession();
  const toast = useToast();
  const skelett = useVerzoegert(q.isPending);
  const vor = nachbarQuartal(jahr, quartal, -1);
  const nach = nachbarQuartal(jahr, quartal, 1);
  const fehler = (e: unknown) => {
    if (isConflict(e)) { toast.error(e, TQR.konflikt); void q.refetch(); } else toast.error(e);
  };
  const l = q.data;
  const b = l?.item;

  return (
    <section aria-labelledby="page-title" className="qr">
      <header className="mh">
        <div className="mh-row">
          <div className="mh-title">
            <div className="type-ico neutral"><Icon name="target" /></div>
            <div className="minw0">
              <h1 id="page-title">{TQR.title(titel)}</h1>
              <div className="sub">{b ? <><Stand familie={FAMILIE[b.stand] ?? 'entwurf'} label={TQR.stand[b.stand] ?? b.stand} /> · {TQR.erzeugtAm(fmtDatum(b.erzeugtAt))}</> : TQR.sub}</div>
            </div>
          </div>
          <nav className="acts" aria-label={TQR.quartalWaehlen}>
            <button type="button" className="btn" onClick={() => setQuartal(vor.jahr, vor.quartal)}>
              {TQR.vorher}<span className="sr"> ({fmtQuartal(vor.jahr, vor.quartal)})</span>
            </button>
            <button type="button" className="btn" onClick={() => setQuartal(nach.jahr, nach.quartal)}>
              {TQR.nachher}<span className="sr"> ({fmtQuartal(nach.jahr, nach.quartal)})</span>
            </button>
          </nav>
        </div>
      </header>
      <div className="body qr-body">
        {q.isPending ? (
          <div aria-busy="true"><span className="sr" role="status">{TQR.title(titel)}</span>{skelett ? <Skelett /> : null}</div>
        ) : q.error ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : !b ? (
          <Empty action={can('quartalsbericht:write') ? (
            <button type="button" className="btn primary" aria-busy={m.erzeugen.isPending} disabled={m.erzeugen.isPending}
              onClick={() => m.erzeugen.mutate(undefined, { onError: e => (statusOf(e) === 409 ? toast.error(e, TQR.laeuftNoch) : fehler(e)) })}>{TQR.erstellen}</button>
          ) : undefined}>{can('quartalsbericht:write') ? TQR.leer(titel) : TQR.leerNurLesen(titel)}</Empty>
        ) : (
          <Bericht key={b.quartal} l={l!} busy={m.kommentare.isPending || m.erzeugen.isPending || m.traktandieren.isPending}
            neuLaden={() => void q.refetch()}
            erzeugen={fertig => m.erzeugen.mutate(undefined, { onSuccess: () => { fertig(); toast.show(TQR.neuErstellt); }, onError: e => { fertig(); fehler(e); } })}
            speichern={(kommentare, r) => m.kommentare.mutate({ etag: l!.etag, kommentare }, {
              // Automatisch gespeichert (I-R3) meldet die Statuszeile, von Hand gespeichert zusätzlich der Toast
              onSuccess: () => { r.ok(); if (r.manuell) toast.show(TQR.gespeichert); },
              // Z7: Kommentare nicht verwerfen; der Bericht zeigt den Konflikt und lädt erst auf Wunsch neu
              onError: e => (isConflict(e) ? r.konflikt() : toast.error(e)),
            })}
            traktandieren={fertig => m.traktandieren.mutate({ etag: l!.etag }, { onSuccess: () => { fertig(); toast.show(TQR.traktandiert); }, onError: e => { fertig(); fehler(e); } })}
            vrSpeichern={t => m.vrRueckmeldung.mutate({ etag: l!.etag, vrRueckmeldung: t }, { onSuccess: () => toast.show(TQR.gespeichert), onError: fehler })}
            auftragErfassen={(a, ok) => m.auftrag.mutate(a, { onSuccess: () => { ok(); toast.show(TQR.auftragErfasst); }, onError: fehler })} />
        )}
      </div>
    </section>
  );
}

/** Pause nach der letzten Eingabe, bevor die Kommentare automatisch gespeichert werden (I-R3). */
const PAUSE_MS = 3000;

const ABSCHNITTE_KOMMENTAR: readonly Abschnitt[] = ['gesamtstatus', 'entwicklungen', 'risiken', 'abhaengigkeiten', 'auswirkungen', 'weiterleitungen'];

function Bericht({ l, busy, neuLaden, erzeugen, speichern, traktandieren, vrSpeichern, auftragErfassen }: {
  l: QuartalsberichtLoaded; busy: boolean; neuLaden(): void; erzeugen(fertig: () => void): void;
  speichern(k: Partial<Kommentare>, r: { manuell: boolean; ok(): void; konflikt(): void }): void; traktandieren(fertig: () => void): void;
  vrSpeichern(t: string): void; auftragErfassen(a: { text: string; verantwortlich: string; termin: string | null }, ok: () => void): void;
}) {
  const b = l.item;
  // Nur die eigenen, noch nicht gespeicherten Änderungen: sie überstehen Neu laden und Neu erstellen (Z7)
  const [entwurf, setEntwurf] = useState<Partial<Kommentare>>({});
  const [konflikt, setKonflikt] = useState(false);
  const [frage, setFrage] = useState<'neu' | 'traktandieren' | null>(null);
  const offen = ABSCHNITTE_KOMMENTAR.filter(a => entwurf[a] !== undefined && entwurf[a] !== b.kommentare[a]);
  const geaendert = offen.length > 0;
  const wert = (a: Abschnitt) => entwurf[a] ?? b.kommentare[a];
  const i = b.inhalt;
  const pf = i.portfolios;
  const kommentar = (a: Abschnitt) => (
    <KommentarFeld abschnitt={a} wert={wert(a)} darf={b.can.bearbeiten} onChange={v => setEntwurf(k => ({ ...k, [a]: v }))} />
  );
  const [gespeichertAt, setGespeichertAt] = useState<number | null>(null);
  const [jetzt, setJetzt] = useState(() => Date.now());
  const sichern = (manuell: boolean) => {
    const gesendet: Partial<Kommentare> = Object.fromEntries(offen.map(a => [a, wert(a)]));
    speichern(gesendet, {
      manuell,
      // Nur verwerfen, was gesendet wurde: was während des Speicherns getippt wurde, bleibt offen
      ok: () => {
        setEntwurf(e => Object.fromEntries(Object.entries(e).filter(([a, v]) => v !== gesendet[a as Abschnitt])));
        setKonflikt(false);
        setGespeichertAt(Date.now());
        setJetzt(Date.now());
      },
      konflikt: () => setKonflikt(true),
    });
  };
  // Automatisch speichern nach einer Pause (I-R3); nicht im Konflikt, dort entscheidet die Person (Z7)
  useEffect(() => {
    if (!geaendert || konflikt || busy) return;
    const t = setTimeout(() => sichern(false), PAUSE_MS);
    return () => clearTimeout(t);
  }, [entwurf, geaendert, konflikt, busy]); // eslint-disable-line react-hooks/exhaustive-deps -- sichern liest den Stand dieser Darstellung
  // Eingaben gehen nicht verloren (I-F7): beim Verlassen nachfragen, solange etwas offen ist
  useEffect(() => {
    if (!geaendert) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [geaendert]);
  // «Gespeichert vor 5 s»: Anzeige alle 5 Sekunden nachführen
  useEffect(() => {
    if (!gespeichertAt) return;
    const t = setInterval(() => setJetzt(Date.now()), 5000);
    return () => clearInterval(t);
  }, [gespeichertAt]);
  const statusText = busy && geaendert ? TQR.speichert : geaendert ? TQR.ungespeichert
    : gespeichertAt ? TQR.gespeichertVor(Math.max(0, Math.round((jetzt - gespeichertAt) / 1000))) : '';
  return (
    <>
      {konflikt ? (
        <Hinweis stufe="warnung" live aktion={<button type="button" className="btn sm" onClick={() => { setKonflikt(false); neuLaden(); }}>{TQR.konfliktNeuLaden}</button>}>
          {TQR.konfliktKommentare(offen.length)}
        </Hinweis>
      ) : null}
      {b.stand === 'traktandiert' && b.traktandiertAt ? <Hinweis stufe="hinweis">{TQR.bannerTraktandiert(fmtDatum(b.traktandiertAt))}</Hinweis> : null}
      {b.stand === 'verabschiedet' && b.verabschiedetAt ? <Hinweis stufe="hinweis">{TQR.bannerVerabschiedet(fmtDatum(b.verabschiedetAt))}</Hinweis> : null}
      {b.stand === 'in_arbeit' && b.rueckmeldungPrat ? <Hinweis stufe="warnung">{TQR.rueckmeldungPrat(b.rueckmeldungPrat)}</Hinweis> : null}
      {!b.can.bearbeiten && b.stand === 'in_arbeit' ? <Hinweis stufe="hinweis">{TQR.nurLesen}</Hinweis> : null}
      {i.hinweise.length ? (
        <Hinweis stufe="warnung">
          <strong>{TQR.hinweise}</strong>
          <ul className="qr-hinweise">{i.hinweise.map(h => <li key={h}>{h}</li>)}</ul>
        </Hinweis>
      ) : null}

      {b.can.bearbeiten ? (
        <div className="qr-acts">
          <div>
            <button type="button" className="btn" onClick={() => setFrage('neu')}>{TQR.neuErstellen}</button>
            <p className="hint">{TQR.neuWirkung}</p>
          </div>
          <div>
            <button type="button" className="btn primary" onClick={() => setFrage('traktandieren')} disabled={geaendert}>{TQR.traktandieren}</button>
            <p className="hint">{TQR.traktandierenWirkung}</p>
          </div>
        </div>
      ) : null}
      <Dokument quartal={b.quartal} />
      {frage === 'neu' ? (
        <Dialog title={TQR.neuFrage(qLabel(b.quartal))} onClose={() => setFrage(null)} footer={<>
          <button type="button" className="btn" onClick={() => setFrage(null)} data-autofocus>{TQR.abbrechen}</button>
          <button type="button" className="btn primary" disabled={busy} onClick={() => erzeugen(() => setFrage(null))}>{TQR.neuErstellen}</button>
        </>}>
          <p>{TQR.neuErsetzt(fmtDatum(b.erzeugtAt))}</p>
          <p>{geaendert ? TQR.neuKommentareUngespeichert(offen.length) : TQR.neuKommentareBleiben}</p>
        </Dialog>
      ) : null}
      {frage === 'traktandieren' ? (
        <Dialog title={TQR.traktandierenFrage(qLabel(b.quartal))} onClose={() => setFrage(null)} footer={<>
          <button type="button" className="btn" onClick={() => setFrage(null)} data-autofocus>{TQR.abbrechen}</button>
          <button type="button" className="btn primary" disabled={busy} onClick={() => traktandieren(() => setFrage(null))}>{TQR.traktandieren}</button>
        </>}>
          <p>{TQR.traktandierenWirkung}</p>
          <p>{TQR.kommentiert(ABSCHNITTE_KOMMENTAR.filter(a => b.kommentare[a].trim()).length, ABSCHNITTE_KOMMENTAR.length)}</p>
          {i.hinweise.length ? <Hinweis stufe="warnung">{TQR.traktandierenHinweise(i.hinweise.length)}</Hinweis> : null}
        </Dialog>
      ) : null}

      <Teil id="gesamtstatus">
        {kommentar('gesamtstatus')}
        <Tabelle caption={TQR.abschnitte.gesamtstatus!} kopf={[TQR.portfolio, TQR.periode, TQR.projekte, TQR.imPlan, TQR.kritisch, TQR.nichtGemeldet, TQR.bericht]}
          zeilen={pf.map(p => [p.name, fmtPeriode(p.periode), String(p.projekte), String(p.imPlan), String(p.kritisch), String(p.nichtGemeldet),
            p.berichtId ? (p.bereitgestellt ? TQR.bereitgestellt : TQR.entwurf) : TQR.fehlt])} leer={TQR.fehlt} />
        <h3>{TQR.kritischeProjekte}</h3>
        <Tabelle caption={TQR.kritischeProjekte} kopf={[TQR.projekt, TQR.portfolio, TQR.phase, TQR.trend]} leer={TQR.keineKritischen}
          zeilen={pf.flatMap(p => p.kritischeProjekte.map(c => [`${c.nummer} ${c.name}`, p.name, c.phase, c.trend ?? '–']))} />
        <h3>{TQR.meilensteine}</h3>
        <Tabelle caption={TQR.meilensteine} kopf={[TQR.projekt, TQR.meilenstein, TQR.termin]} leer={TQR.keineMeilensteine}
          zeilen={pf.flatMap(p => p.meilensteine).slice(0, 30).map(x => [`${x.projekt.nummer} ${x.projekt.name}`, x.text, x.termin ? fmtDatum(x.termin) : '–'])} />
      </Teil>

      <Teil id="zielerreichung">
        <p>{TQR.nachgefuehrt(i.zielerreichung.nachgefuehrt, i.zielerreichung.gesamt)}</p>
        <Tabelle caption={TQR.abschnitte.zielerreichung!} kopf={[TQR.nummer, TQR.ziel, TQR.metrik, TQR.zielwert, TQR.standZiel, TQR.beurteilung]} leer={TQR.keineZiele}
          zeilen={i.zielerreichung.ziele.map(z => [z.nummer, z.text, z.metrik || '–', z.zielwert || '–',
            z.stand ? `${z.stand}${z.quartal && z.quartal !== b.quartal ? ` ${TQR.ausQuartal(qLabel(z.quartal))}` : ''}` : '–', z.beurteilung || '–'])} />
      </Teil>

      <Teil id="entwicklungen">{kommentar('entwicklungen')}</Teil>

      <Teil id="risiken">
        {kommentar('risiken')}
        <Tabelle caption={TQR.abschnitte.risiken!} kopf={[TQR.ebene, TQR.risiko, TQR.wahrscheinlichkeit, TQR.auswirkung, TQR.massnahme]} leer={TQR.keineRisiken}
          zeilen={pf.flatMap(p => p.risiken.map(r => [r.projekt ? `${r.projekt.nummer} ${r.projekt.name}` : p.name, r.text, r.wahrscheinlichkeit, r.auswirkung, r.massnahme || '–']))} />
      </Teil>

      <Teil id="abhaengigkeiten">
        {kommentar('abhaengigkeiten')}
        <Tabelle caption={TQR.abschnitte.abhaengigkeiten!} kopf={[TQR.projekt, TQR.haengtAb, TQR.beschreibung]} leer={TQR.keineAbhaengigkeiten}
          zeilen={pf.flatMap(p => p.abhaengigkeiten.map(a => [`${a.von.nummer} ${a.von.name}`, `${a.zu.nummer} ${a.zu.name}`, a.text]))} />
        <Tabelle caption={TQR.eskalation} kopf={[TQR.eskalation, TQR.periode, TQR.grund, TQR.massnahme]} leer={TQR.keineEskalationen}
          zeilen={pf.flatMap(p => p.eskalationen.map(e => [`${e.projekt.nummer} ${e.projekt.name}`, fmtPeriode(e.periode), e.grund, e.massnahme || '–']))} />
      </Teil>

      <Teil id="auswirkungen">{kommentar('auswirkungen')}</Teil>

      <Teil id="weiterleitungen">
        {kommentar('weiterleitungen')}
        <Tabelle caption={TQR.abschnitte.weiterleitungen!} kopf={[TQR.datum, TQR.gremium, TQR.geschaeft, TQR.entscheid, TQR.begruendung]} leer={TQR.keineWeiterleitungen}
          zeilen={i.weiterleitungen.map(w => [fmtDatum(w.datum), w.gremium, w.ausserordentlichAm ? `${w.titel} (${TQR.bereitsWeitergeleitet(fmtDatum(w.ausserordentlichAm))})` : w.titel, w.ergebnis, w.begruendung])} />
      </Teil>

      {b.can.bearbeiten ? (
        <div className="qr-speichern">
          <span className="muted small" role="status">{statusText}</span>
          <button type="button" className="btn primary" aria-busy={busy} disabled={busy || !geaendert} onClick={() => sichern(true)}>{TQR.kommentareSpeichern}</button>
        </div>
      ) : null}

      {b.stand === 'verabschiedet' ? <Vr key={l.etag} b={b} vrSpeichern={vrSpeichern} auftragErfassen={auftragErfassen} /> : null}
    </>
  );
}

function Teil({ id, children }: { id: string; children: ReactNode }) {
  const hid = `qr-${id}`;
  return (
    <section aria-labelledby={hid} className="qr-abschnitt">
      <h2 id={hid}>{TQR.abschnitte[id]}</h2>
      {children}
    </section>
  );
}

function KommentarFeld({ abschnitt, wert, darf, onChange }: { abschnitt: Abschnitt; wert: string; darf: boolean; onChange(v: string): void }) {
  const id = useId();
  if (!darf) return wert ? <p className="qr-kommentar">{wert}</p> : null;
  return (
    <div className="field">
      <label htmlFor={id}>{TQR.kommentarVon(TQR.abschnitte[abschnitt]!.replace(/^\d+ /, ''))}</label>
      <textarea id={id} rows={3} maxLength={4000} value={wert} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function Tabelle({ caption, kopf, zeilen, leer }: { caption: string; kopf: string[]; zeilen: string[][]; leer: string }) {
  if (!zeilen.length) return <p className="muted">{leer}</p>;
  return (
    <div className="qr-tab">
      <table>
        <caption className="sr">{caption}</caption>
        <thead><tr>{kopf.map(k => <th key={k} scope="col"><span className="th">{k}</span></th>)}</tr></thead>
        <tbody>{zeilen.map((z, n) => <tr key={n}>{z.map((c, k) => <td key={k}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function speichernDatei(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function Dokument({ quartal }: { quartal: string }) {
  const id = useId();
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);
  const laden = async (format: 'pdf' | 'docx') => {
    setLaeuft(true);
    setMeldung(null);
    try {
      const d = await dokumentLaden(quartal, format);
      speichernDatei(d.blob, d.name);
      setMeldung({ ok: true, text: TQR.dokumentBereit(d.name) });
    } catch (e) {
      const f = describeError(e);
      setMeldung({ ok: false, text: f.detail || f.title });
    } finally {
      setLaeuft(false);
    }
  };
  return (
    <div className="qr-dokument" role="group" aria-labelledby={`${id}-t`} aria-describedby={`${id}-h`}>
      <span id={`${id}-t`}><Icon name="download" /> {TQR.dokument}</span>
      <button type="button" className="btn sm" disabled={laeuft} onClick={() => void laden('pdf')}>{TQR.pdf}</button>
      <button type="button" className="btn sm" disabled={laeuft} onClick={() => void laden('docx')}>{TQR.word}</button>
      <p id={`${id}-h`} className="muted small">{TQR.personendaten}</p>
      <div role="status" aria-live="polite" className="small">{laeuft ? TQR.wirdErstellt : meldung?.ok ? meldung.text : null}</div>
      {meldung && !meldung.ok ? <Hinweis stufe="sperre" live>{meldung.text}</Hinweis> : null}
    </div>
  );
}

function Vr({ b, vrSpeichern, auftragErfassen }: {
  b: Quartalsbericht; vrSpeichern(t: string): void; auftragErfassen(a: { text: string; verantwortlich: string; termin: string | null }, ok: () => void): void;
}) {
  const id = useId();
  const [text, setText] = useState(b.vrRueckmeldung);
  const [auftrag, setAuftrag] = useState('');
  const [person, setPerson] = useState('');
  const [termin, setTermin] = useState('');
  const [fehlt, setFehlt] = useState<{ text: boolean; person: boolean }>({ text: false, person: false });
  const darf = b.can.rueckmeldung;
  return (
    <section aria-labelledby={`${id}-vr`} className="qr-abschnitt">
      <h2 id={`${id}-vr`}>{TQR.vr}</h2>
      {darf ? (
        <form className="form" onSubmit={e => { e.preventDefault(); vrSpeichern(text); }}>
          <div className="field">
            <label htmlFor={`${id}-r`}>{TQR.vrRueckmeldung}</label>
            <textarea id={`${id}-r`} rows={3} maxLength={8000} value={text} onChange={e => setText(e.target.value)} />
          </div>
          <div className="acts"><button type="submit" className="btn">{TQR.vrSpeichern}</button></div>
        </form>
      ) : b.vrRueckmeldung ? <p className="qr-kommentar">{b.vrRueckmeldung}</p> : null}
      <h3>{TQR.auftraege}</h3>
      {b.auftraege.length ? (
        <ul className="qr-auftraege">
          {b.auftraege.map(a => <li key={a.id}>{a.text}{a.termin ? ` · ${fmtDatum(a.termin)}` : ''} · {a.erledigtAt ? TQR.erledigt(fmtDatum(a.erledigtAt)) : TQR.offen}</li>)}
        </ul>
      ) : <p className="muted">{TQR.keineAuftraege}</p>}
      {darf ? (
        <form className="form" onSubmit={e => {
          e.preventDefault();
          const f = { text: !auftrag.trim(), person: !person };
          setFehlt(f);
          if (f.text || f.person) return;
          auftragErfassen({ text: auftrag.trim(), verantwortlich: person, termin: termin || null }, () => { setAuftrag(''); setPerson(''); setTermin(''); });
        }}>
          <div className="field">
            <label htmlFor={`${id}-a`}>{TQR.auftrag}</label>
            <textarea id={`${id}-a`} rows={2} maxLength={2000} value={auftrag} onChange={e => { setAuftrag(e.target.value); setFehlt(x => ({ ...x, text: false })); }}
              aria-invalid={fehlt.text || undefined} aria-describedby={fehlt.text ? `${id}-ae` : undefined} />
            {fehlt.text ? <p id={`${id}-ae`} className="ferr" role="alert">{TQR.auftragFehlt}</p> : null}
          </div>
          <div className="field">
            <label htmlFor={`${id}-p`}>{TQR.verantwortlich}</label>
            <PersonPick id={`${id}-p`} value={person} onChange={v => { setPerson(v); setFehlt(x => ({ ...x, person: false })); }} />
            {fehlt.person ? <p className="ferr" role="alert">{TQR.verantwortlichFehlt}</p> : null}
          </div>
          <div className="field">
            <label htmlFor={`${id}-t`}>{TQR.terminOptional}</label>
            <input id={`${id}-t`} type="date" value={termin} onChange={e => setTermin(e.target.value)} />
          </div>
          <p className="hint">{TQR.auftragWirkung}</p>
          <div className="acts"><button type="submit" className="btn">{TQR.auftragHinzufuegen}</button></div>
        </form>
      ) : null}
    </section>
  );
}
