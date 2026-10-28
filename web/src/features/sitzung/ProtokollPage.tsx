/**
 * Protokoll (UI-35, Seitentyp «Arbeitsfläche»; UC-006 Schritte 8–9; K3 Schritt 10): Entwurf mit Traktanden,
 * Entscheiden, Begründungen und Auflagen; die UE ergänzt Anwesende, Notizen und Bemerkungen (automatisches Speichern
 * beim Verlassen des Feldes, If-Match). Kopf «Versand bis … · in n Arbeitstagen» (Q8 Kap. 8.1, K3-4); «Protokoll
 * versenden» mit Vorschau der Empfänger (I-R1). Mitglieder lesen ab dem Versand (Z8, Z9).
 * Adresse `/gremien/<kuerzel>/sitzungen/<datum>/protokoll` (I-N5).
 */
import { useId, useState } from 'react';
import { isConflict, statusOf } from '../../api/index.ts';
import { Dialog, Empty, ErrorState, Hinweis, Icon, Loading, Stand, T, fmtDatum, fmtZeitpunkt, useToast } from '../../ui/index.ts';
import { useSitzung } from './api.ts';
import { sitzungPfad } from './search.ts';
import { useProtokoll, useProtokollMutations, useProtokollversand, type Protokoll, type ProtokollPut } from './Sitzungsmodus.api.ts';
import { TM } from './Sitzungsmodus.texte.ts';
import { TS } from './texte.ts';
import './sitzung.css';
import './Sitzungsmodus.css';

function fristText(p: Protokoll): string | null {
  const f = p.frist;
  if (!f.bis) return null;
  const n = f.restArbeitstage ?? 0;
  const d = fmtDatum(f.bis);
  return n < 0 ? T.format.ueberfaellig(d) : `${d} · ${n === 0 ? T.format.heuteArbeitstag : T.format.inArbeitstagen(n)}`;
}

function VersandDialog({ sitzungId, g, p, busy, onClose, onVersenden }: { sitzungId: string; g: string; p: Protokoll; busy: boolean; onClose(): void; onVersenden(): void }) {
  const v = useProtokollversand(sitzungId, true);
  return (
    <Dialog title={TM.protokollVersandTitel} onClose={onClose} footer={(
      <>
        <button type="button" className="btn" onClick={onClose}>{TS.weiterBearbeiten}</button>
        <button type="button" className="btn primary" disabled={busy || !v.data} onClick={onVersenden}><Icon name="send" />{TM.protokollVersenden}</button>
      </>
    )}>
      {v.isPending ? <Loading /> : v.error ? <ErrorState error={v.error} onRetry={() => void v.refetch()} /> : (
        <div className="sz-wirkung">
          <p>{TM.protokollEmpfaenger(g, v.data.beteiligte.length)}</p>
          {v.data.beteiligte.length ? <p className="smo-leise">{v.data.beteiligte.map(b => b.name ?? '–').join(', ')}</p> : null}
          {v.data.frist.eingehalten ? <p>{TM.protokollFrist(v.data.frist.nachSitzung)}</p>
            : <Hinweis stufe="warnung">{TM.protokollFristVerletzt(fmtDatum(v.data.frist.bis!))}</Hinweis>}
          {p.inhalt.traktanden.some(t => t.behandlung === 'nicht_behandelt') ? <p>{TM.schliessenOhne(p.inhalt.traktanden.filter(t => t.behandlung === 'nicht_behandelt').length)}</p> : null}
        </div>
      )}
    </Dialog>
  );
}

/** Textfeld, das beim Verlassen speichert, wenn sich der Wert geändert hat. */
function Feld({ id, label, wert, zeilen, aktiv, onSpeichern }: { id: string; label: string; wert: string; zeilen: number; aktiv: boolean; onSpeichern(v: string): void }) {
  const [v, setV] = useState(wert);
  if (!aktiv) return wert ? <div className="smo-feld-l"><span className="smo-leise">{label}: </span>{wert}</div> : null;
  return (
    <div className="field smo-feld">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} rows={zeilen} value={v} maxLength={8000} onChange={e => setV(e.target.value)} onBlur={() => { if (v.trim() !== wert) onSpeichern(v); }} />
    </div>
  );
}

export function ProtokollPage({ kuerzel, datum, gehe }: { kuerzel: string; datum: string; gehe(pfad: string): void }) {
  const toast = useToast();
  const titelId = useId();
  const sq = useSitzung(kuerzel, datum);
  const pq = useProtokoll(sq.data?.id);
  const mut = useProtokollMutations(sq.data?.id ?? '');
  const [versand, setVersand] = useState(false);
  const g = kuerzel.toUpperCase();

  if (sq.isPending || (sq.data && pq.isPending)) return <Loading />;
  const s = sq.data;
  const p = pq.data;
  const kopf = (
    <header className="mh">
      <div className="mh-row">
        <div className="mh-title">
          <div className="type-ico neutral"><Icon name="doc" /></div>
          <div className="minw0">
            <h1 id={titelId}>{TM.protokollTitel(g, fmtDatum(datum))}</h1>
            {p ? (
              <div className="sub sz-kopf">
                <Stand familie={p.stand === 'versendet' ? 'positiv' : 'entwurf'} label={p.stand === 'versendet' ? TS.stand.protokoll_versendet! : 'Entwurf'} />
                {s ? <span>{s.gremium.name}</span> : null}
                {p.stand === 'entwurf' && fristText(p) ? <span className="sz-frist"><strong>{TM.versandBis}</strong> {fristText(p)}</span> : null}
                {mut.speichern.isPending ? <span className="smo-leise" aria-live="polite">{TM.speichert}</span> : null}
              </div>
            ) : null}
          </div>
        </div>
        <div className="acts">
          <button type="button" className="btn" onClick={() => gehe(`${sitzungPfad(kuerzel, datum)}/modus`)}><Icon name="gavel" />{TM.zumModus}</button>
          {p ? <button type="button" className="btn" onClick={() => window.print()}><Icon name="printer" />{TM.drucken}</button> : null}
          {p?.can.write ? <button type="button" className="btn primary" disabled={mut.versenden.isPending || mut.speichern.isPending} onClick={() => setVersand(true)}><Icon name="send" />{TM.protokollVersenden}</button> : null}
        </div>
      </div>
    </header>
  );
  if (sq.error || !s) {
    return statusOf(sq.error) === 404 ? <Empty>{TS.gone}</Empty> : <ErrorState error={sq.error} onRetry={() => void sq.refetch()} />;
  }
  if (!p) {
    return (
      <section aria-labelledby={titelId}>
        {kopf}
        <div className="body">{statusOf(pq.error) === 404 || !pq.error ? <Empty>{TM.protokollFehlt}</Empty> : <ErrorState error={pq.error} onRetry={() => void pq.refetch()} />}</div>
      </section>
    );
  }

  const aktiv = p.can.write;
  const speichern = (body: ProtokollPut) => mut.speichern.mutate({ p, body }, {
    onError: e => {
      void pq.refetch();
      if (isConflict(e)) toast.show(TM.protokollKonflikt, { tone: 'error' }); else toast.error(e);
    },
  });
  const ueber = p.stand === 'entwurf' && p.frist.restArbeitstage !== null && p.frist.restArbeitstage < 0;
  return (
    <section aria-labelledby={titelId} className="smo-seite smo-protokoll">
      {kopf}
      {/* scrollbar auch ohne Eingabefelder (nach dem Versand) mit der Tastatur erreichbar (axe scrollable-region-focusable) */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- beschriftete, scrollbare Region (WCAG 2.1.1) */}
      <div className="body" tabIndex={0} role="region" aria-label={TM.protokoll}>
        {p.stand === 'versendet' ? <div className="sz-banner"><Hinweis stufe="hinweis">{TM.protokollVersendetBanner(fmtZeitpunkt(p.versendetAt!))} {TM.protokollFest}</Hinweis></div> : null}
        {ueber ? <div className="sz-banner"><Hinweis stufe="warnung">{TM.protokollFristVerletzt(fmtDatum(p.frist.bis!))}</Hinweis></div> : null}
        <div className="smo-prot">
          <p className="smo-leise">{p.inhalt.kopf.gremium.name} · {fmtDatum(p.inhalt.kopf.datum)}{p.inhalt.kopf.beginn ? ` · ${p.inhalt.kopf.beginn}` : ''}{p.inhalt.kopf.ort ? ` · ${p.inhalt.kopf.ort}` : ''}</p>
          <Feld id={`${titelId}-anw`} label={TM.anwesende} wert={p.inhalt.anwesende} zeilen={2} aktiv={aktiv} onSpeichern={v => speichern({ anwesende: v })} />
          <ol className="smo-prot-liste">
            {p.inhalt.traktanden.map(t => (
              <li key={t.traktandumId} className="smo-prot-tr">
                <h2 className="smo-h">{t.position}. {t.projekt ? `${t.projekt.nummer} ` : ''}{t.titel}</h2>
                {t.antrag ? <p><span className="smo-leise">{TM.antrag}: </span>{t.antrag}</p> : null}
                {t.entscheid ? (
                  <div className="smo-entscheid">
                    <p className="smo-ergebnis">{t.entscheid.stellungnahme ? `${TM.stellungnahmeKurz}: ` : ''}{t.entscheid.label}</p>
                    <p>{t.entscheid.begruendung}</p>
                    {t.entscheid.auflagen.length ? (
                      <><h3 className="smo-h3">{TM.auflagen}</h3><ul className="smo-al">{t.entscheid.auflagen.map((a, i) => <li key={i}>{TM.auflageZeile(a.text, a.verantwortlich, fmtDatum(a.termin))}</li>)}</ul></>
                    ) : null}
                    {t.entscheid.anVr ? <p className="smo-leise">{TM.weitergeleitet}</p> : null}
                  </div>
                ) : <p className="smo-leise">{t.behandlung === 'nicht_behandelt' ? TM.nichtBehandelt : TM.kenntnis}</p>}
                <Feld id={`${titelId}-n-${t.traktandumId}`} label={TM.notiz} wert={t.notiz} zeilen={2} aktiv={aktiv}
                  onSpeichern={v => speichern({ notizen: [{ traktandumId: t.traktandumId, notiz: v }] })} />
              </li>
            ))}
          </ol>
          <Feld id={`${titelId}-bem`} label={TM.bemerkungen} wert={p.inhalt.bemerkungen} zeilen={3} aktiv={aktiv} onSpeichern={v => speichern({ bemerkungen: v })} />
        </div>
      </div>
      {versand ? (
        <VersandDialog sitzungId={s.id} g={g} p={p} busy={mut.versenden.isPending || mut.speichern.isPending} onClose={() => setVersand(false)}
          onVersenden={() => mut.versenden.mutate(p, {
            onSuccess: () => { setVersand(false); toast.show(TM.protokollVersendet); },
            onError: e => { setVersand(false); void pq.refetch(); if (isConflict(e)) toast.show(TM.protokollKonflikt, { tone: 'error' }); else toast.error(e); },
          })} />
      ) : null}
    </section>
  );
}
