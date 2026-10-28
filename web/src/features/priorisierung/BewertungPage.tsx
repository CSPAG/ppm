/**
 * Seite «Bewertung» (UI-20, Seitentyp Arbeitsfläche; BC PP.02.01, UC-008 Schritte 1–2, K5): Raster Projekte × Kriterien
 * des Bewertungsmodells in Kraft mit «hoch / mittel / tief» je Zelle (A-01), Fortschritt im Kopf, automatisches Speichern
 * (I-R3), Rückgängig/Wiederholen, nur mit Tastatur bedienbar (K5-2: Pfeile, 1/2/3, Entf, Eingabetaste); Projekt mit
 * Kommentaren in der Schublade (`?o=<nummer>`). Frühere Modellversionen lesend (`?modell=<nummer>`, G11). Bewerten erst
 * ab 1024 px (K5 «Mobil»), ohne `priorisierung:write` nur lesen (Z8), Konflikt bei 412 (Z7).
 */
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { isConflict } from '../../api/index.ts';
import { useSession } from '../../auth/index.ts';
import { Empty, ErrorState, fmtDatum, Hinweis, Icon, Skelett, useVerzoegert } from '../../ui/index.ts';
import { priorisierungKeys, useBewertungSpeichern, useModelle, usePortfolios, useRaster, type BewertungAenderung, type Bewertungsraster } from './api.ts';
import { useBreit } from './breite.ts';
import { Kopf, PFAD, type Reiter } from './Kopf.tsx';
import { ProjektDrawer } from './ProjektDrawer.tsx';
import { k, naechster, vollstaendig, wertAusTaste, type Wert } from './raster.ts';
import type { BewertungSearch, SetBewertungSearch } from './search.ts';
import { TP } from './texte.ts';
import './priorisierung.css';

const SPEICHERN_NACH = 600;

interface Zelle { e: Wert; kommentar: string }
interface Schritt { key: string; vorher: Wert; nachher: Wert }

export function BewertungPage({ search, setSearch, navigieren }: { search: BewertungSearch; setSearch: SetBewertungSearch; navigieren(pfad: string): void }) {
  const { can } = useSession();
  const selId = useId();
  const modellSelId = useId();
  const qc = useQueryClient();
  const breit = useBreit();
  const orgLesen = can('priorisierung:read');
  const portfolios = usePortfolios();
  const modelle = useModelle(orgLesen);
  const pf = portfolios.data ? (search.portfolio ? portfolios.data.find(p => p.schluessel === search.portfolio) : portfolios.data[0]) : undefined;
  const frueheres = search.modell ? modelle.data?.items.find(m => String(m.nummer) === search.modell && m.stand === 'in_kraft' && !m.aktuell) : undefined;
  const raster = useRaster(pf?.id ?? null, frueheres?.id);
  const r = raster.data;
  const skelett = useVerzoegert(portfolios.isPending || (!!pf && raster.isPending));

  // Werte des Servers und Entwurf der Oberfläche (noch nicht gespeichert)
  const server = useMemo(() => new Map((r?.bewertungen ?? []).map(b => [k(b.projektId, b.kriterium), b])), [r]);
  const [entwurf, setEntwurf] = useState<Record<string, Zelle>>({});
  const [konflikt, setKonflikt] = useState(false);
  const [fehler, setFehler] = useState<unknown>(null);
  const [gespeichertAt, setGespeichertAt] = useState<number | null>(null);
  const [undo, setUndo] = useState<Schritt[]>([]);
  const [redo, setRedo] = useState<Schritt[]>([]);
  const speichern = useBewertungSpeichern(pf?.id ?? '');
  const darf = !!r?.can.write && breit;

  const zelle = useCallback((key: string): Zelle => entwurf[key] ?? { e: (server.get(key)?.einschaetzung ?? '') as Wert, kommentar: server.get(key)?.kommentar ?? '' }, [entwurf, server]);
  const wert = useCallback((key: string) => zelle(key).e, [zelle]);
  const offen = useMemo(() => Object.entries(entwurf).filter(([key, z]) => {
    const s = server.get(key);
    return z.e !== (s?.einschaetzung ?? '') || (z.e !== '' && z.kommentar !== (s?.kommentar ?? ''));
  }), [entwurf, server]);

  // Automatisch speichern (I-R3): alle offenen Zellen in einem Aufruf
  useEffect(() => {
    if (!darf || !pf || konflikt || fehler || speichern.isPending || !offen.length) return;
    const t = setTimeout(() => {
      const zellen: BewertungAenderung[] = offen.map(([key, z]) => {
        const [projektId, kriterium] = key.split('|') as [string, string];
        const v = server.get(key)?.version;
        return { projektId, kriterium, einschaetzung: z.e === '' ? null : z.e, ...(z.e !== '' ? { kommentar: z.kommentar } : {}), ...(v ? { version: v } : {}) };
      });
      const gesendet = Object.fromEntries(offen.map(([key, z]) => [key, `${z.e}|${z.kommentar}`]));
      speichern.mutate(zellen, {
        onSuccess: neu => {
          qc.setQueryData<Bewertungsraster>(priorisierungKeys.raster(pf.id, ''), alt => {
            if (!alt) return alt;
            const m = new Map(alt.bewertungen.map(b => [k(b.projektId, b.kriterium), b]));
            for (const c of neu) {
              if (c.einschaetzung === null) m.delete(k(c.projektId, c.kriterium));
              else m.set(k(c.projektId, c.kriterium), c);
            }
            const bewertungen = [...m.values()];
            const anzahl = (id: string) => bewertungen.filter(b => b.projektId === id).length;
            return { ...alt, bewertungen, projekte: alt.projekte.map(p => ({ ...p, bewertet: anzahl(p.id) })) };
          });
          setEntwurf(e => Object.fromEntries(Object.entries(e).filter(([key, z]) => gesendet[key] !== `${z.e}|${z.kommentar}`)));
          setGespeichertAt(Date.now());
        },
        onError: e => (isConflict(e) ? setKonflikt(true) : setFehler(e)),
      });
    }, SPEICHERN_NACH);
    return () => clearTimeout(t);
  }, [offen, darf, pf, konflikt, fehler, speichern, server, qc]);

  const setzen = useCallback((key: string, w: Wert, merken = true) => {
    const vorher = zelle(key);
    if (vorher.e === w) return;
    setEntwurf(e => ({ ...e, [key]: { e: w, kommentar: vorher.kommentar } }));
    if (merken) { setUndo(u => [...u, { key, vorher: vorher.e, nachher: w }]); setRedo([]); }
  }, [zelle]);
  const kommentieren = (key: string, text: string) => setEntwurf(e => ({ ...e, [key]: { e: zelle(key).e, kommentar: text } }));
  const zurueck = () => {
    const s = undo[undo.length - 1];
    if (!s) return;
    setzen(s.key, s.vorher, false);
    setUndo(u => u.slice(0, -1));
    setRedo(x => [...x, s]);
  };
  const vor = () => {
    const s = redo[redo.length - 1];
    if (!s) return;
    setzen(s.key, s.nachher, false);
    setRedo(x => x.slice(0, -1));
    setUndo(u => [...u, s]);
  };
  const neuLaden = async () => { await raster.refetch(); setKonflikt(false); };

  // Tastatur im Raster: eine Zelle im Tab-Ablauf (roving tabindex), Pfeile wechseln
  const tabelle = useRef<HTMLTableElement>(null);
  const [aktiv, setAktiv] = useState<{ z: number; s: number }>({ z: 0, s: 0 });
  const kriterien = r?.modell?.kriterien ?? [];
  const projekte = r?.projekte ?? [];
  const fokus = (z: number, s: number) => {
    const zz = Math.max(0, Math.min(projekte.length - 1, z));
    const ss = Math.max(0, Math.min(kriterien.length - 1, s));
    setAktiv({ z: zz, s: ss });
    tabelle.current?.querySelector<HTMLButtonElement>(`[data-zelle="${zz}:${ss}"]`)?.focus();
  };
  const taste = (z: number, s: number, key: string, nummer: string) => (e: KeyboardEvent<HTMLButtonElement>) => {
    const strg = e.ctrlKey || e.metaKey;
    if (strg && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) vor(); else zurueck(); return; }
    if (strg && e.key.toLowerCase() === 'y') { e.preventDefault(); vor(); return; }
    if (strg || e.altKey) return;
    const nach: Record<string, [number, number]> = { ArrowDown: [z + 1, s], ArrowUp: [z - 1, s], ArrowRight: [z, s + 1], ArrowLeft: [z, s - 1], Home: [z, 0], End: [z, kriterien.length - 1] };
    const ziel = nach[e.key];
    if (ziel) { e.preventDefault(); fokus(...ziel); return; }
    if (e.key === 'Enter') { e.preventDefault(); setSearch({ o: nummer }); return; }
    const w = wertAusTaste(e.key);
    if (w !== undefined && darf) { e.preventDefault(); setzen(key, w); }
  };

  const reiter: Reiter[] = orgLesen ? ['bewertung', 'matrix', 'szenarien', 'modell'] : ['bewertung', 'matrix', 'szenarien'];
  const anzahlFertig = r ? vollstaendig(r, wert) : 0;
  const query = new URLSearchParams(pf ? { portfolio: pf.schluessel } : {}).toString();
  const status = speichern.isPending ? TP.speichert : offen.length ? TP.ungespeichert(offen.length) : gespeichertAt ? <>{TP.gespeichert} <Vor at={gespeichertAt} /></> : null;
  const aktuellListe = (modelle.data?.items ?? []).filter(m => m.stand === 'in_kraft');

  return (
    <section aria-labelledby="page-title" className="pr">
      <Kopf reiter="bewertung" reiterSichtbar={reiter} navigieren={navigieren} query={query}
        sub={r?.modell ? <>{TP.fortschritt(anzahlFertig, r.projekte.length)} · {TP.version(r.modell.nummer)}{r.modell.inKraftAt ? `, ${TP.inKraftSeit(fmtDatum(r.modell.inKraftAt))}` : ''}</> : TP.sub}
        aktionen={darf ? (
          <>
            <button type="button" className="btn" onClick={zurueck} disabled={!undo.length} title="Strg+Z"><Icon name="reset" />{TP.rueckgaengig}</button>
            <button type="button" className="btn" onClick={vor} disabled={!redo.length} title="Strg+Umschalt+Z"><Icon name="reply" />{TP.wiederholen}</button>
          </>
        ) : null} />
      <div className="toolbar">
        <label htmlFor={selId} className="pr-l">{TP.portfolio}</label>
        <select id={selId} className="pr-in" value={pf?.schluessel ?? ''} disabled={!portfolios.data?.length}
          onChange={e => { setEntwurf({}); setUndo([]); setRedo([]); setSearch({ portfolio: e.target.value, o: undefined }); }}>
          {(portfolios.data ?? []).map(p => <option key={p.id} value={p.schluessel}>{`${p.kategorie} · ${p.name}`}</option>)}
        </select>
        {aktuellListe.length > 1 ? (
          <>
            <label htmlFor={modellSelId} className="pr-l">{TP.modellVersion}</label>
            <select id={modellSelId} className="pr-in" value={frueheres ? String(frueheres.nummer) : ''} onChange={e => setSearch({ modell: e.target.value || undefined, o: undefined })}>
              {aktuellListe.map(m => <option key={m.id} value={m.aktuell ? '' : String(m.nummer)}>{`${TP.version(m.nummer)}${m.aktuell ? '' : ` (${TP.frueher})`}`}</option>)}
            </select>
          </>
        ) : null}
      </div>
      <div className="body pr-body">
        {portfolios.error || raster.error ? <ErrorState error={portfolios.error ?? raster.error} onRetry={() => { void portfolios.refetch(); void raster.refetch(); }} /> : null}
        {skelett ? <Skelett zeilen={8} /> : null}
        {portfolios.data && !portfolios.data.length ? <Empty>{TP.keinPortfolio}</Empty> : null}
        {portfolios.data && search.portfolio && !pf ? <Empty>{TP.portfolioUnbekannt}</Empty> : null}
        {r && !r.modell ? (
          <Empty action={orgLesen ? <button type="button" className="btn primary" onClick={() => navigieren(PFAD.modell)}>{TP.keinModellAktion}</button> : undefined}>{TP.keinModell}</Empty>
        ) : null}
        {r?.modell && !r.projekte.length ? <Empty>{TP.keineProjekte}</Empty> : null}
        {konflikt ? <Hinweis stufe="warnung" live aktion={<button type="button" className="btn" onClick={() => void neuLaden()}>{TP.neuLaden}</button>}>{TP.konflikt}</Hinweis> : null}
        {fehler ? <Hinweis stufe="sperre" live aktion={<button type="button" className="btn" onClick={() => setFehler(null)}>{TP.erneut}</button>}>{TP.fehlerSpeichern}</Hinweis> : null}
        {r?.modell && r.projekte.length ? (
          <>
            {frueheres ? <Hinweis stufe="hinweis">{TP.frueherLesen(frueheres.nummer)}</Hinweis>
              : !r.can.write ? <Hinweis stufe="hinweis">{TP.nurLesen}</Hinweis>
                : !breit ? <Hinweis stufe="hinweis">{TP.schmal}</Hinweis>
                  : <p className="pr-legende">{TP.tastatur} <span className="pr-status" role="status" aria-live="polite">{status}</span></p>}
            <div className="pr-scroll">
              <table ref={tabelle} className="pr-raster">
                <caption className="sr">{TP.rasterLabel}</caption>
                <thead>
                  <tr>
                    <th scope="col" className="pr-projekt">{TP.projekt}</th>
                    {kriterien.map(c => (
                      <th key={c.schluessel} scope="col" title={c.beschreibung || undefined}>
                        <span className="pr-kt">{c.text}</span>
                        <span className="pr-dim">{c.dimension ? TP.dimension[c.dimension] : TP.ohneDimension}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {projekte.map((p, z) => (
                    <tr key={p.id} className={search.o === p.nummer ? 'cur' : undefined}>
                      <th scope="row" className="pr-projekt">
                        <button type="button" className="pr-pl" onClick={() => setSearch({ o: p.nummer })}>
                          <span className="mono">{p.nummer}</span> {p.name}
                        </button>
                      </th>
                      {kriterien.map((c, s) => {
                        const key = k(p.id, c.schluessel);
                        const w = wert(key);
                        const geaendert = key in entwurf;
                        return (
                          <td key={c.schluessel} className={`pr-zelle pr-${w || 'leer'}${geaendert ? ' pr-geaendert' : ''}`}>
                            <button type="button" data-zelle={`${z}:${s}`} tabIndex={aktiv.z === z && aktiv.s === s ? 0 : -1}
                              aria-label={TP.zelleLabel(`${p.nummer} ${p.name}`, c.text, w ? TP.einschaetzung[w]! : TP.offen)}
                              onFocus={() => setAktiv({ z, s })} onKeyDown={taste(z, s, key, p.nummer)}
                              onClick={() => { if (darf) setzen(key, naechster(w)); }} aria-disabled={!darf || undefined}>
                              {w ? <><span aria-hidden="true" className="pr-kurz">{TP.kurz[w]}</span><span className="pr-wort">{TP.einschaetzung[w]}</span></> : <span className="pr-offen" aria-hidden="true">–</span>}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
      {search.o && r?.modell ? (
        <ProjektDrawer raster={r} nummer={search.o} wert={wert} kommentar={key => zelle(key).kommentar} darf={darf}
          setzen={(key, w) => setzen(key, w)} kommentieren={kommentieren} onClose={() => setSearch({ o: undefined })} />
      ) : null}
    </section>
  );
}

/** «gerade eben», «vor 5 s», «vor 2 Min.»; alle 5 s neu. */
function Vor({ at }: { at: number }) {
  const [jetzt, setJetzt] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setJetzt(Date.now()), 5000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.round((jetzt - at) / 1000));
  return <>{s < 5 ? TP.gerade : s < 60 ? TP.vorSekunden(s - (s % 5)) : TP.vorMinuten(Math.floor(s / 60))}</>;
}
