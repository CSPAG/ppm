/**
 * Seite «Kapazität» (UI-24, Seitentyp Arbeitsfläche; BC RK.01.01 Grundfunktion, UC-009 Schritte 1–2): Raster Rolle (Pool,
 * A-20) × Monat mit dem für Vorhaben verfügbaren Angebot in FTE. Automatisches Speichern mit Anzeige (I-R3), Rückgängig
 * und Wiederholen (Strg+Z / Strg+Umschalt+Z), Tastatur (Pfeile, Eingabetaste), Konflikt bei 412 (Z7), nur lesen ohne
 * `ressource:write` (Z8). Zeilen virtualisiert (Q-L5: flüssig bei 50 × 31 Zellen).
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { isConflict } from '../../api/index.ts';
import { Empty, ErrorState, Hinweis, Icon, Skelett, T, useVerzoegert } from '../../ui/index.ts';
import { ressourcenKeys, useKapazitaet, useKapazitaetSpeichern, useRollen, type Kapazitaet, type KapazitaetAenderung } from './api.ts';
import { Kopf } from './Kopf.tsx';
import { eingabeAusFte, fenster, fteAusEingabe, ZEILE } from './raster.ts';
import type { KapazitaetSearch, SetKapazitaetSearch } from './search.ts';
import { TR } from './texte.ts';
import { monate, monatKurz, monatLang, zeitraum } from './zeitraum.ts';
import './ressourcen.css';

/** Pause nach der letzten Eingabe bis zum Speichern. */
const SPEICHERN_NACH = 800;

const k = (rolle: string, monat: string) => `${rolle}|${monat}`;
interface Schritt { key: string; vorher: string; nachher: string }

export function KapazitaetPage({ search, setSearch, navigieren }: { search: KapazitaetSearch; setSearch: SetKapazitaetSearch; navigieren(pfad: string): void }) {
  const z = zeitraum(search);
  const daten = useKapazitaet(z);
  const rollen = useRollen();
  const speichern = useKapazitaetSpeichern();
  const qc = useQueryClient();
  const skelett = useVerzoegert((daten.isPending || rollen.isPending) && !!z);

  const ms = useMemo(() => (z ? monate(z.von, z.bis) : []), [z?.von, z?.bis]); // eslint-disable-line react-hooks/exhaustive-deps
  const server = useMemo(() => new Map((daten.data?.zellen ?? []).map(c => [k(c.rolle, c.monat), c])), [daten.data]);
  // Zeilen: aktive Rollen in der Reihenfolge der Codetabelle, deaktivierte nur mit erfasstem Angebot, unbekannte Schlüssel am Ende
  const zeilen = useMemo(() => {
    const mitAngebot = new Set((daten.data?.zellen ?? []).map(c => c.rolle));
    const bekannt = (rollen.data ?? []).filter(r => r.aktiv || mitAngebot.has(r.schluessel));
    const rest = [...mitAngebot].filter(r => !bekannt.some(b => b.schluessel === r)).sort().map(r => ({ schluessel: r, label: r, aktiv: false }));
    return [...bekannt, ...rest];
  }, [rollen.data, daten.data]);
  const darf = daten.data?.can.write ?? false;

  // Entwurf: Eingaben, die noch nicht gespeichert sind (Schlüssel Rolle|Monat → Text)
  const [entwurf, setEntwurf] = useState<Record<string, string>>({});
  const [konflikt, setKonflikt] = useState(false);
  const [fehler, setFehler] = useState<unknown>(null);
  const [gespeichertAt, setGespeichertAt] = useState<number | null>(null);
  const [undo, setUndo] = useState<Schritt[]>([]);
  const [redo, setRedo] = useState<Schritt[]>([]);
  const startwert = useRef<{ key: string; wert: string } | null>(null);

  const wert = useCallback((key: string) => entwurf[key] ?? eingabeAusFte(server.get(key)?.fte), [entwurf, server]);
  const offen = useMemo(() => Object.entries(entwurf).filter(([key, v]) => {
    const f = fteAusEingabe(v);
    return f !== undefined && f !== (server.get(key)?.fte ?? null);
  }), [entwurf, server]);

  // Automatisch speichern (I-R3): nach einer Pause alle gültigen offenen Zellen in einem Aufruf
  useEffect(() => {
    if (!darf || konflikt || fehler || speichern.isPending || !offen.length) return;
    const t = setTimeout(() => {
      const zellen: KapazitaetAenderung[] = offen.map(([key, v]) => {
        const [rolle, monat] = key.split('|') as [string, string];
        const vorher = server.get(key);
        return { rolle, monat, fte: fteAusEingabe(v) as number | null, ...(vorher?.version ? { version: vorher.version } : {}) };
      });
      const gesendet = Object.fromEntries(offen);
      speichern.mutate(zellen, {
        onSuccess: neu => {
          qc.setQueryData<Kapazitaet>(ressourcenKeys.kapazitaet(z!.von, z!.bis), alt => {
            if (!alt) return alt;
            const m = new Map(alt.zellen.map(c => [k(c.rolle, c.monat), c]));
            for (const c of neu) {
              if (c.fte === null) m.delete(k(c.rolle, c.monat));
              else m.set(k(c.rolle, c.monat), c);
            }
            return { ...alt, zellen: [...m.values()] };
          });
          // nur Entwürfe entfernen, die seit dem Senden nicht weiter geändert wurden
          setEntwurf(e => Object.fromEntries(Object.entries(e).filter(([key, v]) => gesendet[key] !== v)));
          setGespeichertAt(Date.now());
        },
        onError: e => (isConflict(e) ? setKonflikt(true) : setFehler(e)),
      });
    }, SPEICHERN_NACH);
    return () => clearTimeout(t);
  }, [offen, darf, konflikt, fehler, speichern, server, qc, z]);

  const neuLaden = async () => {
    await daten.refetch();
    setKonflikt(false);
  };

  const setzen = (key: string, v: string) => setEntwurf(e => ({ ...e, [key]: v }));
  const schrittMerken = () => {
    const s = startwert.current;
    if (!s) return;
    const jetzt = wert(s.key);
    if (jetzt !== s.wert) {
      setUndo(u => [...u, { key: s.key, vorher: s.wert, nachher: jetzt }]);
      setRedo([]);
      startwert.current = { key: s.key, wert: jetzt };
    }
  };
  const zurueck = () => {
    schrittMerken();
    setUndo(u => {
      const s = u[u.length - 1];
      if (!s) return u;
      setzen(s.key, s.vorher);
      setRedo(r => [...r, s]);
      if (startwert.current?.key === s.key) startwert.current = { key: s.key, wert: s.vorher };
      return u.slice(0, -1);
    });
  };
  const vor = () => {
    setRedo(r => {
      const s = r[r.length - 1];
      if (!s) return r;
      setzen(s.key, s.nachher);
      setUndo(u => [...u, s]);
      if (startwert.current?.key === s.key) startwert.current = { key: s.key, wert: s.nachher };
      return r.slice(0, -1);
    });
  };

  // Virtualisierung der Zeilen (Q-L5)
  const scroller = useRef<HTMLDivElement>(null);
  const [oben, setOben] = useState(0);
  const [hoehe, setHoehe] = useState(0);
  useLayoutEffect(() => { setHoehe(scroller.current?.clientHeight ?? 0); }, [zeilen.length]);
  const f = fenster(zeilen.length, oben, hoehe);
  const [fokus, setFokus] = useState<{ zeile: number; spalte: number } | null>(null);
  useEffect(() => {
    if (!fokus) return;
    const el = scroller.current?.querySelector<HTMLInputElement>(`[data-zelle="${fokus.zeile}:${fokus.spalte}"]`);
    if (el) { el.focus(); el.select(); setFokus(null); }
  }, [fokus, f.von, f.bis]);
  const gehe = (zeile: number, spalte: number) => {
    if (zeile < 0 || zeile >= zeilen.length) return;
    const s = scroller.current;
    if (s) {
      const kopf = ZEILE;
      if (zeile * ZEILE < s.scrollTop) s.scrollTop = zeile * ZEILE;
      else if ((zeile + 1) * ZEILE + kopf > s.scrollTop + (s.clientHeight || 600)) s.scrollTop = (zeile + 1) * ZEILE + kopf - (s.clientHeight || 600);
      setOben(s.scrollTop);
    }
    setFokus({ zeile, spalte });
  };
  const taste = (zeile: number, spalte: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    const strg = e.ctrlKey || e.metaKey;
    if (strg && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) vor(); else zurueck(); return; }
    if (strg && e.key.toLowerCase() === 'y') { e.preventDefault(); vor(); return; }
    if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); gehe(zeile + 1, spalte); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); gehe(zeile - 1, spalte); }
  };

  const status = speichern.isPending ? TR.speichert
    : offen.length ? TR.ungespeichert(offen.length)
      : gespeichertAt ? <>{TR.gespeichert} <Vor at={gespeichertAt} /></> : null;

  return (
    <section aria-labelledby="page-title" className="res">
      <Kopf reiter="kapazitaet" sub={TR.kapazitaetSub} navigieren={navigieren} zeitraum={z ?? { von: search.von, bis: search.bis }} setZeitraum={n => setSearch(n, { replace: true })}
        aktionen={darf ? (
          <>
            <button type="button" className="btn" onClick={zurueck} disabled={!undo.length && !Object.keys(entwurf).length} title="Strg+Z"><Icon name="reset" />{TR.rueckgaengig}</button>
            <button type="button" className="btn" onClick={vor} disabled={!redo.length} title="Strg+Umschalt+Z"><Icon name="reply" />{TR.wiederholen}</button>
          </>
        ) : null} />
      <div className="body res-body">
        {!z ? <Hinweis stufe="sperre" live>{TR.zeitraumUngueltig}</Hinweis> : null}
        {daten.error || rollen.error ? <ErrorState error={daten.error ?? rollen.error} onRetry={() => { void daten.refetch(); void rollen.refetch(); }} /> : null}
        {skelett ? <Skelett zeilen={8} /> : null}
        {konflikt ? <Hinweis stufe="warnung" live aktion={<button type="button" className="btn" onClick={() => void neuLaden()}>{TR.neuLaden}</button>}>{TR.konflikt}</Hinweis> : null}
        {fehler ? <Hinweis stufe="sperre" live aktion={<button type="button" className="btn" onClick={() => setFehler(null)}>{TR.erneut}</button>}>{TR.fehlerSpeichern}</Hinweis> : null}
        {daten.data && rollen.data && !zeilen.length ? <Empty>{TR.keineRollen}</Empty> : null}
        {daten.data && rollen.data && zeilen.length ? (
          <>
            {darf ? <p className="res-legende">{TR.tastatur} <span className="res-status" role="status" aria-live="polite">{status}</span></p>
              : <Hinweis stufe="hinweis">{TR.nurLesen}</Hinweis>}
            <div className="res-scroll res-raster-scroll" ref={scroller} onScroll={e => setOben(e.currentTarget.scrollTop)}>
              <table className="res-tabelle res-raster" aria-rowcount={zeilen.length + 1} aria-colcount={ms.length + 1}>
                <caption className="sr">{TR.rasterLabel}</caption>
                <thead>
                  <tr aria-rowindex={1}>
                    <th scope="col" className="res-rolle">{TR.rolle}</th>
                    {ms.map(m => <th key={m} scope="col" className="num"><abbr title={monatLang(m)}>{monatKurz(m, T.format.monateKurz)}</abbr></th>)}
                  </tr>
                </thead>
                <tbody>
                  {f.von > 0 ? <tr aria-hidden="true" className="res-platz" style={{ height: f.von * ZEILE }}><td colSpan={ms.length + 1} /></tr> : null}
                  {zeilen.slice(f.von, f.bis).map((r, i) => {
                    const zi = f.von + i;
                    return (
                      <tr key={r.schluessel} aria-rowindex={zi + 2}>
                        <th scope="row" className="res-rolle">{r.label}{r.aktiv ? null : <span className="res-aus"> ({TR.deaktiviert})</span>}</th>
                        {ms.map((m, si) => {
                          const key = k(r.schluessel, m);
                          const v = wert(key);
                          if (!darf) return <td key={m} className="num">{v || '–'}</td>;
                          const ungueltig = fteAusEingabe(v) === undefined;
                          return (
                            <td key={m} className={`res-eingabe${key in entwurf ? ' res-geaendert' : ''}`}>
                              <input type="text" inputMode="decimal" autoComplete="off" data-zelle={`${zi}:${si}`} value={v}
                                aria-label={TR.zelleEingabe(r.label, monatLang(m))} aria-invalid={ungueltig || undefined}
                                title={ungueltig ? TR.ungueltig : undefined}
                                onFocus={() => { startwert.current = { key, wert: v }; }}
                                onBlur={schrittMerken}
                                onChange={e => setzen(key, e.target.value)}
                                onKeyDown={taste(zi, si)} />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {f.bis < zeilen.length ? <tr aria-hidden="true" className="res-platz" style={{ height: (zeilen.length - f.bis) * ZEILE }}><td colSpan={ms.length + 1} /></tr> : null}
                </tbody>
              </table>
            </div>
            {Object.values(entwurf).some(v => fteAusEingabe(v) === undefined) ? <Hinweis stufe="sperre" live>{TR.ungueltig}</Hinweis> : null}
          </>
        ) : null}
      </div>
    </section>
  );
}

/** «gerade eben», «vor 5 s», «vor 2 Min.»; alle 5 s neu. */
function Vor({ at }: { at: number }) {
  const [jetzt, setJetzt] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setJetzt(Date.now()), 5000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.round((jetzt - at) / 1000));
  return <>{s < 5 ? TR.gerade : s < 60 ? TR.vorSekunden(s - (s % 5)) : TR.vorMinuten(Math.floor(s / 60))}</>;
}
