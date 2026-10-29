/**
 * Assistent «Projektidee» (K4 Einreichen, Seitentyp Assistent; BC DM.01.01, UC-001 Schritte 1–2, A2.2): vier Schritte
 * «Worum geht es?», «Bezug zur Strategie», «Erste Einschätzung», «Zusammenfassung» mit Wirkung (I-F5). Der Entwurf wird
 * automatisch gespeichert (I-R3, I-F7); «Weiter» prüft die Pflichtfelder des Schritts (Sperre am Feld, Fokus auf das
 * erste, I-F3); «Zurück» ohne Datenverlust. Beim Einreichen entscheidet der Server (I-P6); fehlende Angaben erscheinen
 * mit Sprung zum Schritt. In Ergänzung stehen die Rückfragen der UE über den betroffenen Feldern (A2.2).
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ApiError, isConflict, newIdempotencyKey } from '../../api/index.ts';
import { Confirm, Hinweis, Icon, TeilFehler, useToast } from '../../ui/index.ts';
import { useAuswahl, useIdeeMutations, type IdeeAuswahl, type Loaded, type Rueckfrage } from './api.ts';
import { AehnlicheIdeen } from './PoolAehnlich.tsx';
import { ideePfad, MEINE_IDEEN, Verweis, type Gehe } from './stand.tsx';
import { ideeNeuPfad } from './search.ts';
import { PFLICHT, TI } from './texte.ts';
import './idee.css';

type Stufe = 'hoch' | 'mittel' | 'tief';
const STUFEN: readonly Stufe[] = ['hoch', 'mittel', 'tief'];

export interface Werte {
  titel: string; ausgangslage: string; zielsetzung: string;
  handlungsfeldId: string | null; strategischesZielId: string | null; bereiche: string[]; herkunft: string | null;
  nutzen: Stufe | null; nutzenText: string; aufwand: Stufe | null; aufwandText: string; relevanz: Stufe | null; relevanzText: string;
}
type Feld = keyof typeof PFLICHT;

export const leer = (): Werte => ({
  titel: '', ausgangslage: '', zielsetzung: '', handlungsfeldId: null, strategischesZielId: null, bereiche: [], herkunft: null,
  nutzen: null, nutzenText: '', aufwand: null, aufwandText: '', relevanz: null, relevanzText: '',
});

const ausIdee = (i: Loaded['item']): Werte => ({
  titel: i.titel, ausgangslage: i.ausgangslage, zielsetzung: i.zielsetzung, handlungsfeldId: i.handlungsfeldId, strategischesZielId: i.strategischesZielId,
  bereiche: i.bereiche, herkunft: i.herkunft, nutzen: i.nutzen, nutzenText: i.nutzenText, aufwand: i.aufwand, aufwandText: i.aufwandText,
  relevanz: i.relevanz, relevanzText: i.relevanzText,
});

/** Pflichtfelder je Schritt (UC-001 Schritt 2; Ziel, Bereiche und Herkunft freiwillig). */
const PFLICHT_JE_SCHRITT: Record<number, readonly Feld[]> = { 1: ['titel', 'ausgangslage', 'zielsetzung'], 2: ['handlungsfeldId'], 3: ['nutzen', 'aufwand', 'relevanz'] };
const SCHRITT_VON: Record<string, number> = {
  titel: 1, ausgangslage: 1, zielsetzung: 1, handlungsfeldId: 2, handlungsfeld: 2, strategischesZielId: 2, strategischesZiel: 2, bereiche: 2, herkunft: 2,
  nutzen: 3, aufwand: 3, relevanz: 3,
};

function fehlend(v: Werte, schritt?: number): Feld[] {
  const felder = schritt ? PFLICHT_JE_SCHRITT[schritt] ?? [] : Object.values(PFLICHT_JE_SCHRITT).flat();
  return felder.filter(f => { const x = v[f]; return typeof x === 'string' ? !x.trim() : !x; });
}

const istLeer = (v: Werte) => JSON.stringify(v) === JSON.stringify(leer());

export interface AssistentProps {
  /** Geladene Idee (Entwurf oder in Ergänzung); null = neue Idee, die beim ersten Speichern entsteht. */
  start: Loaded | null;
  /** Vorbelegung einer neuen Idee (Ziel aus dem Zielzyklus, Herkunft aus dem Direktlink). */
  vorbelegung?: Partial<Werte>;
  schritt?: number;
  /** Schritt in die Adresse übernehmen (nur bei einer bestehenden Idee). */
  onSchritt?(n: number): void;
  gehe: Gehe;
}

type Speichern = { art: 'ruhe' } | { art: 'laeuft' } | { art: 'gespeichert' } | { art: 'fehler' } | { art: 'konflikt' };

export function IdeeAssistent({ start, vorbelegung, schritt: schrittStart, onSchritt, gehe }: AssistentProps) {
  const id = useId();
  const toast = useToast();
  const auswahl = useAuswahl();
  const m = useIdeeMutations();
  const [werte, setWerte] = useState<Werte>(() => (start ? ausIdee(start.item) : { ...leer(), ...vorbelegung }));
  const [schritt, setSchrittState] = useState(schrittStart ?? 1);
  const [fehler, setFehler] = useState<Partial<Record<string, string>>>({});
  const [speichern, setSpeichern] = useState<Speichern>({ art: 'ruhe' });
  const [fertig, setFertig] = useState<Loaded | null>(null);
  const [fehlenNachSenden, setFehlenNachSenden] = useState<{ feld: string; text: string }[]>([]);
  const ref = useRef<{ loaded: Loaded | null; key: string; kette: Promise<unknown>; gespeichert: string }>({
    loaded: start, key: newIdempotencyKey(), kette: Promise.resolve(), gespeichert: JSON.stringify(start ? ausIdee(start.item) : leer()),
  });
  const ueberschrift = useRef<HTMLHeadingElement>(null);
  const gewechselt = useRef(false);
  const item = ref.current.loaded?.item ?? null;
  const ergaenzung = item?.stand === 'in_ergaenzung';

  // Fokus auf die Überschrift des Schritts beim Wechsel (K4 Barrierefreiheit), nicht beim ersten Anzeigen
  useEffect(() => {
    if (gewechselt.current) ueberschrift.current?.focus();
    gewechselt.current = true;
  }, [schritt, fertig]);

  /** Speichert den aktuellen Stand (der Reihe nach, nie zwei Anfragen gleichzeitig); neue Idee beim ersten Mal anlegen. */
  const sichern = useCallback((v: Werte): Promise<boolean> => {
    const lauf = ref.current.kette.then(async () => {
      const text = JSON.stringify(v);
      if (text === ref.current.gespeichert || (!ref.current.loaded && istLeer(v))) return true;
      setSpeichern({ art: 'laeuft' });
      try {
        const l = ref.current.loaded
          ? await m.update.mutateAsync({ id: ref.current.loaded.item.id, etag: ref.current.loaded.etag, body: v })
          : await m.create.mutateAsync({ body: v, key: ref.current.key });
        ref.current.loaded = l;
        ref.current.gespeichert = text;
        setSpeichern({ art: 'gespeichert' });
        return true;
      } catch (e) {
        if (isConflict(e)) setSpeichern({ art: 'konflikt' });
        else {
          if (e instanceof ApiError && e.status === 422) setFehler(f => ({ ...f, ...feldFehler(e) }));
          setSpeichern({ art: 'fehler' });
        }
        return false;
      }
    });
    ref.current.kette = lauf;
    return lauf;
  }, [m.create, m.update]);

  // Automatisch speichern, kurz nach der letzten Eingabe (I-R3)
  useEffect(() => {
    if (fertig) return;
    const t = setTimeout(() => { void sichern(werte); }, 800);
    return () => clearTimeout(t);
  }, [werte, sichern, fertig]);

  // Ungespeicherte Eingaben beim Verlassen ansprechen (I-F7)
  useEffect(() => {
    const warnen = (e: BeforeUnloadEvent) => { if (JSON.stringify(werte) !== ref.current.gespeichert && !istLeer(werte)) e.preventDefault(); };
    window.addEventListener('beforeunload', warnen);
    return () => window.removeEventListener('beforeunload', warnen);
  }, [werte]);

  const setze = <K extends keyof Werte>(k: K, wert: Werte[K]) => {
    setWerte(v => ({ ...v, [k]: wert, ...(k === 'handlungsfeldId' && wert !== v.handlungsfeldId ? { strategischesZielId: null } : {}) }));
    setFehler(f => ({ ...f, [k]: undefined }));
  };

  const geheZu = (n: number) => {
    setSchrittState(n);
    onSchritt?.(n);
  };

  const weiter = () => {
    const fehlt = fehlend(werte, schritt);
    if (fehlt.length) {
      setFehler(f => ({ ...f, ...Object.fromEntries(fehlt.map(x => [x, PFLICHT[x]])) }));
      document.getElementById(`${id}-${fehlt[0]}`)?.focus();
      return;
    }
    void sichern(werte);
    geheZu(schritt + 1);
  };

  const einreichen = async () => {
    const fehlt = fehlend(werte);
    if (fehlt.length) {
      setFehlenNachSenden(fehlt.map(f => ({ feld: f, text: PFLICHT[f] })));
      return;
    }
    setFehlenNachSenden([]);
    if (!(await sichern(werte)) || !ref.current.loaded) return;
    try {
      const l = await m.einreichen.mutateAsync({ id: ref.current.loaded.item.id, etag: ref.current.loaded.etag, key: newIdempotencyKey() });
      ref.current.loaded = l;
      setFertig(l);
    } catch (e) {
      if (isConflict(e)) setSpeichern({ art: 'konflikt' });
      else if (e instanceof ApiError && e.status === 422 && e.fieldErrors.length) {
        setFehlenNachSenden(e.fieldErrors.map(x => ({ feld: x.path.replace(/^\//, ''), text: x.message })));
      } else toast.error(e);
    }
  };

  const [frageVerwerfen, setFrageVerwerfen] = useState(false);
  const verwerfen = async () => {
    await ref.current.kette;
    const l = ref.current.loaded;
    if (!l) return;
    try {
      await m.verwerfen.mutateAsync({ id: l.item.id, etag: l.etag });
      toast.show(TI.verworfen);
      gehe(MEINE_IDEEN);
    } catch (e) {
      setFrageVerwerfen(false);
      toast.error(e, isConflict(e) ? TI.konflikt : undefined);
    }
  };

  if (fertig) return <Bestaetigung nummer={fertig.item.nummer} gehe={gehe} ueberschrift={ueberschrift} />;

  const name = TI.schritte[schritt - 1]!;
  const fragen = (item?.rueckfragen ?? []) as Rueckfrage[];
  const fragenZu = (felder: string[]) => fragen.filter(q => felder.includes(q.feld ?? '') || (felder.includes('titel') && !q.feld));
  const feldProps = (k: Feld) => ({
    id: `${id}-${k}`,
    'aria-invalid': fehler[k] ? true : undefined,
    'aria-describedby': [`${id}-${k}-h`, fehler[k] ? `${id}-${k}-e` : ''].filter(Boolean).join(' '),
  });
  const fehlerText = (k: string) => (fehler[k] ? <p id={`${id}-${k}-e`} className="ferr" role="alert">{fehler[k]}</p> : null);

  return (
    <section aria-labelledby={`${id}-titel-seite`} className="idee-assistent">
      <header className="mh">
        <div className="mh-row">
          <div className="mh-title">
            <div className="type-ico neutral"><Icon name="edit" /></div>
            <div className="minw0">
              <h1 id={`${id}-titel-seite`}>{item ? `${TI.idee(item.nummer)}${werte.titel ? ` · ${werte.titel}` : ''}` : TI.neu}</h1>
              <div className="sub"><SpeicherStand s={speichern} /></div>
            </div>
          </div>
          {item?.can.loeschen ? <div className="acts"><button type="button" className="btn ghost" onClick={() => setFrageVerwerfen(true)}>{TI.verwerfen}</button></div> : null}
        </div>
        <ol className="idee-schritte" aria-label={TI.schritt(schritt, 4, name)}>
          {TI.schritte.map((s, i) => (
            <li key={s} className={i + 1 === schritt ? 'on' : i + 1 < schritt ? 'done' : undefined} aria-current={i + 1 === schritt ? 'step' : undefined}>
              <span className="idee-nr" aria-hidden="true">{i + 1}</span><span>{s}</span>
            </li>
          ))}
        </ol>
      </header>
      <div className="body idee-body">
        {speichern.art === 'konflikt' ? (
          <Hinweis stufe="warnung" live aktion={<button type="button" className="btn sm" onClick={() => window.location.reload()}>{TI.neuLaden}</button>}>{TI.konflikt}</Hinweis>
        ) : null}
        {speichern.art === 'fehler' ? <Hinweis stufe="warnung" live aktion={<button type="button" className="btn sm" onClick={() => { ref.current.gespeichert = ''; void sichern(werte); }}>{TI.erneutSpeichern}</button>}>{TI.nichtGespeichert}</Hinweis> : null}
        {ergaenzung && fragen.length ? <Hinweis stufe="hinweis">{TI.rueckfragenBanner(fragen.filter(q => !q.antwort).length || fragen.length)}</Hinweis> : null}

        <h2 ref={ueberschrift} tabIndex={-1} className="idee-h">{TI.schritt(schritt, 4, name)}</h2>

        {schritt === 1 ? (
          <div className="form idee-form">
            <Fragen fragen={fragenZu(['titel', 'ausgangslage', 'zielsetzung'])} ideeId={item?.id} />
            <div className="field">
              <label htmlFor={`${id}-titel`}>{TI.titelFeld}</label>
              <input {...feldProps('titel')} value={werte.titel} maxLength={200} autoComplete="off" onChange={e => setze('titel', e.target.value)} />
              <p id={`${id}-titel-h`} className="hint">{TI.titelHilfe}</p>
              {fehlerText('titel')}
            </div>
            <div className="field">
              <label htmlFor={`${id}-ausgangslage`}>{TI.ausgangslage}</label>
              <textarea {...feldProps('ausgangslage')} rows={4} maxLength={4000} value={werte.ausgangslage} onChange={e => setze('ausgangslage', e.target.value)} />
              <p id={`${id}-ausgangslage-h`} className="hint">{TI.ausgangslageHilfe}</p>
              {fehlerText('ausgangslage')}
            </div>
            <div className="field">
              <label htmlFor={`${id}-zielsetzung`}>{TI.zielsetzung}</label>
              <textarea {...feldProps('zielsetzung')} rows={4} maxLength={4000} value={werte.zielsetzung} onChange={e => setze('zielsetzung', e.target.value)} />
              <p id={`${id}-zielsetzung-h`} className="hint">{TI.zielsetzungHilfe}</p>
              {fehlerText('zielsetzung')}
            </div>
          </div>
        ) : null}

        {schritt === 2 ? (
          <Strategie id={id} werte={werte} setze={setze} auswahl={auswahl.data} laedt={auswahl.isPending} fehler={fehler} fehlerText={fehlerText}
            ladefehler={auswahl.error} erneut={() => void auswahl.refetch()}
            fragen={<Fragen fragen={fragenZu(['handlungsfeld', 'strategischesZiel', 'bereiche', 'herkunft'])} ideeId={item?.id} />} />
        ) : null}
        {schritt === 2 || schritt === 4 ? <AehnlicheIdeen handlungsfeldId={werte.handlungsfeldId} bereiche={werte.bereiche} ausser={item?.id} /> : null}

        {schritt === 3 ? (
          <div className="form idee-form">
            <Fragen fragen={fragenZu(['nutzen', 'aufwand', 'relevanz'])} ideeId={item?.id} />
            {(['nutzen', 'aufwand', 'relevanz'] as const).map(k => (
              <fieldset key={k} className="idee-gruppe" aria-describedby={[`${id}-${k}-h`, fehler[k] ? `${id}-${k}-e` : ''].filter(Boolean).join(' ')} aria-invalid={fehler[k] ? true : undefined}>
                <legend>{TI[k]}</legend>
                <p id={`${id}-${k}-h`} className="hint">{TI[`${k}Hilfe`]}</p>
                <div className="idee-stufen" role="radiogroup" aria-label={TI[k]}>
                  {STUFEN.map((s, i) => (
                    <label key={s} className="idee-wahl">
                      <input type="radio" name={`${id}-${k}`} id={i === 0 ? `${id}-${k}` : undefined} value={s} checked={werte[k] === s} onChange={() => setze(k, s)} />
                      <span>{TI.stufen[s]}</span>
                    </label>
                  ))}
                </div>
                {fehlerText(k)}
                <div className="field">
                  <label htmlFor={`${id}-${k}Text`}>{TI.begruendung} <span className="muted">({TI.optional})</span></label>
                  <input id={`${id}-${k}Text`} value={werte[`${k}Text`]} maxLength={1000} autoComplete="off" onChange={e => setze(`${k}Text`, e.target.value)} />
                </div>
              </fieldset>
            ))}
          </div>
        ) : null}

        {schritt === 4 ? (
          <Zusammenfassung werte={werte} auswahl={auswahl.data} geheZu={geheZu} fehlen={fehlenNachSenden} ergaenzung={ergaenzung} fragen={fragen} />
        ) : null}
      </div>
      <footer className="df idee-fuss">
        {schritt > 1 ? <button type="button" className="btn" onClick={() => geheZu(schritt - 1)}>{TI.zurueck}</button> : <span />}
        {schritt < 4
          ? <button type="button" className="btn primary" onClick={weiter}>{TI.weiterSchritt}</button>
          : <button type="button" className="btn primary" onClick={() => void einreichen()} aria-busy={m.einreichen.isPending}>{ergaenzung ? TI.erneutEinreichen : TI.einreichen}</button>}
      </footer>
      {frageVerwerfen ? <Confirm title={TI.verwerfen} text={TI.verwerfenFrage(werte.titel || TI.ohneTitel)} confirm={TI.verwerfen} busy={m.verwerfen.isPending}
        onConfirm={() => void verwerfen()} onClose={() => setFrageVerwerfen(false)} /> : null}
    </section>
  );
}

function feldFehler(e: ApiError): Record<string, string> {
  return Object.fromEntries(e.fieldErrors.map(x => [x.path.replace(/^\//, '').split('/')[0]!, x.message]));
}

function SpeicherStand({ s }: { s: Speichern }) {
  const text = s.art === 'laeuft' ? TI.speichert : s.art === 'gespeichert' ? TI.gespeichert : '';
  return <span role="status" aria-live="polite">{text}</span>;
}

function Strategie({ id, werte, setze, auswahl, laedt, ladefehler, erneut, fehler, fehlerText, fragen }: {
  id: string; werte: Werte; setze<K extends keyof Werte>(k: K, v: Werte[K]): void; auswahl: IdeeAuswahl | undefined; laedt: boolean;
  /** Fehler beim Laden der Auswahl: nicht als «keine Handlungsfelder» zeigen, sonst ist das Pflichtfeld unerfüllbar (Z5) */
  ladefehler: unknown; erneut(): void;
  fehler: Partial<Record<string, string>>; fehlerText(k: string): ReactNode; fragen: ReactNode;
}) {
  const feld = auswahl?.handlungsfelder.find(h => h.id === werte.handlungsfeldId);
  if (laedt) return <p role="status" className="muted">…</p>;
  if (ladefehler) return <TeilFehler was={TI.auswahlLaden} error={ladefehler} onRetry={erneut} />;
  const felder = auswahl?.handlungsfelder ?? [];
  return (
    <div className="form idee-form">
      {fragen}
      <fieldset className="idee-gruppe" aria-describedby={[`${id}-handlungsfeldId-h`, fehler.handlungsfeldId ? `${id}-handlungsfeldId-e` : ''].filter(Boolean).join(' ')}>
        <legend>{TI.handlungsfeld}</legend>
        <p id={`${id}-handlungsfeldId-h`} className="hint">{TI.handlungsfeldHilfe}</p>
        {felder.length ? (
          <div className="idee-liste">
            {felder.map((h, i) => (
              <label key={h.id} className="idee-wahl idee-karte">
                <input type="radio" name={`${id}-hf`} id={i === 0 ? `${id}-handlungsfeldId` : undefined} checked={werte.handlungsfeldId === h.id} onChange={() => setze('handlungsfeldId', h.id)} />
                <span><strong>{h.label}</strong>{h.leitsatz ? <span className="idee-leitsatz">{h.leitsatz}</span> : null}</span>
              </label>
            ))}
          </div>
        ) : <p className="muted">{TI.keineHandlungsfelder}</p>}
        {fehlerText('handlungsfeldId')}
      </fieldset>

      {feld ? (
        <fieldset className="idee-gruppe">
          <legend>{TI.ziel} <span className="muted">({TI.optional})</span></legend>
          <p className="hint">{TI.zielHilfe}</p>
          {feld.ziele.length ? (
            <div className="idee-liste">
              {feld.ziele.map(z => (
                <label key={z.id} className="idee-wahl">
                  <input type="radio" name={`${id}-ziel`} checked={werte.strategischesZielId === z.id} onChange={() => setze('strategischesZielId', z.id)} />
                  <span>{z.nummer} {z.text}</span>
                </label>
              ))}
              <label className="idee-wahl">
                <input type="radio" name={`${id}-ziel`} checked={!werte.strategischesZielId} onChange={() => setze('strategischesZielId', null)} />
                <span>{TI.keinZiel}</span>
              </label>
            </div>
          ) : <p className="muted">{TI.keineZiele}</p>}
          {fehlerText('strategischesZielId')}
        </fieldset>
      ) : null}

      <fieldset className="idee-gruppe">
        <legend>{TI.bereiche} <span className="muted">({TI.optional})</span></legend>
        <p className="hint">{TI.bereicheHilfe}</p>
        {auswahl?.bereiche.length ? (
          <div className="idee-liste idee-spalten">
            {auswahl.bereiche.map(b => (
              <label key={b.id} className="idee-wahl">
                <input type="checkbox" checked={werte.bereiche.includes(b.id)}
                  onChange={e => setze('bereiche', e.target.checked ? [...werte.bereiche, b.id] : werte.bereiche.filter(x => x !== b.id))} />
                <span>{b.name} <span className="muted">{b.kuerzel}</span></span>
              </label>
            ))}
          </div>
        ) : <p className="muted">{TI.keineBereiche}</p>}
        {fehlerText('bereiche')}
      </fieldset>

      {auswahl?.herkunft.length ? (
        <fieldset className="idee-gruppe">
          <legend>{TI.herkunft} <span className="muted">({TI.optional})</span></legend>
          <p className="hint">{TI.herkunftHilfe}</p>
          <div className="idee-stufen">
            {auswahl.herkunft.map(h => (
              <label key={h.schluessel} className="idee-wahl">
                <input type="radio" name={`${id}-herkunft`} checked={werte.herkunft === h.schluessel} onChange={() => setze('herkunft', h.schluessel)} />
                <span>{h.label}</span>
              </label>
            ))}
          </div>
          {fehlerText('herkunft')}
        </fieldset>
      ) : null}
    </div>
  );
}

/** Rückfragen der UE über den betroffenen Feldern, mit Antwort (gespeichert beim Verlassen des Felds). */
function Fragen({ fragen, ideeId }: { fragen: Rueckfrage[]; ideeId: string | undefined }) {
  if (!fragen.length || !ideeId) return null;
  return <div className="idee-fragen">{fragen.map(q => <Frage key={q.id} q={q} ideeId={ideeId} />)}</div>;
}

function Frage({ q, ideeId }: { q: Rueckfrage; ideeId: string }) {
  const id = useId();
  const m = useIdeeMutations();
  const toast = useToast();
  const [antwort, setAntwort] = useState(q.antwort ?? '');
  const [gespeichert, setGespeichert] = useState(q.antwort ?? '');
  const sichern = async () => {
    const a = antwort.trim();
    if (!a || a === gespeichert) return;
    try {
      await m.antworten.mutateAsync({ id: ideeId, rueckfrageId: q.id, antwort: a });
      setGespeichert(a);
      toast.show(TI.antwortGespeichert);
    } catch (e) {
      toast.error(e);
    }
  };
  return (
    <div className="idee-frage">
      <p><Icon name="info" /> <strong>{TI.rueckfrage}{q.feld ? '' : ` · ${TI.allgemein}`}:</strong> {q.text}</p>
      <div className="field">
        <label htmlFor={id}>{TI.antwort}{gespeichert ? <span className="muted"> · {TI.beantwortet}</span> : null}</label>
        <textarea id={id} rows={2} maxLength={4000} value={antwort} onChange={e => setAntwort(e.target.value)} onBlur={() => void sichern()} />
      </div>
    </div>
  );
}

function Zusammenfassung({ werte, auswahl, geheZu, fehlen, ergaenzung, fragen }: {
  werte: Werte; auswahl: IdeeAuswahl | undefined; geheZu(n: number): void; fehlen: { feld: string; text: string }[]; ergaenzung: boolean; fragen: Rueckfrage[];
}) {
  const feld = auswahl?.handlungsfelder.find(h => h.id === werte.handlungsfeldId);
  const ziel = feld?.ziele.find(z => z.id === werte.strategischesZielId);
  const bereiche = auswahl?.bereiche.filter(b => werte.bereiche.includes(b.id)).map(b => b.name).join(', ');
  const herkunft = auswahl?.herkunft.find(h => h.schluessel === werte.herkunft)?.label;
  const stufe = (s: Stufe | null, t: string) => (s ? `${TI.stufen[s]}${t ? ` – ${t}` : ''}` : '');
  const zeilen = useMemo(() => [
    { schritt: 1, label: TI.titelFeld, wert: werte.titel },
    { schritt: 1, label: TI.ausgangslage, wert: werte.ausgangslage },
    { schritt: 1, label: TI.zielsetzung, wert: werte.zielsetzung },
    { schritt: 2, label: TI.handlungsfeld, wert: feld?.label ?? '' },
    { schritt: 2, label: TI.ziel, wert: ziel ? `${ziel.nummer} ${ziel.text}` : '' },
    { schritt: 2, label: TI.bereiche, wert: bereiche ?? '' },
    { schritt: 2, label: TI.herkunft, wert: herkunft ?? '' },
    { schritt: 3, label: TI.nutzen, wert: stufe(werte.nutzen, werte.nutzenText) },
    { schritt: 3, label: TI.aufwand, wert: stufe(werte.aufwand, werte.aufwandText) },
    { schritt: 3, label: TI.relevanz, wert: stufe(werte.relevanz, werte.relevanzText) },
  ], [werte, feld, ziel, bereiche, herkunft]);
  return (
    <div className="idee-zf">
      {fehlen.length ? (
        <div className="hinweis hinweis-sperre" role="alert">
          <Icon name="ban" />
          <div className="hinweis-b">
            <p><strong>{TI.fehlenTitel}</strong></p>
            <ul>
              {fehlen.map(f => (
                <li key={f.feld}>
                  {f.text} <button type="button" className="btn sm" onClick={() => geheZu(SCHRITT_VON[f.feld] ?? 1)}>{TI.zuSchritt(SCHRITT_VON[f.feld] ?? 1)}</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      <p>{TI.zusammenfassung}</p>
      <dl className="attrs idee-attrs">
        {zeilen.map(z => (
          <div key={z.label} className="idee-attr">
            <dt>{z.label}</dt>
            <dd>{z.wert ? <span className="idee-wert">{z.wert}</span> : <span className="muted">{TI.leerWert}</span>}</dd>
            <dd className="idee-aendern"><button type="button" className="btn ghost sm" onClick={() => geheZu(z.schritt)} aria-label={`${z.label} ${TI.aendern.toLowerCase()}`}>{TI.aendern}</button></dd>
          </div>
        ))}
      </dl>
      {ergaenzung && fragen.length ? (
        <section className="idee-fragen" aria-label={TI.rueckfragenTitel}>
          <h3>{TI.rueckfragenTitel}</h3>
          {fragen.map(q => <p key={q.id}><strong>{q.text}</strong><br />{q.antwort ?? <span className="muted">{TI.leerWert}</span>}</p>)}
        </section>
      ) : null}
      <Hinweis stufe="hinweis">{ergaenzung ? TI.wirkungErneut : TI.wirkung}</Hinweis>
    </div>
  );
}

function Bestaetigung({ nummer, gehe, ueberschrift }: { nummer: number; gehe: Gehe; ueberschrift: RefObject<HTMLHeadingElement | null> }) {
  return (
    <section aria-labelledby="idee-fertig" className="idee-assistent">
      <div className="body idee-body idee-fertig">
        <div className="emptystate">
          <Icon name="check" />
          <h1 id="idee-fertig" ref={ueberschrift} tabIndex={-1}>{TI.eingereicht}</h1>
          <p>{TI.bestaetigung}</p>
          <div className="idee-fertig-acts">
            <Verweis pfad={MEINE_IDEEN} gehe={gehe} className="btn primary">{TI.zuMeinenIdeen}</Verweis>
            <Verweis pfad={ideePfad(nummer)} gehe={gehe} className="btn">{TI.idee(nummer)}</Verweis>
            <Verweis pfad={ideeNeuPfad()} gehe={p => { gehe(p); }} className="btn ghost">{TI.weitereIdee}</Verweis>
          </div>
        </div>
      </div>
    </section>
  );
}
