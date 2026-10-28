/**
 * Datenliste für den Seitentyp «Liste + Schublade» (docs/ux/rahmen/interaktion.md, Abschnitte 3 und 6): Tabelle mit
 * Kopfzellen und Beschriftung (Q-B3), ganze Zeile öffnet das Objekt, per Tastatur über die Schaltfläche in der
 * Namensspalte (I-L2); Nachladen mit «Mehr laden» (I-L3); auf dem Telefon Karten mit den als `karte` markierten Spalten
 * (I-L6). Zustände: Laden als Skelett erst nach 300 ms (Z1), leer beim ersten Mal mit erster Aktion (Z2), leer durch
 * Filter mit «Filter zurücksetzen» (Z3), teilweise (Z4), Fehler mit «Erneut versuchen» (Z5).
 */
import type { ReactNode } from 'react';
import { Empty, ErrorState, Skelett, useVerzoegert } from './states.tsx';
import { T } from './texte/index.ts';

export interface Spalte<R> {
  key: string;
  titel: string;
  zelle(r: R): ReactNode;
  /** «name» trägt die Schaltfläche zum Öffnen (genau eine Spalte), «zahl» rechtsbündig. */
  art?: 'name' | 'zahl' | 'text';
  /** Auf dem Telefon in der Karte sichtbar (höchstens drei, I-L6); ohne Angabe nur die Namensspalte. */
  karte?: boolean;
}

export interface DatenlisteProps<R> {
  /** Beschriftung der Tabelle für Bildschirmleser. */
  titel: string;
  spalten: Spalte<R>[];
  zeilen: R[] | undefined;
  schluessel(r: R): string;
  /** Name des Objekts für die Schaltfläche zum Öffnen (Bildschirmleser), sonst der Inhalt der Namensspalte. */
  name?(r: R): string;
  oeffnen?(r: R): void;
  /** Schlüssel des geöffneten Objekts (Schublade). */
  aktuell?: string;
  laedt: boolean;
  fehler?: unknown;
  erneut?(): void;
  /** Leer beim ersten Mal: ein Satz, wozu die Ansicht dient, und die erste Aktion (Z2). */
  leer: ReactNode;
  leerAktion?: ReactNode;
  /** Suche oder Filter aktiv: leer heisst «nichts passt» (Z3). */
  gefiltert?: boolean;
  leerGefiltert?: ReactNode;
  zuruecksetzen?(): void;
  /** Was fehlt, benannt (Z4), z. B. «Salden werden berechnet …». */
  teilweise?: ReactNode;
  mehr?: { vorhanden: boolean; laedt: boolean; laden(): void };
}


export function Datenliste<R>(p: DatenlisteProps<R>) {
  const skelett = useVerzoegert(p.laedt);
  if (p.laedt) {
    return (
      <div aria-busy="true">
        <span className="sr" role="status">{T.common.loading}</span>
        {skelett ? <Skelett /> : null}
      </div>
    );
  }
  if (p.fehler) return <ErrorState error={p.fehler} onRetry={p.erneut} />;
  const zeilen = p.zeilen ?? [];
  if (zeilen.length === 0) {
    return p.gefiltert ? (
      <Empty action={p.zuruecksetzen ? <button type="button" className="btn" onClick={p.zuruecksetzen}>{T.liste.filterZuruecksetzen}</button> : undefined}>
        <span role="status">{p.leerGefiltert ?? T.liste.leerGefiltert}</span>
      </Empty>
    ) : <Empty action={p.leerAktion}>{p.leer}</Empty>;
  }
  const karte = (s: Spalte<R>) => s.karte ?? s.art === 'name';
  return (
    <>
      {p.teilweise ? <p className="dl-teil" role="status">{p.teilweise}</p> : null}
      <table className="dl">
        <caption className="sr">{p.titel}</caption>
        <thead>
          <tr>{p.spalten.map(s => <th key={s.key} scope="col" className={s.art === 'zahl' ? 'num' : undefined}><span className="th">{s.titel}</span></th>)}</tr>
        </thead>
        <tbody>
          {zeilen.map(r => {
            const k = p.schluessel(r);
            const cur = p.aktuell === k;
            return (
              <tr key={k} className={`${cur ? 'cur' : ''}${p.oeffnen ? '' : ' static'}`.trim() || undefined} aria-current={cur ? 'true' : undefined}
                onClick={p.oeffnen ? () => p.oeffnen!(r) : undefined}>
                {p.spalten.map(s => (
                  <td key={s.key} data-label={s.titel} className={[s.art === 'name' ? 'nm' : s.art === 'zahl' ? 'num' : '', karte(s) ? 'karte' : ''].filter(Boolean).join(' ') || undefined}>
                    {s.art === 'name' && p.oeffnen ? (
                      <button type="button" className="rowlink" aria-label={p.name ? T.liste.oeffnen(p.name(r)) : undefined}
                        onClick={e => { e.stopPropagation(); p.oeffnen!(r); }}>{s.zelle(r)}</button>
                    ) : s.zelle(r)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {p.mehr?.vorhanden ? (
        <div className="list-foot">
          <button type="button" className="btn" onClick={p.mehr.laden} disabled={p.mehr.laedt}>{p.mehr.laedt ? T.common.loading : T.common.more}</button>
        </div>
      ) : null}
    </>
  );
}
