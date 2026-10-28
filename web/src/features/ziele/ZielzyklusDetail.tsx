/**
 * Seitenpanel des Zielzyklus (UI-38, K6 Schritte 2–5): gewähltes strategisches Ziel mit seinen Jahreszielen,
 * «Jahresziel hinzufügen», Projekten und «Projektidee anstossen»; gewähltes Jahresziel mit Text, Metrik und Zielwert
 * (automatisch gespeichert beim Verlassen des Feldes, I-R3), Hauptaktivitäten mit Verantwortlichen und Projekten
 * (PP.02.05). Bearbeiten nur mit `can` aus der Antwort; ab «zur Freigabe» gesperrt (K6 Z9).
 */
import { describeError, PersonName, PersonPick } from '@vollholz/iam-web';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { isConflict, newIdempotencyKey, statusOf } from '../../api/index.ts';
import { Confirm, Hinweis, Icon, PhaseKurz, useToast, type Phase } from '../../ui/index.ts';
import { useProjektSuche, useZielzyklusMutations, type JahreszielKnoten, type StrategischerKnoten, type ZielProjekt, type Zielzyklus } from './ZielzyklusApi.ts';
import { TZZ } from './ZielzyklusTexte.ts';

interface Gemeinsam {
  zyklus: Zielzyklus;
  onWaehlen(nummer: string): void;
  onProjekt(nummer: string): void;
}

// ---------------------------------------------------------------- Strategisches Ziel

export function StrategischDetail({ ziel, zyklus, onWaehlen, onProjekt, ideeAnstossen }: Gemeinsam & {
  ziel: StrategischerKnoten;
  /** Adresse des Assistenten «Projektidee» mit vorausgefülltem Strategiebezug (K4); fehlt, solange es ihn nicht gibt. */
  ideeAnstossen?: (zielNummer: string) => void;
}) {
  const write = zyklus.can.write;
  return (
    <article className="zz-detail" aria-labelledby="zz-detail-h">
      <div className="zz-eb">{TZZ.ebene.strategisch}</div>
      <h2 id="zz-detail-h">{ziel.nummer} {ziel.text}</h2>
      <dl className="attrs">
        <dt>{TZZ.metrik}</dt><dd className="wrap">{ziel.metrik || <span className="empty">{TZZ.metrikFehlt}</span>}</dd>
        <dt>{TZZ.zielwert}</dt><dd className="wrap">{ziel.zielwert || <span className="empty">–</span>}</dd>
      </dl>
      <section className="grp" aria-labelledby="zz-jz-h">
        <h3 id="zz-jz-h" className="grp-h"><Icon name="calendar" /> {TZZ.ebene.jahresziel}</h3>
        {ziel.jahresziele.length ? (
          <ul className="zz-liste">
            {ziel.jahresziele.map(j => (
              <li key={j.id}>
                <button type="button" className="linkbtn" onClick={() => onWaehlen(j.nummer)}>{j.nummer} {j.text}</button>
                {!j.metrik || !j.zielwert ? <span className="zz-m"><Icon name="warn" />{TZZ.metrikFehlt}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
        {write ? <JahreszielNeu ziel={ziel} jahr={zyklus.jahr} onAngelegt={onWaehlen} /> : null}
      </section>
      <Projekte projekte={ziel.projekte} zyklus={zyklus} ziel={{ strategischesZielId: ziel.id }} onProjekt={onProjekt} />
      {ideeAnstossen && zyklus.can.zuordnen ? (
        <div className="acts"><button type="button" className="btn" onClick={() => ideeAnstossen(ziel.nummer)}><Icon name="plus" />{TZZ.projektideeAnstossen}</button></div>
      ) : null}
    </article>
  );
}

function JahreszielNeu({ ziel, jahr, onAngelegt }: { ziel: StrategischerKnoten; jahr: number; onAngelegt(nummer: string): void }) {
  const id = useId();
  const toast = useToast();
  const m = useZielzyklusMutations(jahr);
  const [offen, setOffen] = useState(false);
  const [key, setKey] = useState(newIdempotencyKey);
  const [v, setV] = useState({ text: '', metrik: '', zielwert: '' });
  const [fehler, setFehler] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (offen) textRef.current?.focus(); }, [offen]);
  if (!offen) return <div className="acts"><button type="button" className="btn" onClick={() => setOffen(true)}><Icon name="plus" />{TZZ.jahreszielHinzufuegen}</button></div>;
  const absenden = (e: FormEvent) => {
    e.preventDefault();
    if (!v.text.trim()) { setFehler(TZZ.textMissing); textRef.current?.focus(); return; }
    m.jahreszielAnlegen.mutate({ key, body: { strategischesZielId: ziel.id, text: v.text, metrik: v.metrik, zielwert: v.zielwert } }, {
      onSuccess: j => {
        toast.show(TZZ.jahreszielAngelegt(j.nummer));
        setV({ text: '', metrik: '', zielwert: '' }); setKey(newIdempotencyKey()); setOffen(false); onAngelegt(j.nummer);
      },
    });
  };
  return (
    <form className="form zz-form" onSubmit={absenden} aria-label={TZZ.jahreszielHinzufuegen} noValidate>
      {m.jahreszielAnlegen.error ? <Hinweis stufe="sperre" live>{describeError(m.jahreszielAnlegen.error).detail || describeError(m.jahreszielAnlegen.error).title}</Hinweis> : null}
      <div className="field">
        <label htmlFor={`${id}-t`}>{TZZ.text}</label>
        <textarea id={`${id}-t`} ref={textRef} rows={2} maxLength={1000} value={v.text} aria-invalid={!!fehler} aria-describedby={fehler ? `${id}-te` : undefined}
          onChange={e => { setV({ ...v, text: e.target.value }); setFehler(null); }} />
        {fehler ? <div id={`${id}-te`} className="ferr">{fehler}</div> : null}
      </div>
      <div className="field">
        <label htmlFor={`${id}-m`}>{TZZ.metrik}</label>
        <input id={`${id}-m`} maxLength={500} value={v.metrik} aria-describedby={`${id}-mh`} onChange={e => setV({ ...v, metrik: e.target.value })} />
        <div id={`${id}-mh`} className="note">{TZZ.metrikHint}</div>
      </div>
      <div className="field">
        <label htmlFor={`${id}-z`}>{TZZ.zielwert}</label>
        <input id={`${id}-z`} maxLength={200} value={v.zielwert} onChange={e => setV({ ...v, zielwert: e.target.value })} />
      </div>
      <div className="acts">
        <button type="button" className="btn" onClick={() => setOffen(false)}>{TZZ.abbrechen}</button>
        <button type="submit" className="btn primary" disabled={m.jahreszielAnlegen.isPending}>{TZZ.jahreszielHinzufuegen}</button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- Jahresziel

export function JahreszielDetail({ jz, ziel, zyklus, onWaehlen, onProjekt, onNeuLaden }: Gemeinsam & {
  jz: JahreszielKnoten; ziel: StrategischerKnoten; onNeuLaden(): void;
}) {
  const write = zyklus.can.write;
  const toast = useToast();
  const m = useZielzyklusMutations(zyklus.jahr);
  const [loeschen, setLoeschen] = useState(false);
  return (
    <article className="zz-detail" aria-labelledby="zz-detail-h">
      <div className="zz-eb">
        {TZZ.ebene.jahresziel} · <button type="button" className="linkbtn" onClick={() => onWaehlen(ziel.nummer)}>{ziel.nummer} {ziel.text}</button>
      </div>
      <h2 id="zz-detail-h">{jz.nummer} {jz.text}</h2>
      {!jz.metrik || !jz.zielwert ? <Hinweis stufe="warnung">{TZZ.ohneMetrik(1, [jz.nummer])}</Hinweis> : null}
      {write
        ? <JahreszielFelder key={jz.id} jz={jz} jahr={zyklus.jahr} onNeuLaden={onNeuLaden} />
        : (
          <dl className="attrs">
            <dt>{TZZ.text}</dt><dd className="wrap">{jz.text}</dd>
            <dt>{TZZ.metrik}</dt><dd className="wrap">{jz.metrik || <span className="empty">{TZZ.metrikFehlt}</span>}</dd>
            <dt>{TZZ.zielwert}</dt><dd className="wrap">{jz.zielwert || <span className="empty">–</span>}</dd>
          </dl>
        )}
      <Hauptaktivitaeten jz={jz} jahr={zyklus.jahr} write={write} />
      <Projekte projekte={jz.projekte} zyklus={zyklus} ziel={{ jahreszielId: jz.id }} onProjekt={onProjekt} />
      {write ? (
        <div className="acts">
          <button type="button" className="btn danger" onClick={() => setLoeschen(true)}><Icon name="trash" />{TZZ.jahreszielLoeschen}</button>
        </div>
      ) : null}
      {loeschen ? (
        <Confirm title={TZZ.jahreszielLoeschen} text={TZZ.confirmJahresziel(jz.nummer)} confirm={TZZ.jahreszielLoeschen} busy={m.jahreszielLoeschen.isPending}
          onClose={() => setLoeschen(false)}
          onConfirm={() => void m.jahreszielLoeschen.mutateAsync({ id: jz.id, version: jz.version }).then(
            () => { toast.show(TZZ.jahreszielGeloescht(jz.nummer)); onWaehlen(ziel.nummer); },
            (e: unknown) => { setLoeschen(false); toast.error(e, isConflict(e) ? TZZ.konflikt : undefined); },
          )} />
      ) : null}
    </article>
  );
}

type Feld = 'text' | 'metrik' | 'zielwert';

/** Felder des Jahresziels mit automatischem Speichern beim Verlassen (I-R3); 412: Hinweis, Eingabe bleibt (Z7). */
function JahreszielFelder({ jz, jahr, onNeuLaden }: { jz: JahreszielKnoten; jahr: number; onNeuLaden(): void }) {
  const id = useId();
  const m = useZielzyklusMutations(jahr);
  const [v, setV] = useState<Record<Feld, string>>({ text: jz.text, metrik: jz.metrik, zielwert: jz.zielwert });
  const gespeichert = useRef<Record<Feld, string>>({ text: jz.text, metrik: jz.metrik, zielwert: jz.zielwert });
  // Version aus der letzten Antwort, damit zwei Felder nacheinander ohne 412 speichern (der Baum lädt nach)
  const version = useRef(jz.version);
  useEffect(() => { version.current = Math.max(version.current, jz.version); }, [jz.version]);
  const [fehler, setFehler] = useState<Partial<Record<Feld, string>>>({});
  // Speichern nacheinander: Verlässt man zwei Felder rasch hintereinander, wartet das zweite auf die Antwort des ersten
  // und nimmt dessen Version (sonst 412)
  const kette = useRef<Promise<unknown>>(Promise.resolve());
  const speichern = (f: Feld) => {
    const wert = v[f].trim();
    if (f === 'text' && !wert) { setFehler({ ...fehler, text: TZZ.textMissing }); return; }
    kette.current = kette.current.then(async () => {
      if (wert === gespeichert.current[f]) return;
      const r = await m.jahreszielAendern.mutateAsync({ id: jz.id, version: version.current, body: { [f]: wert } });
      version.current = r.version;
      gespeichert.current = { ...gespeichert.current, [f]: wert };
      setFehler({});
    }).catch(() => undefined);   // Fehler zeigt der Zustand der Mutation (412: Hinweis, Eingabe bleibt)
  };
  const konflikt = isConflict(m.jahreszielAendern.error);
  const anderer = m.jahreszielAendern.error && !konflikt ? describeError(m.jahreszielAendern.error) : null;
  const feld = (f: Feld, label: string, hint?: string) => (
    <div className="field">
      <label htmlFor={`${id}-${f}`}>{label}</label>
      {f === 'text'
        ? <textarea id={`${id}-${f}`} rows={2} maxLength={1000} value={v[f]} aria-invalid={!!fehler[f]} aria-describedby={fehler[f] ? `${id}-${f}-e` : undefined}
          onChange={e => setV({ ...v, [f]: e.target.value })} onBlur={() => speichern(f)} />
        : <input id={`${id}-${f}`} maxLength={f === 'metrik' ? 500 : 200} value={v[f]} aria-describedby={hint ? `${id}-${f}-h` : undefined}
          onChange={e => setV({ ...v, [f]: e.target.value })} onBlur={() => speichern(f)} />}
      {hint ? <div id={`${id}-${f}-h`} className="note">{hint}</div> : null}
      {fehler[f] ? <div id={`${id}-${f}-e`} className="ferr">{fehler[f]}</div> : null}
    </div>
  );
  return (
    <div className="form zz-form">
      {konflikt ? (
        <div className="notice" role="alert">
          <p>{TZZ.konflikt}</p>
          <button type="button" className="btn" onClick={() => { m.jahreszielAendern.reset(); onNeuLaden(); }}>{TZZ.neuLaden}</button>
        </div>
      ) : anderer ? <Hinweis stufe="sperre" live>{anderer.detail || anderer.title}</Hinweis> : null}
      {feld('text', TZZ.text)}
      {feld('metrik', TZZ.metrik, TZZ.metrikHint)}
      {feld('zielwert', TZZ.zielwert, TZZ.zielwertHint)}
      <div className="note" role="status" aria-live="polite">{m.jahreszielAendern.isPending ? TZZ.speichert : m.jahreszielAendern.isSuccess ? TZZ.gespeichert : ''}</div>
    </div>
  );
}

function Hauptaktivitaeten({ jz, jahr, write }: { jz: JahreszielKnoten; jahr: number; write: boolean }) {
  const id = useId();
  const toast = useToast();
  const m = useZielzyklusMutations(jahr);
  const [text, setText] = useState('');
  const [person, setPerson] = useState('');
  const [key, setKey] = useState(newIdempotencyKey);
  const [fehler, setFehler] = useState<string | null>(null);
  const absenden = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) { setFehler(TZZ.textMissing); return; }
    m.hauptaktivitaetAnlegen.mutate({ key, body: { jahreszielId: jz.id, text, verantwortlich: person || null } }, {
      onSuccess: () => { setText(''); setPerson(''); setKey(newIdempotencyKey()); setFehler(null); },
    });
  };
  return (
    <section className="grp" aria-labelledby={`${id}-h`}>
      <h3 id={`${id}-h`} className="grp-h"><Icon name="check" /> {TZZ.hauptaktivitaeten}</h3>
      {jz.hauptaktivitaeten.length ? (
        <ul className="zz-liste">
          {jz.hauptaktivitaeten.map(h => (
            <li key={h.id}>
              <span className="grow">{h.text}</span>
              <span className="muted small">{TZZ.verantwortlich}: {h.verantwortlich ? <PersonName id={h.verantwortlich.id} /> : TZZ.ohneVerantwortlich}</span>
              {write ? (
                <button type="button" className="iconbtn" aria-label={TZZ.hauptaktivitaetEntfernen(h.text)}
                  onClick={() => m.hauptaktivitaetLoeschen.mutate({ id: h.id, version: h.version }, {
                    // umkehrbar (I-R1 Stufe 1): «Rückgängig» legt sie mit Text, Verantwortlich und Stelle wieder an
                    onSuccess: () => toast.show(TZZ.hauptaktivitaetEntfernt, {
                      action: {
                        label: TZZ.rueckgaengig,
                        run: () => m.hauptaktivitaetAnlegen.mutate({ key: newIdempotencyKey(), body: { jahreszielId: jz.id, text: h.text, verantwortlich: h.verantwortlich?.id ?? null, position: h.position } }, { onError: e => toast.error(e) }),
                      },
                    }),
                    onError: e => toast.error(e),
                  })}>
                  <Icon name="trash" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : <p className="note">{TZZ.keineHauptaktivitaet}</p>}
      {write ? (
        <form className="form zz-form" onSubmit={absenden} aria-label={TZZ.hauptaktivitaetHinzufuegen} noValidate>
          {m.hauptaktivitaetAnlegen.error ? <Hinweis stufe="sperre" live>{describeError(m.hauptaktivitaetAnlegen.error).detail || describeError(m.hauptaktivitaetAnlegen.error).title}</Hinweis> : null}
          <div className="field">
            <label htmlFor={`${id}-t`}>{TZZ.hauptaktivitaet}</label>
            <input id={`${id}-t`} maxLength={1000} value={text} aria-invalid={!!fehler} aria-describedby={fehler ? `${id}-te` : undefined}
              onChange={e => { setText(e.target.value); setFehler(null); }} />
            {fehler ? <div id={`${id}-te`} className="ferr">{fehler}</div> : null}
          </div>
          <div className="field">
            <label htmlFor={`${id}-p`}>{TZZ.verantwortlich} <span className="muted">(optional)</span></label>
            <PersonPick id={`${id}-p`} value={person} onChange={setPerson} />
          </div>
          <div className="acts"><button type="submit" className="btn" disabled={m.hauptaktivitaetAnlegen.isPending}><Icon name="plus" />{TZZ.hauptaktivitaetHinzufuegen}</button></div>
        </form>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------- Projekte (PP.02.05)

function Projekte({ projekte, zyklus, ziel, onProjekt }: {
  projekte: ZielProjekt[]; zyklus: Zielzyklus; ziel: { strategischesZielId: string } | { jahreszielId: string }; onProjekt(nummer: string): void;
}) {
  const id = useId();
  const toast = useToast();
  const m = useZielzyklusMutations(zyklus.jahr);
  const darf = zyklus.can.zuordnen;
  return (
    <section className="grp" aria-labelledby={`${id}-h`}>
      <h3 id={`${id}-h`} className="grp-h"><Icon name="folder" /> {TZZ.projekte}</h3>
      {projekte.length ? (
        <ul className="zz-liste">
          {projekte.map(p => (
            <li key={p.zuordnungId}>
              <button type="button" className="linkbtn grow" aria-label={TZZ.projektOeffnen(p.nummer, p.name)} onClick={() => onProjekt(p.nummer)}>
                <span className="mono">{p.nummer}</span> {p.name}
              </button>
              <PhaseKurz phase={p.phase as Phase} />
              {darf ? (
                <button type="button" className="iconbtn" aria-label={TZZ.zuordnungLoesen(p.nummer)}
                  onClick={() => m.loesen.mutate({ projektId: p.projektId, zuordnungId: p.zuordnungId }, {
                    // umkehrbar (I-R1 Stufe 1): «Rückgängig» ordnet das Projekt demselben Ziel wieder zu
                    onSuccess: () => toast.show(TZZ.zuordnungGeloest(p.nummer), {
                      action: { label: TZZ.rueckgaengig, run: () => m.zuordnen.mutate({ projektId: p.projektId, body: ziel, key: newIdempotencyKey() }, { onError: e => toast.error(e) }) },
                    }),
                    onError: e => toast.error(e),
                  })}>
                  <Icon name="x" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : <p className="note">{TZZ.keineProjekte}</p>}
      {darf ? <ProjektZuordnen jahr={zyklus.jahr} ziel={ziel} /> : null}
    </section>
  );
}

/** «Projekt zuordnen» per Suche (K6 Schritt 4); Treffer als Liste, ein Klick ordnet zu. */
function ProjektZuordnen({ jahr, ziel }: { jahr: number; ziel: { strategischesZielId: string } | { jahreszielId: string } }) {
  const id = useId();
  const toast = useToast();
  const m = useZielzyklusMutations(jahr);
  const [offen, setOffen] = useState(false);
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => { const t = setTimeout(() => setQ(text), 250); return () => clearTimeout(t); }, [text]);
  const suche = useProjektSuche(q);
  const eingabe = useRef<HTMLInputElement>(null);
  useEffect(() => { if (offen) eingabe.current?.focus(); }, [offen]);
  if (!offen) return <div className="acts"><button type="button" className="btn" onClick={() => setOffen(true)}><Icon name="link" />{TZZ.projektZuordnen}</button></div>;
  const fehler = m.zuordnen.error ? (statusOf(m.zuordnen.error) === 409 ? TZZ.projektSchonZugeordnet : describeError(m.zuordnen.error).detail) : null;
  return (
    <div className="zz-suche">
      <label className="search" htmlFor={`${id}-q`}>
        <Icon name="search" />
        <span className="sr">{TZZ.projektSuchen}</span>
        <input id={`${id}-q`} type="search" ref={eingabe} value={text} placeholder={TZZ.projektSuchen} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setOffen(false); } }} />
      </label>
      {fehler ? <Hinweis stufe="sperre" live>{fehler}</Hinweis> : null}
      {q.trim() && suche.data ? (
        suche.data.length ? (
          <ul className="zz-liste" aria-label={TZZ.projektZuordnen}>
            {suche.data.map(p => (
              <li key={p.id}>
                <button type="button" className="linkbtn" disabled={m.zuordnen.isPending}
                  onClick={() => m.zuordnen.mutate({ projektId: p.id, body: ziel, key: newIdempotencyKey() }, {
                    onSuccess: () => { toast.show(TZZ.projektZugeordnet(p.nummer)); setText(''); setOffen(false); },
                  })}>
                  <span className="mono">{p.nummer}</span> {p.name}
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="note" role="status">{TZZ.keinTreffer}</p>
      ) : null}
      <div className="acts"><button type="button" className="btn" onClick={() => setOffen(false)}>{TZZ.abbrechen}</button></div>
    </div>
  );
}
