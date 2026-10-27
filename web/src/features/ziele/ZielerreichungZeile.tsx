/**
 * Zeile der Zielerreichung (K6 Schritt 10): Ziel mit Metrik, Zielwert und letztem Stand, Felder für den neuen Stand und
 * den Kommentar. Gespeichert wird, wenn der Fokus die Zeile verlässt (I-R3; Tab springt zum nächsten Ziel), bestätigt
 * nach Antwort des Servers. Konflikt (412/409) und Fehler bleiben in der Zeile, die Eingabe bleibt im Feld (Z7, I-F7).
 */
import { describeError } from '@vollholz/iam-web';
import { useEffect, useId, useRef, useState, type FocusEvent } from 'react';
import { newIdempotencyKey, statusOf } from '../../api/index.ts';
import { fmtQuartal, fmtZeitpunkt, Icon, T } from '../../ui/index.ts';
import type { useZielerreichungSpeichern, ZielerreichungEintrag, ZielerreichungZiel } from './ZielerreichungApi.ts';
import type { QuartalNr } from './ZielerreichungSearch.ts';
import { TZE } from './ZielerreichungTexte.ts';

type Zustand = { art: 'ruhe' } | { art: 'speichert' } | { art: 'gespeichert' } | { art: 'entfernt' } | { art: 'fehler'; text: string; konflikt?: boolean };

const quartalText = (q: string) => fmtQuartal(Number(q.slice(0, 4)), Number(q.slice(6)) as QuartalNr);

function Letzter({ e }: { e: ZielerreichungEintrag | null }) {
  if (!e) return <span className="muted">–</span>;
  return <><span>{e.stand}</span> <span className="muted small">· {quartalText(e.quartal)}</span></>;
}

export interface ZeileProps {
  ziel: ZielerreichungZiel;
  write: boolean;
  speichern: ReturnType<typeof useZielerreichungSpeichern>;
  neuLaden(): void;
  ansagen(text: string): void;
}

export function ZielerreichungZeile({ ziel, write, speichern, neuLaden, ansagen }: ZeileProps) {
  const id = useId();
  const e = ziel.eintrag;
  const [stand, setStand] = useState(e?.stand ?? '');
  const [beurteilung, setBeurteilung] = useState(e?.beurteilung ?? '');
  const [zustand, setZustand] = useState<Zustand>({ art: 'ruhe' });
  // ein Schlüssel je Absicht «erfassen»: Wiederholung nach Netzfehler legt nicht doppelt an
  const key = useRef(newIdempotencyKey());
  // neuer Stand vom Server (neu geladen, andere Person): Felder übernehmen, solange nichts Ungespeichertes drin ist
  const basis = useRef({ stand: e?.stand ?? '', beurteilung: e?.beurteilung ?? '', version: e?.version ?? 0 });
  useEffect(() => {
    const v = e?.version ?? 0;
    if (v === basis.current.version) return;
    const sauber = stand === basis.current.stand && beurteilung === basis.current.beurteilung;
    basis.current = { stand: e?.stand ?? '', beurteilung: e?.beurteilung ?? '', version: v };
    if (sauber) { setStand(e?.stand ?? ''); setBeurteilung(e?.beurteilung ?? ''); }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur bei neuem Stand vom Server
  }, [e?.version, e?.stand, e?.beurteilung]);

  const geaendert = stand.trim() !== (e?.stand ?? '') || beurteilung.trim() !== (e?.beurteilung ?? '');

  const sichern = () => {
    if (!geaendert || zustand.art === 'speichert') return;
    if (!stand.trim() && !e) {
      if (beurteilung.trim()) setZustand({ art: 'fehler', text: TZE.standFehlt });
      return;
    }
    setZustand({ art: 'speichert' });
    // mutateAsync: jede Zeile erhält ihr eigenes Ergebnis, auch wenn mehrere Zeilen zugleich speichern
    speichern.mutateAsync({ ziel, stand: stand.trim(), beurteilung: beurteilung.trim(), key: key.current }).then(neu => {
      basis.current = { stand: neu?.stand ?? '', beurteilung: neu?.beurteilung ?? '', version: neu?.version ?? 0 };
      setStand(neu?.stand ?? ''); setBeurteilung(neu?.beurteilung ?? '');
      key.current = newIdempotencyKey();
      setZustand({ art: neu ? 'gespeichert' : 'entfernt' });
      ansagen(neu ? TZE.gespeichertAnsage(ziel.nummer) : TZE.entferntAnsage(ziel.nummer));
    }, (err: unknown) => {
      const s = statusOf(err);
      const d = describeError(err);
      setZustand(s === 412 || s === 409 ? { art: 'fehler', text: TZE.konflikt, konflikt: true } : { art: 'fehler', text: d.detail || d.title || T.common.error });
    });
  };

  // erst speichern, wenn der Fokus die Zeile verlässt (nicht beim Wechsel vom Stand zum Kommentar)
  const verlassen = (ev: FocusEvent<HTMLTableRowElement>) => {
    if (ev.relatedTarget instanceof Node && ev.currentTarget.contains(ev.relatedTarget)) return;
    sichern();
  };

  const fehlerId = `${id}-f`;
  const fehler = zustand.art === 'fehler';
  return (
    <tr className={`static ze-${ziel.typ}`} onBlur={write ? verlassen : undefined}>
      <td data-label={TZE.nummer} className="nm karte">
        <span className="sr">{TZE.ebene[ziel.typ]} </span><span className="ze-nr">{ziel.nummer}</span>
      </td>
      <td data-label={TZE.ziel} className="karte ze-text">{ziel.text}</td>
      <td data-label={TZE.metrik} className="karte">{ziel.metrik || <span className="muted"><Icon name="info" /> {TZE.metrikFehlt}</span>}</td>
      <td data-label={TZE.zielwert} className="karte">{ziel.zielwert || <span className="muted">–</span>}</td>
      <td data-label={TZE.letzter} className="karte"><Letzter e={ziel.letzter} /></td>
      {write ? (
        <>
          <td data-label={TZE.stand} className="karte ze-in">
            <input value={stand} onChange={x => setStand(x.target.value)} maxLength={200} aria-label={TZE.standVon(ziel.nummer)}
              aria-invalid={fehler && !zustand.konflikt ? true : undefined} aria-describedby={fehler ? fehlerId : undefined}
              onKeyDown={x => { if (x.key === 'Enter') sichern(); }} />
          </td>
          <td data-label={TZE.beurteilung} className="karte ze-in">
            <input value={beurteilung} onChange={x => setBeurteilung(x.target.value)} maxLength={2000} aria-label={TZE.beurteilungVon(ziel.nummer)}
              onKeyDown={x => { if (x.key === 'Enter') sichern(); }} />
          </td>
        </>
      ) : (
        <>
          <td data-label={TZE.stand} className="karte">{e?.stand ?? <span className="muted">{TZE.keinStand}</span>}</td>
          <td data-label={TZE.beurteilung} className="karte">{e?.beurteilung || <span className="muted">–</span>}</td>
        </>
      )}
      <td data-label={TZE.status} className="karte ze-st">
        {zustand.art === 'speichert' ? <span className="muted small">{TZE.wirdGespeichert}</span> : null}
        {zustand.art === 'gespeichert' && e ? <span className="small"><Icon name="check" /> {TZE.gespeichert}</span> : null}
        {zustand.art === 'entfernt' ? <span className="small">{TZE.entfernt}</span> : null}
        {(zustand.art === 'ruhe' || zustand.art === 'gespeichert') && e ? <div className="muted small">{TZE.erfasst(fmtZeitpunkt(e.erfasstAt), e.erfasstVon?.name ?? null)}</div> : null}
        {fehler ? (
          <div id={fehlerId} className="ze-fehler small" role="alert">
            <Icon name="warn" /> {zustand.text}
            {zustand.konflikt ? <> <button type="button" className="btn sm" onClick={() => { setZustand({ art: 'ruhe' }); neuLaden(); }}>{T.common.reload}</button></> : null}
          </div>
        ) : null}
      </td>
    </tr>
  );
}
