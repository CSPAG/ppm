/**
 * Projekt in der Schublade (K5 Seitenpanel, UC-008 Schritt 2): Einschätzung je Kriterium als Auswahl und Kommentar.
 * Abhängigkeiten und Portfoliorisiken (Schritt 3) ergänzt AP-E5-2 hier.
 */
import { useId, useState } from 'react';
import { Drawer } from '../../ui/index.ts';
import type { Bewertungsraster } from './api.ts';
import { k, type Wert } from './raster.ts';
import { TP } from './texte.ts';

export function ProjektDrawer({ raster, nummer, wert, kommentar, darf, setzen, kommentieren, onClose }: {
  raster: Bewertungsraster; nummer: string; wert(key: string): Wert; kommentar(key: string): string; darf: boolean;
  setzen(key: string, w: Wert): void; kommentieren(key: string, text: string): void; onClose(): void;
}) {
  const p = raster.projekte.find(x => x.nummer === nummer);
  const id = useId();
  return (
    <Drawer title={p ? `${p.nummer} ${p.name}` : nummer} onClose={onClose}>
      {!p ? <p className="empty">{TP.projektUnbekannt}</p> : (
        <>
          <p className="sub">{TP.phase} {p.phase}</p>
          {(raster.modell?.kriterien ?? []).map(c => {
            const key = k(p.id, c.schluessel);
            const w = wert(key);
            return (
              <fieldset key={c.schluessel} className="pr-kriterium">
                <legend>{c.text}{c.dimension ? <span className="pr-dim"> · {TP.dimension[c.dimension]}</span> : null}</legend>
                {c.beschreibung ? <p className="pr-hint">{c.beschreibung}</p> : null}
                <div className="seg" role="radiogroup" aria-label={c.text}>
                  {(['tief', 'mittel', 'hoch'] as const).map(e => (
                    <button key={e} type="button" role="radio" aria-checked={w === e} className={w === e ? 'on' : ''} disabled={!darf} onClick={() => setzen(key, w === e ? '' : e)}>
                      {TP.einschaetzung[e]}
                    </button>
                  ))}
                </div>
                <Kommentar id={`${id}-${c.schluessel}`} wert={kommentar(key)} aktiv={darf && w !== ''} hinweis={darf && w === ''} speichern={t => kommentieren(key, t)} />
              </fieldset>
            );
          })}
        </>
      )}
    </Drawer>
  );
}

function Kommentar({ id, wert, aktiv, hinweis, speichern }: { id: string; wert: string; aktiv: boolean; hinweis: boolean; speichern(t: string): void }) {
  const [text, setText] = useState(wert);
  const [basis, setBasis] = useState(wert);
  // Neuer Stand vom Server übernehmen, solange nichts eingegeben wurde
  if (wert !== basis) { setBasis(wert); setText(wert); }
  return (
    <div className="pr-kommentar">
      <label htmlFor={id}>{TP.kommentar} <span className="pr-hint">({TP.kommentarHinweis})</span></label>
      <textarea id={id} rows={2} maxLength={1000} value={text} disabled={!aktiv} aria-describedby={hinweis ? `${id}-h` : undefined}
        onChange={e => setText(e.target.value)} onBlur={() => { if (text.trim() !== wert) speichern(text.trim()); }} />
      {hinweis ? <p id={`${id}-h`} className="pr-hint">{TP.ohneBewertungKommentar}</p> : null}
    </div>
  );
}
