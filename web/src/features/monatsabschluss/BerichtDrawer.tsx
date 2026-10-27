/**
 * Bericht in der breiten Schublade (K1 Prüfen Schritt 2, UC-005 Schritt 2): Auffälligkeiten oben, offene Rückfrage,
 * Bericht neben der Vorperiode mit markierten Unterschieden (Text «geändert», nicht nur Farbe, Q-B5), Rückfragen und
 * die Aktionen der Zeile (Bestätigen, Rückfrage, Einfordern, Rückgängig).
 */
import { useEffect, useId, useRef, useState } from 'react';
import { Drawer, ErrorState, fmtDatum, fmtPeriode, fmtZeitpunkt, Hinweis, Icon, Loading, statusText } from '../../ui/index.ts';
import { useBerichtVergleich, useRueckfragen, type Bericht, type Zeile } from './api.ts';
import { auffText, StandZelle, StatusZelle, statusVon } from './anzeige.tsx';
import { TM } from './texte.ts';

const DIM = ['inhalt', 'termin', 'ressourcen', 'budget'] as const;
const TB = TM.bericht;

type Feld = { key: string; label: string; wert(b: Bericht): string };

const FELDER: Feld[] = [
  { key: 'status', label: TB.felder.status!, wert: b => (statusVon(b.status) ? statusText({ status: statusVon(b.status)! }) : '–') },
  { key: 'trend', label: TB.felder.trend!, wert: b => (b.trend ? TB.trend[b.trend] ?? b.trend : '–') },
  { key: 'phase', label: TB.felder.phase!, wert: b => b.phase },
  { key: 'abschlussPer', label: TB.felder.abschlussPer!, wert: b => (b.abschlussPer ? fmtDatum(b.abschlussPer, '1900-01-01') : '–') },
  { key: 'naechsterMeilenstein', label: TB.felder.naechsterMeilenstein!, wert: b => b.naechsterMeilenstein || '–' },
  ...DIM.map(d => ({
    key: `abweichung.${d}`, label: TB.dimension[d]!,
    wert: (b: Bericht) => {
      const a = b.abweichung[d];
      const stufe = a.stufe ? TB.stufe[a.stufe] ?? a.stufe : '–';
      return a.kommentar ? `${stufe} · ${a.kommentar}` : stufe;
    },
  })),
  { key: 'abhaengigkeiten', label: TB.felder.abhaengigkeiten!, wert: b => b.abhaengigkeiten || '–' },
  { key: 'entscheide', label: TB.felder.entscheide!, wert: b => b.entscheide || '–' },
  { key: 'begruendung', label: TB.felder.begruendung!, wert: b => b.begruendung || '–' },
  { key: 'massnahme', label: TB.felder.massnahme!, wert: b => b.massnahme || '–' },
  { key: 'entscheidNoetig', label: TB.felder.entscheidNoetig!, wert: b => (b.entscheidNoetig ? TB.ja : TB.nein) },
];

export interface BerichtDrawerProps {
  z: Zeile;
  periode: string;
  onClose(): void;
  bestaetigen(z: Zeile): void;
  zuruecknehmen(z: Zeile): void;
  rueckfrage(z: Zeile, text: string, fertig: () => void): void;
  einfordern(z: Zeile): void;
  beschaeftigt: boolean;
}

export function BerichtDrawer({ z, periode, onClose, ...a }: BerichtDrawerProps) {
  const vorperiode = z.vorperiode?.periode ?? null;
  const q = useBerichtVergleich(z.stand === 'ausstehend' && !z.entwurf ? undefined : z.projektId, periode, vorperiode);
  const rf = useRueckfragen(z.stand === 'ausstehend' ? undefined : z.projektId, periode);
  const [text, setText] = useState<string | null>(null);
  const [fehler, setFehler] = useState(false);
  const tid = useId();
  const ta = useRef<HTMLTextAreaElement>(null);
  const offen = text !== null;
  useEffect(() => { if (offen) ta.current?.focus(); }, [offen]);

  const footer = (
    <>
      {z.can.bestaetigen ? <button type="button" className="btn primary" disabled={a.beschaeftigt} onClick={() => a.bestaetigen(z)}><Icon name="check" />{TM.aktion.bestaetigen}</button> : null}
      {z.can.rueckfrage && text === null ? <button type="button" className="btn" onClick={() => setText('')}><Icon name="comment" />{TM.aktion.rueckfrage}</button> : null}
      {z.can.zuruecknehmen ? <button type="button" className="btn" disabled={a.beschaeftigt} onClick={() => a.zuruecknehmen(z)}>{TM.aktion.zuruecknehmen}</button> : null}
      {z.can.einfordern ? <button type="button" className="btn" disabled={a.beschaeftigt} onClick={() => a.einfordern(z)}><Icon name="send" />{TM.aktion.einfordern}</button> : null}
    </>
  );
  const hatFooter = z.can.bestaetigen || z.can.rueckfrage || z.can.zuruecknehmen || z.can.einfordern;

  return (
    <Drawer title={TB.titel(z.projektNummer, z.projektName)} onClose={onClose} footer={hatFooter ? footer : undefined}
      actions={<><StandZelle z={z} /><StatusZelle z={z} /></>}>
      <div className="pad ma-bericht">
        {z.auffaelligkeiten.length ? (
          <Hinweis stufe="warnung"><span>{z.auffaelligkeiten.map(auffText).join(' · ')}</span></Hinweis>
        ) : null}
        {z.rueckfrage ? <Hinweis stufe="hinweis"><strong>{TM.rueckfrage.offen}: </strong>{z.rueckfrage.text}</Hinweis> : null}

        {text !== null ? (
          <div className="ma-rf-drawer">
            <div className="field">
              <label htmlFor={tid}>{TM.rueckfrage.label}</label>
              <textarea id={tid} rows={4} maxLength={2000} value={text} placeholder={TM.rueckfrage.platzhalter} ref={ta}
                aria-invalid={fehler || undefined} aria-describedby={fehler ? `${tid}-f` : undefined}
                onChange={e => { setText(e.target.value); setFehler(false); }} />
              {fehler ? <div id={`${tid}-f`} className="ferr" role="alert">{TM.rueckfrage.leer}</div> : null}
            </div>
            <div className="ma-rf-a">
              <button type="button" className="btn primary sm" disabled={a.beschaeftigt}
                onClick={() => { if (!text.trim()) { setFehler(true); return; } a.rueckfrage(z, text.trim(), () => setText(null)); }}>
                <Icon name="send" />{TM.aktion.senden}
              </button>
              <button type="button" className="btn ghost sm" onClick={() => setText(null)}>{TM.aktion.abbrechen}</button>
            </div>
          </div>
        ) : null}

        {z.stand === 'ausstehend' && !z.entwurf ? <p className="muted">{TB.ausstehend}</p> : null}
        {q.isPending && q.fetchStatus !== 'idle' ? <Loading /> : null}
        {q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : null}
        {q.data?.bericht ? <Vergleich bericht={q.data.bericht} vor={q.data.vor} periode={periode} vorperiode={vorperiode} /> : null}

        {rf.data?.length ? (
          <section aria-labelledby={`${tid}-rf`}>
            <h3 id={`${tid}-rf`} className="grp-h">{TM.rueckfrage.verlauf}</h3>
            <ul className="ma-rf-liste">
              {rf.data.map(r => (
                <li key={r.id}>
                  <p>{r.text}</p>
                  <div className="note">
                    {TM.rueckfrage.gestellt(r.gestelltBy?.name ?? '–', fmtZeitpunkt(r.gestelltAt))}
                    {r.beantwortetAt ? ` · ${TM.rueckfrage.beantwortet(fmtZeitpunkt(r.beantwortetAt))}` : ''}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </Drawer>
  );
}

function Vergleich({ bericht, vor, periode, vorperiode }: { bericht: Bericht; vor: Bericht | null; periode: string; vorperiode: string | null }) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="grp-h">{TB.vergleich}</h3>
      {bericht.eingereichtAt ? <p className="note">{TB.eingereichtAm(fmtZeitpunkt(bericht.eingereichtAt))}</p> : null}
      <table className="ma-vergleich">
        <thead>
          <tr>
            <th scope="col">{TB.feld}</th>
            <th scope="col">{fmtPeriode(periode)}</th>
            <th scope="col">{vorperiode ? fmtPeriode(vorperiode) : TB.keineVorperiode}</th>
          </tr>
        </thead>
        <tbody>
          {FELDER.map(f => {
            const jetzt = f.wert(bericht);
            const vorher = vor ? f.wert(vor) : '–';
            const anders = !!vor && jetzt !== vorher;
            return (
              <tr key={f.key} className={anders ? 'diff' : undefined}>
                <th scope="row">{f.label}</th>
                <td>{jetzt}{anders ? <span className="ma-geaendert"> · {TB.geaendert}</span> : null}</td>
                <td className="muted">{vorher}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
