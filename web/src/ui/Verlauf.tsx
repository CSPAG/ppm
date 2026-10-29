/**
 * Verlauf am Objekt (UX-E13, A-75): wer wann was getan hat, älteste zuerst, als Zeitleiste wie bei Handlungsfeldern und
 * Zielen. Einträge «geändert nach …» tragen die Markierung (darstellung.md «Geändert nach …»). Laden und Fehler wie
 * jede Teilansicht (Z1, Z5).
 */
import { ErrorState, Loading } from './states.tsx';
import { fmtDateTime } from './format.ts';
import { Icon } from './Icon.tsx';

export interface VerlaufEintrag { at: string; person: string | null; aktion: string; text: string }

export function Verlauf({ titel, eintraege, laedt, fehler, erneut }: {
  titel: string; eintraege: readonly VerlaufEintrag[] | undefined; laedt: boolean; fehler?: unknown; erneut?(): void;
}) {
  return (
    <section className="grp verlauf" aria-label={titel}>
      <h3 className="grp-h"><Icon name="clock" /> {titel}</h3>
      {laedt ? <Loading /> : fehler ? <ErrorState error={fehler} onRetry={erneut} /> : (
        <ol className="tl">
          {(eintraege ?? []).map((e, i) => (
            <li key={`${e.at}-${i}`}>
              <span className="tl-dot" aria-hidden="true" />
              <div>
                {e.aktion.endsWith('.amended') ? <span className="geaendert"><Icon name="edit" />{e.text}</span> : <strong>{e.text}</strong>}
                <div className="t">{fmtDateTime(e.at)}{e.person ? ` · ${e.person}` : ''}</div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Markierung «geändert nach …» am Objekt (darstellung.md: Stift + Datum, neutral); führt in den Verlauf. */
export function GeaendertNach({ text, at }: { text: string; at: string }) {
  return <span className="geaendert" title={fmtDateTime(at)}><Icon name="edit" />{text} · {fmtDateTime(at)}</span>;
}
