/**
 * Überbuchungen (UC-009 A1; AP-E7-2): je Person über einer Stelle bzw. Rolle über dem Angebot eine Regelmeldung (Regel,
 * Ist, Grenze, Vorschlag; darstellung.md) mit den beteiligten Projekten nach Priorität und dem Anteil zum Anpassen.
 */
import { useState } from 'react';
import { isConflict } from '../../api/index.ts';
import { Empty, ErrorState, Hinweis, Regelmeldung, Skelett, useToast, useVerzoegert } from '../../ui/index.ts';
import { useAnteilAendern, useKonflikte, type Konflikt } from './BedarfApi.ts';
import { anteil, fte, zahl } from './BedarfFormat.ts';
import { TB } from './BedarfTexte.ts';
import { monatLang } from './zeitraum.ts';

export function KonfliktMeldung({ k, rolle, live = false }: { k: Konflikt; rolle(r: string): string; live?: boolean }) {
  const person = k.art === 'person';
  return (
    <Regelmeldung stufe="warnung" live={live} regel={person ? TB.regelPerson : TB.regelPool} ist={TB.ist(fte(k.summe))} grenze={TB.grenze(fte(k.grenze))}
      wer={person ? TB.konfliktPerson(k.personName ?? TB.person, monatLang(k.monat)) : TB.konfliktPool(rolle(k.rolle ?? ''), monatLang(k.monat))} vorschlag={TB.vorschlag} />
  );
}

function Anteil({ b }: { b: Konflikt['beteiligte'][number] }) {
  const toast = useToast();
  const aendern = useAnteilAendern();
  const [wert, setWert] = useState(zahl(b.fte));
  const n = anteil(wert);
  const person = b.personName ?? TB.person;
  return (
    <form className="res-anteil" onSubmit={e => { e.preventDefault(); if (n !== null && n !== b.fte) aendern.mutate({ id: b.zuteilungId, version: b.version, fte: n }, { onSuccess: () => toast.show(TB.geaendert), onError: x => toast.error(x, isConflict(x) ? TB.konflikt : undefined) }); }}>
      <input aria-label={TB.anteilLabel(person, b.projekt?.nummer ?? '')} inputMode="decimal" value={wert} onChange={e => setWert(e.target.value)} aria-invalid={n === null || undefined} size={5} />
      <button type="submit" className="btn sm" disabled={n === null || aendern.isPending}>{TB.speichern}</button>
    </form>
  );
}

export function BedarfKonflikte({ zeitraum, rolle, write }: { zeitraum: { von: string; bis: string } | null; rolle(r: string): string; write: boolean }) {
  const q = useKonflikte(zeitraum);
  const skelett = useVerzoegert(q.isPending && !!zeitraum);
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (q.isPending) return skelett ? <Skelett zeilen={4} /> : null;
  const d = q.data;
  if (!d.items.length) return <Empty>{TB.keineKonflikte}</Empty>;
  return (
    <section aria-label={TB.konflikteTitel} className="res-konflikte">
      {!d.prioritaetVorhanden ? <Hinweis stufe="hinweis">{TB.ohnePrioritaet}</Hinweis> : null}
      {d.items.map(k => (
        <article key={`${k.art}:${k.personId ?? k.rolle}:${k.monat}`} className="res-konflikt">
          <KonfliktMeldung k={k} rolle={rolle} />
          <table className="res-beteiligte">
            <caption className="sr">{TB.beteiligte}</caption>
            <thead><tr><th scope="col">{TB.spalte.prioritaet}</th><th scope="col">{TB.spalte.projekt}</th><th scope="col">{TB.person}</th><th scope="col" className="num">{TB.anteil}</th></tr></thead>
            <tbody>
              {k.beteiligte.map(b => (
                <tr key={b.zuteilungId}>
                  <td>{b.prioritaet ? TB.rang(b.prioritaet.rang) : <span className="empty">{TB.keinRang}</span>}</td>
                  <th scope="row">{b.projekt ? <><span className="mono">{b.projekt.nummer}</span> {b.projekt.name}</> : '–'}</th>
                  <td>{b.personName ?? ''}</td>
                  <td className="num">{d.can.write && write ? <Anteil b={b} /> : fte(b.fte)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      ))}
    </section>
  );
}
