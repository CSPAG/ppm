/**
 * Schublade einer Dokumentart (`?o=<art>`, UI-48; UC-018 Schritt 2): Versionen mit Stand, neue Version hochladen; eine
 * Version (`&v=<nummer>`) zeigt die Platzhalter mit ihrem Datenfeld, den Prüfbericht (Sperre/Warnung nach I-P1, Texte
 * vom Server) und die Aktionen «Zuordnung speichern», «Aktiv setzen» (Wirkung vorher, I-F5/I-R1 Stufe 3) und «Entwurf
 * löschen» (Dialog, I-R1 Stufe 2). Aktive und abgelöste Versionen sind gesperrt (Z9); 412 → Hinweis mit «Neu laden» (Z7).
 */
import { describeError } from '@vollholz/iam-web';
import { useId, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { isConflict, newIdempotencyKey } from '../../api/index.ts';
import { Confirm, Dialog, Drawer, Empty, ErrorState, fmtZeitpunkt, Hinweis, Icon, Loading, Stand, T, useToast, type StandFamilie } from '../../ui/index.ts';
import { dateiLaden, useVorlage, useVorlageMutations, type Art, type VorlageArt, type VorlageDetail, type VorlageFeld, type VorlageVersion } from './api.ts';
import { TV } from './texte.ts';

const FAMILIE: Record<string, StandFamilie> = { entwurf: 'entwurf', aktiv: 'positiv', abgeloest: 'ruhend' };
const MAX = 5 * 1024 * 1024;

export interface VorlageDrawerProps {
  art: string; version: number | null; arten: VorlageArt[]; laedt: boolean; onVersion(v: number | undefined): void; onClose(): void;
}

export function VorlageDrawer({ art, version, arten, laedt, onVersion, onClose }: VorlageDrawerProps) {
  const eintrag = arten.find(a => a.art === art);
  if (laedt) return <Drawer title={TV.title} onClose={onClose}><Loading /></Drawer>;
  if (!eintrag) return <Drawer title={TV.title} onClose={onClose}><Empty>{TV.gone}</Empty></Drawer>;
  return <Inhalt eintrag={eintrag} version={version} onVersion={onVersion} onClose={onClose} />;
}

function Inhalt({ eintrag, version, onVersion, onClose }: { eintrag: VorlageArt; version: number | null; onVersion(v: number | undefined): void; onClose(): void }) {
  const art = eintrag.art as Art;
  const q = useVorlage(art);
  if (q.isPending) return <Drawer title={eintrag.name} onClose={onClose}><Loading /></Drawer>;
  if (q.error) return <Drawer title={eintrag.name} onClose={onClose}><ErrorState error={q.error} onRetry={() => void q.refetch()} /></Drawer>;
  const v = version ? q.data.versionen.find(x => x.version === version) : undefined;
  if (version && !v) {
    return <Drawer title={eintrag.name} onClose={onClose}><Empty action={<button type="button" className="btn" onClick={() => onVersion(undefined)}>{TV.zurueck}</button>}>{TV.versionGone}</Empty></Drawer>;
  }
  return v
    // neuer Stand vom Server (nach Speichern oder Neu laden): Schlüssel mit `rev` setzt die Auswahl zurück
    ? <Version key={`${v.version}:${v.rev}`} detail={q.data} v={v} onZurueck={() => onVersion(undefined)} onClose={onClose} neuLaden={() => void q.refetch()} />
    : <Uebersicht detail={q.data} eintrag={eintrag} onVersion={onVersion} onClose={onClose} />;
}

// ---------------------------------------------------------------- Übersicht: Versionen und Hochladen

function Uebersicht({ detail, eintrag, onVersion, onClose }: { detail: VorlageDetail; eintrag: VorlageArt; onVersion(v: number): void; onClose(): void }) {
  const art = detail.art as Art;
  const toast = useToast();
  const m = useVorlageMutations(art);
  const id = useId();
  const datei = useRef<HTMLInputElement>(null);
  const [key, setKey] = useState(newIdempotencyKey);
  const [fehler, setFehler] = useState<string | null>(null);

  const hochladen = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.docx')) { setFehler(TV.keinWord); return; }
    if (file.size > MAX) { setFehler(TV.zuGross); return; }
    setFehler(null);
    m.hochladen.mutate({ file, key }, {
      onSuccess: neu => { setKey(newIdempotencyKey()); toast.show(TV.hochgeladen(neu.version)); onVersion(neu.version); },
      onError: err => { const d = describeError(err); setFehler(d.detail || d.title || T.common.error); },
    });
  };

  return (
    <Drawer title={detail.name} onClose={onClose} actions={(
      <>
        <input ref={datei} id={`${id}-f`} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr"
          onChange={hochladen} aria-describedby={`${id}-h`} tabIndex={-1} />
        <button type="button" className="btn sm primary" onClick={() => datei.current?.click()} disabled={m.hochladen.isPending}>
          <Icon name="upload" />{m.hochladen.isPending ? TV.wirdHochgeladen : TV.hochladen}
        </button>
      </>
    )}>
      <p id={`${id}-h`} className="hint">{TV.hochladenHint}</p>
      {fehler ? <Hinweis stufe="sperre" live>{fehler}</Hinweis> : null}
      {!eintrag.datenquelle ? <Hinweis stufe="hinweis">{TV.vorbereitetHinweis}</Hinweis> : null}
      <p className="vl-gilt"><strong>{TV.gilt}: </strong>
        {eintrag.aktiv ? TV.eigene(eintrag.aktiv) : detail.grundbestand ? TV.grundbestand(detail.grundbestand.version) : TV.keine}
      </p>
      <h3 className="vl-h">{TV.versionenTitel}</h3>
      {detail.versionen.length === 0 ? <Empty>{TV.leer}</Empty> : (
        <ul className="vl-liste">
          {detail.versionen.map(v => (
            <li key={v.version}>
              <button type="button" className="vl-zeile" onClick={() => onVersion(v.version)} aria-label={`${TV.version(v.version)}, ${TV.stand[v.stand]}`}>
                <span className="vl-nr">{TV.version(v.version)}</span>
                <Stand familie={FAMILIE[v.stand]!} label={TV.stand[v.stand]!} />
                <span className="muted small vl-meta">{v.dateiname} · {TV.von(fmtZeitpunkt(v.erstelltAt), v.erstelltVon?.name ?? null)}</span>
                {v.stand === 'entwurf' && !v.pruefung.aktivierbar ? <span className="vl-warn"><Icon name="warn" /><span className="sr">{TV.pruefung}</span></span> : null}
                <Icon name="chev" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}

// ---------------------------------------------------------------- Eine Version: Zuordnung, Prüfung, Aktionen

/** Felder nach Gruppe für die Auswahl (optgroup). */
function gruppiert(felder: readonly VorlageFeld[]): [string, VorlageFeld[]][] {
  const m = new Map<string, VorlageFeld[]>();
  for (const f of felder) m.set(f.gruppe, [...(m.get(f.gruppe) ?? []), f]);
  return [...m];
}

function Version({ detail, v, onZurueck, onClose, neuLaden }: { detail: VorlageDetail; v: VorlageVersion; onZurueck(): void; onClose(): void; neuLaden(): void }) {
  const art = detail.art as Art;
  const toast = useToast();
  const m = useVorlageMutations(art);
  const id = useId();
  const [entwurf, setEntwurf] = useState<Record<string, string | null>>(v.zuordnung);
  const [dialog, setDialog] = useState<'aktivieren' | 'entfernen' | null>(null);
  const [fehler, setFehler] = useState<{ text: string; konflikt: boolean } | null>(null);
  const gruppen = useMemo(() => gruppiert(detail.felder ?? []), [detail.felder]);
  const geaendert = JSON.stringify(entwurf) !== JSON.stringify(v.zuordnung);
  const bearbeitbar = v.can.zuordnen && !!detail.felder;
  const aktivAlt = detail.versionen.find(x => x.stand === 'aktiv')?.version ?? null;
  const sperre = v.pruefung.meldungen.filter(x => x.stufe === 'sperre');

  const fehlerAus = (err: unknown) => {
    const d = describeError(err);
    setFehler({ text: isConflict(err) ? TV.conflict : d.detail || d.title || T.common.error, konflikt: isConflict(err) });
  };
  const speichern = () => m.zuordnen.mutate({ v, zuordnung: entwurf }, { onSuccess: () => { setFehler(null); toast.show(TV.gespeichert); }, onError: fehlerAus });
  const aktivieren = () => m.aktivieren.mutate({ v }, {
    onSuccess: neu => { setDialog(null); setFehler(null); toast.show(TV.aktiviert(neu.version)); },
    onError: err => { setDialog(null); fehlerAus(err); },
  });
  const entfernen = () => m.entfernen.mutate({ v }, {
    onSuccess: () => { setDialog(null); toast.show(TV.entfernt(v.version)); onZurueck(); },
    onError: err => { setDialog(null); fehlerAus(err); },
  });

  return (
    <Drawer title={`${detail.name} · ${TV.version(v.version)}`} onClose={onClose}
      actions={<button type="button" className="btn sm" onClick={onZurueck}><Icon name="arrow" className="vl-zurueck" />{TV.zurueck}</button>}
      footer={v.stand === 'entwurf' ? (
        <>
          <button type="button" className="btn" onClick={() => setDialog('entfernen')}>{TV.entfernen}</button>
          {bearbeitbar ? <button type="button" className="btn" onClick={speichern} disabled={!geaendert || m.zuordnen.isPending}>{TV.speichern}</button> : null}
          <button type="button" className="btn primary" onClick={() => setDialog('aktivieren')} disabled={!v.can.aktivieren || geaendert}
            aria-describedby={!v.can.aktivieren || geaendert ? `${id}-p` : undefined}>{TV.aktivieren}</button>
        </>
      ) : undefined}>
      <div className="vl-kopf">
        <Stand familie={FAMILIE[v.stand]!} label={TV.stand[v.stand]!} />
        <span className="muted small">{v.dateiname} · {TV.von(fmtZeitpunkt(v.erstelltAt), v.erstelltVon?.name ?? null)}</span>
        <button type="button" className="btn sm" onClick={() => void dateiLaden(art, v).catch(fehlerAus)}><Icon name="download" />{TV.datei}</button>
      </div>
      {v.bemerkung ? <p>{v.bemerkung}</p> : null}
      {v.stand !== 'entwurf' ? <Hinweis stufe="hinweis">{TV.gesperrt}</Hinweis> : null}
      {fehler ? (
        <Hinweis stufe="sperre" live aktion={fehler.konflikt ? <button type="button" className="btn sm" onClick={() => { setFehler(null); neuLaden(); }}>{T.common.reload}</button> : undefined}>
          {fehler.text}
        </Hinweis>
      ) : null}

      <section aria-labelledby={`${id}-p`} className="vl-pruefung">
        <h3 id={`${id}-p`} className="vl-h">{TV.pruefung}</h3>
        {geaendert ? <Hinweis stufe="hinweis">{TV.ungespeichert}</Hinweis> : null}
        {v.pruefung.meldungen.length === 0 ? <Hinweis stufe="hinweis">{TV.pruefungOk}</Hinweis>
          : v.pruefung.meldungen.map(x => <Hinweis key={x.regel} stufe={x.stufe}>{x.text}</Hinweis>)}
      </section>

      <h3 className="vl-h">{TV.zuordnung}</h3>
      {v.platzhalter.length === 0 ? <Empty>{TV.keinePlatzhalter}</Empty> : (
        <table className="dl vl-tab">
          <caption className="sr">{TV.zuordnung}</caption>
          <thead><tr><th scope="col">{TV.platzhalter}</th><th scope="col">{TV.feld}</th></tr></thead>
          <tbody>
            {v.platzhalter.map(p => {
              const offen = sperre.some(x => x.platzhalter?.includes(p));
              return (
                <tr key={p} className="static">
                  <td data-label={TV.platzhalter} className="nm karte"><label htmlFor={`${id}-${p}`} className="mono">«{p}»</label></td>
                  <td data-label={TV.feld} className="karte">
                    {bearbeitbar ? (
                      <select id={`${id}-${p}`} value={entwurf[p] ?? ''} aria-invalid={offen && !entwurf[p] ? true : undefined}
                        onChange={e => setEntwurf({ ...entwurf, [p]: e.target.value || null })}>
                        <option value="">{TV.feldWaehlen}</option>
                        {gruppen.map(([g, fs]) => (
                          <optgroup key={g} label={g}>{fs.map(f => <option key={f.schluessel} value={f.schluessel}>{f.bezeichnung}</option>)}</optgroup>
                        ))}
                      </select>
                    ) : (
                      <span id={`${id}-${p}`}>{(detail.felder ?? []).find(f => f.schluessel === v.zuordnung[p])?.bezeichnung ?? v.zuordnung[p] ?? <span className="muted">{TV.feldWaehlen}</span>}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {dialog === 'aktivieren' ? (
        <Dialog title={TV.aktivFrage(v.version)} onClose={() => setDialog(null)} footer={<>
          <button type="button" className="btn" onClick={() => setDialog(null)} data-autofocus>{T.common.cancel}</button>
          <button type="button" className="btn primary" onClick={aktivieren} disabled={m.aktivieren.isPending}>{TV.aktivieren}</button>
        </>}>
          <p>{TV.aktivWirkung(detail.name, aktivAlt)}</p>
          {v.pruefung.meldungen.filter(x => x.stufe === 'warnung').map(x => <Hinweis key={x.regel} stufe="warnung">{x.text}</Hinweis>)}
        </Dialog>
      ) : null}
      {dialog === 'entfernen' ? (
        <Confirm title={TV.entfernenFrage(v.version)} text={TV.entfernenText} confirm={TV.entfernen} onConfirm={entfernen} onClose={() => setDialog(null)} busy={m.entfernen.isPending} />
      ) : null}
    </Drawer>
  );
}
