/**
 * Traktandenliste der Sitzung (K3 Schritte 2–3): Position, Geschäft mit Antrag, Zeitbedarf und Zeitfenster,
 * Unterlagenstand als Badge mit Symbol und Text, «via SNS-VR» (UC-006 A1), Eingeladene. Reihenfolge mit «Nach oben» /
 * «Nach unten» und Alt+↑ / Alt+↓ (I-M2, G9: Ziehen ist nur Abkürzung). Fehlen Unterlagen, steht die Warnung am
 * Traktandum mit dem Ausweg «Auf nächste Sitzung verschieben» (UC-006 A2). Das feste Traktandum 1 «Bericht der
 * Programmleitung» (K3 Schritt 4) hat weder Griff noch Entfernen und trägt einen Hinweis; ohne Bericht ist es ein Platzhalter.
 */
import type { KeyboardEvent } from 'react';
import { Hinweis, Icon, Stand, fmtDatum, type StandFamilie } from '../../ui/index.ts';
import type { Traktandum } from './api.ts';
import { TS } from './texte.ts';

export const standFamilie = (stand: string): StandFamilie => (({
  geplant: 'entwurf', in_vorbereitung: 'entwurf', versendet: 'traktandiert', laufend: 'wartet', geschlossen: 'gesperrt', protokoll_versendet: 'positiv',
} as Record<string, StandFamilie>)[stand] ?? 'ruhend');

const UNTERLAGEN: Record<string, StandFamilie> = { bereit: 'positiv', quality_check_offen: 'wartet', fehlt: 'negativ', keine: 'ruhend' };

/** Minuten als «35 Min.» bzw. «2 h 50». */
export function fmtMinuten(n: number): string {
  if (n < 60) return TS.minuten(n);
  const m = n % 60;
  return `${Math.floor(n / 60)} h${m ? ` ${String(m).padStart(2, '0')}` : ''}`;
}

export interface TraktandenlisteProps {
  traktanden: Traktandum[];
  /** Bearbeiten erlaubt (sitzung:write bis zum Versand) */
  bearbeiten: boolean;
  /** Versandfrist als Text für die Warnung («in 2 Arbeitstagen») */
  versandRest: string;
  busy: boolean;
  aktuell?: number;
  onVerschieben(t: Traktandum, richtung: -1 | 1): void;
  onEntfernen(t: Traktandum): void;
  onAufNaechste(t: Traktandum): void;
}

export function Traktandenliste({ traktanden, bearbeiten, versandRest, busy, aktuell, onVerschieben, onEntfernen, onAufNaechste }: TraktandenlisteProps) {
  const taste = (e: KeyboardEvent, t: Traktandum) => {
    if (!bearbeiten || t.fest || !e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    onVerschieben(t, e.key === 'ArrowUp' ? -1 : 1);
  };
  return (
    <ol className="sz-liste" aria-label={TS.liste}>
      {traktanden.map((t, i) => {
        const name = t.projekt ? `${t.projekt.nummer} ${t.titel}` : t.titel;
        const u = t.unterlagen.stand;
        const platzhalter = t.fest && t.bezug.typ === 'sitzung';
        // über dem festen Traktandum 1 lässt sich nichts einordnen
        const obenGesperrt = i === 0 || (i === 1 && !!traktanden[0]?.fest);
        return (
          <li key={t.id} className={`sz-tr${aktuell === t.position ? ' on' : ''}`} data-traktandum={t.position ?? undefined}>
            <div className="sz-tr-k">
              {bearbeiten && !t.fest ? (
                // Griff: Alt+↑ / Alt+↓ ordnet um (I-M2), der Fokus folgt dem Traktandum
                <button type="button" className="sz-nr sz-griff" data-griff={t.position ?? undefined} onKeyDown={e => taste(e, t)}
                  aria-label={TS.griff(t.position ?? 0, name)} aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown">{t.position}</button>
              ) : <span className="sz-nr" aria-hidden="true">{t.position}</span>}
              <div className="sz-tr-b minw0">
                <h3 className="sz-tr-t">{t.projekt ? <span className="sz-pnr">{t.projekt.nummer}</span> : null}{t.titel}</h3>
                {t.antrag ? <p className="sz-antrag"><span className="sr">{TS.antrag}: </span>{t.antrag}</p> : null}
                <div className="sz-merk">
                  <span className="sz-zeit"><Icon name="clock" />{t.zeit ? `${t.zeit} · ` : ''}{t.dauerMin ? fmtMinuten(t.dauerMin) : TS.ohneZeit}</span>
                  <span className="sz-art">{t.artLabel}</span>
                  <Stand familie={UNTERLAGEN[u] ?? 'ruhend'} label={TS.unterlagen[u] ?? u}
                    detail={t.unterlagen.liste.map(x => x.hinweis).filter(Boolean).join(', ') || undefined} />
                  {t.viaSns ? <span className="pill st-pending" title={TS.viaSnsHinweis}>{TS.viaSns}</span> : null}
                  {t.vertraulich ? <span className="pill st-idle"><Icon name="lock" />{TS.vertraulich}</span> : null}
                  {t.verschobenVon ? <span className="pill st-idle">{TS.verschobenVon(fmtDatum(t.verschobenVon))}</span> : null}
                </div>
                <p className="sz-einl">
                  <span className="sz-sub">{TS.eingeladen}: </span>
                  {t.einladungen.length ? t.einladungen.map(e => `${e.name ?? '–'} (${TS.funktion[e.funktion] ?? e.funktion})`).join(', ') : TS.keineEinladung}
                </p>
              </div>
              {bearbeiten && !t.fest ? (
                <div className="sz-tr-a">
                  <button type="button" className="iconbtn" disabled={busy || obenGesperrt} onClick={() => onVerschieben(t, -1)} aria-label={TS.nachOben(name)}><Icon name="up" /></button>
                  <button type="button" className="iconbtn" disabled={busy || i === traktanden.length - 1} onClick={() => onVerschieben(t, 1)} aria-label={TS.nachUnten(name)}><Icon name="down" /></button>
                  <button type="button" className="iconbtn" disabled={busy} onClick={() => onEntfernen(t)} aria-label={`${TS.entfernen}: ${name}`} title={TS.entfernen}><Icon name="x" /></button>
                </div>
              ) : null}
            </div>
            {bearbeiten && t.fest ? <Hinweis stufe="hinweis">{platzhalter ? `${TS.festHinweis} ${TS.festPlatzhalter}` : TS.festHinweis}</Hinweis> : null}
            {bearbeiten && !t.fest && (u === 'fehlt' || u === 'quality_check_offen') ? (
              <Hinweis stufe="warnung" aktion={<button type="button" className="btn" disabled={busy} onClick={() => onAufNaechste(t)}><Icon name="calendar" />{TS.verschieben}</button>}>
                {u === 'fehlt' ? TS.unterlagenWarnung(name, versandRest) : TS.qcWarnung(name)}
              </Hinweis>
            ) : null}
            {t.viaSns && bearbeiten ? <p className="sz-sub sz-sns"><Icon name="info" />{TS.viaSnsHinweis}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}
