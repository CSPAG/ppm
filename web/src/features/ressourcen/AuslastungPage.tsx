/**
 * Seite «Auslastung» (UI-23, Seitentyp Bericht; BC RK.02.04, UC-009 Schritt 5, K5): Zeitraum oben, Kennzahlen,
 * Engpässe als Warnung nach dem Mustertext aus darstellung.md (UC-009 A1), Tabelle Rolle × Monat mit Bedarf / Angebot;
 * jede Zelle öffnet ihre Einzelwerte (Bedarf je Projekt) in der Schublade (`?o=<rolle>:<monat>`); Export als CSV.
 * Auch für ein Szenario der Priorisierung (`?szenario=`, UC-008 Schritt 5).
 */
import { useMemo } from 'react';
import { useSession } from '../../auth/index.ts';
import { Empty, ErrorState, fmtFte, Hinweis, Icon, Regelmeldung, Skelett, T, useVerzoegert } from '../../ui/index.ts';
import { useAuslastung, useRollen, type Auslastung, type AuslastungZelle } from './api.ts';
import { BeitraegeDrawer } from './BeitraegeDrawer.tsx';
import { Kopf, PFAD } from './Kopf.tsx';
import { zelleAusO, zelleO, type AuslastungSearch, type SetAuslastungSearch } from './search.ts';
import { TR } from './texte.ts';
import { monatKurz, monatLang, quartalText, zeitraum } from './zeitraum.ts';
import './ressourcen.css';

const zahl = (n: number) => fmtFte(n).replace(/\s?FTE$/, '');
const LAGE_ICON: Partial<Record<AuslastungZelle['lage'], 'warn' | 'check' | 'minus'>> = { ueberbucht: 'warn', ohne_angebot: 'warn', ausgelastet: 'check' };

/** Bezeichnung der Rolle aus der Codetabelle; unbekannte (z. B. nicht mehr sichtbare) mit ihrem Schlüssel. */
export const rollenLabel = (labels: Map<string, string>) => (r: string) => labels.get(r) ?? r;

function csv(a: Auslastung, label: (r: string) => string): string {
  const q = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const zeilen = a.rollen.flatMap(r => r.zellen.map(z => [label(r.rolle), z.monat, z.angebot ?? '', z.bedarf, z.frei, TR.lage[z.lage] ?? z.lage].map(v => q(String(v))).join(';')));
  return [TR.csvKopf.join(';'), ...zeilen].join('\r\n');
}

function exportieren(a: Auslastung, label: (r: string) => string) {
  const blob = new Blob([String.fromCharCode(0xfeff) + csv(a, label)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `auslastung-${a.von}-${a.bis}${a.szenario ? '-szenario' : ''}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function AuslastungPage({ search, setSearch, navigieren }: { search: AuslastungSearch; setSearch: SetAuslastungSearch; navigieren(pfad: string): void }) {
  const { can } = useSession();
  const z = zeitraum(search);
  const daten = useAuslastung(z, search.szenario);
  const rollen = useRollen();
  const labels = useMemo(() => new Map((rollen.data ?? []).map(r => [r.schluessel, r.label])), [rollen.data]);
  const label = rollenLabel(labels);
  const skelett = useVerzoegert(daten.isPending && !!z);
  const a = daten.data;

  const kennzahlen = useMemo(() => {
    if (!a) return null;
    const zellen = a.rollen.flatMap(r => r.zellen);
    return {
      engpaesse: a.engpaesse.length,
      ohneAngebot: zellen.filter(x => x.lage === 'ohne_angebot').length,
      frei: zellen.reduce((s, x) => s + Math.max(0, x.frei), 0),
    };
  }, [a]);

  const offen = search.o ? zelleAusO(search.o) : null;
  const zeitraumWert = z ?? { von: search.von, bis: search.bis };

  return (
    <section aria-labelledby="page-title" className="res">
      <Kopf reiter="auslastung" sub={TR.sub} navigieren={navigieren} zeitraum={zeitraumWert} setZeitraum={n => setSearch({ ...n, o: undefined }, { replace: true })}
        aktionen={a && a.rollen.length ? <button type="button" className="btn" onClick={() => exportieren(a, label)}><Icon name="download" />{TR.export}</button> : null} />
      <div className="body res-body">
        {!z ? <Hinweis stufe="sperre" live>{TR.zeitraumUngueltig}</Hinweis> : null}
        {a?.szenario ? (
          <Hinweis stufe="hinweis" aktion={<button type="button" className="btn" onClick={() => setSearch({ szenario: undefined, o: undefined })}>{TR.istStand}</button>}>
            {TR.szenario(a.szenario.name)}
          </Hinweis>
        ) : null}
        {daten.error ? <ErrorState error={daten.error} onRetry={() => void daten.refetch()} /> : null}
        {skelett ? <Skelett zeilen={6} /> : null}
        {a && !a.rollen.length ? (
          <Empty action={can('ressource:write') ? <button type="button" className="btn primary" onClick={() => navigieren(PFAD.kapazitaet)}>{TR.leerAktion}</button> : undefined}>{TR.leer}</Empty>
        ) : null}
        {a && a.rollen.length && kennzahlen ? (
          <>
            <section aria-label={TR.kennzahlen} className="res-kpis">
              <Kennzahl titel={TR.engpaesse} wert={String(kennzahlen.engpaesse)} hinweis={TR.engpaesseHinweis} warn={kennzahlen.engpaesse > 0} />
              <Kennzahl titel={TR.ohneAngebot} wert={String(kennzahlen.ohneAngebot)} hinweis={TR.ohneAngebotHinweis} warn={kennzahlen.ohneAngebot > 0} />
              <Kennzahl titel={TR.frei} wert={TR.fteMonate(zahl(kennzahlen.frei))} hinweis={TR.freiHinweis} />
            </section>
            {a.engpaesse.length ? (
              <section aria-label={TR.engpaesse} className="res-engpaesse">
                {a.engpaesse.map(e => (
                  e.angebot > 0 ? (
                    <Regelmeldung key={`${e.rolle}:${e.quartal}`} stufe="warnung" regel={TR.engpassRegel(quartalText(e.quartal))} ist={TR.engpassIst(fmtFte(e.bedarf), label(e.rolle))}
                      grenze={TR.engpassGrenze(zahl(e.angebot))} vorschlag={TR.engpassVorschlag(e.projekte)}
                      aktion={<button type="button" className="btn" onClick={() => setSearch({ o: zelleO(e.rolle, e.monat) })}>{TR.engpassZeigen}</button>} />
                  ) : (
                    <Hinweis key={`${e.rolle}:${e.quartal}`} stufe="warnung"
                      aktion={<button type="button" className="btn" onClick={() => setSearch({ o: zelleO(e.rolle, e.monat) })}>{TR.engpassZeigen}</button>}>
                      {TR.engpassOhneAngebot(quartalText(e.quartal), label(e.rolle), fmtFte(e.bedarf))}
                    </Hinweis>
                  )
                ))}
              </section>
            ) : null}
            <p className="res-legende">{TR.legende} {TR.nurFte}</p>
            <div className="res-scroll">
              <table className="res-tabelle">
                <caption className="sr">{TR.tabelle}</caption>
                <thead>
                  <tr>
                    <th scope="col" className="res-rolle">{TR.rolle}</th>
                    {a.monate.map(m => <th key={m} scope="col" className="num"><abbr title={monatLang(m)}>{monatKurz(m, T.format.monateKurz)}</abbr></th>)}
                  </tr>
                </thead>
                <tbody>
                  {a.rollen.map(r => (
                    <tr key={r.rolle}>
                      <th scope="row" className="res-rolle">{label(r.rolle)}</th>
                      {r.zellen.map(x => {
                        const aktuell = offen?.rolle === r.rolle && offen.monat === x.monat;
                        const icon = LAGE_ICON[x.lage];
                        return (
                          <td key={x.monat} className={`res-zelle res-${x.lage}${aktuell ? ' cur' : ''}`}>
                            <button type="button" aria-label={TR.zelleLabel(label(r.rolle), monatLang(x.monat), fmtFte(x.bedarf), x.angebot === null ? TR.keinAngebot : fmtFte(x.angebot), TR.lage[x.lage] ?? x.lage)}
                              aria-current={aktuell ? 'true' : undefined} onClick={() => setSearch({ o: zelleO(r.rolle, x.monat) })}>
                              {icon ? <Icon name={icon} /> : null}
                              <span>{zahl(x.bedarf)}</span><span className="res-durch">/</span><span>{x.angebot === null ? '–' : zahl(x.angebot)}</span>
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
      {offen && a ? <BeitraegeDrawer auslastung={a} rolle={offen.rolle} monat={offen.monat} label={label(offen.rolle)} onClose={() => setSearch({ o: undefined })} /> : null}
    </section>
  );
}

function Kennzahl({ titel, wert, hinweis, warn = false }: { titel: string; wert: string; hinweis: string; warn?: boolean }) {
  return (
    <div className={`res-kpi${warn ? ' warn' : ''}`}>
      <div className="res-kpi-t">{warn ? <Icon name="warn" /> : null}{titel}</div>
      <div className="res-kpi-v">{wert}</div>
      <div className="res-kpi-h">{hinweis}</div>
    </div>
  );
}
