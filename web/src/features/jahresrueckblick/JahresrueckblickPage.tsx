/**
 * Gremien › Jahresrückblick (UI-37, Seitentyp Bericht; BC ZM.03.03, PS.04.03; UC-013 Schritte 1–4, A1; Entscheid in K3
 * Schritt 8; AP-E7-5): Jahresauswertung mit Kennzahlen (je Zahl ein Sprung zu ihren Einzelwerten), Zielerreichung,
 * Vorhaben und Lessons Learned; die UE fordert fehlende Lessons Learned an (A1), erfasst Erkenntnisse und Massnahmen und
 * traktandiert den Rückblick im PRAT (Wirkung vorher, I-R1 Stufe 3). Dokument als PDF oder Word.
 * Zustände: Z1 Laden, Z2 noch nichts gespeichert, Z5 Fehler, Z7 Konflikt (412 → neu laden), Z8 nur lesen,
 * Z9 traktandiert (gesperrt) bzw. ausgewertet. Adresse: `/gremien/jahresrueckblick/2026` (I-N5).
 */
import { describeError } from '@vollholz/iam-web';
import { useId, useState, type ReactNode } from 'react';
import { isConflict, statusOf } from '../../api/index.ts';
import { useSession } from '../../auth/index.ts';
import { Dialog, Empty, ErrorState, fmtDatum, fmtPhase, fmtQuartal, Hinweis, Icon, Skelett, Stand, useToast, useVerzoegert, type Phase } from '../../ui/index.ts';
import {
  dokumentLaden, useJahresrueckblick, useJahresrueckblickMutations, type Jahresauswertung, type JahresrueckblickLoaded, type Vorhaben,
} from './JahresrueckblickApi.ts';
import { TJ } from './JahresrueckblickTexte.ts';
import './Jahresrueckblick.css';

export interface JahresrueckblickPageProps {
  jahr: number;
  /** Anderes Jahr öffnen (`/gremien/jahresrueckblick/<jahr>`). */
  jahrWechseln(jahr: number): void;
}

const quartal = (q: string) => fmtQuartal(Number(q.slice(0, 4)), Number(q.slice(6)) as 1 | 2 | 3 | 4);

export function JahresrueckblickPage({ jahr, jahrWechseln }: JahresrueckblickPageProps) {
  const { can, canSomewhere } = useSession();
  // Mitglieder des PRAT (sitzung:read am Portfolio) lesen ab «traktandiert» (A-67); die API entscheidet, andere Gremien 403
  const darf = can('ziel:read') || can('quartalsbericht:write') || canSomewhere('sitzung:read');
  const q = useJahresrueckblick(jahr, darf);
  const skelett = useVerzoegert(q.isPending && darf);
  const l = q.data;
  const r = l?.item;
  const familie = r?.stand === 'ausgewertet' ? 'positiv' : r?.stand === 'traktandiert' ? 'traktandiert' : r?.stand === 'in_arbeit' ? 'wartet' : 'entwurf';
  const detail = !r ? undefined : r.stand === 'traktandiert' && r.traktandiertAt ? TJ.standDetail.traktandiert(fmtDatum(r.traktandiertAt))
    : r.stand === 'ausgewertet' && r.ausgewertetAt ? TJ.standDetail.ausgewertet(fmtDatum(r.ausgewertetAt))
      : r.stand === 'offen' ? TJ.standDetail.offen : TJ.standDetail.in_arbeit;

  return (
    <section aria-labelledby="page-title" className="jr">
      <header className="mh">
        <div className="mh-row">
          <div className="mh-title">
            <div className="type-ico neutral"><Icon name="target" /></div>
            <div className="minw0">
              <h1 id="page-title">{TJ.title(jahr)}</h1>
              <div className="sub">{TJ.sub}</div>
            </div>
          </div>
          <div className="jr-kopf">
            {r ? <Stand familie={familie} label={TJ.stand[r.stand]!} detail={detail} /> : null}
            <nav className="acts" aria-label={TJ.jahrWaehlen}>
              <button type="button" className="btn sm" onClick={() => jahrWechseln(jahr - 1)}>{TJ.vorher}<span className="sr"> ({jahr - 1})</span></button>
              <button type="button" className="btn sm" onClick={() => jahrWechseln(jahr + 1)}>{TJ.nachher}<span className="sr"> ({jahr + 1})</span></button>
            </nav>
          </div>
        </div>
      </header>
      {/* scrollbar mit der Tastatur erreichbar, auch für Lesende ohne Eingabefelder (axe scrollable-region-focusable) */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- beschriftete, scrollbare Region (WCAG 2.1.1) */}
      <div className="body jr-body" tabIndex={0} role="region" aria-label={TJ.inhalt(jahr)}>
        {!darf ? <Empty>{TJ.keinRecht}</Empty> : q.isPending ? (
          <div aria-busy="true"><span className="sr" role="status">{TJ.title(jahr)}</span>{skelett ? <Skelett /> : null}</div>
        ) : q.error && statusOf(q.error) === 403 ? <Empty>{TJ.keinRecht}</Empty> : q.error ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : !l ? <Empty>{TJ.nochNichtTraktandiert(jahr)}</Empty> : <Rueckblick key={l.etag} l={l} neuLaden={() => void q.refetch()} />}
      </div>
    </section>
  );
}

function Rueckblick({ l, neuLaden }: { l: JahresrueckblickLoaded; neuLaden(): void }) {
  const r = l.item;
  const a = r.auswertung as Jahresauswertung;
  const m = useJahresrueckblickMutations(r.jahr);
  const toast = useToast();
  const [frage, setFrage] = useState(false);
  const [erkenntnisse, setErkenntnisse] = useState(r.erkenntnisse);
  const [massnahmen, setMassnahmen] = useState(r.massnahmen);
  const geaendert = erkenntnisse.trim() !== r.erkenntnisse || massnahmen.trim() !== r.massnahmen;
  const busy = m.speichern.isPending || m.traktandieren.isPending || m.anfordern.isPending;
  const fehler = (e: unknown) => { if (isConflict(e)) { toast.error(e, TJ.konflikt); neuLaden(); } else toast.error(e); };
  const z = a.zielerreichung;
  const v = a.vorhaben;
  const ll = a.lessonsLearned;
  const traktandierbar = r.can.traktandieren && r.stand !== 'offen' && !geaendert;

  return (
    <>
      {r.stand === 'traktandiert' && r.traktandiertAt ? <Hinweis stufe="hinweis">{TJ.bannerTraktandiert(fmtDatum(r.traktandiertAt))}</Hinweis> : null}
      {r.stand === 'ausgewertet' && r.ausgewertetAt ? <Hinweis stufe="hinweis">{TJ.bannerAusgewertet(fmtDatum(r.ausgewertetAt), r.jahr + 1)}</Hinweis> : null}
      {r.stand === 'in_arbeit' && r.rueckmeldung ? <Hinweis stufe="warnung">{TJ.rueckmeldung(r.rueckmeldung)}</Hinweis> : null}
      {!r.can.bearbeiten && r.stand !== 'traktandiert' ? <Hinweis stufe="hinweis">{TJ.nurLesen}</Hinweis> : null}

      <ul className="jr-kennzahlen" aria-label={TJ.kennzahl.kennzahlen}>
        <li><a href="#jr-zielerreichung">{TJ.kennzahl.ziele(z.mitStand, z.gesamt)}</a></li>
        <li><a href="#jr-vorhaben-abgeschlossen">{TJ.kennzahl.abgeschlossen(v.abgeschlossen.length)}</a></li>
        <li><a href="#jr-vorhaben-abgebrochen">{TJ.kennzahl.abgebrochen(v.abgebrochen.length)}</a></li>
        <li><a href="#jr-vorhaben-laufend">{TJ.kennzahl.laufend(v.laufend.length)}</a></li>
        <li><a href="#jr-lessons">{TJ.kennzahl.lessons(ll.eintraege.length)}</a></li>
        <li><a href="#jr-ohne" className={ll.ohne.length ? 'jr-warn' : undefined}>{TJ.kennzahl.ohne(ll.ohne.length)}</a></li>
      </ul>

      {r.can.traktandieren ? (
        <div className="jr-acts">
          <div>
            <button type="button" className="btn primary" disabled={busy || !traktandierbar} onClick={() => setFrage(true)}><Icon name="send" />{TJ.traktandieren}</button>
            {!traktandierbar ? <p className="hint">{TJ.traktandierenVorher}</p> : null}
          </div>
        </div>
      ) : null}
      {r.stand !== 'offen' ? <Dokument jahr={r.jahr} /> : null}

      <Teil id="zielerreichung">
        <Tabelle caption={TJ.tabelle.ziele} leer={TJ.leer.ziele}
          kopf={[TJ.spalte.nummer, TJ.spalte.ziel, TJ.spalte.metrik, TJ.spalte.zielwert, TJ.spalte.stand, TJ.spalte.beurteilung]}
          zeilen={z.ziele.map(x => [x.nummer, x.text, x.metrik || '–', x.zielwert || '–', x.stand ? `${x.stand}${x.quartal ? ` ${TJ.ausQuartal(quartal(x.quartal))}` : ''}` : '–', x.beurteilung || '–'])} />
      </Teil>

      <Teil id="vorhaben">
        <ProjektTabelle id="abgeschlossen" titel={TJ.vorhaben.abgeschlossen} leer={TJ.leer.abgeschlossen} liste={v.abgeschlossen} seit />
        <ProjektTabelle id="abgebrochen" titel={TJ.vorhaben.abgebrochen} leer={TJ.leer.abgebrochen} liste={v.abgebrochen} seit />
        <ProjektTabelle id="laufend" titel={TJ.vorhaben.laufend} leer={TJ.leer.laufend} liste={v.laufend} />
      </Teil>

      <Teil id="lessons">
        <Tabelle caption={TJ.tabelle.lessons} leer={TJ.leer.lessons} kopf={[TJ.spalte.projekt, TJ.spalte.kategorie, TJ.spalte.lesson]}
          zeilen={ll.eintraege.map(x => [<a key="p" href={`/projekte/${x.projekt.nummer}/abschluss`}>{x.projekt.nummer} {x.projekt.name}</a>, x.kategorie || '–', x.text])} />
        <p><a href={`/portfolio/auswertungen/lessons-learned?jahr=${r.jahr}`}>{TJ.sammlung}</a></p>
        <h3 id="jr-ohne">{TJ.ohneTitel}</h3>
        <Tabelle caption={TJ.ohneTitel} leer={TJ.leer.ohne} kopf={[TJ.spalte.projekt, TJ.spalte.portfolio, TJ.spalte.am]}
          zeilen={ll.ohne.map(p => [<a key="p" href={`/projekte/${p.nummer}/abschluss`}>{p.nummer} {p.name}</a>, p.portfolio, p.seit ? fmtDatum(p.seit) : '–'])} />
        {r.can.bearbeiten && r.stand !== 'ausgewertet' && ll.ohne.length ? (
          <div>
            {/* Anfordern lädt den Rückblick neu: ungespeicherte Eingaben gingen verloren */}
            <button type="button" className="btn" disabled={busy || geaendert} onClick={() => m.anfordern.mutate(undefined, {
              onSuccess: n => toast.show(TJ.angefordert(n.vorhaben, n.aufgaben)), onError: fehler,
            })}><Icon name="send" />{TJ.anfordern}</button>
            <p className="hint">{geaendert ? TJ.anfordernVorher : TJ.anfordernWirkung(ll.ohne.length)}</p>
          </div>
        ) : null}
      </Teil>

      <Teil id="erkenntnisse">
        {r.can.bearbeiten ? (
          <form className="form" onSubmit={e => {
            e.preventDefault();
            m.speichern.mutate({ l, erkenntnisse: erkenntnisse.trim(), massnahmen: massnahmen.trim() }, { onSuccess: () => toast.show(TJ.gespeichert), onError: fehler });
          }}>
            <Feld label={TJ.erkenntnisse} hinweis={TJ.erkenntnisseHinweis} wert={erkenntnisse} setzen={setErkenntnisse} />
            <Feld label={TJ.massnahmen} hinweis={TJ.massnahmenHinweis(r.jahr + 1)} wert={massnahmen} setzen={setMassnahmen} />
            <div className="acts"><button type="submit" className="btn primary" aria-busy={m.speichern.isPending} disabled={busy || !(geaendert || r.version === 0)}><Icon name="check" />{TJ.speichern}</button></div>
          </form>
        ) : (
          <>
            <h3>{TJ.erkenntnisse}</h3>
            <p className="jr-text">{r.erkenntnisse || <span className="muted">{TJ.leer.erkenntnisse}</span>}</p>
            <h3>{TJ.massnahmen}</h3>
            <p className="jr-text">{r.massnahmen || <span className="muted">{TJ.leer.massnahmen}</span>}</p>
          </>
        )}
      </Teil>

      {frage ? (
        <Dialog title={TJ.dialog.titel(r.jahr)} onClose={() => setFrage(false)} footer={<>
          <button type="button" className="btn" onClick={() => setFrage(false)} data-autofocus>{TJ.dialog.abbrechen}</button>
          <button type="button" className="btn primary" disabled={busy} onClick={() => m.traktandieren.mutate(undefined, {
            onSuccess: () => { setFrage(false); toast.show(TJ.traktandiert(r.jahr)); }, onError: e => { setFrage(false); fehler(e); },
          })}>{TJ.traktandieren}</button>
        </>}>
          <p>{TJ.dialog.text}</p>
        </Dialog>
      ) : null}
    </>
  );
}

function Teil({ id, children }: { id: string; children: ReactNode }) {
  const hid = `jr-${id}`;
  return (
    <section aria-labelledby={hid} className="jr-abschnitt">
      <h2 id={hid}>{TJ.abschnitte[id]}</h2>
      {children}
    </section>
  );
}

function Feld({ label, hinweis, wert, setzen }: { label: string; hinweis: string; wert: string; setzen(v: string): void }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} rows={4} maxLength={8000} value={wert} aria-describedby={`${id}-h`} onChange={e => setzen(e.target.value)} />
      <div id={`${id}-h`} className="note">{hinweis}</div>
    </div>
  );
}

function ProjektTabelle({ id, titel, leer, liste, seit }: { id: string; titel: string; leer: string; liste: Vorhaben[]; seit?: boolean }) {
  return (
    <>
      <h3 id={`jr-vorhaben-${id}`}>{titel}</h3>
      <Tabelle caption={titel} leer={leer}
        kopf={[TJ.spalte.projekt, TJ.spalte.portfolio, TJ.spalte.phase, seit ? TJ.spalte.am : TJ.spalte.lebenszyklus]}
        zeilen={liste.map(p => [<a key="p" href={`/projekte/${p.nummer}`}>{p.nummer} {p.name}</a>, p.portfolio, fmtPhase(p.phase as Phase),
          seit ? (p.seit ? fmtDatum(p.seit) : '–') : TJ.lebenszyklus[p.lebenszyklus] ?? p.lebenszyklus])} />
    </>
  );
}

function Tabelle({ caption, kopf, zeilen, leer }: { caption: string; kopf: string[]; zeilen: ReactNode[][]; leer: string }) {
  if (!zeilen.length) return <p className="muted">{leer}</p>;
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- beschriftete, scrollbare Region (WCAG 2.1.1)
    <div className="jr-tab" tabIndex={0} role="region" aria-label={caption}>
      <table className="dl">
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

function Dokument({ jahr }: { jahr: number }) {
  const id = useId();
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);
  const laden = async (format: 'pdf' | 'docx') => {
    setLaeuft(true);
    setMeldung(null);
    try {
      const d = await dokumentLaden(jahr, format);
      speichernDatei(d.blob, d.name);
      setMeldung({ ok: true, text: TJ.dokumentBereit(d.name) });
    } catch (e) {
      const f = describeError(e);
      setMeldung({ ok: false, text: f.detail || f.title });
    } finally {
      setLaeuft(false);
    }
  };
  return (
    <div className="jr-dokument" role="group" aria-labelledby={`${id}-t`} aria-describedby={`${id}-h`}>
      <span id={`${id}-t`}><Icon name="download" /> {TJ.dokument}</span>
      <button type="button" className="btn sm" disabled={laeuft} onClick={() => void laden('pdf')}>{TJ.pdf}</button>
      <button type="button" className="btn sm" disabled={laeuft} onClick={() => void laden('docx')}>{TJ.word}</button>
      <p id={`${id}-h`} className="muted small">{TJ.personendaten}</p>
      <div role="status" aria-live="polite" className="small">{laeuft ? TJ.wirdErstellt : meldung?.ok ? meldung.text : null}</div>
      {meldung && !meldung.ok ? <Hinweis stufe="sperre" live>{meldung.text}</Hinweis> : null}
    </div>
  );
}
