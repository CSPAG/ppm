/**
 * Periode abschliessen (K1 Prüfen Schritt 5, UC-005 Schritt 5 und A3): Wirkung vor dem Klick (I-R1 Stufe 3) – Anzahl
 * Projekte, geprüft, nicht gemeldet mit Werten der Vorperiode (Warnung, A-11), Freigabe des Dashboards ab dem 1. Sind
 * eingereichte Berichte ungeprüft, sperrt die Regel den Abschluss; der Ausweg zeigt sie mit einem Klick.
 */
import { Dialog, fmtDatum, fmtPeriode, Hinweis, Icon } from '../../ui/index.ts';
import type { Periodenstand } from './api.ts';
import { periodePlus } from './search.ts';
import { TM } from './texte.ts';

export interface AbschlussDialogProps {
  kopf: Periodenstand;
  onClose(): void;
  abschliessen(): void;
  eingereichteZeigen(): void;
  beschaeftigt: boolean;
}

export function AbschlussDialog({ kopf, onClose, abschliessen, eingereichteZeigen, beschaeftigt }: AbschlussDialogProps) {
  const p = fmtPeriode(kopf.periode);
  const a = kopf.abschluss;
  const ab = fmtDatum(`${periodePlus(kopf.periode, 1)}-01`);
  return (
    <Dialog title={TM.abschluss.titel(p)} onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose} data-autofocus>{TM.abschluss.weiter}</button>
      {a.moeglich ? <button type="button" className="btn primary" onClick={abschliessen} disabled={beschaeftigt}><Icon name="calendar-check" />{TM.aktion.abschliessen}</button> : null}
    </>}>
      {/* ungeprüfte Berichte: Warnung statt Sperre, abschliessen geht mit Vermerk (UC-005 Schritt 5, UX-E12) */}
      {a.hinweis ? (
        <Hinweis stufe="warnung" aktion={<button type="button" className="btn sm" onClick={eingereichteZeigen}>{TM.aktion.eingereichteZeigen}</button>}>{a.hinweis}</Hinweis>
      ) : null}
      <p>{TM.abschluss.wirkung(kopf.anzahl.projekte, a.geprueft, a.nichtGemeldet)}</p>
      {a.nichtGemeldet ? <Hinweis stufe="warnung">{TM.abschluss.nichtGemeldet(a.nichtGemeldet, fmtPeriode(kopf.vorperiode).split(' ')[0]!)}</Hinweis> : null}
      <p>{TM.abschluss.dashboard(p.split(' ')[0]!, ab)}</p>
    </Dialog>
  );
}
