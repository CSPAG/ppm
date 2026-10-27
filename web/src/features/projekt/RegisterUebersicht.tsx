/**
 * Register des Projekts in der Projektübersicht (UI-06, Seitentyp Bericht; AP-E0-6): Meilensteine und Lieferergebnisse
 * mit Termin und Baseline (PS.02.04), Risiken (PC.02.04), Kosten nach CAPEX/OPEX nur mit `finanzen:read` (A-33),
 * Abhängigkeiten in beide Richtungen (PP.02.03, UC-002 Schritt 5) und die übrigen Register als Anzahl. Nur lesend:
 * gepflegt werden die Register im Projektvertrag und im Statusbericht. Jeder Abschnitt lädt für sich (Z1, Z5).
 */
import type { ReactNode } from 'react';
import { useSession } from '../../auth/index.ts';
import { ErrorState, fmtBetrag, fmtDatum, Icon, Loading, PhaseKurz, tageBis } from '../../ui/index.ts';
import {
  ANZAHL, useAbhaengigkeiten, useKosten, useMeilensteine, useRisiken, useWeitere, type Kosten, type Meilenstein,
} from './register-api.ts';
import { TR } from './register-texte.ts';
import './register.css';

type Abfrage<T> = { isPending: boolean; error: unknown; data?: T; refetch(): unknown };

/** Abschnitt mit Überschrift und den Zuständen Laden und Fehler. */
function Abschnitt<T>({ id, titel, icon, q, children }: { id: string; titel: string; icon?: Parameters<typeof Icon>[0]['name']; q: Abfrage<T>; children(d: T): ReactNode }) {
  return (
    <section aria-labelledby={id} className="grp">
      <h2 id={id} className="grp-h">{icon ? <Icon name={icon} /> : null}{titel}</h2>
      {q.isPending ? <Loading /> : q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : children(q.data as T)}
    </section>
  );
}

const Mehr = ({ n }: { n: number }) => (n >= ANZAHL ? <p className="note">{TR.weitereEintraege(ANZAHL)}</p> : null);

function meilensteinStand(m: Meilenstein): { text: string; klasse: string } {
  if (m.abgenommenAm) return { text: TR.meilensteine.abgenommen(fmtDatum(m.abgenommenAm)), klasse: 'pd-ok' };
  if (m.erreichtAm) return { text: TR.meilensteine.erreicht(fmtDatum(m.erreichtAm)), klasse: 'pd-ok' };
  const termin = m.terminAktuell ?? m.terminBaseline;
  if (termin && tageBis(termin) < 0) return { text: TR.meilensteine.ueberfaellig, klasse: 'pd-warn' };
  return { text: TR.meilensteine.offen, klasse: '' };
}

function Meilensteine({ items }: { items: Meilenstein[] }) {
  if (!items.length) return <p className="empty">{TR.meilensteine.leer}</p>;
  const t = TR.meilensteine;
  return (
    <>
      <table className="pd-tab">
        <caption className="sr">{t.tabelle}</caption>
        <thead><tr><th scope="col">{t.phase}</th><th scope="col">{t.art}</th><th scope="col">{t.text}</th><th scope="col">{t.termin}</th><th scope="col">{t.stand}</th></tr></thead>
        <tbody>
          {items.map(m => {
            const termin = m.terminAktuell ?? m.terminBaseline;
            const stand = meilensteinStand(m);
            const verschoben = m.terminBaseline && m.terminAktuell && m.terminBaseline !== m.terminAktuell;
            return (
              <tr key={m.id}>
                <td><PhaseKurz phase={m.phase} /></td>
                <td>{t.art_[m.art]}</td>
                <th scope="row" className="pd-text">{m.text}{m.art === 'kommunikation' && m.adressat ? <span className="muted small"> · {m.adressat}</span> : null}</th>
                <td>
                  {termin ? fmtDatum(termin) : <span className="empty">{t.keinTermin}</span>}
                  {verschoben ? <div className="muted small">{t.baseline(fmtDatum(m.terminBaseline!))}</div> : null}
                </td>
                <td className={stand.klasse}>{stand.text}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Mehr n={items.length} />
    </>
  );
}

function Risiken({ items }: { items: { id: string; text: string; wahrscheinlichkeit: 'hoch' | 'mittel' | 'tief'; auswirkung: 'hoch' | 'mittel' | 'tief'; massnahme: string; massnahmeStand: 'offen' | 'umgesetzt' }[] }) {
  if (!items.length) return <p className="empty">{TR.risiken.leer}</p>;
  const t = TR.risiken;
  return (
    <>
      <table className="pd-tab">
        <caption className="sr">{t.tabelle}</caption>
        <thead>
          <tr>
            <th scope="col">{t.text}</th>
            <th scope="col"><abbr title={t.ewLang}>{t.ew}</abbr></th>
            <th scope="col"><abbr title={t.awLang}>{t.aw}</abbr></th>
            <th scope="col">{t.massnahme}</th>
          </tr>
        </thead>
        <tbody>
          {items.map(r => (
            <tr key={r.id}>
              <th scope="row" className="pd-text">{r.text}</th>
              <td className={`pd-stufe pd-${r.wahrscheinlichkeit}`}>{t.stufe[r.wahrscheinlichkeit]}</td>
              <td className={`pd-stufe pd-${r.auswirkung}`}>{t.stufe[r.auswirkung]}</td>
              <td>{r.massnahme || <span className="empty">{t.keineMassnahme}</span>}{r.massnahme ? <span className="muted small"> · {t.massnahmeStand[r.massnahmeStand]}</span> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Mehr n={items.length} />
    </>
  );
}

/** Summe der Beträge; `null`, wenn kein Eintrag einen Wert hat («noch nicht verfügbar» statt 0, darstellung.md). */
function summe(items: Kosten[], feld: 'budgetBaseline' | 'prognose' | 'ist'): number | null {
  const werte = items.map(k => k[feld]).filter((v): v is number => v !== null);
  return werte.length ? werte.reduce((a, b) => a + b, 0) : null;
}

function KostenTabelle({ items }: { items: Kosten[] }) {
  if (!items.length) return <p className="empty">{TR.kosten.leer}</p>;
  const t = TR.kosten;
  const betrag = (n: number | null) => (n === null ? <span className="empty">{t.nichtVerfuegbar}</span> : fmtBetrag(n));
  const zeilen = [
    ...(['capex', 'opex'] as const).filter(a => items.some(k => k.art === a)).map(a => ({ key: a, label: t.art_[a], liste: items.filter(k => k.art === a) })),
    { key: 'total', label: t.total, liste: items },
  ];
  return (
    <table className="pd-tab">
      <caption className="sr">{t.tabelle}</caption>
      <thead><tr><th scope="col">{t.art}</th><th scope="col" className="num">{t.baseline}</th><th scope="col" className="num">{t.prognose}</th><th scope="col" className="num">{t.ist}</th></tr></thead>
      <tbody>
        {zeilen.map(z => (
          <tr key={z.key} className={z.key === 'total' ? 'pd-total' : undefined}>
            <th scope="row">{z.label}</th>
            <td className="num">{betrag(summe(z.liste, 'budgetBaseline'))}</td>
            <td className="num">{betrag(summe(z.liste, 'prognose'))}</td>
            <td className="num">{betrag(summe(z.liste, 'ist'))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Abhaengigkeiten({ items }: { items: { id: string; richtung: 'ausgehend' | 'eingehend'; text: string; ansprechperson: string; anderesProjekt: { nummer: string; name: string } | null }[] }) {
  if (!items.length) return <p className="empty">{TR.abhaengigkeiten.leer}</p>;
  const t = TR.abhaengigkeiten;
  return (
    <dl className="attrs">
      {(['ausgehend', 'eingehend'] as const).filter(r => items.some(a => a.richtung === r)).map(r => (
        <div key={r} className="pd-g">
          <dt>{t[r]}</dt>
          <dd>
            <ul className="pd-liste">
              {items.filter(a => a.richtung === r).map(a => (
                <li key={a.id}>
                  {a.anderesProjekt ? <><span className="mono">{a.anderesProjekt.nummer}</span> {a.anderesProjekt.name}</> : <span className="muted">{t.unsichtbar}</span>}
                  <span className="muted small"> · {a.text}{a.ansprechperson ? ` · ${t.ansprechperson(a.ansprechperson)}` : ''}</span>
                </li>
              ))}
            </ul>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function RegisterUebersicht({ projektId }: { projektId: string }) {
  const { canSomewhere } = useSession();
  const meilensteine = useMeilensteine(projektId);
  const risiken = useRisiken(projektId);
  const betraege = canSomewhere('finanzen:read');
  const kosten = useKosten(projektId, betraege);
  const abhaengigkeiten = useAbhaengigkeiten(projektId);
  const weitere = useWeitere(projektId);
  const w = TR.weitere;
  return (
    <>
      <Abschnitt id="pd-meilensteine" titel={TR.meilensteine.titel} icon="calendar" q={meilensteine}>{d => <Meilensteine items={d.items} />}</Abschnitt>
      <Abschnitt id="pd-risiken" titel={TR.risiken.titel} icon="warn" q={risiken}>{d => <Risiken items={d.items} />}</Abschnitt>
      {/* Ohne Recht auf Beträge (A-33) kein Abschnitt, auch keine leere Überschrift */}
      {betraege && kosten.data !== null ? (
        <Abschnitt id="pd-kosten" titel={TR.kosten.titel} q={kosten}>{d => (d ? <KostenTabelle items={d.items} /> : null)}</Abschnitt>
      ) : null}
      <Abschnitt id="pd-abhaengigkeiten" titel={TR.abhaengigkeiten.titel} icon="link" q={abhaengigkeiten}>{d => <Abhaengigkeiten items={d.items} />}</Abschnitt>
      <Abschnitt id="pd-weitere" titel={w.titel} q={weitere}>
        {d => (
          <dl className="attrs">
            <dt>{w.kpis}</dt><dd>{d.kpis.length ? w.anzahl(d.kpis.length) : <span className="empty">{w.keine}</span>}</dd>
            <dt>{w.stakeholder}</dt><dd>{d.stakeholder.length ? w.anzahl(d.stakeholder.length) : <span className="empty">{w.keine}</span>}</dd>
            <dt>{w.bedarf}</dt><dd>{d.bedarf.length ? w.anzahl(d.bedarf.length) : <span className="empty">{w.keine}</span>}</dd>
            <dt>{w.meldungen}</dt>
            <dd>{d.meldungen[0] ? w.gemeldet(w.stelle[d.meldungen[0].stelle], fmtDatum(d.meldungen[0].gemeldetAt)) : <span className="empty">{w.keine}</span>}</dd>
          </dl>
        )}
      </Abschnitt>
    </>
  );
}
