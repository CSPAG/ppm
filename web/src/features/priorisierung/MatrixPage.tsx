/**
 * Seite «Matrix» (UI-21, Seitentyp Arbeitsfläche; BC PP.03.04, PP.02.02, UC-008 Schritte 3–4, K5): Portfolio-Matrix
 * Nutzen × Risiko mit den Feldern nach Q6 F9, umschaltbar auf Ressourcen × Nutzen, Kreisgrösse = Kosten (nur mit
 * `finanzen:read`, A-33), Abhängigkeiten des gewählten Projekts als Linien, Tabelle als Alternative, «Wie wird das
 * berechnet?» mit der Regel (A-39, ohne Score A-01). Rechts die Rangfolge als Entwurf mit Begründung (Alt+↑/↓) und
 * Warnung bei verletzter Abhängigkeit. Projekt in der Schublade (`?o=<nummer>`) mit Abhängigkeiten; Portfoliorisiken
 * (`?o=risiken`, PC.02.01). Umordnen nur ab 1024 px und mit `priorisierung:write` (K5 «Mobil», Z8), Konflikt bei 412 (Z7).
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { isConflict } from '../../api/index.ts';
import { useSession } from '../../auth/index.ts';
import { Empty, ErrorState, fmtBetragKurz, fmtDateTime, Hinweis, Icon, Skelett, useToast, useVerzoegert } from '../../ui/index.ts';
import { usePortfolios } from './api.ts';
import { useBreit } from './breite.ts';
import { Kopf, type Reiter } from './Kopf.tsx';
import { ausgangsreihenfolge, lage, verletzt, verschieben, type Ansicht } from './matrix.ts';
import { useMatrix, useRangfolge, useRangfolgeSpeichern, type Matrix, type MatrixProjekt } from './matrix-api.ts';
import { MatrixBerechnung, MatrixProjektDrawer, MatrixRisiken } from './MatrixDrawer.tsx';
import { TM } from './matrix-texte.ts';
import type { MatrixSearch, SetMatrixSearch } from './search.ts';
import './priorisierung.css';

const projektName = (p: MatrixProjekt) => `${p.nummer} ${p.name}`;
const fteMonate = (n: number) => `${n.toLocaleString('de-CH', { maximumFractionDigits: 1 })} FTE-Monate`;

/** Position als Text (K5 Barrierefreiheit): «Nutzen hoch, Risiko tief, Feld Rasch umsetzen». */
export function lageText(p: MatrixProjekt, ansicht: Ansicht): string {
  const stufe = (s: string | null) => (s ? TM.stufe[s]! : TM.nichtBewertet);
  const zweite = ansicht === 'risiko' ? TM.risikoText(stufe(p.risiko.stufe))
    : TM.ressourcenText(p.ressourcen.fteMonate !== null ? fteMonate(p.ressourcen.fteMonate) : p.ressourcen.groesse ? `${p.ressourcen.groesse} (${TM.geschaetzt})` : TM.ohneRessourcen);
  return TM.lage(projektName(p), stufe(p.nutzen.stufe), zweite, p.feld ? TM.feldText(TM.felder[p.feld]!) : TM.ohneFeld);
}

export function MatrixPage({ search, setSearch, navigieren }: { search: MatrixSearch; setSearch: SetMatrixSearch; navigieren(pfad: string): void }) {
  const { can } = useSession();
  const selId = useId();
  const breit = useBreit();
  const portfolios = usePortfolios();
  const pf = portfolios.data ? (search.portfolio ? portfolios.data.find(p => p.schluessel === search.portfolio) : portfolios.data[0]) : undefined;
  const matrix = useMatrix(pf?.id ?? null);
  const m = matrix.data;
  const skelett = useVerzoegert(portfolios.isPending || (!!pf && matrix.isPending));
  const ansicht: Ansicht = search.ansicht === 'ressourcen' ? 'ressourcen' : 'risiko';
  const gewaehlt = search.o ? m?.projekte.find(p => p.nummer === search.o) : undefined;
  const reiter: Reiter[] = can('priorisierung:read') ? ['bewertung', 'matrix', 'modell'] : ['bewertung', 'matrix'];
  const query = new URLSearchParams(pf ? { portfolio: pf.schluessel } : {}).toString();
  const oeffnen = (p: MatrixProjekt) => setSearch({ o: p.nummer });

  return (
    <section aria-labelledby="page-title" className="pr">
      <Kopf reiter="matrix" reiterSichtbar={reiter} navigieren={navigieren} query={query}
        sub={m?.modell ? <>{TM.sub} {TM.modell(m.modell.nummer)}</> : TM.sub}
        aktionen={pf ? <button type="button" className="btn" onClick={() => setSearch({ o: 'risiken' })}><Icon name="warn" />{TM.risiken}</button> : null} />
      <div className="toolbar">
        <label htmlFor={selId} className="pr-l">{TM.portfolio}</label>
        <select id={selId} className="pr-in" value={pf?.schluessel ?? ''} disabled={!portfolios.data?.length}
          onChange={e => setSearch({ portfolio: e.target.value, o: undefined })}>
          {(portfolios.data ?? []).map(p => <option key={p.id} value={p.schluessel}>{`${p.kategorie} · ${p.name}`}</option>)}
        </select>
        <div className="seg" role="group" aria-label={TM.ansicht}>
          {(['risiko', 'ressourcen'] as const).map(a => (
            <button key={a} type="button" aria-pressed={ansicht === a} className={ansicht === a ? 'on' : ''}
              onClick={() => setSearch({ ansicht: a === 'ressourcen' ? 'ressourcen' : undefined }, { replace: true })}>{TM.ansichten[a]}</button>
          ))}
        </div>
        <button type="button" className="btn" aria-pressed={!!search.tabelle} onClick={() => setSearch({ tabelle: search.tabelle ? undefined : '1' }, { replace: true })}>
          <Icon name={search.tabelle ? 'graph' : 'table'} />{search.tabelle ? TM.alsMatrix : TM.alsTabelle}
        </button>
        <button type="button" className="btn ghost" onClick={() => setSearch({ o: 'berechnung' })}><Icon name="info" />{TM.berechnung}</button>
      </div>
      <div className="body pr-body">
        {portfolios.error || matrix.error ? <ErrorState error={portfolios.error ?? matrix.error} onRetry={() => { void portfolios.refetch(); void matrix.refetch(); }} /> : null}
        {skelett ? <Skelett zeilen={8} /> : null}
        {portfolios.data && !portfolios.data.length ? <Empty>{TM.keinPortfolio}</Empty> : null}
        {portfolios.data && search.portfolio && !pf ? <Empty>{TM.portfolioUnbekannt}</Empty> : null}
        {m && !m.modell ? <Empty>{TM.keinModell}</Empty> : null}
        {m?.modell && !m.projekte.length ? <Empty>{TM.keineProjekte}</Empty> : null}
        {m?.modell && m.projekte.length ? (
          <div className="mx-layout">
            <div className="mx-haupt">
              {!m.modell.kriterien.some(k => k.dimension === 'nutzen') || !m.modell.kriterien.some(k => k.dimension === 'risiko')
                ? <Hinweis stufe="hinweis">{TM.ohneZuordnung}</Hinweis> : null}
              {search.tabelle ? <MatrixTabelle m={m} gewaehlt={gewaehlt?.id} oeffnen={oeffnen} />
                : <MatrixDiagramm m={m} ansicht={ansicht} gewaehlt={gewaehlt} oeffnen={oeffnen} />}
            </div>
            {pf ? <Rangliste key={pf.id} portfolioId={pf.id} m={m} breit={breit} gewaehlt={gewaehlt?.id} oeffnen={oeffnen} /> : null}
          </div>
        ) : null}
      </div>
      {search.o === 'risiken' && pf ? <MatrixRisiken portfolioId={pf.id} onClose={() => setSearch({ o: undefined })} /> : null}
      {search.o === 'berechnung' ? <MatrixBerechnung m={m} onClose={() => setSearch({ o: undefined })} /> : null}
      {search.o && search.o !== 'risiken' && search.o !== 'berechnung' && m && pf ? (
        <MatrixProjektDrawer m={m} nummer={search.o} portfolioId={pf.id} ansicht={ansicht} lageText={lageText}
          onBewertung={() => navigieren(`/portfolio/priorisierung/bewertung?${new URLSearchParams({ portfolio: pf.schluessel, o: search.o! })}`)}
          onClose={() => setSearch({ o: undefined })} />
      ) : null}
    </section>
  );
}

/** Kreise im Diagramm: gleiche Lage leicht aufgefächert, damit jedes Projekt sichtbar und anklickbar bleibt. */
function punkte(m: Matrix, ansicht: Ansicht) {
  const maxFte = Math.max(0, ...m.projekte.map(p => p.ressourcen.fteMonate ?? 0));
  const maxKosten = Math.max(0, ...m.projekte.map(p => p.kosten ?? 0));
  const gruppen = new Map<string, number>();
  const aussen: MatrixProjekt[] = [];
  const innen: { p: MatrixProjekt; x: number; y: number; r: number; geschaetzt: boolean }[] = [];
  for (const p of m.projekte) {
    const l = lage(p, ansicht, maxFte);
    if (!l || (ansicht === 'risiko' && !p.feld)) { aussen.push(p); continue; }
    const key = `${l.x.toFixed(3)}|${l.y.toFixed(3)}`;
    const n = gruppen.get(key) ?? 0;
    gruppen.set(key, n + 1);
    const winkel = n * 2.4;
    const abstand = n ? 0.06 * Math.sqrt(n) : 0;
    const x = Math.min(1, Math.max(0, l.x + Math.cos(winkel) * abstand));
    const y = Math.min(1, Math.max(0, l.y + Math.sin(winkel) * abstand));
    const r = m.kostenSichtbar && maxKosten > 0 && p.kosten ? 12 + 16 * Math.sqrt(p.kosten / maxKosten) : 14;
    innen.push({ p, x, y, r, geschaetzt: l.geschaetzt });
  }
  return { innen, aussen };
}

function MatrixDiagramm({ m, ansicht, gewaehlt, oeffnen }: { m: Matrix; ansicht: Ansicht; gewaehlt?: MatrixProjekt; oeffnen(p: MatrixProjekt): void }) {
  const { innen, aussen } = useMemo(() => punkte(m, ansicht), [m, ansicht]);
  const pos = new Map(innen.map(i => [i.p.id, i]));
  // Linien des gewählten Projekts: was es braucht und wer es braucht
  const linien = gewaehlt ? [
    ...gewaehlt.abhaengigVon.map(b => [gewaehlt.id, b] as const),
    ...m.projekte.filter(p => p.abhaengigVon.includes(gewaehlt.id)).map(p => [p.id, gewaehlt.id] as const),
  ].filter(([a, b]) => pos.has(a) && pos.has(b)) : [];
  const titel = TM.diagramm(TM.ansichten[ansicht]);
  return (
    <figure className="mx-fig" aria-label={titel}>
      <div className="mx-achse-y" aria-hidden="true">{TM.achse.nutzen} →</div>
      <div className="mx-flaeche">
        {ansicht === 'risiko' ? (
          <div className="mx-felder" aria-hidden="true">
            <div className="mx-feld mx-rasch">{TM.felder.rasch_umsetzen}</div>
            <div className="mx-feld mx-prio">{TM.felder.priorisieren}</div>
            <div className="mx-feld mx-opp">{TM.felder.opportunistisch}</div>
            <div className="mx-feld mx-hint">{TM.felder.hinterfragen}</div>
          </div>
        ) : <div className="mx-felder mx-raster" aria-hidden="true" />}
        <div className="mx-innen">
          <svg className="mx-linien" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs><marker id="mx-pfeil" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" /></marker></defs>
            {linien.map(([a, b]) => {
              const pa = pos.get(a)!, pb = pos.get(b)!;
              return <line key={`${a}-${b}`} x1={pa.x * 100} y1={100 - pa.y * 100} x2={pb.x * 100} y2={100 - pb.y * 100} markerEnd="url(#mx-pfeil)" vectorEffect="non-scaling-stroke" />;
            })}
          </svg>
          <ul className="mx-punkte" aria-label={titel}>
            {innen.map(({ p, x, y, r, geschaetzt }) => (
              <li key={p.id} style={{ left: `${x * 100}%`, bottom: `${y * 100}%` }}>
                <button type="button" className={`mx-punkt${gewaehlt?.id === p.id ? ' on' : ''}${geschaetzt ? ' mx-geschaetzt' : ''}`}
                  style={{ width: r * 2, height: r * 2 }} aria-label={lageText(p, ansicht)} aria-current={gewaehlt?.id === p.id || undefined}
                  title={lageText(p, ansicht)} onClick={() => oeffnen(p)}>
                  <span aria-hidden="true">{p.rangEntwurf ?? p.rang ?? ''}</span>
                </button>
                <span className="mx-name" aria-hidden="true">{p.nummer}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mx-achse-x" aria-hidden="true">{ansicht === 'risiko' ? TM.achse.risiko : TM.achse.ressourcen} →</div>
      <figcaption className="pr-legende">
        {m.kostenSichtbar ? TM.kreisKosten : TM.kreisOhneKosten}
        {aussen.length ? (
          <span className="mx-aussen"> {TM.nichtEingeordnet(aussen.length)}: {aussen.map((p, i) => (
            <span key={p.id}>{i ? ', ' : ''}<button type="button" className="linkbtn" onClick={() => oeffnen(p)} aria-label={lageText(p, ansicht)}>{p.nummer}</button></span>
          ))}. {TM.nichtEingeordnetGrund}</span>
        ) : null}
      </figcaption>
    </figure>
  );
}

function MatrixTabelle({ m, gewaehlt, oeffnen }: { m: Matrix; gewaehlt?: string; oeffnen(p: MatrixProjekt): void }) {
  const achse = (a: MatrixProjekt['nutzen']) => (a.stufe ? `${TM.stufe[a.stufe]} (${a.wert!.toLocaleString('de-CH', { maximumFractionDigits: 2 })})` : TM.nichtBewertet);
  const s = TM.spalten;
  return (
    <div className="pr-scroll">
      <table className="pr-tab mx-tab">
        <caption className="sr">{TM.tabelle}</caption>
        <thead><tr>
          <th scope="col">{s.rang}</th><th scope="col">{s.projekt}</th><th scope="col">{s.phase}</th><th scope="col">{s.nutzen}</th>
          <th scope="col">{s.risiko}</th><th scope="col">{s.feld}</th><th scope="col">{s.ressourcen}</th>{m.kostenSichtbar ? <th scope="col" className="num">{s.kosten}</th> : null}
        </tr></thead>
        <tbody>
          {m.projekte.map(p => (
            <tr key={p.id} className={gewaehlt === p.id ? 'cur' : undefined}>
              <td>{p.rangEntwurf ?? p.rang ?? <span className="empty">–</span>}</td>
              <th scope="row"><button type="button" className="linkbtn" onClick={() => oeffnen(p)}><span className="mono">{p.nummer}</span> {p.name}</button></th>
              <td>{p.phase}</td>
              <td>{achse(p.nutzen)}</td>
              <td>{achse(p.risiko)}</td>
              <td>{p.feld ? TM.felder[p.feld] : <span className="empty">{TM.ohneFeld}</span>}</td>
              <td>{p.ressourcen.fteMonate !== null ? fteMonate(p.ressourcen.fteMonate) : p.ressourcen.groesse ? `${p.ressourcen.groesse} (${TM.geschaetzt})` : <span className="empty">–</span>}</td>
              {m.kostenSichtbar ? <td className="num">{p.kosten !== null ? fmtBetragKurz(p.kosten) : '–'}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Rangfolge als Entwurf (PP.02.02): Liste mit Alt+↑/↓, Begründung je Projekt, Speichern mit If-Match. */
function Rangliste({ portfolioId, m, breit, gewaehlt, oeffnen }: { portfolioId: string; m: Matrix; breit: boolean; gewaehlt?: string; oeffnen(p: MatrixProjekt): void }) {
  const toast = useToast();
  const rf = useRangfolge(portfolioId);
  const speichern = useRangfolgeSpeichern(portfolioId);
  const darf = !!rf.data?.item.can.write && breit;
  const basis = useMemo(() => ausgangsreihenfolge(m.projekte), [m.projekte]);
  const basisBegruendung = useMemo(() => Object.fromEntries((rf.data?.item.entwurf ?? []).map(e => [e.projektId, e.begruendung])), [rf.data]);
  const [liste, setListe] = useState<string[] | null>(null);
  const [begruendung, setBegruendung] = useState<Record<string, string>>({});
  const [ansage, setAnsage] = useState('');
  const [konflikt, setKonflikt] = useState(false);
  const ol = useRef<HTMLOListElement>(null);
  const reihenfolge = liste ?? basis;
  const projekt = useMemo(() => new Map(m.projekte.map(p => [p.id, p])), [m.projekte]);
  const geaendert = liste !== null || Object.keys(begruendung).length > 0;
  const fehler = verletzt(reihenfolge, m.projekte);
  const fokusNach = useRef<string | null>(null);

  useEffect(() => {
    if (!fokusNach.current) return;
    ol.current?.querySelector<HTMLButtonElement>(`[data-griff="${fokusNach.current}"]`)?.focus();
    fokusNach.current = null;
  });

  const bewegen = (i: number, schritt: -1 | 1) => {
    const neu = verschieben(reihenfolge, i, schritt);
    if (neu[i] === reihenfolge[i]) return;
    const id = reihenfolge[i]!;
    setListe(neu);
    fokusNach.current = id;
    setAnsage(TM.angesagt(projektName(projekt.get(id)!), neu.indexOf(id) + 1));
  };
  const taste = (i: number) => (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!e.altKey || !darf) return;
    if (e.key === 'ArrowUp') { e.preventDefault(); bewegen(i, -1); }
    if (e.key === 'ArrowDown') { e.preventDefault(); bewegen(i, 1); }
  };
  const verwerfen = () => { setListe(null); setBegruendung({}); };
  const sichern = () => {
    if (!rf.data) return;
    const projekte = reihenfolge.map(projektId => ({ projektId, begruendung: begruendung[projektId] ?? basisBegruendung[projektId] ?? '' }));
    speichern.mutate({ etag: rf.data.etag, projekte }, {
      onSuccess: () => { verwerfen(); toast.show(TM.gespeichert); },
      onError: e => (isConflict(e) ? setKonflikt(true) : toast.error(e)),
    });
  };
  const neuLaden = async () => { await rf.refetch(); verwerfen(); setKonflikt(false); };
  const item = rf.data?.item;

  return (
    <aside className="mx-rang" aria-labelledby="mx-rang-t">
      <h2 id="mx-rang-t">{TM.rangfolge}</h2>
      <p className="pr-hint">{item?.geaendertAt ? TM.rangfolgeEntwurf(fmtDateTime(item.geaendertAt)) : TM.rangfolgeOhneEntwurf}</p>
      {rf.error ? <ErrorState error={rf.error} onRetry={() => void rf.refetch()} /> : null}
      {item && !item.can.write ? <Hinweis stufe="hinweis">{TM.nurLesen}</Hinweis> : item && !breit ? <Hinweis stufe="hinweis">{TM.schmal}</Hinweis> : darf ? <p className="pr-hint">{TM.rangfolgeHinweis}</p> : null}
      {konflikt ? <Hinweis stufe="warnung" live aktion={<button type="button" className="btn" onClick={() => void neuLaden()}>{TM.neuLaden}</button>}>{TM.konflikt}</Hinweis> : null}
      {fehler.map(f => (
        <Hinweis key={`${f.projekt}-${f.braucht}`} stufe="warnung">{TM.abhaengigkeitVerletzt(projektName(projekt.get(f.projekt)!), projektName(projekt.get(f.braucht)!))}</Hinweis>
      ))}
      <p className="sr" role="status" aria-live="polite">{ansage}</p>
      <ol ref={ol} className="mx-liste">
        {reihenfolge.map((id, i) => {
          const p = projekt.get(id)!;
          const warnung = fehler.some(f => f.projekt === id);
          const text = begruendung[id] ?? basisBegruendung[id] ?? '';
          return (
            <li key={id} className={`${gewaehlt === id ? 'cur' : ''}${warnung ? ' mx-warn' : ''}`}>
              <span className="mx-nr" aria-hidden="true">{i + 1}</span>
              <div className="mx-zeile">
                <button type="button" className="linkbtn mx-pn" data-griff={id} onKeyDown={taste(i)} onClick={() => oeffnen(p)}
                  aria-label={`${TM.rang(i + 1)}: ${projektName(p)}${warnung ? ` (${TM.abhaengigkeiten})` : ''}`}>
                  <span className="mono">{p.nummer}</span> {p.name}
                </button>
                {darf ? (
                  <span className="mx-pfeile">
                    <button type="button" className="iconbtn" aria-label={TM.hinauf(projektName(p))} disabled={i === 0} onClick={() => bewegen(i, -1)}><Icon name="up" /></button>
                    <button type="button" className="iconbtn" aria-label={TM.hinunter(projektName(p))} disabled={i === reihenfolge.length - 1} onClick={() => bewegen(i, 1)}><Icon name="down" /></button>
                  </span>
                ) : null}
              </div>
              {darf ? (
                <input className="mx-begr" aria-label={TM.begruendungFuer(projektName(p))} placeholder={TM.begruendung} maxLength={1000} value={text}
                  onChange={e => setBegruendung(b => ({ ...b, [id]: e.target.value }))} />
              ) : text ? <p className="pr-hint">{text}</p> : null}
            </li>
          );
        })}
      </ol>
      {darf ? (
        <div className="pr-akt">
          <button type="button" className="btn primary" disabled={!geaendert || speichern.isPending || konflikt} onClick={sichern}>{TM.speichern}</button>
          {geaendert ? <button type="button" className="btn" onClick={verwerfen}>{TM.verwerfen}</button> : null}
          {geaendert ? <span className="pr-status" role="status">{TM.ungespeichert}</span> : null}
        </div>
      ) : null}
    </aside>
  );
}
