/**
 * Projektakte › Vertrag › Quality-Check (UI-12; Kernablauf K2 Schritt 7; DM.02.05; UC-002 Schritt 9, A5; UC-003
 * Schritt 7, A4): Prüfansicht der Unternehmensentwicklung. Kapitel nur lesbar (Sprung in die Projektakte), Kommentar je
 * Kapitel, Checkliste (Pflichtangaben der Phase, Einhaltung PM-Handbuch); «Quality-Check bestätigen» und «Zurück an
 * die Projektleitung» je mit Wirkung davor (I-R1 Stufe 3). Die Oberfläche prüft vorab, der Server entscheidet (I-P6).
 * Kommentare bleiben als Entwurf im Speicher der Sitzung, bis sie gesendet sind: Der Sprung ins Kapitel und zurück
 * verliert nichts (Z7 sinngemäss, I-R3).
 */
import { describeError, useIamConfig } from '@vollholz/iam-web';
import { useEffect, useId, useState } from 'react';
import { isConflict, statusOf } from '../../api/index.ts';
import { Empty, ErrorState, fmtDatum, fmtPhase, Hinweis, Icon, Skelett, T, TeilFehler, useToast, useVerzoegert, type Phase } from '../../ui/index.ts';
import { usePflichtangaben, useProjekt, useVertrag, type Version } from './api.ts';
import { KAPITEL } from './felder.ts';
import { usePruefung, usePruefungMutations, type PruefungLoaded } from './PruefenApi.ts';
import { TP } from './PruefenTexte.ts';
import { useNeuLaden } from './neuLaden.ts';
import { TV } from './texte.ts';
import './Pruefen.css';

export function PruefenPage({ nummer }: { nummer: string }) {
  const projekt = useProjekt(nummer);
  const vertrag = useVertrag(projekt.data?.id);
  const entwurf = vertrag.data?.entwurf ?? null;
  const pruefung = usePruefung(entwurf);
  const skelett = useVerzoegert(projekt.isPending || vertrag.isPending || (!!entwurf && pruefung.isPending));
  if (projekt.isPending || vertrag.isPending || (entwurf && pruefung.isPending)) {
    return <div aria-busy="true"><span className="sr" role="status">{T.common.loading}</span>{skelett ? <Skelett zeilen={6} /> : null}</div>;
  }
  // ein gescheitertes Neuladen behält den geladenen Stand (und die Eingaben); nur ohne Daten der Fehler (Z5)
  const fehler = projekt.error ?? vertrag.error ?? pruefung.error;
  if (fehler && !(projekt.data && vertrag.data && (!entwurf || pruefung.data))) return <ErrorState error={fehler} onRetry={() => { void projekt.refetch(); void vertrag.refetch(); void pruefung.refetch(); }} />;
  const version = vertrag.data?.versionen.find(v => v.id === entwurf);
  if (!projekt.data || !version || !pruefung.data) return <Empty>{TP.keinEntwurf}</Empty>;
  return <Pruefansicht nummer={nummer} projektId={projekt.data.id} version={version} geladen={pruefung.data} neuLaden={() => pruefung.refetch()} />;
}

const entwurfSchluessel = (versionId: string) => `ppm.qc.kommentare.${versionId}`;

/** Kommentar-Entwurf der Prüfung je Version (ohne Speicher: nur im Zustand der Seite). */
function entwurfLesen(versionId: string): Record<number, string> {
  try {
    const roh = sessionStorage.getItem(entwurfSchluessel(versionId));
    const w: unknown = roh ? JSON.parse(roh) : null;
    return w && typeof w === 'object' ? w as Record<number, string> : {};
  } catch { return {}; }
}

function entwurfSchreiben(versionId: string, k: Record<number, string>): void {
  try {
    if (Object.values(k).some(t => t.trim())) sessionStorage.setItem(entwurfSchluessel(versionId), JSON.stringify(k));
    else sessionStorage.removeItem(entwurfSchluessel(versionId));
  } catch { /* ohne Speicher bleibt der Entwurf nur auf der Seite */ }
}

function Pruefansicht({ nummer, projektId, version, geladen, neuLaden }: { nummer: string; projektId: string; version: Version; geladen: PruefungLoaded; neuLaden(): Promise<{ error: unknown }> }) {
  const id = useId();
  const toast = useToast();
  const { qualityCheck } = usePruefungMutations(projektId);
  const laden = useNeuLaden(neuLaden, () => qualityCheck.reset());
  const pflicht = usePflichtangaben(version.id);
  const { router: { Link } } = useIamConfig();
  const [kommentare, setKommentare] = useState<Record<number, string>>(() => entwurfLesen(geladen.pruefung.versionId));
  useEffect(() => { entwurfSchreiben(geladen.pruefung.versionId, kommentare); }, [geladen.pruefung.versionId, kommentare]);
  const [ohneKommentar, setOhneKommentar] = useState(false);
  const p = geladen.pruefung;
  const phase = fmtPhase(version.zielphase as Phase);
  const liste = Object.entries(kommentare).filter(([, t]) => t.trim()).map(([k, t]) => ({ kapitel: Number(k), text: t.trim() }));
  const fehlend = (pflicht.data?.angaben ?? []).filter(a => !a.erfuellt).length;
  const darf = p.can.qualityCheck;
  const frueher = p.qualityChecks.filter(q => q.ergebnis === 'rueckmeldung');
  const serverFehler = qualityCheck.error && statusOf(qualityCheck.error) !== 412 ? describeError(qualityCheck.error) : null;

  const senden = (ergebnis: 'bestaetigt' | 'rueckmeldung') => {
    if (ergebnis === 'rueckmeldung' && !liste.length) { setOhneKommentar(true); return; }
    setOhneKommentar(false);
    qualityCheck.mutate({ id: p.versionId, etag: geladen.etag, body: { ergebnis, ...(liste.length ? { kommentare: liste } : {}) } }, {
      onSuccess: () => { setKommentare({}); toast.show(ergebnis === 'bestaetigt' ? TP.bestaetigt : TP.zurueckgegeben); },
    });
  };

  return (
    <section className="qc" aria-labelledby={`${id}-h`}>
      <header className="qc-kopf">
        <h2 id={`${id}-h`} className="vt-h">{TP.pruefenTitel} · {TP.version(p.nummer, phase)}</h2>
        <Link className="btn sm" to={`/projekte/${nummer}/vertrag?version=entwurf`}><Icon name="doc" />{TP.zurueckZumVertrag}</Link>
      </header>
      {p.stand !== 'in_pruefung' ? <Hinweis stufe="hinweis">{TP.nichtInPruefung(TV.stand[p.stand])}</Hinweis>
        : !darf ? <Hinweis stufe="hinweis">{TP.nurUe}</Hinweis> : null}

      <div className="qc-flaeche">
        <ol className="qc-kapitel" aria-label={TP.kapitel}>
          {KAPITEL.map(k => (
            <li key={k.nr} className="qc-k">
              <div className="qc-k-kopf">
                <span className="vt-nr">{k.nr}</span> <span className="qc-k-t">{k.titel}</span>
                <Link className="btn sm" to={`/projekte/${nummer}/vertrag?version=entwurf&kapitel=${k.nr}`}><Icon name="eye" /><span className="sr">{TP.kapitelAnsehen(k.nr)}</span></Link>
              </div>
              {darf ? (
                <div className="field qc-feld">
                  <label htmlFor={`${id}-k${k.nr}`} className="sr">{TP.kommentar(k.nr, k.titel)}</label>
                  <textarea id={`${id}-k${k.nr}`} rows={2} maxLength={2000} value={kommentare[k.nr] ?? ''} placeholder={TP.kommentarHint}
                    onChange={e => setKommentare({ ...kommentare, [k.nr]: e.target.value })} />
                </div>
              ) : null}
            </li>
          ))}
        </ol>

        <aside className="qc-panel" aria-labelledby={`${id}-c`}>
          <h3 id={`${id}-c`} className="grp-h">{TP.checkliste}</h3>
          <ul className="qc-check">
            {pflicht.error ? <li><TeilFehler was={TP.pflichtangaben} error={pflicht.error} onRetry={() => void pflicht.refetch()} /></li>
              : <li><Icon name={fehlend ? 'warn' : 'check'} />{pflicht.isPending ? T.common.loading : TP.checkPflicht(fehlend)}</li>}
            <li><Icon name="info" />{TP.checkHandbuch}</li>
          </ul>
          {frueher.length ? (
            <>
              <h3 className="grp-h">{TP.fruehere}</h3>
              <ul className="qc-frueher">
                {frueher.map(q => (
                  <li key={q.id}>
                    <strong>{TP.rueckmeldungVom(fmtDatum(q.at))}</strong>
                    <ul>{q.kommentare.map(k => <li key={k.kapitel}><span className="vt-nr">{k.kapitel}</span> {k.text}</li>)}</ul>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {darf ? (
            <div className="qc-aktion">
              {isConflict(qualityCheck.error) ? (
                <Hinweis stufe="warnung" live aktion={<button type="button" className="btn sm" disabled={laden.laedt} onClick={() => void laden.laden()}>{TP.neuLaden}</button>}>{TP.konflikt}</Hinweis>
              ) : null}
              {serverFehler ? <Hinweis stufe="sperre" live>{statusOf(qualityCheck.error) === 409 && serverFehler.detail?.includes('Projektorganisation') ? `${serverFehler.detail} ${TP.organisationFehlt}` : serverFehler.detail ?? serverFehler.title}</Hinweis> : null}
              <p className="small" role="status">{TP.kommentareAnzahl(liste.length)}</p>
              {liste.length ? <p className="muted small">{TP.entwurfBleibt}</p> : null}
              <p className="small" id={`${id}-wb`}>{TP.bestaetigenWirkung}</p>
              <button type="button" className="btn primary" aria-describedby={`${id}-wb`} disabled={qualityCheck.isPending || isConflict(qualityCheck.error)} onClick={() => senden('bestaetigt')}>
                <Icon name="check" />{TP.bestaetigen}
              </button>
              <p className="small" id={`${id}-wz`}>{TP.zurueckgebenWirkung}</p>
              {ohneKommentar ? <Hinweis stufe="sperre" live>{TP.zurueckgebenFehlt}</Hinweis> : null}
              <button type="button" className="btn" aria-describedby={`${id}-wz`} disabled={qualityCheck.isPending || isConflict(qualityCheck.error)} onClick={() => senden('rueckmeldung')}>
                <Icon name="reply" />{TP.zurueckgeben}
              </button>
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
