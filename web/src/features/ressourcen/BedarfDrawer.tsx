/**
 * Schublade eines Bedarfs (UI-25, Liste + Schublade; UC-009 Schritte 3–4, A1, A2): Angaben, Deckung je Monat, zugeteilte
 * Personen mit Anteil je Monat (ändern, entfernen), Person zuteilen mit freier Kapazität je Monat und Lücke melden. Nach
 * dem Speichern zeigt sie berührte Überbuchungen als Warnung (I-P2). Bearbeiten nur mit `ressource:write` (RM).
 */
import { useId, useState, type FormEvent } from 'react';
import { isConflict, statusOf } from '../../api/index.ts';
import { Drawer, ErrorState, fmtDatum, Hinweis, Icon, Loading, Stand, useToast } from '../../ui/index.ts';
import {
  useAnteilAendern, useBedarf, useLuecke, usePersonen, useZuteilen, useZuteilungEntfernen, type Bedarf, type Konflikt, type PersonBelegung, type Zuteilung,
} from './BedarfApi.ts';
import { anteil, fte, STAND_FAMILIE, zahl } from './BedarfFormat.ts';
import { KonfliktMeldung } from './BedarfKonflikte.tsx';
import { TB } from './BedarfTexte.ts';
import { monatLang } from './zeitraum.ts';

function ZuteilungZeile({ z, write, label }: { z: Zuteilung; write: boolean; label: string }) {
  const toast = useToast();
  const aendern = useAnteilAendern();
  const entfernen = useZuteilungEntfernen();
  const zuteilen = useZuteilen();
  const [wert, setWert] = useState(zahl(z.fte));
  const fehler = anteil(wert) === null;
  const person = z.personName ?? label;
  const monat = monatLang(z.monat);
  const fehlerMelden = (e: unknown) => toast.error(e, isConflict(e) ? TB.konflikt : undefined);
  return (
    <tr>
      <th scope="row">{monat}</th>
      <td className="num">
        {write ? (
          <form className="res-anteil" onSubmit={e => { e.preventDefault(); const n = anteil(wert); if (n !== null && n !== z.fte) aendern.mutate({ id: z.id, version: z.version, fte: n }, { onSuccess: () => toast.show(TB.geaendert), onError: fehlerMelden }); }}>
            <input aria-label={TB.anteilLabel(person, monat)} inputMode="decimal" value={wert} onChange={e => setWert(e.target.value)} aria-invalid={fehler || undefined} size={5} />
            <button type="submit" className="btn sm" disabled={fehler || aendern.isPending}>{TB.speichern}</button>
          </form>
        ) : fte(z.fte)}
      </td>
      {write ? (
        <td>
          <button type="button" className="iconbtn" aria-label={TB.entfernen(person, monat)} disabled={entfernen.isPending}
            onClick={() => entfernen.mutate({ id: z.id, version: z.version }, {
              // umkehrbar (I-R1 Stufe 1): «Rückgängig» teilt dieselbe Person im selben Monat mit demselben Anteil wieder zu
              onSuccess: () => toast.show(TB.entfernt, {
                action: { label: TB.rueckgaengig, run: () => zuteilen.mutate({ id: z.bedarfId, personId: z.personId, fte: z.fte, vonMonat: z.monat, bisMonat: z.monat }, { onError: fehlerMelden }) },
              }),
              onError: fehlerMelden,
            })}>
            <Icon name="trash" />
          </button>
        </td>
      ) : null}
    </tr>
  );
}

/** Zugeteilte Personen, je Person ihre Monate. */
function Zuteilungen({ liste, write }: { liste: Zuteilung[]; write: boolean }) {
  if (!liste.length) return <p className="empty">{TB.keineZuteilung}</p>;
  const personen = [...new Set(liste.map(z => z.personId))];
  return (
    <>
      {personen.map(p => {
        const zeilen = liste.filter(z => z.personId === p);
        const name = zeilen[0]!.personName ?? TB.person;
        return (
          <table key={p} className="res-zuteilung">
            <caption>{name}</caption>
            <thead><tr><th scope="col">{TB.monat}</th><th scope="col" className="num">{TB.anteil}</th>{write ? <th scope="col"><span className="sr">{TB.entfernen(name, '')}</span></th> : null}</tr></thead>
            <tbody>{zeilen.map(z => <ZuteilungZeile key={z.id} z={z} write={write} label={name} />)}</tbody>
          </table>
        );
      })}
    </>
  );
}

/** Person zuteilen: Suche, Auswahl mit freier Kapazität, Anteil und Zeitraum (UC-009 Schritte 3–4). */
function Zuteilen({ b, onKonflikte }: { b: Bedarf; onKonflikte(k: Konflikt[]): void }) {
  const id = useId();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [person, setPerson] = useState<PersonBelegung | null>(null);
  const [wert, setWert] = useState(zahl(b.fte <= 1 ? b.fte : 1));
  const [von, setVon] = useState(b.vonMonat);
  const [bis, setBis] = useState(b.bisMonat);
  const [gesendet, setGesendet] = useState(false);
  const personen = usePersonen(b.id, q.trim(), true);
  const zuteilen = useZuteilen();
  const n = anteil(wert);
  const absenden = (e: FormEvent) => {
    e.preventDefault();
    setGesendet(true);
    if (!person || n === null) return;
    zuteilen.mutate({ id: b.id, personId: person.id, fte: n, vonMonat: von, bisMonat: bis }, {
      onSuccess: r => { toast.show(TB.zugeteilt_(person.name)); onKonflikte(r.konflikte); setPerson(null); setGesendet(false); },
      onError: e => toast.error(e, statusOf(e) === 409 ? TB.doppelt : undefined),
    });
  };
  const minFrei = (p: PersonBelegung) => Math.min(...p.monate.map(m => m.frei));
  return (
    <form className="res-zuteilen" onSubmit={absenden} noValidate>
      <label htmlFor={`${id}-q`}>{TB.personSuchen}</label>
      <input id={`${id}-q`} type="search" value={q} placeholder={TB.personSuchenHinweis} onChange={e => setQ(e.target.value)} />
      <fieldset>
        <legend>{TB.personWaehlen}</legend>
        {personen.isPending ? <Loading /> : personen.error ? <ErrorState error={personen.error} onRetry={() => void personen.refetch()} /> : !personen.data.length ? <p className="empty">{TB.keinePerson}</p> : (
          <ul className="res-personen">
            {personen.data.map(p => {
              const frei = minFrei(p);
              return (
                <li key={p.id}>
                  <label>
                    <input type="radio" name={`${id}-person`} checked={person?.id === p.id} onChange={() => setPerson(p)} />
                    <span>{p.name}</span>
                    <span className={`muted small${frei <= 0 ? ' res-voll' : ''}`}>{frei <= 0 ? TB.ueberbucht : TB.freiMin(fte(frei))}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        {gesendet && !person ? <p className="field-error" role="alert">{TB.personFehlt}</p> : null}
      </fieldset>
      <div className="res-zuteilen-felder">
        <label htmlFor={`${id}-fte`}>{TB.anteil}</label>
        <input id={`${id}-fte`} inputMode="decimal" value={wert} onChange={e => setWert(e.target.value)} aria-invalid={gesendet && n === null ? true : undefined} aria-describedby={`${id}-fte-h`} size={5} />
        <label htmlFor={`${id}-von`}>{TB.vonMonat}</label>
        <input id={`${id}-von`} type="month" min={b.vonMonat} max={b.bisMonat} value={von} onChange={e => setVon(e.target.value || b.vonMonat)} />
        <label htmlFor={`${id}-bis`}>{TB.bisMonat}</label>
        <input id={`${id}-bis`} type="month" min={b.vonMonat} max={b.bisMonat} value={bis} onChange={e => setBis(e.target.value || b.bisMonat)} />
      </div>
      <p id={`${id}-fte-h`} className={gesendet && n === null ? 'field-error' : 'note'}>{gesendet && n === null ? TB.anteilUngueltig : TB.wirkung}</p>
      <button type="submit" className="btn primary" disabled={zuteilen.isPending}><Icon name="plus" />{TB.zuteilenAktion}</button>
    </form>
  );
}

function Luecke({ b, write }: { b: Bedarf; write: boolean }) {
  const id = useId();
  const toast = useToast();
  const luecke = useLuecke();
  const [text, setText] = useState('');
  if (b.luecke) {
    return (
      <Hinweis stufe="warnung" aktion={write ? <button type="button" className="btn" disabled={luecke.isPending} onClick={() => luecke.mutate({ id: b.id, text: null }, { onSuccess: () => toast.show(TB.lueckeWeg), onError: e => toast.error(e) })}>{TB.lueckeZuruecknehmen}</button> : undefined}>
        {TB.lueckeGemeldet(fmtDatum(b.luecke.gemeldetAt))}{b.luecke.text ? `: ${b.luecke.text}` : ''}
      </Hinweis>
    );
  }
  if (!write || b.stand === 'gedeckt') return null;
  return (
    <form className="res-luecke" onSubmit={e => { e.preventDefault(); luecke.mutate({ id: b.id, text }, { onSuccess: () => { toast.show(TB.lueckeOk); setText(''); }, onError: x => toast.error(x) }); }}>
      <label htmlFor={`${id}-t`}>{TB.lueckeText}</label>
      <textarea id={`${id}-t`} rows={2} maxLength={1000} value={text} onChange={e => setText(e.target.value)} aria-describedby={`${id}-w`} />
      <p id={`${id}-w`} className="note">{TB.lueckeWirkung}</p>
      <button type="submit" className="btn" disabled={luecke.isPending}>{TB.lueckeMelden}</button>
    </form>
  );
}

export function BedarfDrawer({ id, rolle, onClose }: { id: string; rolle(r: string): string; onClose(): void }) {
  const q = useBedarf(id);
  const [konflikte, setKonflikte] = useState<Konflikt[]>([]);
  const d = q.data;
  const b = d?.bedarf;
  const titel = b ? TB.drawerTitel(rolle(b.rolle), b.projekt ? `${b.projekt.nummer} ${b.projekt.name}` : '') : TB.angaben;
  return (
    <Drawer title={titel} onClose={onClose} actions={b ? <Stand familie={STAND_FAMILIE[b.stand]} label={TB.stand[b.stand]} /> : undefined}>
      {q.isPending ? <Loading /> : q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : d && b ? (
        <>
          {konflikte.length ? (
            <section aria-label={TB.warnungNachSpeichern} className="res-warnungen">
              {konflikte.map(k => <KonfliktMeldung key={`${k.art}:${k.personId ?? k.rolle}:${k.monat}`} k={k} rolle={rolle} live />)}
            </section>
          ) : null}
          <dl className="attrs">
            <dt>{TB.spalte.rolle}</dt><dd>{rolle(b.rolle)}</dd>
            <dt>{TB.spalte.phase}</dt><dd>{b.phase}</dd>
            <dt>{TB.spalte.zeitraum}</dt><dd>{`${monatLang(b.vonMonat)} – ${monatLang(b.bisMonat)}`}</dd>
            <dt>{TB.spalte.fte}</dt><dd>{fte(b.fte)}</dd>
            <dt>{TB.spalte.prioritaet}</dt><dd>{b.prioritaet ? TB.rang(b.prioritaet.rang) : <span className="empty">{TB.keinRang}</span>}</dd>
            {b.bemerkung ? <><dt>{TB.bemerkung}</dt><dd>{b.bemerkung}</dd></> : null}
          </dl>
          <Luecke b={b} write={d.can.write} />
          <section aria-labelledby={`${id}-m`} className="grp">
            <h3 id={`${id}-m`} className="grp-h">{TB.monate}</h3>
            <table className="res-deckung">
              <thead><tr><th scope="col">{TB.monat}</th><th scope="col" className="num">{TB.bedarf}</th><th scope="col" className="num">{TB.zugeteilt}</th></tr></thead>
              <tbody>
                {d.monate.map(m => (
                  <tr key={m.monat} className={m.zugeteilt < m.bedarf ? 'res-luecke-zeile' : undefined}>
                    <th scope="row">{monatLang(m.monat)}</th><td className="num">{fte(m.bedarf)}</td><td className="num">{fte(m.zugeteilt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section aria-labelledby={`${id}-z`} className="grp">
            <h3 id={`${id}-z`} className="grp-h">{TB.zuteilungen}</h3>
            <Zuteilungen liste={d.zuteilungen} write={d.can.write} />
          </section>
          <section aria-labelledby={`${id}-n`} className="grp">
            <h3 id={`${id}-n`} className="grp-h">{TB.zuteilen}</h3>
            {d.can.write ? <Zuteilen b={b} onKonflikte={setKonflikte} /> : <p className="note">{TB.nurLesen}</p>}
          </section>
        </>
      ) : null}
    </Drawer>
  );
}
