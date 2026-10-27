/**
 * Editoren der Abschnitte (Arbeitsfläche UI-46): Version, Phase, Gate, Fristen und Toleranzen, Kapitelwirkung. Im
 * Lesemodus (Z8, Z9) ohne Bearbeiten-Elemente. Reihenfolge per Tastatur über «Nach oben» / «Nach unten»; der Fokus folgt
 * dem verschobenen Eintrag.
 */
import { useEffect, useId, useRef } from 'react';
import { fmtDateTime, Icon, Stand, T } from '../../ui/index.ts';
import type { Phasenmodell } from './api.ts';
import {
  einheitenFrist, verschiebe, WERTESTROEME, wertestromLabel, type Dok, type Frist, type Gate, type Phase, type Pflicht, type Toleranz,
} from './dokument.ts';

const P = T.phasenmodell;
type Fehler = Record<string, string>;

/** Liste von Texten mit Hinzufügen, Entfernen und Verschieben. */
function TextListe({ titel, items, onChange, ro, addLabel, ebene = 3 }: { titel: string; items: string[]; onChange(l: string[]): void; ro: boolean; addLabel: string; ebene?: 3 | 4 }) {
  const H = ebene === 3 ? 'h3' : 'h4';
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  // Fokus nach dem Verschieben, Entfernen oder Hinzufügen auf den betroffenen Eintrag (nach dem nächsten Zeichnen)
  const fokus = useRef<{ row: number; act: string } | null>(null);
  const setFokus = (f: { row: number; act: string } | null) => { fokus.current = f; };
  useEffect(() => {
    const f = fokus.current;
    if (!f) return;
    fokus.current = null;
    ref.current?.querySelector<HTMLElement>(`[data-row="${f.row}"] [data-act="${f.act}"]`)?.focus();
  });
  if (ro) {
    return (
      <div className="pm-liste">
        <H className="pm-h">{titel}</H>
        {items.length ? <ol className="pm-ro">{items.map((t, i) => <li key={i}>{t}</li>)}</ol> : <p className="empty">{P.keine}</p>}
      </div>
    );
  }
  const setze = (i: number, v: string) => onChange(items.map((x, j) => (j === i ? v : x)));
  return (
    <div className="pm-liste" ref={ref} role="group" aria-labelledby={`${id}-h`}>
      <H className="pm-h" id={`${id}-h`}>{titel}</H>
      <ol className="pm-rows">
        {items.map((t, i) => (
          <li key={i} data-row={i} className="pm-row">
            <input className="pm-in" value={t} onChange={e => setze(i, e.target.value)} aria-label={`${titel} ${i + 1}`} maxLength={1000} data-act="text" />
            <button type="button" className="iconbtn" data-act="hoch" aria-label={`${P.hoch}: ${t}`} title={P.hoch} disabled={i === 0}
              onClick={() => { onChange(verschiebe(items, i, -1)); setFokus({ row: i - 1, act: i - 1 === 0 ? 'runter' : 'hoch' }); }}><Icon name="up" /></button>
            <button type="button" className="iconbtn" data-act="runter" aria-label={`${P.runter}: ${t}`} title={P.runter} disabled={i === items.length - 1}
              onClick={() => { onChange(verschiebe(items, i, 1)); setFokus({ row: i + 1, act: i + 1 === items.length - 1 ? 'hoch' : 'runter' }); }}><Icon name="down" /></button>
            <button type="button" className="iconbtn" data-act="weg" aria-label={P.entfernen(t)} title={P.entfernen(t)}
              onClick={() => { onChange(items.filter((_, j) => j !== i)); setFokus(items.length > 1 ? { row: Math.max(0, i - 1), act: 'text' } : null); }}><Icon name="trash" /></button>
          </li>
        ))}
      </ol>
      <button type="button" className="btn sm ghost" onClick={() => { onChange([...items, '']); setFokus({ row: items.length, act: 'text' }); }}>
        <Icon name="plus" />{addLabel}
      </button>
    </div>
  );
}

function PflichtListe({ items, onChange, ro, fehler, pfad }: { items: Pflicht[]; onChange(l: Pflicht[]): void; ro: boolean; fehler: Fehler; pfad: string }) {
  const id = useId();
  const kapitel = (k: number) => `${k} ${P.kapitelName[k - 1] ?? ''}`;
  if (ro) {
    return (
      <div className="pm-liste">
        <h3 className="pm-h">{P.pflichtangaben}</h3>
        {items.length ? <ul className="pm-ro">{items.map((p, i) => <li key={i}>{p.text} <span className="muted small">({P.kapitel} {kapitel(p.kapitel)} · <span className="mono">{p.feld}</span>)</span></li>)}</ul>
          : <p className="empty">{P.keine}</p>}
      </div>
    );
  }
  const setze = (i: number, v: Partial<Pflicht>) => onChange(items.map((x, j) => (j === i ? { ...x, ...v } : x)));
  return (
    <div className="pm-liste" role="group" aria-labelledby={`${id}-h`} aria-describedby={`${id}-d`}>
      <h3 className="pm-h" id={`${id}-h`}>{P.pflichtangaben}</h3>
      <p className="hint" id={`${id}-d`}>{P.pflichtHint}</p>
      <ol className="pm-rows">
        {items.map((p, i) => {
          const fFeld = fehler[`${pfad}/${i}/feld`], fText = fehler[`${pfad}/${i}/text`];
          return (
            <li key={i} className="pm-row pm-pflicht">
              <select className="pm-in pm-kap" value={p.kapitel} onChange={e => setze(i, { kapitel: Number(e.target.value) })} aria-label={`${P.kapitel} ${i + 1}`}>
                {P.kapitelName.map((_, k) => <option key={k} value={k + 1}>{kapitel(k + 1)}</option>)}
              </select>
              <span className="pm-feld">
                <input className="pm-in mono" value={p.feld} onChange={e => setze(i, { feld: e.target.value })} aria-label={`${P.feld} ${i + 1}`} placeholder={P.feldHint}
                  aria-invalid={fFeld ? true : undefined} aria-describedby={fFeld ? `${id}-${i}-f` : undefined} maxLength={60} />
                {fFeld ? <span id={`${id}-${i}-f`} className="ferr">{fFeld}</span> : null}
              </span>
              <span className="pm-feld pm-grow">
                <input className="pm-in" value={p.text} onChange={e => setze(i, { text: e.target.value })} aria-label={`${P.text} ${i + 1}`}
                  aria-invalid={fText ? true : undefined} aria-describedby={fText ? `${id}-${i}-t` : undefined} maxLength={500} />
                {fText ? <span id={`${id}-${i}-t`} className="ferr">{fText}</span> : null}
              </span>
              <button type="button" className="iconbtn" aria-label={P.entfernen(p.text)} title={P.entfernen(p.text)} onClick={() => onChange(items.filter((_, j) => j !== i))}><Icon name="trash" /></button>
            </li>
          );
        })}
      </ol>
      <button type="button" className="btn sm ghost" onClick={() => onChange([...items, { kapitel: 9, feld: '', text: '' }])}><Icon name="plus" />{P.hinzufuegen.pflicht}</button>
    </div>
  );
}

function NameFeld({ value, onChange, ro, fehler }: { value: string; onChange(v: string): void; ro: boolean; fehler?: string }) {
  const id = useId();
  if (ro) return null;
  return (
    <div className="field">
      <label htmlFor={id}>{P.name}</label>
      <input id={id} value={value} onChange={e => onChange(e.target.value)} maxLength={200} aria-invalid={fehler ? true : undefined} aria-describedby={fehler ? `${id}-e` : undefined} />
      {fehler ? <p id={`${id}-e`} className="ferr">{fehler}</p> : null}
    </div>
  );
}

export function PhaseEditor({ phase, index, onChange, ro, fehler }: { phase: Phase; index: number; onChange(p: Phase): void; ro: boolean; fehler: Fehler }) {
  const art = (a: 'lieferergebnis' | 'meilenstein') => phase.ergebnisse.filter(e => e.art === a).map(e => e.text);
  const setzeArt = (a: 'lieferergebnis' | 'meilenstein', texte: string[]) => {
    const andere = a === 'lieferergebnis' ? 'meilenstein' : 'lieferergebnis';
    const neu = texte.map(text => ({ art: a, text }));
    const alt = phase.ergebnisse.filter(e => e.art === andere);
    onChange({ ...phase, ergebnisse: a === 'lieferergebnis' ? [...neu, ...alt] : [...alt, ...neu] });
  };
  return (
    <div className="pm-ed">
      <NameFeld value={phase.name} onChange={name => onChange({ ...phase, name })} ro={ro} fehler={fehler[`/phasen/${index}/name`]} />
      {phase.code !== 'PRE_P0' ? <p className="hint">{P.ergebnisseHint}</p> : null}
      <TextListe titel={P.lieferergebnisse} items={art('lieferergebnis')} onChange={l => setzeArt('lieferergebnis', l)} ro={ro} addLabel={P.hinzufuegen.lieferergebnis} />
      <TextListe titel={P.meilensteine} items={art('meilenstein')} onChange={l => setzeArt('meilenstein', l)} ro={ro} addLabel={P.hinzufuegen.meilenstein} />
      <PflichtListe items={phase.pflichtangaben} onChange={pflichtangaben => onChange({ ...phase, pflichtangaben })} ro={ro} fehler={fehler} pfad={`/phasen/${index}/pflichtangaben`} />
    </div>
  );
}

export function GateEditor({ gate, index, onChange, ro, fehler }: { gate: Gate; index: number; onChange(g: Gate): void; ro: boolean; fehler: Fehler }) {
  const weitere = [...new Set(gate.leitfragen.map(l => l.wertestrom))].filter(w => !(WERTESTROEME as readonly string[]).includes(w));
  const gruppen = [...WERTESTROEME, ...weitere];
  const setzeGruppe = (w: string, texte: string[]) => onChange({
    ...gate,
    leitfragen: gruppen.flatMap(g => (g === w ? texte.map(text => ({ wertestrom: w, text })) : gate.leitfragen.filter(l => l.wertestrom === g))),
  });
  return (
    <div className="pm-ed">
      <NameFeld value={gate.name} onChange={name => onChange({ ...gate, name })} ro={ro} fehler={fehler[`/gates/${index}/name`]} />
      <h3 className="pm-h2">{P.leitfragen}</h3>
      <p className="hint">{P.leitfragenHint}</p>
      {gruppen.map(w => (
        <TextListe key={w} titel={wertestromLabel(w)} items={gate.leitfragen.filter(l => l.wertestrom === w).map(l => l.text)} onChange={l => setzeGruppe(w, l)} ro={ro} addLabel={P.hinzufuegen.leitfrage} ebene={4} />
      ))}
      <PflichtListe items={gate.pflichtangaben} onChange={pflichtangaben => onChange({ ...gate, pflichtangaben })} ro={ro} fehler={fehler} pfad={`/gates/${index}/pflichtangaben`} />
    </div>
  );
}

export function FristenEditor({ fristen, toleranzen, onFristen, onToleranzen, ro, fehler }: {
  fristen: Frist[]; toleranzen: Toleranz[]; onFristen(l: Frist[]): void; onToleranzen(l: Toleranz[]): void; ro: boolean; fehler: Fehler;
}) {
  const id = useId();
  const setzeF = (i: number, v: Partial<Frist>) => onFristen(fristen.map((x, j) => (j === i ? { ...x, ...v } : x)));
  const setzeT = (i: number, v: Partial<Toleranz>) => onToleranzen(toleranzen.map((x, j) => (j === i ? { ...x, ...v } : x)));
  return (
    <div className="pm-ed">
      <h3 className="pm-h2" id={`${id}-f`}>{P.fristen}</h3>
      <p className="hint">{P.fristenHint}</p>
      <table className="pm-tab" aria-labelledby={`${id}-f`}>
        <thead><tr><th scope="col"><span className="th">{P.fristSpalte}</span></th><th scope="col"><span className="th">{P.wert}</span></th><th scope="col"><span className="th">{P.einheitLabel}</span></th></tr></thead>
        <tbody>
          {fristen.map((f, i) => {
            const err = fehler[`/fristen/${i}/wert`];
            return (
              <tr key={f.schluessel} className="static">
                <th scope="row" className="pm-rh">{P.frist[f.schluessel] ?? f.schluessel}<span className="muted small"> · {P.fristBezug[f.schluessel]}</span></th>
                <td>{ro ? <span className="mono">{f.wert}</span> : (
                  <span className="pm-feld">
                    <input className="pm-in pm-zahl" inputMode="numeric" value={Number.isNaN(f.wert) ? '' : String(f.wert)} aria-label={`${P.frist[f.schluessel]}: ${P.wert}`}
                      onChange={e => setzeF(i, { wert: e.target.value.trim() === '' ? NaN : Number(e.target.value) })}
                      aria-invalid={err ? true : undefined} aria-describedby={err ? `${id}-f${i}` : undefined} />
                    {err ? <span id={`${id}-f${i}`} className="ferr">{err}</span> : null}
                  </span>
                )}</td>
                <td>{ro || einheitenFrist(f.schluessel).length === 1 ? P.einheit[f.einheit] : (
                  <select className="pm-in" value={f.einheit} onChange={e => setzeF(i, { einheit: e.target.value as Frist['einheit'] })} aria-label={`${P.frist[f.schluessel]}: ${P.einheitLabel}`}>
                    {einheitenFrist(f.schluessel).map(x => <option key={x} value={x}>{P.einheit[x]}</option>)}
                  </select>
                )}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <h3 className="pm-h2" id={`${id}-t`}>{P.toleranzen}</h3>
      <p className="hint">{P.toleranzenHint}</p>
      <table className="pm-tab" aria-labelledby={`${id}-t`}>
        <thead><tr><th scope="col"><span className="th">{P.toleranzSpalte}</span></th><th scope="col"><span className="th">{P.wert}</span></th><th scope="col"><span className="th">{P.einheitLabel}</span></th></tr></thead>
        <tbody>
          {toleranzen.map((t, i) => {
            const err = fehler[`/toleranzen/${i}/wert`];
            const label = P.toleranz[t.dimension] ?? t.dimension;
            return (
              <tr key={t.dimension} className="static">
                <th scope="row" className="pm-rh">{label}</th>
                <td>{ro ? (t.wert === null ? <span className="empty">{P.ohneWert}</span> : <span className="mono">{t.wert}</span>) : (
                  <span className="pm-feld">
                    <input className="pm-in pm-zahl" inputMode="decimal" value={t.wert === null ? '' : Number.isNaN(t.wert) ? '' : String(t.wert)} placeholder={P.ohneWert}
                      aria-label={`${label}: ${P.wert}`} onChange={e => setzeT(i, { wert: e.target.value.trim() === '' ? null : Number(e.target.value.replace(',', '.')) })}
                      aria-invalid={err ? true : undefined} aria-describedby={err ? `${id}-t${i}` : undefined} />
                    {err ? <span id={`${id}-t${i}`} className="ferr">{err}</span> : null}
                  </span>
                )}</td>
                <td>{ro ? P.einheit[t.einheit] : (
                  <select className="pm-in" value={t.einheit} onChange={e => setzeT(i, { einheit: e.target.value as Toleranz['einheit'] })} aria-label={`${label}: ${P.einheitLabel}`}>
                    {(['prozent', 'kalendertage', 'arbeitstage'] as const).map(x => <option key={x} value={x}>{P.einheit[x]}</option>)}
                  </select>
                )}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function WirkungEditor({ wirkung, onChange, ro }: { wirkung: Dok['kapitelWirkung']; onChange(l: Dok['kapitelWirkung']): void; ro: boolean }) {
  const dims = ['scope', 'budget', 'ressourcen'] as const;
  const hat = (k: number, d: string) => wirkung.some(w => w.kapitel === k && w.dimension === d);
  const umschalten = (k: number, d: (typeof dims)[number]) => onChange(hat(k, d)
    ? wirkung.filter(w => !(w.kapitel === k && w.dimension === d))
    : [...wirkung, { kapitel: k, dimension: d }].sort((a, b) => a.kapitel - b.kapitel || dims.indexOf(a.dimension) - dims.indexOf(b.dimension)));
  return (
    <div className="pm-ed">
      <p className="hint">{P.wirkungHint}</p>
      <table className="pm-tab">
        <caption className="sr">{P.wirkung}</caption>
        <thead><tr><th scope="col"><span className="th">{P.kapitel}</span></th>{dims.map(d => <th key={d} scope="col"><span className="th">{P.dimension[d]}</span></th>)}</tr></thead>
        <tbody>
          {P.kapitelName.map((name, i) => (
            <tr key={i} className="static">
              <th scope="row" className="pm-rh">{i + 1} {name}</th>
              {dims.map(d => (
                <td key={d}>{ro ? (hat(i + 1, d) ? <><Icon name="check" /><span className="sr">{P.dimension[d]}</span></> : null) : (
                  <input type="checkbox" checked={hat(i + 1, d)} onChange={() => umschalten(i + 1, d)} aria-label={`${i + 1} ${name}: ${P.dimension[d]}`} />
                )}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function VersionEditor({ modell, beschreibung, onChange, ro }: { modell: Phasenmodell; beschreibung: string; onChange(v: string): void; ro: boolean }) {
  const id = useId();
  return (
    <div className="pm-ed">
      <dl className="attrs">
        <dt>{P.versionLabel}</dt><dd>{P.version(modell.nummer)}</dd>
        <dt>{P.standLabel}</dt>
        <dd><Stand familie={modell.stand === 'entwurf' ? 'entwurf' : modell.stand === 'in_kraft' ? 'positiv' : 'ruhend'} label={P.stand[modell.stand] ?? modell.stand}
          detail={modell.inKraftAb ? fmtDateTime(modell.inKraftAb) : undefined} /></dd>
      </dl>
      {ro ? (
        <p className="pm-besch">{beschreibung || <span className="empty">{P.keine}</span>}</p>
      ) : (
        <div className="field">
          <label htmlFor={id}>{P.beschreibung}</label>
          <textarea id={id} rows={3} maxLength={2000} value={beschreibung} onChange={e => onChange(e.target.value)} aria-describedby={`${id}-h`} />
          <p id={`${id}-h`} className="hint">{P.beschreibungHint}</p>
        </div>
      )}
    </div>
  );
}
