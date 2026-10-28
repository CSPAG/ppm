/**
 * Projektakte › Versionen (UI-10 Versionsvergleich, UI-11 Dokumentausgabe; Kernablauf K2 Schritte 5 und 11; PS.03.04;
 * Seitentyp «Arbeitsfläche»): alle Versionen des Projektvertrags mit Stand und «Als Dokument herunterladen», darunter der
 * Vergleich zweier Versionen je Kapitel – alt und neu nebeneinander, Änderungen zusätzlich zur Farbe mit «neu» /
 * «entfernt» / «geändert» gekennzeichnet (Q-B5), Zahlen mit Differenz. Adresse `?vergleich=baseline...entwurf` (I-N5).
 */
import { useId } from 'react';
import { Empty, ErrorState, fmtBetrag, fmtDatum, fmtFte, Hinweis, Skelett, Stand, T, useVerzoegert, type StandFamilie } from '../../ui/index.ts';
import { useVergleich, type Unterschied, type Vergleich } from './AenderungApi.ts';
import { TA } from './AenderungTexte.ts';
import { useProjekt, useVertrag, type Version, type Vertrag } from './api.ts';
import { DokumentAusgabe } from './DokumentAusgabe.tsx';
import { TV } from './texte.ts';
import { vergleichTeile, type SetVersionenSearch, type VersionenSearch } from './VersionenSearch.ts';
import './Aenderung.css';

const FAMILIE: Record<Version['stand'], StandFamilie> = {
  in_arbeit: 'entwurf', in_pruefung: 'wartet', zur_unterzeichnung: 'wartet', unterzeichnet: 'wartet', traktandiert: 'traktandiert',
  abgenommen: 'positiv', abgelehnt: 'negativ', verworfen: 'ruhend', zurueckgezogen: 'ruhend',
};

export function VersionenPage({ nummer, search, setSearch }: { nummer: string; search: VersionenSearch; setSearch: SetVersionenSearch }) {
  const projekt = useProjekt(nummer);
  const vertrag = useVertrag(projekt.data?.id);
  const skelett = useVerzoegert(projekt.isPending || vertrag.isPending);
  if (projekt.isPending || vertrag.isPending) return <div aria-busy="true"><span className="sr" role="status">{T.common.loading}</span>{skelett ? <Skelett zeilen={5} /> : null}</div>;
  const fehler = projekt.error ?? vertrag.error;
  if (fehler) return <ErrorState error={fehler} onRetry={() => { void projekt.refetch(); void vertrag.refetch(); }} />;
  if (!vertrag.data || vertrag.data.versionen.length === 0) return <Empty>{TA.keineVersionen}</Empty>;
  return <Versionen vertrag={vertrag.data} search={search} setSearch={setSearch} />;
}

/** «baseline», «entwurf» oder ID in die ID einer Version auflösen. */
const aufloesen = (v: Vertrag, x: string) => (x === 'baseline' ? v.baseline : x === 'entwurf' ? v.entwurf : v.versionen.some(y => y.id === x) ? x : null);

/** Standard: Entwurf gegen seine Basis, sonst die jüngste gegen die vorherige Version. */
function standard(v: Vertrag): [string | null, string | null] {
  const neu = v.entwurf ?? v.versionen[0]!.id;
  const basis = v.versionen.find(x => x.id === neu)?.basisVersionId;
  const alt = basis ?? v.versionen.find(x => x.id !== neu)?.id ?? null;
  return [alt, neu];
}

function Versionen({ vertrag, search, setSearch }: { vertrag: Vertrag; search: VersionenSearch; setSearch: SetVersionenSearch }) {
  const id = useId();
  const teile = vergleichTeile(search.vergleich);
  const [stdAlt, stdNeu] = standard(vertrag);
  const alt = (teile && aufloesen(vertrag, teile[0])) ?? stdAlt;
  const neu = (teile && aufloesen(vertrag, teile[1])) ?? stdNeu;
  const nummerVon = (x: string | null) => vertrag.versionen.find(v => v.id === x)?.nummer ?? '';
  const marke = (v: Version) => (v.baseline ? ` · ${TA.baselineMarke}` : v.id === vertrag.entwurf ? ` · ${TA.entwurfMarke}` : '');
  const waehle = (a: string | null, n: string | null) => setSearch({ vergleich: `${a}...${n}` }, { replace: true });

  return (
    <div className="vg">
      <section aria-labelledby={`${id}-l`}>
        <h2 id={`${id}-l`} className="grp-h">{TA.versionen}</h2>
        <table className="vg-liste">
          <thead><tr>
            <th scope="col">{TA.spalte.nummer}</th><th scope="col">{TA.spalte.anlass}</th><th scope="col" className="vg-opt">{TA.spalte.phase}</th>
            <th scope="col">{TA.spalte.stand}</th><th scope="col" className="vg-opt">{TA.spalte.datum}</th><th scope="col"><span className="sr">{TA.spalte.nummer}</span></th>
          </tr></thead>
          <tbody>
            {vertrag.versionen.map(v => (
              <tr key={v.id}>
                <td className="mono">{v.nummer}</td>
                <td>{TV.anlass[v.anlass]}</td>
                <td className="vg-opt">{v.zielphase}</td>
                <td><Stand familie={FAMILIE[v.stand]} label={v.baseline ? TV.baseline : TV.stand[v.stand]} /></td>
                <td className="vg-opt">{fmtDatum(v.baselineAt ?? v.updatedAt)}</td>
                <td><DokumentAusgabe versionId={v.id} nummer={v.nummer} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby={`${id}-v`} className="vg">
        <h2 id={`${id}-v`} className="grp-h">{TA.vergleich}</h2>
        {vertrag.versionen.length < 2 ? <p className="muted">{TA.nurEine}</p> : (
          <>
            <div className="vg-wahl">
              <label>{TA.alt}
                <select value={alt ?? ''} onChange={e => waehle(e.target.value, neu)}>
                  {vertrag.versionen.map(v => <option key={v.id} value={v.id}>{`${v.nummer}${marke(v)}`}</option>)}
                </select>
              </label>
              <label>{TA.neu}
                <select value={neu ?? ''} onChange={e => waehle(alt, e.target.value)}>
                  {vertrag.versionen.map(v => <option key={v.id} value={v.id}>{`${v.nummer}${marke(v)}`}</option>)}
                </select>
              </label>
            </div>
            {alt && neu && alt !== neu ? <VergleichAnsicht alt={alt} neu={neu} titel={TA.vergleichTitel(nummerVon(alt), nummerVon(neu))} /> : <p className="muted">{TA.gleich}</p>}
          </>
        )}
      </section>
    </div>
  );
}

function VergleichAnsicht({ alt, neu, titel }: { alt: string; neu: string; titel: string }) {
  const q = useVergleich(neu, alt);
  const skelett = useVerzoegert(q.isPending);
  if (q.isPending) return <div aria-busy="true"><span className="sr" role="status">{T.common.loading}</span>{skelett ? <Skelett zeilen={4} /> : null}</div>;
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  return <VergleichListe v={q.data} titel={titel} />;
}

export function VergleichListe({ v, titel }: { v: Vergleich; titel: string }) {
  const geaendert = v.kapitel.filter(k => k.geaendert);
  const gleich = v.kapitel.length - geaendert.length;
  return (
    <div className="vg">
      <p className="small" role="status">{titel} · {gleich ? TA.unveraendertKapitel(gleich) : ''}</p>
      {v.betraege ? null : <Hinweis stufe="hinweis">{TA.ohneBetraege}</Hinweis>}
      {geaendert.length === 0 ? <p className="muted">{TA.gleich}</p> : (
        <ul className="vg-kapitel">
          {geaendert.map(k => (
            <li key={k.kapitel} className="vg-k">
              <h3 className="vg-kt"><span className="muted">{k.kapitel}</span> {k.titel}</h3>
              <ul className="vg-u">
                {k.unterschiede.map((u, i) => <Zeile key={`${u.feld}-${u.eintrag ?? ''}-${u.eintragFeld ?? ''}-${i}`} u={u} />)}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Wert für die Anzeige: Betrag, FTE, Datum, Listeneintrag als «Feld: Wert · …», Text. */
function wert(feld: string | null, x: unknown): string {
  if (x === null || x === undefined || x === '') return TA.leer;
  if (typeof x === 'number') return feld === 'betrag' ? fmtBetrag(x) : feld === 'fte' ? fmtFte(x) : String(x);
  if (typeof x === 'string') return /^\d{4}-\d{2}-\d{2}$/.test(x) ? fmtDatum(x) : x;
  if (typeof x === 'object') {
    return Object.entries(x as Record<string, unknown>).filter(([k, y]) => k !== 'registerId' && y !== null && y !== '')
      .map(([k, y]) => wert(k, y)).join(' · ');
  }
  return String(x);
}

function Zeile({ u }: { u: Unterschied }) {
  const feld = u.eintragFeld ?? u.feld;
  return (
    <li className="vg-z">
      <span className="vg-kopf">
        <span className={`vg-marke ${u.art}`}>{TA.art[u.art]}</span>
        <span>{u.label}{u.eintrag ? ` «${u.eintrag}»` : ''}{u.eintragFeld ? ` · ${TA.feld[u.eintragFeld] ?? u.eintragFeld}` : ''}</span>
      </span>
      <p className={`vg-alt${u.art === 'entfernt' ? ' weg' : ''}`}><span className="vg-sp">{TA.bisher}</span>{wert(feld, u.alt)}</p>
      <p className="vg-neu"><span className="vg-sp">{TA.jetzt}</span>{wert(feld, u.neu)}</p>
      {u.differenz !== null ? <span className="vg-diff">{TA.differenz}: {feld === 'betrag' ? fmtBetrag(u.differenz, { vorzeichen: true }) : `${u.differenz > 0 ? '+' : ''}${u.differenz}`}</span> : null}
    </li>
  );
}

