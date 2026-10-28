/**
 * Portfolio › Auswertungen (UI-30, Seitentyp Bericht; BC PC.04.03, UC-014 A2.1; AP-E7-6): Filter oben (Portfolio, Phase,
 * Lebenszyklus, Status, Handlungsfeld, Stichperiode) mit entfernbaren Chips (I-L1), Kennzahlen und Gruppierung wählen,
 * Ergebnis als Tabelle mit Summe; jede Zahl öffnet ihre Einzelwerte in der Schublade (`?o=<gruppe>`), Export als CSV.
 * Nur mit `auswertung:write` (UE, FI); Beträge nur mit `finanzen:read`. Adresse nach I-N5, alles in den Suchparametern.
 */
import { useState } from 'react';
import { useSession } from '../../auth/index.ts';
import { Drawer, Empty, ErrorState, fmtBetrag, fmtPeriode, Icon, Skelett, Status, useToast, useVerzoegert } from '../../ui/index.ts';
import { exportieren, useAuswertung, type AuswertungEinzelwert, type AuswertungGruppe } from './AuswertungenApi.ts';
import {
  FILTER, GRUPPIERUNGEN, kennzahlenVon, KENNZAHLEN, LEBENSZYKLEN, PHASEN, STATUS,
  type AuswertungenSearch, type Kennzahl, type SetAuswertungenSearch,
} from './AuswertungenSearch.ts';
import { TA } from './AuswertungenTexte.ts';
import './Auswertungen.css';

const FINANZ: readonly string[] = ['budget', 'prognose', 'ist'];
const KENNZAHL_LABEL: Record<Kennzahl, string> = {
  projekte: 'Projekte', kritisch: 'Status kritisch', eskalationen: 'Offene Eskalationen', meilensteine_offen: 'Offene Meilensteine',
  risiken: 'Risiken', budget: 'Budget', prognose: 'Prognose', ist: 'Ist',
};

/** Wert einer Kennzahl: Beträge in CHF, sonst Anzahl. */
const zahl = (k: string, n: number) => (FINANZ.includes(k) ? fmtBetrag(n) : String(n));

function Kopf({ aktionen }: { aktionen?: React.ReactNode }) {
  return (
    <header className="mh">
      <div className="mh-row">
        <div className="mh-title">
          <div className="type-ico neutral"><Icon name="graph" /></div>
          <div className="minw0">
            <h1 id="page-title">{TA.title}</h1>
            <div className="sub">{TA.sub}</div>
          </div>
        </div>
        {aktionen ? <div className="mh-actions">{aktionen}</div> : null}
      </div>
    </header>
  );
}

/** Auswahl mit «Alle»; ein Wert aus der Adresse mit mehreren Einträgen bleibt als eigene Option wählbar. */
function Auswahl({ label, wert, alle, optionen, onChange }: { label: string; wert?: string; alle: string; optionen: { wert: string; label: string }[]; onChange(v?: string): void }) {
  const mehrere = wert && !optionen.some(o => o.wert === wert)
    ? { wert, label: wert.split(',').map(w => optionen.find(o => o.wert === w)?.label ?? w).join(', ') } : null;
  return (
    <label className="aw-feld">
      <span>{label}</span>
      <select value={wert ?? ''} onChange={e => onChange(e.target.value || undefined)}>
        <option value="">{alle}</option>
        {mehrere ? <option value={mehrere.wert}>{mehrere.label}</option> : null}
        {optionen.map(o => <option key={o.wert} value={o.wert}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function AuswertungenPage({ search, setSearch }: { search: AuswertungenSearch; setSearch: SetAuswertungenSearch }) {
  const { can } = useSession();
  const toast = useToast();
  const darf = can('auswertung:write');
  const finanzen = can('finanzen:read');
  const q = useAuswertung(search, darf);
  const skelett = useVerzoegert(q.isPending && darf);
  const [exportLaeuft, setExportLaeuft] = useState(false);
  const d = q.data;
  const gewaehlt = kennzahlenVon(search);

  if (!darf) return <section aria-labelledby="page-title"><Kopf /><div className="body"><Empty>{TA.keinRecht}</Empty></div></section>;

  const exp = async (ebene: 'gruppen' | 'einzelwerte') => {
    setExportLaeuft(true);
    try { toast.show(TA.exportiert(await exportieren(search, ebene))); } catch (e) { toast.error(e); } finally { setExportLaeuft(false); }
  };
  const setzeKennzahl = (k: Kennzahl, an: boolean) => {
    const neu = KENNZAHLEN.filter(x => (x === k ? an : gewaehlt.includes(x)));
    if (neu.length) setSearch({ kennzahlen: neu.join(','), o: undefined }, { replace: true });
  };
  const optionen = (werte: readonly string[], labels: Record<string, string>) => werte.map(w => ({ wert: w, label: labels[w] ?? w }));
  const portfolios = (d?.optionen.portfolios ?? []).map(p => ({ wert: p.schluessel, label: p.name }));
  const handlungsfelder = (d?.optionen.handlungsfelder ?? []).map(h => ({ wert: h.id, label: h.label }));
  const chipLabel: Record<string, (v: string) => string> = {
    portfolio: v => v.split(',').map(s => portfolios.find(p => p.wert === s)?.label ?? s).join(', '),
    phase: v => v.replace(/,/g, ', '),
    lebenszyklus: v => v.split(',').map(s => TA.lebenszyklen[s] ?? s).join(', '),
    status: v => v.split(',').map(s => TA.status[s] ?? s).join(', '),
    handlungsfeld: v => handlungsfelder.find(h => h.wert === v)?.label ?? '–',
    periode: v => fmtPeriode(v),
  };
  const filterName: Record<string, string> = {
    portfolio: TA.filter.portfolio, phase: TA.filter.phase, lebenszyklus: TA.filter.lebenszyklus, status: TA.filter.status,
    handlungsfeld: TA.filter.handlungsfeld, periode: TA.filter.periode,
  };
  const aktiv = FILTER.filter(f => search[f]);
  const ohneFilter = Object.fromEntries(FILTER.map(f => [f, undefined]));
  const gruppen = (d?.gruppen ?? []) as AuswertungGruppe[];
  const einzelwerte = (d?.einzelwerte ?? []) as AuswertungEinzelwert[];
  const offen = search.o ? gruppen.find(g => g.schluessel === search.o) : undefined;
  const gruppierung = d?.gruppierung ?? search.gruppierung ?? 'portfolio';

  return (
    <section aria-labelledby="page-title">
      <Kopf aktionen={d && einzelwerte.length ? (
        <>
          <button type="button" className="btn" disabled={exportLaeuft} onClick={() => void exp('gruppen')}><Icon name="download" />{TA.export}</button>
          <button type="button" className="btn" disabled={exportLaeuft} onClick={() => void exp('einzelwerte')}><Icon name="download" />{TA.exportEinzelwerte}</button>
        </>
      ) : null} />
      <div className="body">
        <div className="aw-steuer" role="search" aria-label={TA.filter.titel}>
          <div className="aw-filter">
            <Auswahl label={TA.filter.portfolio} wert={search.portfolio} alle={TA.filter.allePortfolios} optionen={portfolios} onChange={v => setSearch({ portfolio: v, o: undefined })} />
            <Auswahl label={TA.filter.phase} wert={search.phase} alle={TA.filter.allePhasen} optionen={PHASEN.map(p => ({ wert: p, label: p }))} onChange={v => setSearch({ phase: v, o: undefined })} />
            <Auswahl label={TA.filter.lebenszyklus} wert={search.lebenszyklus} alle={TA.lebenszyklen.aktiv!} optionen={optionen(LEBENSZYKLEN.filter(l => l !== 'aktiv'), TA.lebenszyklen)} onChange={v => setSearch({ lebenszyklus: v, o: undefined })} />
            <Auswahl label={TA.filter.status} wert={search.status} alle={TA.filter.alleStatus} optionen={optionen(STATUS, TA.status)} onChange={v => setSearch({ status: v, o: undefined })} />
            <Auswahl label={TA.filter.handlungsfeld} wert={search.handlungsfeld} alle={TA.filter.alleHandlungsfelder} optionen={handlungsfelder} onChange={v => setSearch({ handlungsfeld: v, o: undefined })} />
            <label className="aw-feld">
              <span>{TA.filter.periode}</span>
              <input type="month" value={search.periode ?? d?.periode ?? ''} title={TA.filter.periodeHilfe}
                onChange={e => setSearch({ periode: /^\d{4}-\d{2}$/.test(e.target.value) ? e.target.value : undefined, o: undefined }, { replace: true })} />
            </label>
            <Auswahl label={TA.gruppierung} wert={search.gruppierung === 'portfolio' ? undefined : search.gruppierung} alle={TA.gruppierungen.portfolio!}
              optionen={optionen(GRUPPIERUNGEN.filter(g => g !== 'portfolio'), TA.gruppierungen)} onChange={v => setSearch({ gruppierung: v, o: undefined })} />
          </div>
          <fieldset className="aw-kennzahlen">
            <legend>{TA.kennzahlen}</legend>
            {KENNZAHLEN.filter(k => finanzen || !FINANZ.includes(k)).map(k => (
              <label key={k} className="aw-check">
                <input type="checkbox" checked={gewaehlt.includes(k)} disabled={gewaehlt.length === 1 && gewaehlt.includes(k)} onChange={e => setzeKennzahl(k, e.target.checked)} />
                {KENNZAHL_LABEL[k]}{FINANZ.includes(k) ? ' (CHF)' : ''}
              </label>
            ))}
          </fieldset>
          {aktiv.length ? (
            <div className="aw-chips">
              {aktiv.map(f => (
                <span key={f} className="chip">
                  <span className="v"><b>{filterName[f]}:</b> {chipLabel[f]!(search[f]!)}</span>
                  <button type="button" className="x" aria-label={TA.filter.entfernen(filterName[f]!)} onClick={() => setSearch({ [f]: undefined, o: undefined })}><Icon name="x" /></button>
                </span>
              ))}
              <button type="button" className="btn sm ghost" onClick={() => setSearch({ ...ohneFilter, o: undefined })}>{TA.filter.zuruecksetzen}</button>
            </div>
          ) : null}
        </div>
        {q.isPending ? (
          <div aria-busy="true"><span className="sr" role="status">{TA.title}</span>{skelett ? <Skelett /> : null}</div>
        ) : q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : d && !einzelwerte.length ? (
          <Empty action={aktiv.length ? <button type="button" className="btn" onClick={() => setSearch({ ...ohneFilter, o: undefined })}>{TA.filter.zuruecksetzen}</button> : undefined}>{TA.leer}</Empty>
        ) : d ? (
          <div className="aw-scroll">
            <table className="aw-tabelle">
              <caption>{TA.ergebnisLabel(TA.gruppierungen[gruppierung] ?? gruppierung, einzelwerte.length)}</caption>
              <thead>
                <tr>
                  <th scope="col">{TA.gruppierungen[gruppierung]}</th>
                  {d.kennzahlen.map(k => <th key={k.schluessel} scope="col" className="num">{k.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {gruppen.map(g => (
                  <tr key={g.schluessel} className={search.o === g.schluessel ? 'cur' : undefined}>
                    <th scope="row">{g.label}</th>
                    {d.kennzahlen.map(k => {
                      const w = zahl(k.schluessel, g.werte[k.schluessel] ?? 0);
                      return (
                        <td key={k.schluessel} className="num">
                          <button type="button" className="aw-zahl" aria-label={TA.zelle(g.label, k.label, w)} aria-current={search.o === g.schluessel ? 'true' : undefined}
                            onClick={() => setSearch({ o: g.schluessel })}>{w}</button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">{TA.summe}</th>
                  {d.kennzahlen.map(k => <td key={k.schluessel} className="num">{zahl(k.schluessel, d.summe[k.schluessel] ?? 0)}</td>)}
                </tr>
              </tfoot>
            </table>
          </div>
        ) : null}
      </div>
      {search.o && d ? (
        <Drawer title={TA.einzelwerteTitel(offen?.label ?? search.o)} onClose={() => setSearch({ o: undefined })}>
          {!offen ? <p className="empty">{TA.gruppeUnbekannt}</p> : (
            <table className="aw-einzel">
              <caption className="sr">{TA.einzelwerte}</caption>
              <thead>
                <tr>
                  <th scope="col">{TA.projekt}</th><th scope="col">{TA.phase}</th><th scope="col">{TA.statusSpalte}</th>
                  {d.kennzahlen.map(k => <th key={k.schluessel} scope="col" className="num">{k.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {einzelwerte.filter(e => e.gruppe === offen.schluessel).map(e => (
                  <tr key={e.projektId}>
                    <td><a className="aw-link" href={`/projekte/${e.nummer}`} aria-label={TA.oeffnen(e.nummer, e.name)}><span className="mono">{e.nummer}</span> {e.name}</a></td>
                    <td>{e.phase}</td>
                    <td>{e.status ? <Status status={e.status === 'kritisch' ? 'kritisch' : 'im-plan'} /> : <span className="muted">{TA.ohneStatus}</span>}</td>
                    {d.kennzahlen.map(k => <td key={k.schluessel} className="num">{zahl(k.schluessel, e.werte[k.schluessel] ?? 0)}</td>)}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={3}>{TA.summe}</th>
                  {d.kennzahlen.map(k => <td key={k.schluessel} className="num">{zahl(k.schluessel, offen.werte[k.schluessel] ?? 0)}</td>)}
                </tr>
              </tfoot>
            </table>
          )}
        </Drawer>
      ) : null}
    </section>
  );
}
