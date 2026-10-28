/**
 * Seite «Bedarf» (UI-25, Seitentyp Liste + Schublade; BC RK.02.02, RK.02.03; UC-009 Schritte 3–4, A1, A2; AP-E7-2):
 * Bedarfsliste der Projekte mit Deckung, Stand und Priorität, Filter nach Stand und Zeitraum in der Adresse; ein Bedarf
 * öffnet in der Schublade (`?o=<id>`) mit Zuteilung und Lücke. Die Ansicht «Überbuchungen» (`?ansicht=konflikte`)
 * zeigt Konflikte nach Priorität (Link der Aufgabe «Überbuchungen auflösen»).
 */
import { useMemo } from 'react';
import { useSession } from '../../auth/index.ts';
import { Datenliste, Hinweis, PhaseKurz, Stand, type Phase, type Spalte } from '../../ui/index.ts';
import { useRollen } from './api.ts';
import { useBedarfe, type Bedarf } from './BedarfApi.ts';
import { BedarfDrawer } from './BedarfDrawer.tsx';
import { fte, STAND_FAMILIE } from './BedarfFormat.ts';
import { BedarfKonflikte } from './BedarfKonflikte.tsx';
import { STAENDE, type BedarfSearch, type BedarfStand, type SetBedarfSearch } from './BedarfSearch.ts';
import { TB } from './BedarfTexte.ts';
import { Kopf } from './Kopf.tsx';
import { monatLang, zeitraum } from './zeitraum.ts';
import './Bedarf.css';
import './ressourcen.css';

const zahl = (n: number) => fte(n).replace(/\s?FTE$/, '');

export function BedarfPage({ search, setSearch, navigieren }: { search: BedarfSearch; setSearch: SetBedarfSearch; navigieren(pfad: string): void }) {
  const { can } = useSession();
  const z = zeitraum(search);
  const liste = useBedarfe(z, search.stand);
  const rollen = useRollen();
  const labels = useMemo(() => new Map((rollen.data ?? []).map(r => [r.schluessel, r.label])), [rollen.data]);
  const rolle = (r: string) => labels.get(r) ?? r;
  const d = liste.data;
  const konflikte = search.ansicht === 'konflikte';

  const spalten: Spalte<Bedarf>[] = [
    { key: 'projekt', titel: TB.spalte.projekt, zelle: b => (b.projekt ? <><span className="mono">{b.projekt.nummer}</span> {b.projekt.name}</> : '–') },
    { key: 'rolle', titel: TB.spalte.rolle, art: 'name', zelle: b => rolle(b.rolle) },
    { key: 'phase', titel: TB.spalte.phase, zelle: b => <PhaseKurz phase={b.phase as Phase} /> },
    { key: 'zeitraum', titel: TB.spalte.zeitraum, karte: true, zelle: b => `${monatLang(b.vonMonat)} – ${monatLang(b.bisMonat)}` },
    { key: 'fte', titel: TB.spalte.fte, art: 'zahl', zelle: b => fte(b.fte) },
    { key: 'deckung', titel: TB.spalte.deckung, karte: true, zelle: b => <><Stand familie={STAND_FAMILIE[b.stand]} label={TB.stand[b.stand]} /> <span className="muted small">{TB.deckung(zahl(b.zugeteilt), zahl(b.benoetigt))}</span></> },
    { key: 'prioritaet', titel: TB.spalte.prioritaet, zelle: b => (b.prioritaet ? TB.rang(b.prioritaet.rang) : <span className="empty">{TB.keinRang}</span>) },
  ];

  return (
    <section aria-labelledby="page-title" className="res">
      <Kopf reiter="bedarf" sub={TB.sub} navigieren={navigieren} zeitraum={z ?? { von: search.von, bis: search.bis }} setZeitraum={n => setSearch({ ...n, o: undefined }, { replace: true })} />
      <div className="body res-body">
        <div className="res-bedarf-filter">
          <div role="radiogroup" aria-label={TB.ansichtLabel} className="seg">
            {(['liste', 'konflikte'] as const).map(a => (
              <button key={a} type="button" role="radio" aria-checked={(a === 'konflikte') === konflikte} className={(a === 'konflikte') === konflikte ? 'on' : undefined}
                onClick={() => setSearch({ ansicht: a === 'konflikte' ? 'konflikte' : undefined, o: undefined })}>{TB.ansicht[a]}</button>
            ))}
          </div>
          {!konflikte ? (
            <label className="res-filter">
              {TB.standFilter}
              <select value={search.stand ?? ''} onChange={e => setSearch({ stand: (e.target.value || undefined) as BedarfStand | undefined, o: undefined }, { replace: true })}>
                <option value="">{TB.standAlle}</option>
                {STAENDE.map(s => <option key={s} value={s}>{`${TB.stand[s]} ${d ? TB.anzahl(d.anzahl[s]) : ''}`.trim()}</option>)}
              </select>
            </label>
          ) : null}
        </div>
        {konflikte ? <BedarfKonflikte zeitraum={z} rolle={rolle} write={can('ressource:write')} /> : (
          <>
            <p className="res-legende">{TB.nurFte}</p>
            {d && d.items.length && !d.items.some(b => b.prioritaet) ? <Hinweis stufe="hinweis">{TB.ohnePrioritaet}</Hinweis> : null}
            <Datenliste titel={TB.tabelle} spalten={spalten} zeilen={d?.items} schluessel={b => b.id}
              name={b => TB.oeffnen(b.projekt ? `${b.projekt.nummer} ${b.projekt.name}` : '', rolle(b.rolle))}
              oeffnen={b => setSearch({ o: b.id })} aktuell={search.o} laedt={liste.isPending && !!z} fehler={liste.error} erneut={() => void liste.refetch()}
              leer={TB.leer} gefiltert={!!search.stand} leerGefiltert={TB.leerGefiltert} zuruecksetzen={() => setSearch({ stand: undefined })} />
          </>
        )}
      </div>
      {search.o && !konflikte ? <BedarfDrawer id={search.o} rolle={rolle} onClose={() => setSearch({ o: undefined })} /> : null}
    </section>
  );
}
