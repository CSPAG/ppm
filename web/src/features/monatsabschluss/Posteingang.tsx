/**
 * Posteingang «Berichte der Periode» (UI-15; Seitentyp Posteingang, docs/ux/rahmen/interaktion.md Abschnitt 2; K1 Prüfen
 * Schritte 1–3, UC-005 A1, A2): alle Entscheidungsinformationen in der Zeile (Projekt, Stand, Status und Trend mit
 * Vorperiode, Auffälligkeiten), Einzel- und Sammelaktionen (I-L4) und Tastatur nach K1: ↑/↓ wechselt die Zeile,
 * B bestätigt, R öffnet die Rückfrage, E fordert ein, Leertaste wählt aus, Enter öffnet die Schublade.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from '../../ui/index.ts';
import type { Zeile } from './api.ts';
import { Auffaelligkeiten, StandZelle, StatusZelle } from './anzeige.tsx';
import { TM } from './texte.ts';

export interface PosteingangProps {
  zeilen: Zeile[];
  /** Nummer des Projekts in der Schublade. */
  aktuell?: string;
  oeffnen(z: Zeile): void;
  bestaetigen(z: Zeile): void;
  rueckfrage(z: Zeile, text: string, fertig: () => void): void;
  /** Öffnet die Vorschau der Wirkung (I-R1 Stufe 3), auch für eine Zeile (E). */
  einfordern(z: Zeile[]): void;
  /** Öffnet die Vorschau: was bestätigt, was übersprungen wird. */
  sammelBestaetigen(z: Zeile[]): void;
  /** Eine Aktion läuft (Schaltflächen gesperrt, I-R2 bestätigt). */
  beschaeftigt: boolean;
}

const istEingabe = (el: EventTarget) => el instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(el.tagName);

export function Posteingang(p: PosteingangProps) {
  const [auswahl, setAuswahl] = useState<Set<string>>(new Set());
  const [fokus, setFokus] = useState(0);
  const [rf, setRf] = useState<{ id: string; text: string; fehler: boolean } | null>(null);
  const rows = useRef<(HTMLTableRowElement | null)[]>([]);
  const rfId = useId();

  // Fokus bleibt in der Liste, auch wenn sie kürzer wird (Filter, Aktionen); die Auswahl zählt nur sichtbare Zeilen
  const aktiv = Math.min(fokus, Math.max(0, p.zeilen.length - 1));
  const rfRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (rf?.id) rfRef.current?.focus(); }, [rf?.id]);

  const gewaehlt = p.zeilen.filter(z => auswahl.has(z.projektId));
  const zumBestaetigen = gewaehlt.filter(z => z.can.bestaetigen);
  const zumEinfordern = gewaehlt.filter(z => z.can.einfordern);
  const waehlbar = p.zeilen.filter(z => z.can.bestaetigen || z.can.einfordern);
  const alle = waehlbar.length > 0 && waehlbar.every(z => auswahl.has(z.projektId));

  const umschalten = (id: string) => setAuswahl(a => { const n = new Set(a); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const fokussieren = (i: number) => { setFokus(i); rows.current[i]?.focus(); };
  const rueckfrageOeffnen = (z: Zeile) => setRf({ id: z.projektId, text: '', fehler: false });

  function onKey(e: KeyboardEvent<HTMLTableRowElement>, z: Zeile, i: number) {
    if (e.target !== e.currentTarget || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (e.key === 'ArrowDown' && i < p.zeilen.length - 1) fokussieren(i + 1);
    else if (e.key === 'ArrowUp' && i > 0) fokussieren(i - 1);
    else if (e.key === ' ') { if (z.can.bestaetigen || z.can.einfordern) umschalten(z.projektId); }
    else if (e.key === 'Enter') p.oeffnen(z);
    else if (k === 'b' && z.can.bestaetigen && !p.beschaeftigt) p.bestaetigen(z);
    else if (k === 'r' && z.can.rueckfrage) rueckfrageOeffnen(z);
    else if (k === 'e' && z.can.einfordern && !p.beschaeftigt) p.einfordern([z]);
    else return;
    e.preventDefault();
  }

  function senden(z: Zeile) {
    if (!rf || !rf.text.trim()) { setRf(r => (r ? { ...r, fehler: true } : r)); return; }
    p.rueckfrage(z, rf.text.trim(), () => { setRf(null); fokussieren(p.zeilen.indexOf(z)); });
  }

  return (
    <>
      {gewaehlt.length ? (
        <div className="ma-sammel" role="region" aria-label={TM.auswahl(gewaehlt.length)}>
          <span className="ma-sammel-n">{TM.auswahl(gewaehlt.length)}</span>
          {zumBestaetigen.length ? (
            <button type="button" className="btn primary sm" disabled={p.beschaeftigt} onClick={() => p.sammelBestaetigen(gewaehlt)}>
              <Icon name="check" />{TM.aktion.sammelBestaetigen(zumBestaetigen.length)}
            </button>
          ) : null}
          {zumEinfordern.length ? (
            <button type="button" className="btn sm" disabled={p.beschaeftigt} onClick={() => p.einfordern(zumEinfordern)}>
              <Icon name="send" />{TM.aktion.sammelEinfordern(zumEinfordern.length)}
            </button>
          ) : null}
          <button type="button" className="btn ghost sm" onClick={() => setAuswahl(new Set())}>{TM.aktion.auswahlAufheben}</button>
        </div>
      ) : null}
      <table className="dl ma-tab">
        <caption className="sr">{TM.title}</caption>
        <thead>
          <tr>
            <th scope="col" className="ck">
              <input type="checkbox" aria-label={TM.alleAuswaehlen} checked={alle} disabled={!waehlbar.length}
                onChange={() => setAuswahl(alle ? new Set() : new Set(waehlbar.map(z => z.projektId)))} />
            </th>
            <th scope="col"><span className="th">{TM.spalte.projekt}</span></th>
            <th scope="col"><span className="th">{TM.spalte.stand}</span></th>
            <th scope="col"><span className="th">{TM.spalte.status}</span></th>
            <th scope="col"><span className="th">{TM.spalte.auffaellig}</span></th>
            <th scope="col"><span className="th">{TM.spalte.aktion}</span></th>
          </tr>
        </thead>
        <tbody>
          {p.zeilen.flatMap((z, i) => {
            const name = `${z.projektNummer} ${z.projektName}`;
            const offen = rf?.id === z.projektId;
            const cur = p.aktuell === z.projektNummer;
            const zeile = (
              <tr key={z.projektId} ref={el => { rows.current[i] = el; }} tabIndex={i === aktiv ? 0 : -1}
                className={[cur ? 'cur' : '', auswahl.has(z.projektId) ? 'sel' : ''].filter(Boolean).join(' ') || undefined}
                aria-current={cur ? 'true' : undefined}
                onFocus={() => setFokus(i)} onKeyDown={e => onKey(e, z, i)}
                onClick={e => { if (!istEingabe(e.target)) p.oeffnen(z); }}>
                <td className="ck karte" data-label={TM.spalte.auswahl}>
                  {z.can.bestaetigen || z.can.einfordern ? (
                    <input type="checkbox" tabIndex={-1} aria-label={TM.auswaehlen(name)} checked={auswahl.has(z.projektId)} onChange={() => umschalten(z.projektId)} />
                  ) : null}
                </td>
                <td className="nm karte" data-label={TM.spalte.projekt}>
                  <button type="button" className="rowlink" tabIndex={-1} aria-label={TM.aktion.oeffnen + ': ' + name} onClick={e => { e.stopPropagation(); p.oeffnen(z); }}>
                    <span className="mono">{z.projektNummer}</span> {z.projektName}
                  </button>
                  <div className="ma-pf">{z.portfolioName}</div>
                </td>
                <td className="karte" data-label={TM.spalte.stand}><StandZelle z={z} /></td>
                <td className="karte" data-label={TM.spalte.status}><StatusZelle z={z} /></td>
                <td className="karte" data-label={TM.spalte.auffaellig}><Auffaelligkeiten liste={z.auffaelligkeiten} /></td>
                <td className="karte ma-akt" data-label={TM.spalte.aktion}>
                  {z.can.bestaetigen ? (
                    <button type="button" className="btn sm" tabIndex={-1} disabled={p.beschaeftigt} onClick={e => { e.stopPropagation(); p.bestaetigen(z); }}
                      aria-label={`${TM.aktion.bestaetigen}: ${name}`} aria-keyshortcuts="B"><Icon name="check" />{TM.aktion.bestaetigen}</button>
                  ) : null}
                  {z.can.rueckfrage ? (
                    <button type="button" className="btn ghost sm" tabIndex={-1} onClick={e => { e.stopPropagation(); rueckfrageOeffnen(z); }}
                      aria-label={`${TM.aktion.rueckfrage}: ${name}`} aria-keyshortcuts="R"><Icon name="comment" />{TM.aktion.rueckfrage}</button>
                  ) : null}
                  {z.can.einfordern ? (
                    <button type="button" className="btn sm" tabIndex={-1} disabled={p.beschaeftigt} onClick={e => { e.stopPropagation(); p.einfordern([z]); }}
                      aria-label={`${TM.aktion.einfordern}: ${name}`} aria-keyshortcuts="E"><Icon name="send" />{TM.aktion.einfordern}</button>
                  ) : null}
                </td>
              </tr>
            );
            if (!offen) return [zeile];
            return [zeile, (
              <tr key={`${z.projektId}-rf`} className="ma-rf static">
                <td colSpan={6}>
                  <div className="field">
                    <label htmlFor={rfId}>{TM.rueckfrage.label} · {name}</label>
                    <textarea id={rfId} rows={3} maxLength={2000} value={rf.text} placeholder={TM.rueckfrage.platzhalter} ref={rfRef}
                      aria-invalid={rf.fehler || undefined} aria-describedby={rf.fehler ? `${rfId}-f` : undefined}
                      onChange={e => setRf({ ...rf, text: e.target.value, fehler: false })}
                      onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); setRf(null); fokussieren(i); } }} />
                    {rf.fehler ? <div id={`${rfId}-f`} className="ferr" role="alert">{TM.rueckfrage.leer}</div> : null}
                  </div>
                  <div className="ma-rf-a">
                    <button type="button" className="btn primary sm" disabled={p.beschaeftigt} onClick={() => senden(z)}><Icon name="send" />{TM.aktion.senden}</button>
                    <button type="button" className="btn ghost sm" onClick={() => { setRf(null); fokussieren(i); }}>{TM.aktion.abbrechen}</button>
                  </div>
                </td>
              </tr>
            )];
          })}
        </tbody>
      </table>
    </>
  );
}
