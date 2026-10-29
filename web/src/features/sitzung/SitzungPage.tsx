/**
 * Sitzung vorbereiten (UI-33, Seitentyp «Arbeitsfläche»; UC-006 Schritte 1–5, A1, A2; Kernablauf K3): Kopf mit Gremium,
 * Datum, Ort und Versandfrist, links die Traktandenliste mit Zeitbedarf gegen die Sitzungsdauer, rechts die Vorschläge
 * gruppiert nach Art. «Unterlagen versenden» zeigt vorher die Wirkung (I-R1 Stufe 3). Jede Änderung ist bestätigt
 * (I-R2: Antwort des Servers ersetzt die Sitzung); Umkehrbares mit «Rückgängig» im Toast. Mitglieder und Eingeladene
 * lesen ab dem Versand (Z8), danach ist die Liste fest (Z9).
 */
import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';
import { isConflict, statusOf, api } from '../../api/index.ts';
import { Dialog, Empty, ErrorState, Hinweis, Icon, Loading, Stand, T, fmtDatum, fmtZeitpunkt, useToast, Verlauf } from '../../ui/index.ts';
import { useSitzung, useSitzungMutations, useSitzungsliste, useVersandvorschau, useVorschlaege, type Sitzung, type Traktandum } from './api.ts';
import type { SetSitzungSearch, SitzungSearch } from './search.ts';
import { fmtMinuten, standFamilie, Traktandenliste } from './Traktandenliste.tsx';
import { TS } from './texte.ts';
import { Vorschlagsliste } from './Vorschlagsliste.tsx';
import { SitzungsmodusEinstieg } from './SitzungsmodusPage.tsx';
import './sitzung.css';

/** «Mi 5.11. · in 4 Arbeitstagen» aus der Frist des Servers (Arbeitstage mit Feiertagen der Organisation). */
function versandText(s: Sitzung): string | null {
  const f = s.frist;
  if (!f.bis) return null;
  const n = f.restArbeitstage ?? 0;
  const datum = fmtDatum(f.bis);
  return n < 0 ? T.format.ueberfaellig(datum) : `${datum} · ${n === 0 ? T.format.heuteArbeitstag : T.format.inArbeitstagen(n)}`;
}

function VersandDialog({ s, onClose, onVersenden, busy }: { s: Sitzung; onClose(): void; onVersenden(): void; busy: boolean }) {
  const v = useVersandvorschau(s.id, true);
  const g = s.gremium.kuerzel.toUpperCase();
  return (
    <Dialog title={TS.versandTitel} onClose={onClose} footer={(
      <>
        <button type="button" className="btn" onClick={onClose}>{TS.weiterBearbeiten}</button>
        <button type="button" className="btn primary" disabled={busy || !v.data} onClick={onVersenden}><Icon name="send" />{TS.versenden}</button>
      </>
    )}>
      {v.isPending ? <Loading /> : v.error ? <ErrorState error={v.error} onRetry={() => void v.refetch()} /> : (
        <div className="sz-wirkung">
          <p>{TS.versandMitglieder(g, v.data.traktanden, v.data.unterlagen.packet, v.data.unterlagen.bericht)}</p>
          {v.data.eingeladene ? <p>{TS.versandEingeladene(v.data.eingeladene)}</p> : null}
          {v.data.verschoben ? <p>{TS.versandVerschoben(v.data.verschoben)}</p> : null}
          {v.data.frist.arbeitstage === null ? null : v.data.frist.eingehalten
            ? <p>{TS.fristEingehalten(v.data.frist.vorlauf)}</p>
            : <Hinweis stufe="warnung">{TS.fristVerletzt(v.data.frist.vorlauf, v.data.frist.arbeitstage)}</Hinweis>}
          {v.data.warnungen.length ? <Hinweis stufe="warnung">{TS.versandWarnungen(v.data.warnungen.length)} {v.data.warnungen.map(w => w.titel).join(', ')}.</Hinweis> : null}
        </div>
      )}
    </Dialog>
  );
}

export function SitzungPage({ kuerzel, datum, search, gehe }: { kuerzel: string; datum: string; search: SitzungSearch; setSearch: SetSitzungSearch; gehe?(pfad: string): void }) {
  const toast = useToast();
  const q = useSitzung(kuerzel, datum);
  const liste = useSitzungsliste(kuerzel);
  const m = useSitzungMutations(kuerzel, datum);
  const [versand, setVersand] = useState(false);
  const titelId = useId();
  const s = q.data;
  const g = kuerzel.toUpperCase();
  const busy = m.aufnehmen.isPending || m.ordnen.isPending || m.entfernen.isPending || m.verschieben.isPending || m.versenden.isPending;

  // Traktandum aus der Adresse (`?traktandum=3`) in den Blick
  useEffect(() => {
    if (!s || !search.traktandum) return;
    document.querySelector<HTMLElement>(`[data-traktandum="${search.traktandum}"]`)?.scrollIntoView?.({ block: 'center' });
  }, [s, search.traktandum]);

  /** Fehler: Konflikt (Z7) neu laden und erklären, sonst die Meldung des Servers (I-P6). */
  const fehler = (e: unknown) => {
    if (isConflict(e) || statusOf(e) === 409) { void q.refetch(); }
    if (isConflict(e)) toast.show(TS.konflikt, { tone: 'error' }); else toast.error(e);
  };
  const aufnehmen = (id: string, text = TS.aufgenommen) => {
    if (!s) return;
    m.aufnehmen.mutate({ id: s.id, body: { vorschlagId: id } }, { onSuccess: () => toast.show(text), onError: fehler });
  };
  const ordnen = (t: Traktandum, richtung: -1 | 1) => {
    if (!s) return;
    const ids = s.traktanden.map(x => x.id);
    const i = ids.indexOf(t.id), j = i + richtung;
    // das feste Traktandum 1 bleibt an Position 1 (K3 Schritt 4)
    if (j < 0 || j >= ids.length || t.fest || s.traktanden[j]?.fest) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    m.ordnen.mutate({ s, reihenfolge: ids }, {
      onSuccess: () => { requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-griff="${j + 1}"]`)?.focus()); },
      onError: fehler,
    });
  };
  const entfernen = (t: Traktandum) => m.entfernen.mutate(t, {
    onSuccess: () => toast.show(TS.entfernt, { action: { label: TS.rueckgaengig, run: () => aufnehmen(t.id, TS.aufgenommen) } }),
    onError: fehler,
  });
  const aufNaechste = (t: Traktandum) => m.verschieben.mutate(t, {
    onSuccess: r => toast.show(TS.verschoben(fmtDatum(r.nach.datum)), { action: { label: TS.rueckgaengig, run: () => aufnehmen(t.id, TS.aufgenommen) } }),
    onError: fehler,
  });
  const versenden = () => {
    if (!s) return;
    m.versenden.mutate(s, { onSuccess: () => { setVersand(false); toast.show(TS.versandOk); }, onError: e => { setVersand(false); fehler(e); } });
  };

  if (q.isPending) return <Loading />;
  if (q.error || !s) {
    if (statusOf(q.error) !== 404) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
    // Termin ohne Sitzung: anlegen, wer vorbereiten darf (sonst wie «nicht gefunden», Z10)
    const termin = liste.data?.items.some(x => x.datum === datum && !x.id);
    return (
      <section aria-labelledby={titelId}>
        <header className="mh"><div className="mh-row"><div className="mh-title">
          <div className="type-ico neutral"><Icon name="gavel" /></div>
          <h1 id={titelId}>{TS.sitzungTitel(g, fmtDatum(datum))}</h1>
        </div></div></header>
        <div className="body">
          {termin && liste.data?.can.write ? (
            <Empty action={<button type="button" className="btn primary" disabled={m.anlegen.isPending} onClick={() => m.anlegen.mutate(undefined, { onSuccess: () => toast.show(TS.angelegt), onError: fehler })}><Icon name="plus" />{TS.anlegen}</button>}>
              {TS.nichtAngelegt}
            </Empty>
          ) : <Empty>{TS.gone}</Empty>}
        </div>
      </section>
    );
  }

  const bearbeiten = s.can.write;
  const versendet = !!s.versendetAt;
  const vt = versandText(s);
  const ueber = s.dauerMin !== null && s.zeitbedarfMin > s.dauerMin;
  return (
    <section aria-labelledby={titelId} className="sz-seite">
      <header className="mh">
        <div className="mh-row">
          <div className="mh-title">
            <div className="type-ico neutral"><Icon name="gavel" /></div>
            <div className="minw0">
              <h1 id={titelId}>{TS.sitzungTitel(g, fmtDatum(s.datum))}</h1>
              <div className="sub sz-kopf">
                <Stand familie={standFamilie(s.stand)} label={TS.stand[s.stand] ?? s.stand} />
                <span>{s.gremium.name}</span>
                {s.ort ? <span><Icon name="pin" />{s.ort}</span> : null}
                {s.beginn ? <span><Icon name="clock" />{s.beginn}</span> : null}
                {!versendet && vt ? <span className="sz-frist"><strong>{TS.versandBis}</strong> {vt}</span> : null}
              </div>
            </div>
          </div>
          {bearbeiten && !versendet ? (
            <div className="acts">
              <button type="button" className="btn primary" disabled={busy} onClick={() => setVersand(true)}><Icon name="send" />{TS.versenden}</button>
            </div>
          ) : <div className="acts"><SitzungsmodusEinstieg kuerzel={kuerzel} datum={datum} stand={s.stand} gehe={gehe} /></div>}
        </div>
      </header>
      {/* scrollbar auch nach dem Versand ohne Eingabefelder mit der Tastatur erreichbar (axe scrollable-region-focusable, 360 px) */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- beschriftete, scrollbare Region (WCAG 2.1.1) */}
      <div className="body sz-body" tabIndex={0} role="region" aria-label={TS.sitzungInhalt}>
        {versendet ? (
          <div className="sz-banner"><Hinweis stufe="hinweis">{TS.versendetBanner(fmtZeitpunkt(s.versendetAt!))}</Hinweis></div>
        ) : null}
        {!versendet && s.frist.arbeitstage !== null && !s.frist.eingehalten ? (
          <div className="sz-banner"><Hinweis stufe="warnung">{TS.fristBanner(s.frist.vorlauf, s.frist.arbeitstage)}</Hinweis></div>
        ) : null}
        {!bearbeiten && !versendet ? <div className="sz-banner"><Hinweis stufe="hinweis">{TS.nurLesen}</Hinweis></div> : null}
        <div className={`sz-flaeche${bearbeiten ? '' : ' sz-lesen'}`}>
          <div className="sz-haupt">
            <div className="sz-summe" aria-live="polite">
              <h2 className="sz-h">{TS.liste}</h2>
              <span className="sz-sub">{TS.zeitbedarfTitel}: {TS.zeitbedarf(fmtMinuten(s.zeitbedarfMin), s.dauerMin ? fmtMinuten(s.dauerMin) : null)}</span>
            </div>
            {ueber ? <Hinweis stufe="hinweis">{TS.zeitbedarfHinweis(fmtMinuten(s.zeitbedarfMin), fmtMinuten(s.dauerMin!))}</Hinweis> : null}
            {s.traktanden.length ? (
              <Traktandenliste traktanden={s.traktanden} bearbeiten={bearbeiten} busy={busy} versandRest={vt ?? ''}
                aktuell={search.traktandum ? Number(search.traktandum) : undefined}
                onVerschieben={ordnen} onEntfernen={entfernen} onAufNaechste={aufNaechste}
                versendet={versendet} onNachfuehren={tr => m.nachfuehren.mutate(tr, { onSuccess: () => toast.show(TS.unterlagenNachgefuehrt), onError: fehler })} />
            ) : bearbeiten ? <VorschlagsZaehler id={s.id} /> : <Empty>{TS.leerLesen}</Empty>}
          </div>
          {bearbeiten ? <Vorschlagsliste sitzung={s} busy={busy} onAufnehmen={id => aufnehmen(id)} onEinplanen={body => m.aufnehmen.mutate({ id: s.id, body }, { onSuccess: () => toast.show(TS.aufgenommen), onError: fehler })} /> : null}
        </div>
      </div>
      {versendet ? <div className="body"><SitzungVerlauf id={s.id} version={s.version} /></div> : null}
      {versand ? <VersandDialog s={s} busy={m.versenden.isPending} onClose={() => setVersand(false)} onVersenden={versenden} /> : null}
    </section>
  );
}

/** Leere Traktandenliste (Z2): erklärt und nennt die Zahl der Vorschläge rechts. */
function VorschlagsZaehler({ id }: { id: string }) {
  const n = useAnzahlVorschlaege(id);
  return <Empty>{TS.leer(n)}</Empty>;
}

function useAnzahlVorschlaege(id: string): number {
  const v = useVorschlaege(id, true);
  return v.data?.gruppen.reduce((n, g) => n + g.traktanden.length, 0) ?? 0;
}

/** Verlauf der Sitzung nach dem Versand (UX-E13): Versand und alle Änderungen danach, markiert. */
function SitzungVerlauf({ id, version }: { id: string; version: number }) {
  const q = useQuery({
    queryKey: ['sitzung', 'verlauf', id, version] as const,
    queryFn: async ({ signal }) => (await api.GET('/v1/sitzungen/{id}/verlauf', { params: { path: { id } }, signal })).data!.items,
  });
  return <Verlauf titel={TS.verlauf} eintraege={q.data} laedt={q.isPending} fehler={q.error} erneut={() => void q.refetch()} />;
}
