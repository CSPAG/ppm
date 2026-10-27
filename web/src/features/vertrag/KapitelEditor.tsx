/**
 * Editor eines Kapitels (UI-07, K2 Schritt 3): Felder nach der Beschreibung in `felder.ts` – Texte, Listen mit
 * Hinzufügen und Entfernen, Termine, Ziel aus dem Zielbaum. Jedes Feld trägt die ID seines Sprungziels (K2-4). Im
 * Lesemodus (Z8, Z9) ohne Bearbeiten-Elemente. Unter Texten steht die Baseline, wenn der Entwurf davon abweicht.
 */
import { PersonName, PersonPick } from '@vollholz/iam-web';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { api } from '../../api/index.ts';
import { fmtBetrag, fmtDatum, Icon } from '../../ui/index.ts';
import { useProjekteAuswahl, useRollen, useStrategischeZiele, type Inhalt } from './api.ts';
import { feldId, kapitel, TERMINE, type Feld, type Spalte } from './felder.ts';
import { TV } from './texte.ts';

export interface EditorProps {
  nr: number;
  inhalt: Inhalt;
  basis: Inhalt | null;
  ro: boolean;
  /** Fehler je Feld: `feld` oder `feld/<index>/<spalte>` (lokal und vom Server). */
  fehler: Record<string, string>;
  onChange(inhalt: Inhalt, feld: string): void;
  /** Ziele lesen (`ziel:read` an der Organisation). */
  zieleLesbar: boolean;
}

type Zeile = Record<string, unknown>;

export function KapitelEditor({ nr, inhalt, basis, ro, fehler, onChange, zieleLesbar }: EditorProps) {
  const k = kapitel(nr);
  const setze = (key: string, v: unknown) => onChange({ ...inhalt, [key]: v }, key);
  return (
    <div className="vt-ed">
      {k.felder.map(f => (
        <div key={f.key} id={feldId(nr, f.key)} className="vt-feld" data-feld={f.key}>
          <FeldEditor nr={nr} f={f} wert={inhalt[f.key]} basis={basis?.[f.key]} ro={ro} fehler={fehler} setze={v => setze(f.key, v)}
            inhalt={inhalt} zieleLesbar={zieleLesbar} onZiel={(zielId, hf) => onChange({ ...inhalt, strategischesZielId: zielId, handlungsfeldId: hf, jahreszielId: null }, 'strategischesZielId')} />
        </div>
      ))}
    </div>
  );
}

function FeldEditor({ nr, f, wert, basis, ro, fehler, setze, inhalt, zieleLesbar, onZiel }: {
  nr: number; f: Feld; wert: unknown; basis: unknown; ro: boolean; fehler: Record<string, string>; setze(v: unknown): void; inhalt: Inhalt;
  zieleLesbar: boolean; onZiel(zielId: string | null, handlungsfeldId: string | null): void;
}) {
  const id = `${feldId(nr, f.key)}-in`;
  const err = fehler[f.key];
  const errId = `${id}-e`;
  const hilfeId = `${id}-h`;
  const beschrieben = [f.hilfe ? hilfeId : '', err ? errId : ''].filter(Boolean).join(' ') || undefined;
  const label = <>{f.label}{f.optional ? <span className="muted"> ({TV.optional})</span> : null}</>;

  if (f.art === 'text') {
    const v = typeof wert === 'string' ? wert : '';
    const b = typeof basis === 'string' ? basis : null;
    return (
      <div className="field vt-text">
        <label htmlFor={id}>{label}</label>
        {ro ? <p id={id} className="vt-ro" tabIndex={-1}>{v || <span className="muted">{TV.keine}</span>}</p>
          : <textarea id={id} rows={4} value={v} maxLength={20000} onChange={e => setze(e.target.value)} aria-invalid={err ? true : undefined} aria-describedby={beschrieben} />}
        {f.hilfe ? <p id={hilfeId} className="hint">{f.hilfe}</p> : null}
        {b !== null && b !== v ? <p className="hint vt-basis">{TV.basis(b || '–')}</p> : null}
        {err ? <p id={errId} className="ferr">{err}</p> : null}
      </div>
    );
  }
  if (f.art === 'termine') {
    const t = (wert ?? {}) as Record<string, string | null>;
    return (
      <fieldset className="vt-termine">
        <legend className="vt-legend">{f.label}</legend>
        {TERMINE.map(([key, l]) => (
          <div key={key} className="field">
            <label htmlFor={`${id}-${key}`}>{l} <span className="muted">({TV.optional})</span></label>
            {ro ? <p id={`${id}-${key}`} className="vt-ro">{t[key] ? fmtDatum(t[key]!) : '–'}</p>
              : <input id={`${id}-${key}`} type="date" value={t[key] ?? ''} onChange={e => setze({ ...t, [key]: e.target.value || null })} />}
          </div>
        ))}
      </fieldset>
    );
  }
  if (f.art === 'ziel') return <ZielFeld id={id} label={label} hilfe={f.hilfe} wert={wert as string | null} ro={ro} err={err} lesbar={zieleLesbar} onZiel={onZiel} />;
  if (f.art === 'jahresziel') {
    return <JahreszielFeld id={id} label={label} ziel={inhalt.strategischesZielId as string | null} wert={wert as string | null} ro={ro} err={err} lesbar={zieleLesbar} setze={setze} />;
  }
  if (f.art === 'handlungsfeld') return <HandlungsfeldFeld id={id} label={label} wert={wert as string | null} lesbar={zieleLesbar} />;
  return <ListeFeld nr={nr} f={f} zeilen={(wert ?? []) as Zeile[]} ro={ro} fehler={fehler} setze={setze} />;
}

function ZielFeld({ id, label, hilfe, wert, ro, err, lesbar, onZiel }: {
  id: string; label: ReactNode; hilfe?: string; wert: string | null; ro: boolean; err?: string; lesbar: boolean;
  onZiel(zielId: string | null, handlungsfeldId: string | null): void;
}) {
  const ziele = useStrategischeZiele(lesbar);
  const liste = ziele.data ?? [];
  const gewaehlt = liste.find(z => z.id === wert);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {ro || !lesbar ? (
        <p id={id} className="vt-ro" tabIndex={-1}>{gewaehlt ? `${gewaehlt.nummer} ${gewaehlt.text}` : wert ? <span className="muted">{TV.zielNichtLesbar}</span> : TV.zielKeins}</p>
      ) : (
        <select id={id} value={wert ?? ''} aria-invalid={err ? true : undefined} aria-describedby={err ? `${id}-e` : `${id}-h`}
          onChange={e => { const z = liste.find(x => x.id === e.target.value); onZiel(z?.id ?? null, z?.handlungsfeldId ?? null); }}>
          <option value="">{TV.zielKeins}</option>
          {liste.map(z => <option key={z.id} value={z.id}>{`${z.nummer} ${z.text}`}</option>)}
        </select>
      )}
      {hilfe ? <p id={`${id}-h`} className="hint">{hilfe}</p> : null}
      {gewaehlt && !ro ? <p className="hint">{TV.zielHinweis(gewaehlt.nummer)}</p> : null}
      {err ? <p id={`${id}-e`} className="ferr">{err}</p> : null}
    </div>
  );
}

function JahreszielFeld({ id, label, ziel, wert, ro, err, lesbar, setze }: {
  id: string; label: ReactNode; ziel: string | null; wert: string | null; ro: boolean; err?: string; lesbar: boolean; setze(v: unknown): void;
}) {
  const q = useQuery({
    queryKey: ['vertrag', 'jahresziele', ziel],
    enabled: lesbar && !!ziel,
    queryFn: async ({ signal }) => (await api.GET('/v1/jahresziele', { params: { query: { strategischesZiel: ziel!, limit: 200 } }, signal })).data!.items,
  });
  const liste = q.data ?? [];
  const gewaehlt = liste.find(j => j.id === wert);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {ro || !lesbar || !ziel ? <p id={id} className="vt-ro" tabIndex={-1}>{gewaehlt ? `${gewaehlt.nummer} ${gewaehlt.text}` : '–'}</p> : (
        <select id={id} value={wert ?? ''} onChange={e => setze(e.target.value || null)} aria-invalid={err ? true : undefined}>
          <option value="">–</option>
          {liste.map(j => <option key={j.id} value={j.id}>{`${j.jahr} · ${j.nummer} ${j.text}`}</option>)}
        </select>
      )}
      {err ? <p className="ferr">{err}</p> : null}
    </div>
  );
}

function HandlungsfeldFeld({ id, label, wert, lesbar }: { id: string; label: ReactNode; wert: string | null; lesbar: boolean }) {
  const q = useQuery({
    queryKey: ['vertrag', 'handlungsfelder'],
    enabled: lesbar && !!wert,
    queryFn: async ({ signal }) => (await api.GET('/v1/handlungsfelder', { params: { query: { limit: 200 } }, signal })).data!.items,
  });
  const hf = q.data?.find(h => h.id === wert);
  return (
    <div className="field">
      <span className="vt-label">{label}</span>
      <p id={id} className="vt-ro" tabIndex={-1}>{hf?.label ?? (wert ? '…' : '–')}</p>
    </div>
  );
}

function ListeFeld({ nr, f, zeilen, ro, fehler, setze }: { nr: number; f: Feld; zeilen: Zeile[]; ro: boolean; fehler: Record<string, string>; setze(v: unknown): void }) {
  const was = f.eintrag ?? f.label;
  const base = feldId(nr, f.key);
  const aendere = (i: number, key: string, v: unknown) => setze(zeilen.map((z, j) => (j === i ? { ...z, [key]: v } : z)));
  const spalten = f.spalten ?? [];
  return (
    <fieldset className="vt-liste" aria-describedby={f.hilfe ? `${base}-h` : undefined}>
      <legend className="vt-legend">{f.label}</legend>
      {f.hilfe ? <p id={`${base}-h`} className="hint">{f.hilfe}</p> : null}
      {zeilen.length === 0 ? <p className="muted small">{TV.keine}</p> : (
        <ol className="vt-zeilen">
          {zeilen.map((z, i) => (
            <li key={i} className="vt-zeile" data-zeile={i}>
              {spalten.map(s => (
                <Zelle key={s.key} s={s} wert={z[s.key]} ro={ro} id={`${base}-${i}-${s.key}`} label={`${s.label} (${TV.zeile(was, i + 1)})`}
                  err={fehler[`${f.key}/${i}/${s.key}`]} setze={v => aendere(i, s.key, v)} />
              ))}
              {!ro ? (
                <button type="button" className="iconbtn vt-weg" aria-label={TV.entfernen(was, i + 1)} title={TV.entfernen(was, i + 1)}
                  onClick={() => setze(zeilen.filter((_, j) => j !== i))}><Icon name="trash" /></button>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      {!ro && f.neu ? (
        <button type="button" className="btn sm ghost" id={`${base}-neu`} onClick={() => setze([...zeilen, f.neu!()])}><Icon name="plus" />{TV.hinzufuegen(was)}</button>
      ) : null}
    </fieldset>
  );
}

function Zelle({ s, wert, ro, id, label, err, setze }: { s: Spalte; wert: unknown; ro: boolean; id: string; label: string; err?: string; setze(v: unknown): void }) {
  const rollen = useRollen();
  const projekte = useProjekteAuswahl();
  const inv = err ? true : undefined;
  const desc = err ? `${id}-e` : undefined;
  let feld: ReactNode;
  if (ro) feld = <span id={id} className="vt-wert">{anzeige(s, wert, { rollen: rollen.data ?? [], projekte: projekte.data ?? [] })}</span>;
  else if (s.art === 'auswahl') {
    feld = (
      <select id={id} value={(wert as string | null) ?? ''} aria-invalid={inv} aria-describedby={desc} onChange={e => setze(e.target.value || null)}>
        {s.optional ? <option value="">–</option> : null}
        {s.optionen!.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    );
  } else if (s.art === 'rolle') {
    feld = (
      <select id={id} value={(wert as string) ?? ''} aria-invalid={inv} aria-describedby={desc} onChange={e => setze(e.target.value)}>
        <option value="">{TV.bitteWaehlen}</option>
        {(rollen.data ?? []).filter(r => r.aktiv || r.schluessel === wert).map(r => <option key={r.schluessel} value={r.schluessel}>{r.label}</option>)}
      </select>
    );
  } else if (s.art === 'projekt') {
    feld = (
      <select id={id} value={(wert as string) ?? ''} aria-invalid={inv} aria-describedby={desc} onChange={e => setze(e.target.value)}>
        <option value="">{TV.bitteWaehlen}</option>
        {(projekte.data ?? []).map(p => <option key={p.id} value={p.id}>{`${p.nummer} ${p.name}`}</option>)}
      </select>
    );
  } else if (s.art === 'person') {
    feld = <PersonPick id={id} value={(wert as string) ?? ''} onChange={v => setze(v)} invalid={!!err} describedBy={desc} />;
  } else if (s.art === 'datum' || s.art === 'monat') {
    feld = <input id={id} type={s.art === 'datum' ? 'date' : 'month'} value={(wert as string | null) ?? ''} aria-invalid={inv} aria-describedby={desc} onChange={e => setze(e.target.value || null)} />;
  } else if (s.art === 'zahl' || s.art === 'betrag') {
    feld = (
      <input id={id} type="number" inputMode="decimal" min={0} step={s.art === 'betrag' ? 0.01 : 0.1} className="vt-zahl" value={wert === null || wert === undefined ? '' : String(wert)}
        aria-invalid={inv} aria-describedby={desc} onChange={e => setze(e.target.value === '' ? null : Number(e.target.value))} />
    );
  } else {
    feld = <input id={id} value={(wert as string) ?? ''} maxLength={s.max} aria-invalid={inv} aria-describedby={desc} onChange={e => setze(e.target.value)} />;
  }
  return (
    <div className={`vt-zelle vt-${s.art}`}>
      <label htmlFor={id} className="vt-zl"><span className="sr">{label}</span><span aria-hidden="true">{s.label}</span></label>
      {feld}
      {err ? <p id={`${id}-e`} className="ferr">{err}</p> : null}
    </div>
  );
}

function anzeige(s: Spalte, wert: unknown, l: { rollen: { schluessel: string; label: string }[]; projekte: { id: string; nummer: string; name: string }[] }): ReactNode {
  if (wert === null || wert === undefined || wert === '') return '–';
  if (s.art === 'auswahl') return s.optionen!.find(([v]) => v === wert)?.[1] ?? String(wert);
  if (s.art === 'rolle') return l.rollen.find(r => r.schluessel === wert)?.label ?? String(wert);
  if (s.art === 'projekt') { const p = l.projekte.find(x => x.id === wert); return p ? `${p.nummer} ${p.name}` : '–'; }
  if (s.art === 'person') return <PersonName id={wert as string} />;
  if (s.art === 'datum') return fmtDatum(wert as string);
  if (s.art === 'betrag') return fmtBetrag(wert as number);
  return String(wert);
}
