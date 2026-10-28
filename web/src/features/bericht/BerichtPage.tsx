/**
 * Statusbericht erfassen (UI-13, BC PS.01.01, UC-004, Kernablauf K1; Seitentyp Arbeitsfläche): Kopf mit Periode, Phase,
 * Abschluss per, nächstem Meilenstein und Vorperiode; Abschnitte in fester Reihenfolge (Meilensteine, Kosten, Risiken,
 * Kommunikation, KPIs, Beurteilung), alles aus Vorperiode und Registern vorausgefüllt ausser Status und Trend (K1
 * Entscheid); rechts das Seitenpanel «Bereit zum Einreichen» (I-P4) mit Sprung zur fehlenden Angabe. Automatisches
 * Speichern (I-R3), Einreichen mit Rückgängig 10 s (G6), danach nur lesbar (Z8); abgeschlossene Periode gesperrt (Z9).
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useIamConfig } from '@vollholz/iam-web';
import { ApiError, isConflict } from '../../api/index.ts';
import {
  Empty, ErrorState, type Phase, fmtAbweichungWochen, fmtBetragKurz, fmtDatum, fmtPeriode, fmtPhase, fmtProzent, Hinweis, Icon, Skelett, Status, T,
  useToast, useVerzoegert,
} from '../../ui/index.ts';
import {
  useAenderungMoeglich, useBericht, useKosten, useKpis, useKpiWerte, useKpiWertSetzen, useMeilensteine, useProjekt, useRegisterAendern, useRisiken, useSpeichern,
  useToleranzen, useUebergang, type Bericht, type BerichtPut, type Kosten, type Kpi, type Meilenstein, type Toleranz,
} from './api.ts';
import { TB } from './texte.ts';
import './bericht.css';

const DIMENSIONEN = ['inhalt', 'termin', 'ressourcen', 'budget'] as const;
const STUFEN = ['keine', 'gering', 'wesentlich'] as const;
const TRENDS = ['aufwaerts', 'gleichbleibend', 'abwaerts'] as const;
const PHASEN = ['P0', 'P1', 'P2', 'P3', 'P4'];
const RUECKGAENGIG_MS = 10_000;
const SPEICHERN_NACH_MS = 600;

type Felder = Required<BerichtPut>;
const FELDER: (keyof Felder)[] = ['anlass', 'status', 'trend', 'abschlussPer', 'naechsterMeilenstein', 'abweichung', 'abhaengigkeiten', 'entscheide', 'begruendung', 'massnahme', 'entscheidNoetig'];
const felderVon = (b: Bericht): Felder => Object.fromEntries(FELDER.map(k => [k, b[k]])) as Felder;

/** Feld-ID für den Sprung aus dem Seitenpanel (`abweichung.budget` → `b-abweichung-budget`). */
const feldId = (feld: string) => `b-${feld.replace('.', '-')}`;

const heute = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });
const tageZwischen = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
const plusMonate = (d: string, n: number) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCMonth(t.getUTCMonth() + n); return t.toISOString().slice(0, 10); };
const periodeEnde = (p: string) => { const [j, m] = p.split('-').map(Number) as [number, number]; return new Date(Date.UTC(j, m, 0)).toISOString().slice(0, 10); };
const toleranz = (t: Toleranz[] | undefined, d: Toleranz['dimension']) => t?.find(x => x.dimension === d)?.wert ?? null;
const statusUi = (s: string | null) => (s === 'kritisch' ? 'kritisch' : 'im-plan') as 'kritisch' | 'im-plan';

function Abschnitt({ id, titel, kurz, children }: { id: string; titel: string; kurz?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grp sb-abschnitt">
      <h2 id={id} className="grp-h">{titel}{kurz ? <span className="muted small sb-kurz"> · {kurz}</span> : null}</h2>
      {children}
    </section>
  );
}

/** Meilensteine (UC-004 Schritt 2): überfällige und die der nächsten drei Monate; erreicht melden oder neuer Termin. */
/**
 * «Änderung beantragen» an der Warnung «wesentliche Abweichung» (UC-004 A1, K1 Schritt 2): öffnet den Vertrag mit dem
 * Dialog des Änderungsantrags (UC-007 Schritt 1); nur, wenn die Person ihn jetzt stellen darf. Der Bericht bleibt als
 * Entwurf erhalten (automatisch gespeichert); der Wechsel geschieht in der App, laufende Speicherungen brechen nicht ab.
 */
function AenderungBeantragen({ nummer, projektId }: { nummer: string; projektId: string }) {
  const { router: { Link } } = useIamConfig();
  if (!useAenderungMoeglich(projektId)) return null;
  return <Link to={`/projekte/${encodeURIComponent(nummer)}/vertrag?aenderung=1`} className="btn sm"><Icon name="edit" />{TB.wesentlich.beantragen}</Link>;
}

function Meilensteine({ nummer, projektId, bearbeitbar, toleranzTage }: { nummer: string; projektId: string; bearbeitbar: boolean; toleranzTage: number | null }) {
  const q = useMeilensteine(projektId);
  const aendern = useRegisterAendern(projektId, 'meilensteine');
  const toast = useToast();
  const h = heute(), bis = plusMonate(h, 3);
  const liste = (q.data?.items ?? []).filter(m => m.art === 'meilenstein' && !m.erreichtAm && (m.terminAktuell ?? m.terminBaseline ?? h) <= bis);
  const setzen = (m: Meilenstein, body: Record<string, unknown>) => aendern.mutate({ eintrag: m, body }, { onError: e => toast.error(e) });
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (!liste.length) return <p className="empty">{TB.meilenstein.leer}</p>;
  return (
    <ul className="sb-zeilen">
      {liste.map(m => {
        const termin = m.terminAktuell ?? m.terminBaseline;
        const tage = m.terminBaseline && termin ? tageZwischen(m.terminBaseline, termin) : 0;
        const wesentlich = toleranzTage !== null && tage > toleranzTage;
        return (
          <li key={m.id} className="sb-zeile">
            <div className="sb-zeile-k">
              <span className="sb-text">{m.text}</span>
              <span className="muted small">
                {TB.meilenstein.termin} {termin ? fmtDatum(termin) : '–'}
                {termin && termin < h ? <> · <strong>{TB.meilenstein.ueberfaellig}</strong></> : null}
                {tage ? <> · <span className={wesentlich ? 'sb-warn' : ''}>{TB.meilenstein.abweichung(fmtAbweichungWochen(Math.round(tage / 7)))}</span></> : null}
              </span>
            </div>
            {bearbeitbar ? (
              <div className="sb-zeile-a">
                <label className="sr" htmlFor={`ms-${m.id}`}>{TB.meilenstein.terminVon(m.text)}</label>
                <input id={`ms-${m.id}`} type="date" className="sb-in" defaultValue={m.terminAktuell ?? ''}
                  onBlur={e => { if (e.target.value && e.target.value !== m.terminAktuell) setzen(m, { terminAktuell: e.target.value }); }} />
                <button type="button" className="btn sm" aria-label={TB.meilenstein.erreichtMelden(m.text)} onClick={() => setzen(m, { erreichtAm: h })}>
                  <Icon name="check" />{TB.meilenstein.erreicht}
                </button>
              </div>
            ) : null}
            {wesentlich && termin && m.terminBaseline ? (
              <div className="sb-zeile-w">
                <Hinweis stufe="warnung" live aktion={<AenderungBeantragen nummer={nummer} projektId={projektId} />}>
                  {TB.wesentlich.termin(m.text, fmtDatum(termin), fmtDatum(m.terminBaseline), fmtAbweichungWochen(Math.round(tage / 7)))}
                </Hinweis>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Kosten (UC-004 Schritt 3): je Phase Budget, Ist und Prognose; die Person ändert nur die Prognose. */
function KostenAbschnitt({ nummer, projektId, bearbeitbar, toleranzProzent }: { nummer: string; projektId: string; bearbeitbar: boolean; toleranzProzent: number | null }) {
  const q = useKosten(projektId);
  const aendern = useRegisterAendern(projektId, 'kosten');
  const toast = useToast();
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (q.data?.gesperrt) return <p className="empty">{TB.kosten.keinRecht}</p>;
  const items = q.data?.items ?? [];
  if (!items.length) return <p className="empty">{TB.kosten.leer}</p>;
  const phasen = PHASEN.filter(p => items.some(k => k.phase === p));
  const summe = (l: Kosten[], f: (k: Kosten) => number | null | undefined) => l.reduce((s, k) => s + (f(k) ?? 0), 0);
  return (
    <div className="sb-kosten">
      {phasen.map(p => {
        const l = items.filter(k => k.phase === p);
        const budget = summe(l, k => k.budgetBaseline), prognose = summe(l, k => k.prognose ?? k.budgetBaseline);
        const pct = budget ? ((prognose - budget) / budget) * 100 : null;
        const diff = pct === null ? TB.kosten.ohneBudget : Math.round(pct) === 0 ? TB.kosten.imBudget : pct > 0 ? TB.kosten.ueber(fmtProzent(pct, { vorzeichen: false })) : TB.kosten.unter(fmtProzent(-pct, { vorzeichen: false }));
        const wesentlich = toleranzProzent !== null && pct !== null && pct > toleranzProzent;
        return (
          <div key={p} className="sb-phase">
            <h3 className="sb-h3">{fmtPhase(p as Phase)}</h3>
            <table className="sb-tab">
              <thead><tr><th scope="col">{TB.kosten.budget}</th><th scope="col">{TB.kosten.ist}</th><th scope="col">{TB.kosten.prognose}</th></tr></thead>
              <tbody>
                {l.map(k => (
                  <tr key={k.id}>
                    <td><span className="sb-text">{k.text}</span><br /><span className="muted small">{k.budgetBaseline != null ? fmtBetragKurz(k.budgetBaseline) : '–'}</span></td>
                    <td>{k.ist != null ? fmtBetragKurz(k.ist) : <span className="muted small">{TB.kosten.istFehlt}</span>}</td>
                    <td>
                      {bearbeitbar ? (
                        <><label className="sr" htmlFor={`k-${k.id}`}>{TB.kosten.prognoseVon(k.text)}</label>
                          <input id={`k-${k.id}`} className="sb-in sb-betrag" inputMode="decimal" defaultValue={k.prognose ?? ''}
                            onBlur={e => {
                              const v = e.target.value.trim() === '' ? null : Number(e.target.value.replace(/['’\s]/g, '').replace(',', '.'));
                              if (v !== (k.prognose ?? null) && (v === null || Number.isFinite(v))) aendern.mutate({ eintrag: k, body: { prognose: v } }, { onError: er => toast.error(er) });
                            }} /></>
                      ) : (k.prognose != null ? fmtBetragKurz(k.prognose) : '–')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={`small sb-summe${wesentlich ? ' sb-warn' : ''}`} aria-live="polite">{TB.kosten.summe(p, fmtBetragKurz(prognose), diff)}</p>
            {wesentlich && pct !== null ? (
              <Hinweis stufe="warnung" aktion={<AenderungBeantragen nummer={nummer} projektId={projektId} />}>{TB.wesentlich.kosten(p, fmtProzent(pct, { vorzeichen: false }))}</Hinweis>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Risiken (UC-004 Schritt 4, PC.02.03): Massnahme und deren Stand. */
function RisikenAbschnitt({ projektId, bearbeitbar }: { projektId: string; bearbeitbar: boolean }) {
  const q = useRisiken(projektId);
  const aendern = useRegisterAendern(projektId, 'risiken');
  const toast = useToast();
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const items = q.data?.items ?? [];
  if (!items.length) return <p className="empty">{TB.risiko.leer}</p>;
  return (
    <ul className="sb-zeilen">
      {items.map(r => (
        <li key={r.id} className="sb-zeile">
          <div className="sb-zeile-k">
            <span className="sb-text">{r.text}</span>
            <span className="muted small">{TB.risiko.ewaw(r.wahrscheinlichkeit, r.auswirkung)} · {TB.risiko.massnahme}: {r.massnahme || TB.risiko.keineMassnahme}</span>
          </div>
          <label className="sb-check">
            <input type="checkbox" checked={r.massnahmeStand === 'umgesetzt'} disabled={!bearbeitbar || !r.massnahme}
              aria-label={TB.risiko.umgesetzt(r.text)}
              onChange={e => aendern.mutate({ eintrag: r, body: { massnahmeStand: e.target.checked ? 'umgesetzt' : 'offen' } }, { onError: er => toast.error(er) })} />
            {TB.risiko.stand[r.massnahmeStand]}
          </label>
        </li>
      ))}
    </ul>
  );
}

/** Kommunikation (UC-004 Schritt 5, PS.05.03): in der Periode fällige Massnahmen mit «erledigt». */
function Kommunikation({ projektId, periode, bearbeitbar }: { projektId: string; periode: string; bearbeitbar: boolean }) {
  const q = useMeilensteine(projektId);
  const aendern = useRegisterAendern(projektId, 'meilensteine');
  const toast = useToast();
  const ende = periodeEnde(periode);
  const liste = (q.data?.items ?? []).filter(m => m.art === 'kommunikation' && (m.terminAktuell ?? m.terminBaseline ?? ende) <= ende && (!m.erreichtAm || m.erreichtAm.slice(0, 7) === periode));
  if (!liste.length) return <p className="empty">{TB.kommunikation.leer}</p>;
  return (
    <ul className="sb-zeilen">
      {liste.map(m => (
        <li key={m.id} className="sb-zeile">
          <label className="sb-check">
            <input type="checkbox" checked={!!m.erreichtAm} disabled={!bearbeitbar} aria-label={TB.kommunikation.erledigt(m.text)}
              onChange={e => aendern.mutate({ eintrag: m, body: { erreichtAm: e.target.checked ? heute() : null } }, { onError: er => toast.error(er) })} />
            <span className="sb-text">{m.text}</span>
          </label>
          <span className="muted small">{[m.adressat, (m.terminAktuell ?? m.terminBaseline) ? fmtDatum((m.terminAktuell ?? m.terminBaseline)!) : ''].filter(Boolean).join(' · ')}</span>
        </li>
      ))}
    </ul>
  );
}

function KpiZeile({ projektId, periode, kpi, bearbeitbar }: { projektId: string; periode: string; kpi: Kpi; bearbeitbar: boolean }) {
  const werte = useKpiWerte(projektId, kpi.id);
  const setzen = useKpiWertSetzen(projektId, periode);
  const toast = useToast();
  const liste = werte.data ?? [];
  const jetzt = liste.find(w => w.periode === periode);
  const letzter = liste.filter(w => w.periode < periode).sort((a, b) => b.periode.localeCompare(a.periode))[0];
  return (
    <li className="sb-zeile">
      <div className="sb-zeile-k">
        <span className="sb-text">{kpi.text}</span>
        <span className="muted small">{TB.kpi.ziel} {kpi.zielwert || '–'} {kpi.einheit} · {TB.kpi.letzter} {letzter ? `${letzter.wert} (${fmtPeriode(letzter.periode)})` : TB.kpi.keiner}</span>
      </div>
      {bearbeitbar ? (
        <div className="sb-zeile-a">
          <label className="sr" htmlFor={`kpi-${kpi.id}`}>{TB.kpi.neu(kpi.text)}</label>
          <input id={`kpi-${kpi.id}`} className="sb-in sb-betrag" inputMode="decimal" defaultValue={jetzt?.wert ?? ''}
            onBlur={e => {
              const v = Number(e.target.value.replace(',', '.'));
              if (e.target.value.trim() && Number.isFinite(v) && v !== jetzt?.wert) setzen.mutate({ kpiId: kpi.id, wert: v, version: jetzt?.version ?? 0 }, { onError: er => toast.error(er) });
            }} />
        </div>
      ) : null}
    </li>
  );
}

/** KPIs (UC-004 Schritt 6, PC.03.03): ab P2 je KPI Zielwert, letzter Ist-Wert und neuer Ist-Wert. */
function Kpis({ projektId, periode, bearbeitbar }: { projektId: string; periode: string; bearbeitbar: boolean }) {
  const q = useKpis(projektId, true);
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const items = q.data?.items ?? [];
  if (!items.length) return <p className="empty">{TB.kpi.leer}</p>;
  return <ul className="sb-zeilen">{items.map(k => <KpiZeile key={k.id} projektId={projektId} periode={periode} kpi={k} bearbeitbar={bearbeitbar} />)}</ul>;
}

/** Beurteilung (UC-004 Schritt 7, A2): Status und Trend bewusst gewählt, Abweichung je Dimension, «kritisch» mit Pflichtfeldern. */
function Beurteilung({ f, setze, vor, bearbeitbar }: { f: Felder; setze: (p: Partial<Felder>) => void; vor: Bericht['vorperiode']; bearbeitbar: boolean }) {
  const id = useId();
  const dis = !bearbeitbar;
  const text = (k: 'naechsterMeilenstein' | 'abhaengigkeiten' | 'entscheide' | 'begruendung' | 'massnahme', label: string, zeilen = 2) => (
    <div className="field">
      <label htmlFor={feldId(k)}>{label}</label>
      {zeilen === 1
        ? <input id={feldId(k)} className="sb-in" value={f[k]} disabled={dis} maxLength={500} onChange={e => setze({ [k]: e.target.value })} />
        : <textarea id={feldId(k)} value={f[k]} disabled={dis} rows={zeilen} maxLength={4000} onChange={e => setze({ [k]: e.target.value })} />}
    </div>
  );
  return (
    <div className="sb-beurteilung">
      <div className="sb-wahl">
        <fieldset className="sb-gruppe" id={feldId('status')} tabIndex={-1}>
          <legend>{TB.beurteilung.status}</legend>
          {(['im_plan', 'kritisch'] as const).map(s => (
            <label key={s} className="sb-radio">
              <input type="radio" name={`${id}-status`} value={s} checked={f.status === s} disabled={dis}
                onChange={() => setze({ status: s, ...(s === 'im_plan' ? { entscheidNoetig: false } : {}) })} />
              {TB.beurteilung.statusWerte[s]}
            </label>
          ))}
          {vor?.status ? <span className="muted small">{TB.beurteilung.vorperiode(TB.beurteilung.statusWerte[vor.status] ?? vor.status)}</span> : null}
        </fieldset>
        <fieldset className="sb-gruppe" id={feldId('trend')} tabIndex={-1}>
          <legend>{TB.beurteilung.trend}</legend>
          {TRENDS.map(t => (
            <label key={t} className="sb-radio">
              <input type="radio" name={`${id}-trend`} value={t} checked={f.trend === t} disabled={dis} onChange={() => setze({ trend: t })} />
              {TB.beurteilung.trendWerte[t]}
            </label>
          ))}
          {vor?.trend ? <span className="muted small">{TB.beurteilung.vorperiode(TB.beurteilung.trendWerte[vor.trend] ?? vor.trend)}</span> : null}
        </fieldset>
      </div>
      {f.status === 'kritisch' ? (
        <div className="sb-kritisch">
          {!f.begruendung.trim() || !f.massnahme.trim() ? <Hinweis stufe="sperre" live>{TB.beurteilung.kritischHinweis}</Hinweis> : null}
          {text('begruendung', TB.beurteilung.begruendung, 3)}
          {text('massnahme', TB.beurteilung.massnahme, 3)}
          <label className="sb-check">
            <input type="checkbox" checked={f.entscheidNoetig} disabled={dis} onChange={e => setze({ entscheidNoetig: e.target.checked })} />
            {TB.beurteilung.entscheidNoetig}
          </label>
          <p className="muted small">{TB.beurteilung.wirkungKritisch}</p>
        </div>
      ) : null}
      <h3 className="sb-h3">{TB.beurteilung.abweichung}</h3>
      <div className="sb-dims">
        {DIMENSIONEN.map(d => (
          <div key={d} className="sb-dim">
            <label htmlFor={feldId(`abweichung.${d}`)}>{TB.beurteilung.dimension[d]}</label>
            <select id={feldId(`abweichung.${d}`)} className="sb-in" value={f.abweichung[d].stufe ?? ''} disabled={dis}
              onChange={e => setze({ abweichung: { ...f.abweichung, [d]: { ...f.abweichung[d], stufe: e.target.value || null } } })}>
              <option value="">{TB.beurteilung.stufeWaehlen}</option>
              {STUFEN.map(s => <option key={s} value={s}>{TB.beurteilung.stufen[s]}</option>)}
            </select>
            <label className="sr" htmlFor={`${feldId(`abweichung.${d}`)}-k`}>{TB.beurteilung.kommentar(TB.beurteilung.dimension[d]!)}</label>
            <input id={`${feldId(`abweichung.${d}`)}-k`} className="sb-in" value={f.abweichung[d].kommentar} disabled={dis} maxLength={2000}
              placeholder={TB.beurteilung.kommentar(TB.beurteilung.dimension[d]!)}
              onChange={e => setze({ abweichung: { ...f.abweichung, [d]: { ...f.abweichung[d], kommentar: e.target.value } } })} />
          </div>
        ))}
      </div>
      {text('naechsterMeilenstein', TB.beurteilung.naechster, 1)}
      <div className="field">
        <label htmlFor={feldId('abschlussPer')}>{TB.beurteilung.abschlussPer}</label>
        <input id={feldId('abschlussPer')} type="date" className="sb-in" value={f.abschlussPer ?? ''} disabled={dis} onChange={e => setze({ abschlussPer: e.target.value || null })} />
      </div>
      {text('abhaengigkeiten', TB.beurteilung.abhaengigkeiten)}
      {text('entscheide', TB.beurteilung.entscheide)}
    </div>
  );
}

/** Fehlende Angaben in der Reihenfolge der Maske; lokal berechnet wie der Server (Seitenpanel vor dem Einreichen, I-P3). */
function fehlend(f: Felder): { feld: string; text: string }[] {
  const l: { feld: string; text: string }[] = [];
  for (const d of DIMENSIONEN) if (!f.abweichung[d].stufe) l.push({ feld: `abweichung.${d}`, text: `${TB.beurteilung.abweichung} ${TB.beurteilung.dimension[d]}` });
  if (!f.status) l.push({ feld: 'status', text: TB.beurteilung.status });
  if (!f.trend) l.push({ feld: 'trend', text: TB.beurteilung.trend });
  if (f.status === 'kritisch') {
    if (!f.begruendung.trim()) l.push({ feld: 'begruendung', text: TB.beurteilung.begruendung });
    if (!f.massnahme.trim()) l.push({ feld: 'massnahme', text: TB.beurteilung.massnahme });
  }
  return l;
}

const springe = (feld: string) => {
  const el = document.getElementById(feldId(feld));
  const ziel = el?.tagName === 'FIELDSET' ? el.querySelector<HTMLElement>('input:not([disabled])') ?? el : el;
  ziel?.scrollIntoView?.({ block: 'center' });
  ziel?.focus();
};

export function BerichtPage({ nummer, periode }: { nummer: string; periode: string }) {
  const projekt = useProjekt(nummer);
  const p = projekt.data ?? undefined;
  const q = useBericht(p?.id, periode);
  const skelett = useVerzoegert(q.isPending);
  if (projekt.isPending || (p && q.isPending)) return <div aria-busy="true"><span className="sr" role="status">{T.common.loading}</span>{skelett ? <Skelett zeilen={4} /> : null}</div>;
  if (projekt.error) return <ErrorState error={projekt.error} onRetry={() => void projekt.refetch()} />;
  if (!p) return <Empty>{TB.projektFehlt}</Empty>;
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  return <Arbeitsflaeche key={`${p.id}/${periode}`} nummer={nummer} projektId={p.id} periode={periode} geladen={q.data!} refetch={() => q.refetch()} />;
}

function Arbeitsflaeche({ nummer, projektId, periode, geladen, refetch }: { nummer: string; projektId: string; periode: string; geladen: { bericht: Bericht; etag: string }; refetch(): Promise<unknown> }) {
  const b = geladen.bericht;
  const toast = useToast();
  const toleranzen = useToleranzen();
  const speichern = useSpeichern(projektId, periode);
  const einreichen = useUebergang(projektId, periode, 'einreichen');
  const zurueckziehen = useUebergang(projektId, periode, 'zurueckziehen');
  const [f, setF] = useState<Felder>(() => felderVon(b));
  const offen = useRef<Partial<Felder>>({});
  const etag = useRef(geladen.etag);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [zustand, setZustand] = useState<'gespeichert' | 'speichert' | 'ungespeichert'>('gespeichert');
  const monat = fmtPeriode(periode).replace(/ \d{4}$/, '');
  const bearbeitbar = b.can.write;

  // Neue Fassung vom Server (Einreichen, Rückgängig, Neuladen) übernehmen, solange nichts offen ist
  useEffect(() => {
    etag.current = geladen.etag;
    if (!Object.keys(offen.current).length) setF(felderVon(geladen.bericht));
  }, [geladen]);

  const sichern = useCallback(async (): Promise<boolean> => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const body = offen.current;
    if (!Object.keys(body).length) return true;
    offen.current = {};
    setZustand('speichert');
    try {
      const l = await speichern.mutateAsync({ etag: etag.current, body });
      etag.current = l.etag;
      setZustand(Object.keys(offen.current).length ? 'ungespeichert' : 'gespeichert');
      return true;
    } catch (e) {
      setZustand('ungespeichert');
      if (isConflict(e)) { toast.show(TB.konflikt, { tone: 'error' }); offen.current = {}; await refetch(); return false; }
      offen.current = { ...body, ...offen.current };
      toast.error(e);
      return false;
    }
  }, [speichern, refetch, toast]);

  const setze = useCallback((patch: Partial<Felder>) => {
    setF(v => ({ ...v, ...patch }));
    offen.current = { ...offen.current, ...patch };
    setZustand('ungespeichert');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void sichern(); }, SPEICHERN_NACH_MS);
  }, [sichern]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const liste = useMemo(() => fehlend(f), [f]);
  const [versucht, setVersucht] = useState(false);
  const reichEin = async () => {
    if (liste.length) { setVersucht(true); springe(liste[0]!.feld); return; }
    if (!(await sichern())) return;
    einreichen.mutate({ etag: etag.current }, {
      onSuccess: l => {
        etag.current = l.etag;
        toast.show(TB.eingereicht(monat), {
          ms: RUECKGAENGIG_MS,
          action: { label: TB.rueckgaengig, run: () => zurueckziehen.mutate({ etag: etag.current }, { onSuccess: z => { etag.current = z.etag; toast.show(TB.zurueckgezogen); }, onError: e => toast.error(e) }) },
        });
      },
      onError: e => {
        const err = e instanceof ApiError ? e.fieldErrors : [];
        if (err[0]) springe(err[0].path.slice(1).replace('/', '.'));
        toast.error(e);
      },
    });
  };

  const vor = b.vorperiode;
  const tolTage = toleranz(toleranzen.data, 'termin');
  const tolProzent = toleranz(toleranzen.data, 'kosten');
  const abP2 = PHASEN.indexOf(b.phase) >= 2;
  const banner = b.periodeStand === 'abgeschlossen' ? TB.banner.abgeschlossen(fmtPeriode(periode))
    : b.stand === 'eingereicht' && b.eingereichtAt ? TB.banner.eingereicht(fmtDatum(b.eingereichtAt.slice(0, 10)))
      : b.stand === 'geprueft' ? TB.banner.geprueft
        : b.stand === 'zurueckgegeben' ? TB.banner.zurueckgegeben
          : !bearbeitbar ? TB.banner.nurLesen : null;

  return (
    <div className="sb-wrap">
      <div className="toolbar sb-tools">
        <h2 className="sb-titel">{TB.titel(fmtPeriode(periode))}</h2>
        <span className="pill">{TB.stand[b.stand]}</span>
        {b.anlass === 'ausserordentlich' ? <span className="pill">{TB.anlass.ausserordentlich}</span> : null}
        <span className="spacer" />
        {bearbeitbar ? <span className="muted small" role="status">{TB[zustand]}</span> : null}
      </div>
      {banner ? <div className="sb-banner"><Hinweis stufe="hinweis">{banner}</Hinweis></div> : null}
      <div className="sb-flaeche">
        <div className="sb-haupt">
          <dl className="attrs sb-kopf">
            <dt>{TB.kopf.phase}</dt><dd>{fmtPhase(b.phase as Phase)}</dd>
            <dt>{TB.kopf.abschlussPer}</dt><dd>{f.abschlussPer ? fmtDatum(f.abschlussPer) : '–'}</dd>
            <dt>{TB.kopf.naechster}</dt><dd>{f.naechsterMeilenstein || '–'}</dd>
            <dt>{TB.kopf.vorperiode}</dt>
            <dd>{vor ? <>{fmtPeriode(vor.periode)}: <Status status={statusUi(vor.status)} /> {vor.trend ? (TB.beurteilung.trendWerte[vor.trend] ?? vor.trend) : ''}</> : TB.kopf.keineVorperiode}</dd>
          </dl>
          <Abschnitt id="sb-ms" titel={TB.abschnitte.meilensteine}><Meilensteine nummer={nummer} projektId={projektId} bearbeitbar={bearbeitbar} toleranzTage={tolTage} /></Abschnitt>
          <Abschnitt id="sb-kosten" titel={TB.abschnitte.kosten}><KostenAbschnitt nummer={nummer} projektId={projektId} bearbeitbar={bearbeitbar} toleranzProzent={tolProzent} /></Abschnitt>
          <Abschnitt id="sb-risiken" titel={TB.abschnitte.risiken}><RisikenAbschnitt projektId={projektId} bearbeitbar={bearbeitbar} /></Abschnitt>
          <Abschnitt id="sb-komm" titel={TB.abschnitte.kommunikation}><Kommunikation projektId={projektId} periode={periode} bearbeitbar={bearbeitbar} /></Abschnitt>
          {abP2 ? <Abschnitt id="sb-kpi" titel={TB.abschnitte.kpis}><Kpis projektId={projektId} periode={periode} bearbeitbar={bearbeitbar} /></Abschnitt> : null}
          <Abschnitt id="sb-beurteilung" titel={TB.abschnitte.beurteilung}><Beurteilung f={f} setze={setze} vor={vor} bearbeitbar={bearbeitbar} /></Abschnitt>
        </div>
        <aside className="sb-panel" aria-labelledby="sb-panel-h">
          <h2 id="sb-panel-h" className="grp-h">{TB.panel.titel}</h2>
          {bearbeitbar ? (
            <>
              {liste.length ? (
                <>
                  {versucht ? <Hinweis stufe="sperre" live>{TB.panel.sperre(liste.map(x => x.text).join(', '))}</Hinweis> : <p className="small"><strong>{TB.panel.fehlt(liste.length)}</strong></p>}
                  <ul className="sb-fehlt">
                    {liste.map(x => <li key={x.feld}><button type="button" className="btn sm ghost" onClick={() => springe(x.feld)}>{x.text}</button></li>)}
                  </ul>
                </>
              ) : <p className="small"><Icon name="check" /> {TB.panel.bereit}</p>}
              <p className="muted small">{TB.panel.wirkung}</p>
              <button type="button" className="btn primary" onClick={() => void reichEin()} disabled={einreichen.isPending}>
                {TB.panel.einreichen}
              </button>
            </>
          ) : <p className="muted small">{TB.panel.nichtBearbeitbar(TB.stand[b.stand] ?? b.stand)}</p>}
        </aside>
      </div>
    </div>
  );
}
