/**
 * Rangliste eines Szenarios mit Wasserlinie (UI-22, K5 Schritt 5): Reihenfolge per Ziehen, Alt+↑/↓ oder Knöpfen
 * (Alternative zum Ziehen, WCAG 2.5.7), Start je Projekt (Monat), enthalten oder nicht. Die Wasserlinie trennt die
 * Projekte, darunter abgesetzt; nach jeder Verschiebung Ansage «‹Projekt› auf Rang 5, über der Wasserlinie».
 */
import { useState, type DragEvent, type KeyboardEvent } from 'react';
import { fmtBetragKurz, Icon } from '../../ui/index.ts';
import type { SzenarioPosition } from './SzenarioApi.ts';
import { fmtMonat, TS } from './SzenarioTexte.ts';

export interface Reihe { projektId: string; aktiv: boolean; startMonat: string | null }

export function SzenarioListe({ positionen, reihe, beiRang, darf, kostenSichtbar, linieText, onAendern }: {
  positionen: readonly SzenarioPosition[];
  /** Reihenfolge der Oberfläche (optimistisch, I-R2); Werte der Rechnung aus `positionen`. */
  reihe: readonly Reihe[];
  /** Rang des ersten Projekts unter der Wasserlinie (null = keines). */
  beiRang: number | null;
  darf: boolean;
  kostenSichtbar: boolean;
  linieText: string | null;
  onAendern(neu: Reihe[], ansage: { projektId: string; rang: number } | null): void;
}) {
  const [gezogen, setGezogen] = useState<number | null>(null);
  const daten = new Map(positionen.map(p => [p.projektId, p]));
  const ueber = new Map(positionen.map(p => [p.projektId, p.ueberWasserlinie]));
  const linieVor = beiRang === null ? null : positionen.find(p => p.rang === beiRang)?.projektId ?? null;

  const verschieben = (von: number, nach: number) => {
    if (nach < 0 || nach >= reihe.length || von === nach) return;
    const neu = [...reihe];
    const [x] = neu.splice(von, 1);
    neu.splice(nach, 0, x!);
    onAendern(neu, { projektId: x!.projektId, rang: nach + 1 });
  };
  const setzen = (i: number, werte: Partial<Reihe>) => onAendern(reihe.map((r, j) => (j === i ? { ...r, ...werte } : r)), null);
  const taste = (i: number) => (e: KeyboardEvent) => {
    if (!darf || !e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    verschieben(i, e.key === 'ArrowUp' ? i - 1 : i + 1);
    // Fokus folgt dem Projekt (die Zeile wird neu gezeichnet)
    const ziel = e.key === 'ArrowUp' ? i - 1 : i + 1;
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-sz-zeile="${ziel}"]`)?.focus());
  };
  const ziehen = {
    start: (i: number) => (e: DragEvent) => { setGezogen(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); },
    ueber: (e: DragEvent) => { if (gezogen !== null) e.preventDefault(); },
    ablegen: (i: number) => (e: DragEvent) => { e.preventDefault(); if (gezogen !== null) verschieben(gezogen, i); setGezogen(null); },
  };

  const linieBei = linieVor ? reihe.findIndex(r => r.projektId === linieVor) : -1;
  return (
    <div className="sz-scroll">
      <table className="sz-liste">
        <caption className="sz-vh">{TS.liste}</caption>
        <thead>
          <tr>
            <th scope="col" className="sz-rang">{TS.rang}</th>
            <th scope="col">{TS.projekt}</th>
            <th scope="col">{TS.start}</th>
            <th scope="col">{TS.enthalten}</th>
            {kostenSichtbar ? <th scope="col" className="num">{TS.kosten}</th> : null}
            {kostenSichtbar ? <th scope="col" className="num">{TS.kumuliert}</th> : null}
            <th scope="col">{TS.ressourcen}</th>
            <th scope="col">{TS.warnungen}</th>
          </tr>
        </thead>
        <tbody>
          {reihe.flatMap((r, i) => {
            const p = daten.get(r.projektId);
            if (!p) return [];
            const zeilen = [];
            const unter = linieBei >= 0 && i >= linieBei;
            if (i === linieBei) {
              zeilen.push(
                <tr key="linie" className="sz-linie">
                  <td colSpan={kostenSichtbar ? 8 : 6}><span className="sz-linie-l"><Icon name="warn" /> {TS.wasserlinie}</span>{linieText ? <span className="sz-linie-t">{linieText}</span> : null}</td>
                </tr>,
              );
            }
            const lage = !r.aktiv ? 'aus' : unter ? 'unter' : 'ueber';
            zeilen.push(
              <tr key={r.projektId} className={`sz-${lage}${gezogen === i ? ' sz-gezogen' : ''}`} draggable={darf}
                onDragStart={ziehen.start(i)} onDragOver={ziehen.ueber} onDrop={ziehen.ablegen(i)} onDragEnd={() => setGezogen(null)}>
                <td className="sz-rang">
                  {darf ? (
                    <span className="sz-griff">
                      <button type="button" className="iconbtn" data-sz-zeile={i} onKeyDown={taste(i)} aria-label={TS.hoch(p.nummer)} disabled={i === 0} onClick={() => verschieben(i, i - 1)}><Icon name="up" /></button>
                      <button type="button" className="iconbtn" onKeyDown={taste(i)} aria-label={TS.runter(p.nummer)} disabled={i === reihe.length - 1} onClick={() => verschieben(i, i + 1)}><Icon name="down" /></button>
                    </span>
                  ) : null}
                  <span className="sz-nr">{i + 1}</span>
                </td>
                <th scope="row" className="sz-projekt">
                  <span className="mono">{p.nummer}</span> {p.name}
                  <span className="sz-merk">
                    {p.phase}
                    {p.neu ? <> · {TS.neu}</> : null}
                    {!r.aktiv ? <> · {TS.nichtEnthalten}</> : lage === 'unter' ? <> · {TS.unterWasserlinie}</> : null}
                  </span>
                </th>
                <td>
                  {darf ? (
                    <input type="month" className="sz-start" aria-label={TS.startLabel(p.nummer)} value={r.startMonat ?? ''}
                      onChange={e => setzen(i, { startMonat: e.target.value || null })} />
                  ) : <span>{r.startMonat ? fmtMonat(r.startMonat) : TS.startWieGeplant}</span>}
                  {p.startGeplant ? <span className="sz-merk">{TS.geplant(p.startGeplant)}</span> : null}
                </td>
                <td>
                  <input type="checkbox" aria-label={TS.enthaltenLabel(p.nummer)} checked={r.aktiv} disabled={!darf} onChange={e => setzen(i, { aktiv: e.target.checked })} />
                </td>
                {kostenSichtbar ? <td className="num">{p.kosten === null ? TS.ohneBetrag : fmtBetragKurz(p.kosten)}</td> : null}
                {kostenSichtbar ? <td className="num">{p.kostenKumuliert === null ? TS.ohneBetrag : fmtBetragKurz(p.kostenKumuliert)}</td> : null}
                <td>
                  {p.fteMonate !== null ? TS.fteMonate(p.fteMonate) : null}
                  {p.groesse ? <span className="sz-merk">{TS.groesse(p.groesse)}{p.fteMonate === null ? ` · ${TS.geschaetzt}` : ''}</span> : null}
                </td>
                <td>{p.warnungen.length ? <ul className="sz-warn">{p.warnungen.map(w => <li key={w.text}><Icon name="warn" /> {w.text}</li>)}</ul> : null}</td>
              </tr>,
            );
            return zeilen;
          })}
        </tbody>
      </table>
      {beiRang === null && ueber.size ? <p className="sz-ok">{TS.ohneWasserlinie}</p> : null}
    </div>
  );
}
