/**
 * Portfolio › Finanzen › Budgetprozess (UI-28, Seitentyp Assistent; BC PC.01.05; UC-010 Schritte 5–6, UC-011 Schritt 9):
 * 1 Jahr wählen, 2 Jahresbedarf CAPEX/OPEX je aktivem Projekt prüfen und korrigieren (zeitanteilig nach den
 * Phasenterminen, durch FI korrigierbar, A-17), 3 Zusammenfassung der Wirkung und Übergeben (Export, danach
 * unveränderlich). Lesen mit `finanzen:read` an der Organisation (FI, GL, UE), ändern nur FI (`finanzen:write`).
 * Adresse: `/portfolio/finanzen/budgetprozess?jahr=2027&schritt=2` (I-N5).
 */
import { useEffect, useId, useRef, useState } from 'react';
import { isConflict } from '../../api/index.ts';
import { useSession } from '../../auth/index.ts';
import { Confirm, Empty, ErrorState, fmtDateTime, Hinweis, Icon, Skelett, Stand, useToast, useVerzoegert } from '../../ui/index.ts';
import { csv, herunterladen, lang } from './anzeige.ts';
import { useUebergabe, useUebergabeAendern, type Budgetuebergabe } from './api.ts';
import { Kopf, reiterFuer } from './Kopf.tsx';
import type { BudgetSearch, SetBudgetSearch } from './search.ts';
import { TF } from './texte.ts';
import './finanzen.css';

type Eingabe = Record<string, { capex: string; opex: string; bemerkung: string }>;
const ZAHL = /^\d{1,11}(\.\d{1,2})?$/;
const zahl = (s: string) => (s.trim() === '' ? null : ZAHL.test(s.replace(/['’\s]/g, '')) ? Number(s.replace(/['’\s]/g, '')) : NaN);

function eingabeAus(u: Budgetuebergabe): Eingabe {
  return Object.fromEntries(u.positionen.map(p => [p.projektId, {
    capex: p.korrektur?.capex != null ? String(p.korrektur.capex) : '',
    opex: p.korrektur?.opex != null ? String(p.korrektur.opex) : '',
    bemerkung: p.korrektur?.bemerkung ?? '',
  }]));
}

export function BudgetprozessPage({ search, setSearch, navigieren, heute = new Date() }: { search: BudgetSearch; setSearch: SetBudgetSearch; navigieren(pfad: string): void; heute?: Date }) {
  const { can } = useSession();
  const orgLesen = can('finanzen:read');
  const jahr = Number(search.jahr ?? heute.getFullYear() + 1);
  const schritt = Number(search.schritt ?? '1');
  const q = useUebergabe(jahr, orgLesen);
  const u = q.data;
  const skelett = useVerzoegert(orgLesen && q.isPending);
  const ueberschrift = useRef<HTMLHeadingElement>(null);
  const erster = useRef(true);
  useEffect(() => {
    if (erster.current) { erster.current = false; return; }
    ueberschrift.current?.focus();
  }, [schritt]);

  const kopf = (
    <Kopf reiter="budgetprozess" titel={TF.title} reiterSichtbar={reiterFuer(orgLesen)} navigieren={navigieren}
      sub={u ? <>{TF.budgetTitel} {jahr} · <Stand familie={u.stand === 'uebergeben' ? 'positiv' : 'entwurf'} label={TF.stand[u.stand]!} /></> : TF.budgetSub} />
  );
  if (!orgLesen) return <section aria-labelledby="page-title" className="fi">{kopf}<div className="body"><Empty>{TF.keinRecht}</Empty></div></section>;
  const name = TF.schritte[schritt - 1]!;
  const gehe = (n: number) => setSearch({ schritt: String(n) as BudgetSearch['schritt'] });

  return (
    <section aria-labelledby="page-title" className="fi">
      {kopf}
      <div className="body fi-body fi-assistent">
        <ol className="fi-schritte" aria-label={TF.schritt(schritt, 3, name)}>
          {TF.schritte.map((s, i) => (
            <li key={s} className={i + 1 === schritt ? 'on' : i + 1 < schritt ? 'done' : undefined} aria-current={i + 1 === schritt ? 'step' : undefined}>
              <span className="fi-nr" aria-hidden="true">{i + 1}</span><span>{s}</span>
            </li>
          ))}
        </ol>
        <h2 ref={ueberschrift} tabIndex={-1} className="fi-h2">{TF.schritt(schritt, 3, name)}</h2>
        {q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : null}
        {skelett ? <Skelett zeilen={6} /> : null}
        {schritt === 1 ? <Jahr jahr={jahr} heute={heute} u={u} weiter={j => setSearch({ jahr: String(j), schritt: '2' })} /> : null}
        {schritt === 2 && u ? <Pruefen key={`${jahr}-${u.version}`} u={u} zurueck={() => gehe(1)} weiter={() => gehe(3)} /> : null}
        {schritt === 3 && u ? <Uebergeben u={u} zurueck={() => gehe(2)} /> : null}
      </div>
    </section>
  );
}

function Jahr({ jahr, heute, u, weiter }: { jahr: number; heute: Date; u?: Budgetuebergabe; weiter(j: number): void }) {
  const id = useId();
  const [wert, setWert] = useState(jahr);
  const jahre = [0, 1, 2].map(d => heute.getFullYear() + d);
  return (
    <form className="fi-form" onSubmit={e => { e.preventDefault(); weiter(wert); }}>
      <label htmlFor={`${id}-j`}>{TF.jahr}</label>
      <select id={`${id}-j`} className="fi-in" value={wert} onChange={e => setWert(Number(e.target.value))} aria-describedby={`${id}-j-h`}>
        {[...new Set([...jahre, jahr])].sort().map(j => <option key={j} value={j}>{j}</option>)}
      </select>
      <p id={`${id}-j-h`} className="fi-hint">{TF.jahrHilfe}{u && wert === jahr ? ` ${TF.stand[u.stand]}.` : ''}</p>
      <div className="fi-akt"><button type="submit" className="btn primary">{TF.weiter}</button></div>
    </form>
  );
}

function Pruefen({ u, zurueck, weiter }: { u: Budgetuebergabe; zurueck(): void; weiter(): void }) {
  const toast = useToast();
  const { korrigieren } = useUebergabeAendern(u.jahr);
  const [eingabe, setEingabe] = useState<Eingabe>(() => eingabeAus(u));
  const [konflikt, setKonflikt] = useState(false);
  const darf = u.can.write && u.stand !== 'uebergeben';
  const geaendert = JSON.stringify(eingabe) !== JSON.stringify(eingabeAus(u));
  const ungueltig = Object.values(eingabe).some(e => Number.isNaN(zahl(e.capex)) || Number.isNaN(zahl(e.opex)));
  const ohne = u.positionen.filter(p => p.ohneTermine.length).length;
  const setze = (projektId: string, k: 'capex' | 'opex' | 'bemerkung', v: string) => setEingabe(e => ({ ...e, [projektId]: { ...e[projektId]!, [k]: v } }));

  const speichern = async (danach?: () => void) => {
    if (ungueltig) return;
    if (!geaendert) { danach?.(); return; }
    const korrekturen = Object.entries(eingabe).map(([projektId, e]) => ({ projektId, capex: zahl(e.capex), opex: zahl(e.opex), bemerkung: e.bemerkung.trim() }));
    try {
      await korrigieren.mutateAsync({ version: u.version, korrekturen });
      toast.show(TF.entwurfGespeichert);
      danach?.();
    } catch (e) {
      if (isConflict(e)) setKonflikt(true);
      else toast.error(e);
    }
  };

  return (
    <div className="fi-pruefen">
      {u.stand === 'uebergeben' && u.uebergebenAt ? <Hinweis stufe="hinweis">{TF.uebergebenAm(fmtDateTime(u.uebergebenAt))}</Hinweis> : null}
      {!u.can.write && u.stand !== 'uebergeben' ? <Hinweis stufe="hinweis">{TF.nurLesen}</Hinweis> : null}
      {konflikt ? <Hinweis stufe="warnung" live>{TF.budgetKonflikt}</Hinweis> : null}
      {ohne ? <Hinweis stufe="hinweis">{TF.ohneTermineHinweis(ohne)}</Hinweis> : null}
      {darf ? <p className="fi-hint">{TF.korrekturHilfe}</p> : null}
      {!u.positionen.length ? <Empty>{TF.keineProjekte}</Empty> : (
        <div className="fi-scroll">
          <table className="fi-tab fi-bedarf">
            <caption className="sr">{TF.budgetTitel} {u.jahr}</caption>
            <thead>
              <tr>
                <th scope="col">{TF.projekt}</th>
                <th scope="col" className="num">{TF.capex} {TF.berechnet}</th>
                <th scope="col" className="num">{TF.opex} {TF.berechnet}</th>
                {darf ? <><th scope="col">{TF.capex} {TF.korrektur}</th><th scope="col">{TF.opex} {TF.korrektur}</th><th scope="col">{TF.bemerkung}</th></>
                  : <><th scope="col" className="num">{TF.capex} {TF.wert}</th><th scope="col" className="num">{TF.opex} {TF.wert}</th><th scope="col">{TF.bemerkung}</th></>}
              </tr>
            </thead>
            <tbody>
              {u.positionen.map(p => {
                const e = eingabe[p.projektId]!;
                const projekt = `${p.nummer} ${p.name}`;
                return (
                  <tr key={p.projektId}>
                    <th scope="row"><span className="mono">{p.nummer}</span> {p.name}{p.ohneTermine.length ? <div className="fi-hint">{TF.ohneTermine(p.ohneTermine.join(', '))}</div> : null}</th>
                    <td className="num">{lang(p.berechnet.capex)}</td>
                    <td className="num">{lang(p.berechnet.opex)}</td>
                    {darf ? (
                      <>
                        {(['capex', 'opex'] as const).map(a => (
                          <td key={a}>
                            <input className="fi-zahl" inputMode="decimal" value={e[a]} placeholder={String(p.berechnet[a])} aria-label={TF.korrekturFuer(projekt, TF[a])}
                              aria-invalid={Number.isNaN(zahl(e[a])) ? true : undefined} title={Number.isNaN(zahl(e[a])) ? TF.korrekturUngueltig : undefined}
                              onChange={x => setze(p.projektId, a, x.target.value)} />
                          </td>
                        ))}
                        <td><input className="fi-bem" maxLength={500} value={e.bemerkung} aria-label={TF.bemerkungFuer(projekt)} onChange={x => setze(p.projektId, 'bemerkung', x.target.value)} /></td>
                      </>
                    ) : (
                      <><td className="num">{lang(p.wert.capex)}</td><td className="num">{lang(p.wert.opex)}</td><td>{p.korrektur?.bemerkung || <span className="empty">–</span>}</td></>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot><tr><th scope="row">{TF.summe}</th><td className="num">{lang(u.summe.capex)}</td><td className="num">{lang(u.summe.opex)}</td><td colSpan={3} /></tr></tfoot>
          </table>
        </div>
      )}
      {ungueltig ? <p className="ferr" role="alert">{TF.korrekturUngueltig}</p> : null}
      <div className="fi-akt">
        <button type="button" className="btn" onClick={zurueck}>{TF.zurueck}</button>
        {darf && geaendert ? <button type="button" className="btn" disabled={korrigieren.isPending || ungueltig} onClick={() => void speichern()}>{TF.entwurfSpeichern}</button> : null}
        <button type="button" className="btn primary" disabled={korrigieren.isPending || ungueltig} onClick={() => void (darf ? speichern(weiter) : weiter())}>{TF.weiter}</button>
      </div>
    </div>
  );
}

function Uebergeben({ u, zurueck }: { u: Budgetuebergabe; zurueck(): void }) {
  const toast = useToast();
  const { uebergeben } = useUebergabeAendern(u.jahr);
  const [frage, setFrage] = useState(false);
  const fertig = u.stand === 'uebergeben';
  const datei = () => herunterladen(`jahresbedarf-${u.jahr}.csv`, csv(
    [TF.projekt, 'Name', `${TF.capex} CHF`, `${TF.opex} CHF`, `${TF.capex} ${TF.berechnet} CHF`, `${TF.opex} ${TF.berechnet} CHF`, TF.bemerkung],
    u.positionen.map(p => [p.nummer, p.name, p.wert.capex, p.wert.opex, p.berechnet.capex, p.berechnet.opex, p.korrektur?.bemerkung ?? null]),
  ));
  const los = () => uebergeben.mutate(u.version, {
    onSuccess: () => { setFrage(false); toast.show(TF.uebergebenToast); },
    onError: e => { setFrage(false); toast.error(e, isConflict(e) ? TF.budgetKonflikt : undefined); },
  });
  return (
    <div className="fi-uebergeben">
      <p className="fi-zusammenfassung" role="status">{TF.zusammenfassung(u.jahr, u.positionen.length, lang(u.summe.capex), lang(u.summe.opex))}</p>
      {fertig && u.uebergebenAt ? <Hinweis stufe="hinweis">{TF.uebergebenAm(fmtDateTime(u.uebergebenAt))}</Hinweis> : <p>{TF.wirkung}</p>}
      {!fertig && !u.can.write ? <Hinweis stufe="hinweis">{TF.nurLesen}</Hinweis> : null}
      <div className="fi-akt">
        <button type="button" className="btn" onClick={zurueck}>{TF.zurueck}</button>
        <button type="button" className="btn" onClick={datei}><Icon name="download" />{TF.herunterladen}</button>
        {!fertig && u.can.write ? <button type="button" className="btn primary" onClick={() => setFrage(true)}>{TF.uebergeben}</button> : null}
      </div>
      {frage ? <Confirm title={TF.uebergebenDialog(u.jahr)} text={`${TF.zusammenfassung(u.jahr, u.positionen.length, lang(u.summe.capex), lang(u.summe.opex))} ${TF.wirkung}`} confirm={TF.uebergeben} onConfirm={los} onClose={() => setFrage(false)} busy={uebergeben.isPending} /> : null}
    </div>
  );
}
